import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import CompleteProfile from './pages/auth/CompleteProfile';
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import Account from './pages/Account';
import FarmerDashboard from './pages/FarmerDashboard';
import Home from './pages/Home';
import MarketDetail from './pages/MarketDetail';
import Markets from './pages/Markets';
import { About, Contact, Farmers, Orders, Products } from './pages/stubs';
import NotFound from './pages/NotFound';

export const routes: RouteObject[] = [
  { path: '/', element: <Home /> },
  { path: '/markets', element: <Markets /> },
  { path: '/markets/:id', element: <MarketDetail /> },
  { path: '/products', element: <Products /> },
  { path: '/farmers', element: <Farmers /> },
  { path: '/orders', element: <Orders /> },
  { path: '/about', element: <About /> },
  { path: '/contact', element: <Contact /> },

  { path: '/signin', element: <SignIn /> },
  { path: '/signup', element: <SignUp /> },
  { path: '/complete-profile', element: <CompleteProfile /> },
  {
    path: '/account',
    element: (
      <RequireAuth>
        <Account />
      </RequireAuth>
    ),
  },
  {
    path: '/farmers/dashboard',
    element: (
      <RequireAuth roles={['farmer']}>
        <FarmerDashboard />
      </RequireAuth>
    ),
  },

  { path: '*', element: <NotFound /> },
];
