import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { RequireAdminSession } from './auth/RequireAdminSession';

const CompleteProfile = lazy(() => import('./pages/auth/CompleteProfile'));
const SignIn = lazy(() => import('./pages/auth/SignIn'));
const SignUp = lazy(() => import('./pages/auth/SignUp'));
const Account = lazy(() => import('./pages/Account'));
const FarmerDashboard = lazy(() => import('./pages/FarmerDashboard'));
const Entry = lazy(() => import('./pages/Entry'));
const MarketDetail = lazy(() => import('./pages/MarketDetail'));
const Markets = lazy(() => import('./pages/Markets'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/Products').then((page) => ({ default: page.ProductDetail })));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Farmers = lazy(() => import('./pages/Farmers'));
const FarmerProfile = lazy(() => import('./pages/Farmers').then((page) => ({ default: page.FarmerProfile })));
const Orders = lazy(() => import('./pages/Orders'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Notifications = lazy(() => import('./pages/Notifications'));
const About = lazy(() => import('./pages/stubs').then((page) => ({ default: page.About })));
const Contact = lazy(() => import('./pages/stubs').then((page) => ({ default: page.Contact })));
const NotFound = lazy(() => import('./pages/NotFound'));

export const routes: RouteObject[] = [
  // A new visitor starts at sign-in. The rest of the marketplace remains browseable by URL.
  { path: '/', element: <Entry /> },
  { path: '/markets', element: <Markets /> },
  { path: '/markets/:id', element: <MarketDetail /> },
  { path: '/products', element: <Products /> },
  { path: '/products/:id', element: <ProductDetail /> },
  { path: '/cart', element: <Cart /> },
  { path: '/favorites', element: <Favorites /> },
  { path: '/notifications', element: <Notifications /> },
  { path: '/checkout', element: <Checkout /> },
  { path: '/farmers', element: <Farmers /> },
  { path: '/farmers/:id', element: <FarmerProfile /> },
  { path: '/orders', element: <Orders /> },
  { path: '/orders/:reference', element: <Orders /> },
  {
    path: '/admin',
    element: (
      <RequireAdminSession>
        <AdminDashboard />
      </RequireAdminSession>
    ),
  },
  { path: '/admin/signin', element: <SignIn adminMode /> },
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
