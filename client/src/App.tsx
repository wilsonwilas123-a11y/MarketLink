import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation, useRoutes } from 'react-router-dom';
import { TopNav } from './components/layout/TopNav';
import { Footer } from './components/layout/Footer';
import { routes } from './routes';
import { useAuth } from './auth/AuthProvider';
import { LoadingScreen } from './motion/LoadingScreen';
import { RouteTransition } from './motion/RouteTransition';

const MarketLinkChat = lazy(() => import('./components/chat/MarketLinkChat').then((module) => ({ default: module.MarketLinkChat })));

export default function App() {
  const location = useLocation();
  const { status } = useAuth();
  const [initialLoadShown, setInitialLoadShown] = useState(false);
  const isAuthScreen = ['/signin', '/signup', '/complete-profile', '/admin/signin'].includes(location.pathname)
    || (location.pathname === '/' && status !== 'ready');
  const isAdminPage = location.pathname === '/admin';
  const showMobileNavigation = !isAuthScreen && !isAdminPage;
  const route = useRoutes(routes);

  useEffect(() => {
    const timer = window.setTimeout(() => setInitialLoadShown(true), 1100);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={`flex min-h-screen flex-col ${showMobileNavigation ? 'pb-[calc(4.5rem+env(safe-area-inset-bottom))] xl:pb-0' : ''}`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-on-block"
      >
        Skip to content
      </a>
      {!isAuthScreen && !isAdminPage ? <TopNav /> : null}
      <main id="main" className="flex-1">
        <Suspense
          fallback={initialLoadShown ? <LoadingScreen label="Opening your page…" /> : null}
        >
          <RouteTransition key={location.pathname} path={location.pathname} enabled={!isAuthScreen}>
            {route}
          </RouteTransition>
        </Suspense>
      </main>
      {!isAuthScreen && !isAdminPage ? <Footer /> : null}
      {!isAuthScreen && !isAdminPage ? (
        <Suspense fallback={null}>
          <MarketLinkChat />
        </Suspense>
      ) : null}
      {!initialLoadShown ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-sheet">
          <LoadingScreen label="Opening your page…" />
        </div>
      ) : null}
    </div>
  );
}
