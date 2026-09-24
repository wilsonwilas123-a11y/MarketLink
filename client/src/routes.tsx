import type { RouteObject } from 'react-router-dom';
import { About, Contact, Farmers, Home, Markets, Orders, Products } from './pages/stubs';
import NotFound from './pages/NotFound';

export const routes: RouteObject[] = [
  { path: '/', element: <Home /> },
  { path: '/markets', element: <Markets /> },
  { path: '/products', element: <Products /> },
  { path: '/farmers', element: <Farmers /> },
  { path: '/orders', element: <Orders /> },
  { path: '/about', element: <About /> },
  { path: '/contact', element: <Contact /> },
  { path: '*', element: <NotFound /> },
];
