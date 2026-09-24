import { Link } from 'react-router-dom';

const footerLinks = [
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
  { to: '/markets', label: 'Markets' },
  { to: '/farmers', label: 'Farmers' },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <p className="font-display text-lg font-bold">MarketLink</p>
          <p className="mt-1 text-sm text-muted">Connecting local farms to your market.</p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {footerLinks.map((l) => (
            <Link key={l.to} to={l.to} className="text-muted transition hover:text-primary">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-muted">
          © {new Date().getFullYear()} MarketLink. Map data © OpenStreetMap contributors. Orders are paid
          in person at pickup.
        </p>
      </div>
    </footer>
  );
}
