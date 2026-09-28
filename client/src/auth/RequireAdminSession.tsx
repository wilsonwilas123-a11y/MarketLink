import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { adminApi, clearAdminToken } from './adminSession';
import { ApiError } from '../lib/api';
import { Button } from '../components/ui/Button';

export function RequireAdminSession({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<'checking' | 'valid' | 'invalid' | 'error'>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    void adminApi.get<{ email: string }>('/admin/session').then(
      () => { if (current) setState('valid'); },
      (error: unknown) => {
        if (!current) return;
        if (error instanceof ApiError && error.status === 401) {
          clearAdminToken();
          setState('invalid');
        } else setState('error');
      },
    );
    return () => { current = false; };
  }, [attempt]);

  if (state === 'checking') {
    return <section className="mx-auto w-full max-w-md px-4 py-24"><p className="text-sm text-muted" role="status">Checking admin session…</p></section>;
  }
  if (state === 'invalid') {
    return <Navigate to="/admin/signin" replace state={{ from: location.pathname + location.search }} />;
  }
  if (state === 'error') {
    return <section className="mx-auto w-full max-w-md px-4 py-24"><h1 className="font-display text-2xl font-bold">Could not verify admin session</h1><p className="mt-2 text-sm text-muted">Check that the MarketLink API is available, then retry.</p><Button className="mt-5" onClick={() => { setState('checking'); setAttempt((value) => value + 1); }}>Retry</Button></section>;
  }
  return <>{children}</>;
}
