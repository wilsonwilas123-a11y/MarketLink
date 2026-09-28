/**
 * Every router in one import.
 *
 * Two things need the complete set at once: `createApp`, which mounts them, and the
 * contract generator, whose input is the set of paths each router registered while loading.
 * Importing through here rather than listing routers in both places is what keeps the two
 * from disagreeing.
 */
export { authRouter } from './auth.js';
export { farmersRouter } from './farmers.js';
export { geoRouter } from './geo.js';
export { healthRouter } from './health.js';
export { marketsRouter } from './markets.js';
export { openApiRouter } from './openapi.js';
export { productsRouter } from './products.js';
export { ordersRouter } from './orders.js';
export { adminRouter } from './admin.js';
export { favoritesRouter } from './favorites.js';
export { uploadsRouter } from './uploads.js';
export { notificationsRouter } from './notifications.js';
