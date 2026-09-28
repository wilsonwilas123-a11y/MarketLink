import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import Home from './Home';

/** First visit starts with sign-in; an established session gets the normal marketplace home. */
export default function Entry() {
  const { status } = useAuth();
  if (status === 'loading') {
    return <section className="grid min-h-[70svh] place-items-center" role="status"><p className="text-sm text-muted">Checking your MarketLink session…</p></section>;
  }
  if (status === 'ready') return <Home />;
  if (status === 'profile_needed') return <Navigate to="/complete-profile" replace />;
  return <Navigate to="/signin" replace />;
}
