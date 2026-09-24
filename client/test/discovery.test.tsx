import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './helpers/render';
import { clock, dayList, searchParams } from '../src/lib/discovery';
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

  it('shows a stall card with its rating and its own trading days', async () => {
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

    expect(within(card).getByText('Trades Tue, Thu, Sat')).toBeInTheDocument();
    expect(within(card).getByText('4.6')).toBeInTheDocument();
    expect(card).toHaveTextContent('4.6 out of 5 from 38 reviews');
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

  it('offers quick links that carry a real filter', () => {
    renderApp('/', {
      stubs: [
        { path: NEARBY_HOME, body: page([]) },
        { path: '/farmers', body: page([]) },
      ],
    });

    const ask = screen.getByPlaceholderText(/fresh tomatoes near lekki/i);
    const panel = ask.closest('aside') as HTMLElement;
    expect(within(panel).getByRole('link', { name: 'Open right now' })).toHaveAttribute(
      'href',
      '/markets?open=1',
    );
    expect(
      within(panel).getByRole('link', { name: /Near Lekki Phase 1/ }),
    ).toHaveAttribute('href', '/markets?lat=6.4551&lng=3.3795&radius=10');
  });

  it('offers the produce categories under the search bar', () => {
    renderApp('/', {
      stubs: [
        { path: NEARBY_HOME, body: page([]) },
        { path: '/farmers', body: page([]) },
      ],
    });

    const title = screen.getByRole('heading', { name: /Fresh from the market/ });
    const hero = within(title.closest('section') as HTMLElement);

    expect(hero.getByRole('link', { name: /Vegetables/ })).toHaveAttribute(
      'href',
      '/products?category=vegetables',
    );
    expect(hero.getByRole('link', { name: 'More' })).toHaveAttribute('href', '/products');
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
