import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp as renderAt } from './helpers/render';

describe('app shell', () => {
  it('renders the landing headline on the home route', () => {
    renderAt('/');
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toMatch(/from the farm\s*to the market\s*to you/i);
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
    expect(screen.getByText('Connecting local farms to your market.')).toBeInTheDocument();
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
