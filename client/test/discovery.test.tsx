import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './helpers/render';
import { LAGOS, clock, dayList, marketBox, searchParams } from '../src/lib/discovery';
import { formatDistance } from '../src/utils/distance';

/**
 * The discovery screens, driven through the same fetch stub the auth tests use.
 *
 * What matters here is the wiring between a filter and a request: a screen that renders a
 * market it was never given, or that asks the wrong endpoint for a coordinate, both look
 * correct in a screenshot and are wrong on the wire.
 */

const MILE_12 = '11111111-1111-4111-8111-111111111111';
const BALOGUN = '22222222-2222-4222-8222-222222222222';
const ADEYEMI = '33333333-3333-4333-8333-333333333333';

const market = (over: Record<string, unknown> = {}) => ({
  id: MILE_12,
  name: 'Mile 12 Market',
  address: 'Ikorodu Road, Mile 12, Ojo',
  city: 'Lagos',
  state: 'Lagos',
  lat: 6.5955,
  lng: 3.3433,
  operating_days: ['tue', 'thu', 'sat'],
  opens_at: '07:00:00',
  closes_at: '17:00:00',
  image_url: '/img/markets/mile-12.jpg',
  is_open_now: false,
  ...over,
});

const nearRow = (over: Record<string, unknown> = {}) => ({ ...market(over), distance_km: 8.84 });

/** Mapo Market, as `/places/markets` answered for `Ibadan` on 2026-09-26. */
const place = (over: Record<string, unknown> = {}) => ({
  ref: 'n3084974661',
  name: 'Mapo Market',
  lat: 7.3762823,
  lng: 3.8957192,
  address: 'Mapo Street, Ìbàdàn, 200252, Oyo, Nigeria',
  city: 'Ìbàdàn',
  state: 'Oyo',
  country: 'Nigeria',
  kind: 'amenity/marketplace',
  ...over,
});

const farmer = (over: Record<string, unknown> = {}) => ({
  id: ADEYEMI,
  stall_name: 'Adeyemi Farms',
  contact_person: 'Bola Adeyemi',
  description: 'Leaf vegetables and tubers grown at Epe, harvested two days before pickup.',
  logo_url: null,
  cover_url: '/img/farmers/bola.jpg',
  lat: 6.5955,
  lng: 3.3433,
  rating_avg: 4.6,
  rating_count: 38,
  operating_days: ['tue', 'thu', 'sat'],
  ...over,
});

const page = (rows: unknown[], total = rows.length) => ({
  data: rows,
  meta: { total, page: 1, limit: 24 },
});

const NEARBY_HOME = '/markets/nearby?lat=6.5244&lng=3.3792&radius_km=25';

describe('discovery formatting', () => {
  it('keeps a short distance readable and a long one round', () => {
    expect(formatDistance(0.42)).toBe('420 m');
    expect(formatDistance(8.84)).toBe('8.8 km');
    expect(formatDistance(23.6)).toBe('24 km');
  });

  it('renders Postgres times as Lagos hours, not as the device locale', () => {
    expect(clock('07:00:00')).toBe('7am');
    expect(clock('16:30:00')).toBe('4:30pm');
    expect(clock('12:00:00')).toBe('12pm');
  });

  it('drops the query fields nobody set', () => {
    expect(searchParams({ q: 'ugu', city: '', day: undefined, open_now: false })).toBe('?q=ugu');
  });

  it('spells a market week in the order the market published it', () => {
    expect(dayList(['sat', 'tue'])).toBe('Sat, Tue');
  });

  it('rounds a viewport box so a small pan is not a new question', () => {
    expect(marketBox({ lat: 6.5244, lng: 3.3792 })).toBe('6.27,3.13,6.77,3.63');
    expect(marketBox({ lat: 6.5249, lng: 3.3795 })).toBe('6.27,3.13,6.77,3.63');
  });

  it('sizes the box by the radius being searched, up to what the server will take', () => {
    expect(marketBox(LAGOS, 10)).toBe('6.43,3.29,6.61,3.47');
    expect(marketBox(LAGOS, 50)).toBe(marketBox(LAGOS));
  });
});

describe('home', () => {
  it('lists the nearest markets with their distance and a live count', async () => {
    renderApp('/', {
      stubs: [
        { path: NEARBY_HOME, body: page([nearRow(), market({ id: BALOGUN, name: 'Balogun Market', is_open_now: true })], 4) },
        { path: '/farmers', body: page([farmer()]) },
      ],
    });

    expect(await screen.findByText('Mile 12 Market')).toBeInTheDocument();
    expect(screen.getByText('8.8 km')).toBeInTheDocument();
    expect(screen.getByText('1 of 4 markets within 25 km of central Lagos')).toBeInTheDocument();
  });

  it('shows a stall card with its rating and who runs it', async () => {
    renderApp('/', {
      stubs: [
        { path: NEARBY_HOME, body: page([]) },
        { path: '/farmers', body: page([farmer()]) },
      ],
    });

    const heading = await screen.findByRole('heading', { level: 2, name: 'Meet the farmers' });
    const section = heading.closest('section') as HTMLElement;
    const stallHeading = await within(section).findByRole('heading', { name: 'Adeyemi Farms' });
    const card = stallHeading.closest('article') as HTMLElement;

    expect(within(card).getByText('Bola Adeyemi')).toBeInTheDocument();
    expect(within(card).getByText('4.6')).toBeInTheDocument();
    expect(card).toHaveTextContent('4.6 out of 5 from 38 reviews');
  });

  it('closes on the week offers, priced from the seed rather than from a mockup', async () => {
    renderApp('/', {
      stubs: [
        { path: NEARBY_HOME, body: page([]) },
        { path: '/farmers', body: page([farmer()]) },
      ],
    });

    await screen.findByRole('heading', { level: 2, name: 'Best deals from local farmers' });
    await screen.findByRole('heading', { name: 'Top offers' });

    const row = (screen.getByText('Tomato (Fresh)').closest('a')) as HTMLElement;
    expect(within(row).getByText('₦9,000')).toBeInTheDocument();
    expect(within(row).getByText('Eze Fresh Produce · Oshodi')).toBeInTheDocument();
    expect(within(row).getByText('/ crate')).toBeInTheDocument();
  });

  it('sends the hero search to the market list with the term', async () => {
    const user = userEvent.setup();
    const { requests } = renderApp('/', {
      stubs: [
        { path: NEARBY_HOME, body: page([]) },
        { path: '/farmers', body: page([]) },
        { path: '/markets?q=Balogun', body: page([market({ name: 'Balogun Market' })]) },
      ],
    });

    await user.type(screen.getByLabelText('Search markets, farmers or produce'), 'Balogun');
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(requests.some((r) => r.path === '/markets?q=Balogun')).toBe(true),
    );
    expect(await screen.findByText('Balogun Market')).toBeInTheDocument();
  });

  it('offers the produce categories under the search bar', () => {
    renderApp('/', {
      stubs: [
        { path: NEARBY_HOME, body: page([]) },
        { path: '/farmers', body: page([]) },
      ],
    });

    const title = screen.getByRole('heading', { name: /From the farm/ });
    const hero = within(title.closest('section') as HTMLElement);

    expect(hero.getByRole('link', { name: /Vegetables/ })).toHaveAttribute(
      'href',
      '/products?category=vegetables',
    );
    expect(hero.getByRole('link', { name: 'More' })).toHaveAttribute('href', '/products');
  });

  it('headers the produce band and leaves the photograph alone', () => {
    renderApp('/', {
      stubs: [
        { path: NEARBY_HOME, body: page([]) },
        { path: '/farmers', body: page([]) },
      ],
    });

    const title = screen.getByRole('heading', { level: 2, name: 'Fresh this week' });
    const section = title.closest('section') as HTMLElement;
    const band = within(section);

    // The header is written like the markets and farmers headers, because the band is a section
    // of the page and not a poster to be captioned.
    expect(band.getByText('Straight from the farm')).toBeInTheDocument();
    expect(band.getByRole('link', { name: 'Browse everything' })).toHaveAttribute(
      'href',
      '/products',
    );

    // Nothing sits on the picture: no listing, no price, and no arrows to work it by hand.
    expect(band.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
    expect(band.queryByRole('button')).not.toBeInTheDocument();

    // Every photograph stays mounted and the band shows one at a time, by opacity and nothing else.
    const photos = Array.from(section.querySelectorAll('img'));
    expect(photos).toHaveLength(4);
    expect(photos.filter((p) => p.closest('.opacity-100'))).toHaveLength(1);
  });

  it('shows three stalls and no more, each linking to its own page', async () => {
    const stalls = ['Adeyemi Farms', 'Eze Fresh Produce', 'Baba Oja Greens', 'Chukwuma Yams'].map(
      (stall_name, i) =>
        farmer({ stall_name, id: `44444444-4444-4444-8444-${String(i).padStart(12, '0')}` }),
    );

    renderApp('/', {
      stubs: [
        { path: NEARBY_HOME, body: page([]) },
        { path: '/farmers', body: page(stalls, 9) },
      ],
    });

    const title = await screen.findByRole('heading', { level: 2, name: 'Meet the farmers' });
    const band = within(title.closest('section') as HTMLElement);
    const cards = await band.findAllByRole('heading', { name: /Farms|Produce|Greens|Yams/ });

    expect(cards).toHaveLength(3);
    const lastCard = cards[2] as HTMLElement;
    expect(lastCard.querySelector('a')).toHaveAttribute('href', `/farmers/${stalls[2]?.id}`);
  });
});

describe('markets screen', () => {
  it('puts a day chip into the request rather than filtering what already arrived', async () => {
    const user = userEvent.setup();
    const { requests } = renderApp('/markets', {
      stubs: [
        { path: '/markets', body: page([market()]) },
        { path: '/markets?day=sat', body: page([market()]) },
      ],
    });

    await screen.findByText('Mile 12 Market');
    await user.click(screen.getByRole('button', { name: 'Sat' }));

    await waitFor(() =>
      expect(requests.some((r) => r.path === '/markets?day=sat')).toBe(true),
    );
  });

  it('asks the distance endpoint once the URL carries a point', async () => {
    renderApp('/markets?lat=6.5244&lng=3.3792&radius=10', {
      stubs: [{ path: '/markets/nearby?lat=6.5244&lng=3.3792&radius_km=10', body: page([nearRow()], 3) }],
    });

    expect(await screen.findByText(/within 10 km/)).toBeInTheDocument();
    expect(screen.getByText(/3 markets/)).toBeInTheDocument();
  });

  it('names the filters when nothing matches', async () => {
    renderApp('/markets?day=sun', { stubs: [{ path: '/markets?day=sun', body: page([]) }] });

    expect(await screen.findByText('No market matches all of that')).toBeInTheDocument();
  });

  it('reports a failed request as a failed request', async () => {
    renderApp('/markets', {
      stubs: [{ path: '/markets', status: 500, body: { error: { code: 'internal', message: 'no' } } }],
    });

    expect(await screen.findByText('Markets did not load')).toBeInTheDocument();
  });

  it('shows the marketplaces the map knows about under their own heading', async () => {
    renderApp('/markets?q=Ibadan', {
      stubs: [
        { path: '/markets?q=Ibadan', body: page([]) },
        {
          path: '/places/markets?q=Ibadan&limit=6',
          body: [
            place({ name: 'Mapo Market', ref: 'n3084974661', address: 'Mapo Street, Ìbàdàn, Oyo, Nigeria' }),
            place({ name: 'Oja Oba Market', ref: 'n3084824648', address: 'Gege, Ìbàdàn, Oyo, Nigeria' }),
          ],
        },
      ],
    });

    const heading = await screen.findByRole('heading', { name: 'Also on the map' });
    const band = within(heading.closest('section') as HTMLElement);

    expect(band.getByText('Mapo Market')).toBeInTheDocument();
    expect(band.getByText('Gege, Ìbàdàn, Oyo, Nigeria')).toBeInTheDocument();
    // ODbL: showing these names means owing the source, in the same breath as the list.
    expect(band.getByRole('link', { name: 'OpenStreetMap contributors' })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/copyright',
    );
  });

  it('does not repeat a market that is already in the list', async () => {
    renderApp('/markets?q=Ibadan', {
      stubs: [
        { path: '/markets?q=Ibadan', body: page([market({ name: 'Bodija Market' })]) },
        {
          path: '/places/markets?q=Ibadan&limit=6',
          body: [place({ name: 'Bodija', ref: 'n1' }), place({ name: 'Mapo Market', ref: 'n2' })],
        },
      ],
    });

    const heading = await screen.findByRole('heading', { name: 'Also on the map' });
    const band = within(heading.closest('section') as HTMLElement);

    // `Bodija` and the row's `Bodija Market` are one gate.
    expect(band.queryByText('Bodija')).not.toBeInTheDocument();
    expect(band.getByText('Mapo Market')).toBeInTheDocument();
  });

  it('fills the screen from the corner of the map when nothing has been typed', async () => {
    const { requests } = renderApp('/markets', {
      stubs: [
        { path: '/markets', body: page([market()]) },
        {
          path: '/places/markets/box?bbox=6.27%2C3.13%2C6.77%2C3.63&limit=8',
          body: [
            place({ name: 'Obuzu Market', ref: 'n3023669230', address: '', city: null, state: null, country: null }),
            place({ name: 'Owode Oniri Market', ref: 'n12281469935', address: '', city: null, state: null, country: null }),
          ],
        },
      ],
    });

    const heading = await screen.findByRole('heading', { name: 'Also on the map' });
    const band = within(heading.closest('section') as HTMLElement);

    expect(band.getByText('Obuzu Market')).toBeInTheDocument();
    expect(band.getByText('Owode Oniri Market')).toBeInTheDocument();
    expect(requests.some((r) => r.path.startsWith('/places/markets?'))).toBe(false);
  });

  it('asks a term by name and leaves the viewport question for later', async () => {
    const { requests } = renderApp('/markets?q=Ibadan', {
      stubs: [
        { path: '/markets?q=Ibadan', body: page([]) },
        { path: '/places/markets?q=Ibadan&limit=6', body: [place()] },
      ],
    });

    await screen.findByText('Mapo Market');
    expect(requests.some((r) => r.path.startsWith('/places/markets/box'))).toBe(false);
  });

  it('shows a name alone when the map has nothing else about that place', async () => {
    renderApp('/markets?q=Ibadan', {
      stubs: [
        { path: '/markets?q=Ibadan', body: page([]) },
        {
          path: '/places/markets?q=Ibadan&limit=6',
          body: [place({ address: '', city: null, state: null, country: null })],
        },
      ],
    });

    const heading = await screen.findByRole('heading', { name: 'Also on the map' });
    const item = within(heading.closest('section') as HTMLElement).getByText('Mapo Market')
      .closest('article') as HTMLElement;

    // Most marketplace nodes carry a name and no address tags at all; the gap is honest, a blank
    // paragraph is a hole in the list.
    expect(item.querySelectorAll('p')).toHaveLength(1);
  });

  it('gives a place the map knows the same row as a market we approved', async () => {
    renderApp('/markets?q=Ibadan', {
      stubs: [
        { path: '/markets?q=Ibadan', body: page([market()]) },
        { path: '/places/markets?q=Ibadan&limit=6', body: [place()] },
      ],
    });

    const heading = await screen.findByRole('heading', { name: 'Also on the map' });
    const band = within(heading.closest('section') as HTMLElement);

    // OpenStreetMap carries no photo for these nodes, so the slot is filled with the app's own
    // plate rather than left blank beside the cards above it.
    expect(band.getByRole('img', { name: 'Mapo Market' })).toBeInTheDocument();
    expect(band.getByRole('button', { name: 'Show on map' })).toBeInTheDocument();
    expect(band.getByText('On the map, not on MarketLink yet')).toBeInTheDocument();
    // The trading line is a claim this row cannot make.
    expect(band.queryByText(/^Trades /)).not.toBeInTheDocument();
  });
});

describe('market detail', () => {
  it('shows who trades there, at which pitch, and how much is listed', async () => {
    renderApp(`/markets/${MILE_12}`, {
      stubs: [
        {
          path: `/markets/${MILE_12}`,
          body: market({
            farmers: [
              {
                id: ADEYEMI,
                stall_name: 'Adeyemi Farms',
                contact_person: 'Bola Adeyemi',
                logo_url: null,
                rating_avg: 4.6,
                rating_count: 38,
                stall_ref: 'A12',
                days: ['tue', 'thu'],
              },
            ],
            product_count: 40,
          }),
        },
      ],
    });

    expect(await screen.findByRole('heading', { name: 'Mile 12 Market' })).toBeInTheDocument();
    expect(screen.getByText('Adeyemi Farms')).toBeInTheDocument();
    expect(screen.getByText(/pitch A12/)).toBeInTheDocument();
    expect(screen.getByText(/products listed this week/)).toBeInTheDocument();
  });

  it('says there is no market there rather than showing an empty page', async () => {
    renderApp(`/markets/${MILE_12}`, {
      stubs: [
        {
          path: `/markets/${MILE_12}`,
          status: 404,
          body: { error: { code: 'not_found', message: 'No such market.' } },
        },
      ],
    });

    expect(await screen.findByText('No market at that address')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All markets' })).toBeInTheDocument();
  });
});
