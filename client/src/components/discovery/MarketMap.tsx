import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { clock } from '../../lib/discovery';
import type { Market, NearbyMarket } from '../../lib/types';
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

const TILES = {
  map: {
    name: 'Map',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
  },
} as const;

export type BaseLayer = keyof typeof TILES;

/**
 * What the list needs from an imperative map: point at a market.
 *
 * Only `focus` is exposed. Panning, zooming and tile state belong to the map, and lifting any
 * of them into React would mean two owners of the same viewport.
 */
export interface MarketMapHandle {
  focus(id: string): void;
}

export interface MarketMapProps {
  markets: (Market | NearbyMarket)[];
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

export const MarketMap = forwardRef<MarketMapHandle, MarketMapProps>(function MarketMap(
  { markets, origin = null, selectedId = null, onSelect, onOpen },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [base, setBase] = useState<BaseLayer>('map');
  const markers = useRef<L.LayerGroup | null>(null);
  const byId = useRef(new Map<string, L.Marker>());
  const fitted = useRef('');
  const tile = useRef<L.TileLayer | null>(null);
  // Read from inside Leaflet callbacks, which are attached once and would otherwise close over
  // the props from the first render.
  const openRef = useRef(onOpen);
  openRef.current = onOpen;

  useImperativeHandle(ref, () => ({
    focus(id) {
      const marker = byId.current.get(id);
      if (!marker || !map) return;
      map.panTo(marker.getLatLng());
      marker.openPopup();
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

    const resize = new ResizeObserver(() => created.invalidateSize());
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

    const layer = L.tileLayer(TILES[base].url, {
      attribution: TILES[base].attribution,
      maxZoom: 19,
    });
    layer.addTo(map);
    tile.current?.remove();
    tile.current = layer;
  }, [map, base]);

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
        color: '#8ab6e0',
        weight: 1,
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(group);
    }

    // Fitting follows the *result set*, not the redraw. Selecting a market repaints the same
    // pins with one highlighted, and refitting then would undo the pan that just showed it.
    const signature = markets.map((m) => m.id).join(',');
    const points = markets.map((m) => [m.lat, m.lng] as [number, number]);
    if (origin) points.push([origin.lat, origin.lng] as [number, number]);

    if (signature !== fitted.current) {
      fitted.current = signature;
      if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points).pad(0.15), { animate: false });
      } else if (points[0]) {
        map.setView(points[0], 14, { animate: false });
      }
    }
  }, [map, markets, origin, onSelect, selectedId]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={host}
        className={`ml-map-frame${base === 'map' ? ' ml-map-toned' : ''}`}
        role="region"
        aria-label="Market map"
        tabIndex={-1}
      />

      <div className="absolute right-3 top-3 z-[500] flex gap-1 rounded-full border border-line bg-surface p-1">
        {(Object.keys(TILES) as BaseLayer[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setBase(key)}
            aria-pressed={base === key}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              base === key ? 'bg-block text-on-block' : 'text-muted hover:bg-elevated hover:text-primary'
            }`}
          >
            {TILES[key].name}
          </button>
        ))}
      </div>
    </div>
  );
});

export default MarketMap;
