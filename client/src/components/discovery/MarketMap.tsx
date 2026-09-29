import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { clock } from '../../lib/discovery';
import type { Market, NearbyMarket, PlaceCandidate } from '../../lib/types';
import { formatDistance } from '../../utils/distance';

/**
 * The market map: OpenStreetMap tiles, our markers.
 *
 * Leaflet is driven imperatively here rather than through a React wrapper. There are about
 * forty markers on this screen, not four thousand, so the reconciliation a wrapper exists for
 * is a loop that clears and redraws — and the wrapper would be one more dependency to wait on
 * when Leaflet's own release moves.
 *
 * Markers are `divIcon`s shaped in CSS, not the PNG pin set: Leaflet's default icons resolve
 * through `imageSize`-style asset URLs that a bundler rewrites, and a pin built from a path
 * matches the token palette on both tile layers.
 */

const MAP_TILES = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
} as const;

/**
 * What the list needs from an imperative map: point at a row, market or mapped place.
 *
 * Only `focus` is exposed. Panning, zooming and tile state belong to the map, and lifting any
 * of them into React would mean two owners of the same viewport.
 */
export interface MarketMapHandle {
  focus(id: string): void;
}

export interface MarketMapProps {
  markets: (Market | NearbyMarket)[];
  /**
   * Places the gazetteer answers with that have no row here.
   *
   * Drawn as hollow rings, never as pins: a visitor who cannot tell a tracked market from a
   * name on a map will phone around for opening hours that this app is promising.
   */
  places?: PlaceCandidate[];
  /** Where the distances were measured from, when there is one worth drawing. */
  origin?: { lat: number; lng: number } | null;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onOpen?: (id: string) => void;
}

function pin(active: boolean, open: boolean): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<span class="ml-pin${active ? ' ml-pin-active' : ''}${open ? ' ml-pin-open' : ''}"></span>`,
    iconSize: [active ? 26 : 18, active ? 26 : 18],
    iconAnchor: [active ? 13 : 9, active ? 13 : 9],
    popupAnchor: [0, -12],
  });
}

/** Mapped places need a marker that stays visible over busy street tiles. */
function placePin(active: boolean): L.DivIcon {
  const size = active ? 34 : 22;
  return L.divIcon({
    className: '',
    html: `<span class="ml-place-pin${active ? ' ml-place-pin-active' : ''}"><span></span></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Popup content built from nodes rather than an HTML string.
 *
 * Market names come from rows an admin typed, and `setContentView` would take them as markup.
 * `textContent` cannot.
 */
function popupContent(market: Market | NearbyMarket, onOpen?: (id: string) => void): HTMLElement {
  const box = document.createElement('div');
  box.className = 'ml-popup';

  const name = document.createElement('p');
  name.className = 'ml-popup-title';
  name.textContent = market.name;
  box.append(name);

  const hours = document.createElement('p');
  hours.className = 'ml-popup-meta';
  hours.textContent = `${clock(market.opens_at)}–${clock(market.closes_at)} · ${
    market.is_open_now ? 'open now' : 'shut now'
  }`;
  box.append(hours);

  if ('distance_km' in market) {
    const distance = document.createElement('p');
    distance.className = 'ml-popup-meta ml-popup-num';
    distance.textContent = `${formatDistance(market.distance_km)} away`;
    box.append(distance);
  }

  if (onOpen) {
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'ml-popup-link';
    link.textContent = 'Open market';
    link.addEventListener('click', () => onOpen(market.id));
    box.append(link);
  }

  return box;
}

/**
 * The same popup for a place nobody has approved yet.
 *
 * No hours and no "Open market" button, because there is no row to read either from — the
 * popup says so rather than leaving the ring to look like a pin that failed to load.
 */
function placePopupContent(place: PlaceCandidate): HTMLElement {
  const box = document.createElement('div');
  box.className = 'ml-popup';

  const name = document.createElement('p');
  name.className = 'ml-popup-title';
  name.textContent = place.name;
  box.append(name);

  // Most mapped gates carry a name and nothing else, and an empty line is a gap, not an answer.
  const whereText = [place.address, [place.city, place.state].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' · ');
  if (whereText !== '') {
    const where = document.createElement('p');
    where.className = 'ml-popup-meta';
    where.textContent = whereText;
    box.append(where);
  }

  const note = document.createElement('p');
  note.className = 'ml-popup-meta';
  note.textContent = 'On the map, not on MarketLink yet';
  box.append(note);

  return box;
}

export const MarketMap = forwardRef<MarketMapHandle, MarketMapProps>(function MarketMap(
  { markets, places = [], origin = null, selectedId = null, onSelect, onOpen },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [mapSizeRevision, setMapSizeRevision] = useState(0);
  /**
   * Pins and rings, under the id the list already has for them.
   *
   * A market answers to its row id and a mapped place to its node ref, and the two never collide,
   * so one lookup serves both when a list card asks the map to focus that place.
   */
  const markers = useRef<L.LayerGroup | null>(null);
  const byId = useRef(new Map<string, L.Marker | L.CircleMarker>());
  const fitted = useRef('');
  const tile = useRef<L.TileLayer | null>(null);
  /**
   * The row the list last pointed at.
   *
   * Choosing something re-renders and the redraw below clears and rebuilds every layer. Keep the
   * focus request and apply it again once the replacement marker exists.
   */
  const pointed = useRef<string | null>(null);
  // Read from inside Leaflet callbacks, which are attached once and would otherwise close over
  // the props from the first render.
  const openRef = useRef(onOpen);
  openRef.current = onOpen;

  function show(id: string) {
    const marker = byId.current.get(id);
    // Keep a focus request pending if the map or its current result markers are still loading.
    if (!marker) return;
    if (!map) return;
    // List hover should bring the place into view at street level without opening a popup.
    // Preserve closer zoom levels if the visitor has already zoomed further in.
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 18), { duration: 0.85 });
  }

  useImperativeHandle(ref, () => ({
    focus(id) {
      pointed.current = id;
      show(id);
    },
  }));

  useEffect(() => {
    if (!host.current) return;

    const created = L.map(host.current, {
      center: origin ? [origin.lat, origin.lng] : [6.5244, 3.3792],
      zoom: 11,
      // A scroll over a map should scroll the page until the map is the thing being aimed at.
      scrollWheelZoom: false,
      zoomControl: true,
    });
    created.on('click', () => created.scrollWheelZoom.enable());

    markers.current = L.layerGroup().addTo(created);
    setMap(created);

    const resize = new ResizeObserver(() => {
      if (!host.current?.clientWidth || !host.current.clientHeight) return;
      created.invalidateSize({ pan: false });
      setMapSizeRevision((revision) => revision + 1);
    });
    resize.observe(host.current);

    return () => {
      resize.disconnect();
      created.remove();
      markers.current = null;
      setMap(null);
    };
    // Once per mount: the container is not recreated when the list changes.
  }, []);

  useEffect(() => {
    if (!map) return;

    const layer = L.tileLayer(MAP_TILES.url, {
      attribution: MAP_TILES.attribution,
      maxZoom: 19,
    });
    layer.addTo(map);
    tile.current?.remove();
    tile.current = layer;
  }, [map]);

  useEffect(() => {
    if (!map || !markers.current) return;

    const group = markers.current;
    group.clearLayers();
    byId.current.clear();

    for (const market of markets) {
      const active = market.id === selectedId;
      const marker = L.marker([market.lat, market.lng], {
        icon: pin(active, market.is_open_now),
        title: market.name,
        alt: `${market.name}, ${market.is_open_now ? 'open now' : 'shut now'}`,
        riseOnHover: true,
        zIndexOffset: active ? 1000 : 0,
      });

      marker.bindPopup(() => popupContent(market, openRef.current), { closeButton: true });
      marker.on('click', () => onSelect?.(market.id));
      marker.addTo(group);
      byId.current.set(market.id, marker);
    }

    if (origin) {
      L.circle([origin.lat, origin.lng], {
        radius: 700,
        className: 'ml-origin',
        weight: 1,
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(group);
    }

    for (const place of places) {
      const active = place.ref === selectedId;
      const ring = L.marker([place.lat, place.lng], {
        icon: placePin(active),
        title: place.name,
        alt: `${place.name}, mapped place not yet listed on MarketLink${active ? ', selected' : ''}`,
        riseOnHover: true,
        zIndexOffset: active ? 2000 : 500,
      })
        .bindTooltip(place.name, {
          permanent: active,
          direction: 'top',
          offset: [0, -14],
          className: 'ml-place-tooltip',
        })
        .bindPopup(() => placePopupContent(place), { closeButton: true })
        .addTo(group);
      byId.current.set(place.ref, ring);
    }

    // Fitting follows the *result set*, not the redraw. Selecting a market repaints the same
    // pins with one highlighted, and refitting then would undo the pan that just showed it —
    // so the guard is a signature of what is on the map, and a new search term changes it.
    const signature = [...markets.map((m) => m.id), ...places.map((p) => p.ref)].join(',');
    const points = markets.map((m) => [m.lat, m.lng] as [number, number]);
    // A ring only moves the viewport when there is nothing of ours to look at: typing a town
    // that has no approved market still has to land on the gates the gazetteer named, or they
    // sit off-screen and the search looks broken. With our own rows present they win, or a
    // visitor inside ten kilometres of Lagos would have the map pull back to Ghana for one ring.
    if (markets.length === 0) points.push(...places.map((p) => [p.lat, p.lng] as [number, number]));
    if (origin) points.push([origin.lat, origin.lng] as [number, number]);

    if (signature !== fitted.current && host.current?.clientWidth && host.current.clientHeight) {
      fitted.current = signature;
      if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points).pad(0.15), { animate: false });
      } else if (points[0]) {
        map.setView(points[0], 14, { animate: false });
      }
    }

    // Once, and only as the answer to that request: replaying it on every redraw would drag the
    // viewport back to a row the visitor has since panned away from.
    if (pointed.current) {
      const id = pointed.current;
      pointed.current = null;
      show(id);
    }
  }, [map, markets, places, origin, onSelect, selectedId, mapSizeRevision]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={host}
        className="ml-map-frame ml-map-toned"
        role="region"
        aria-label="Market map"
        tabIndex={-1}
      />
    </div>
  );
});

export default MarketMap;
