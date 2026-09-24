import { useRoutes } from 'react-router-dom';
import { TopNav } from './components/layout/TopNav';
import { Footer } from './components/layout/Footer';
import { routes } from './routes';

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <TopNav />
      <main id="main" className="flex-1">
        {useRoutes(routes)}
      </main>
      <Footer />
    </div>
  );
}
