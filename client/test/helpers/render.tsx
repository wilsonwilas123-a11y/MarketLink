import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/auth/AuthProvider';
import type { AuthGateway } from '../../src/auth/gateway';
import App from '../../src/App';
import { apiFor, stubFetch } from './auth';

type Stubs = Parameters<typeof stubFetch>[0];

export interface RenderAppOptions {
  gateway?: AuthGateway | null;
  stubs?: Stubs;
}

/**
 * The app at a given path, with an injectable session and API.
 *
 * Provider order matches `main.tsx`: the router has to be outside `AuthProvider` because the
 * nav inside the app reads the location.
 */
export function renderApp(path: string, { gateway = null, stubs = [] }: RenderAppOptions = {}) {
  const { fetchImpl, requests } = stubFetch(stubs);

  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider gateway={gateway} api={apiFor(gateway, fetchImpl)}>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );

  return { requests };
}
