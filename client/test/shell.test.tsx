import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App';

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <App />
  </MemoryRouter>,
);

describe('app shell', () => {
  it('renders the landing headline on the home route', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/fresh from the market/i);
  });

  it('renders a distinct page for each primary route', () => {
    renderAt('/products');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/what is in stock/i);
  });

  it('marks the active nav link', () => {
    renderAt('/markets');
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'Markets' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows the tagline in the footer', () => {
    renderAt('/');
    expect(screen.getByText('Local food. Stronger communities.')).toBeInTheDocument();
  });

  it('states that payment happens at pickup, matching the no-payment constraint', () => {
    renderAt('/');
    expect(screen.getByText(/paid\s+in person at pickup/i)).toBeInTheDocument();
  });

  it('renders a not-found page instead of a blank screen', () => {
    renderAt('/no-such-route');
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
  });
});
