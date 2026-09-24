import '@testing-library/jest-dom/vitest';

/**
 * jsdom ships no ResizeObserver, and the map watches its own container with one so Leaflet
 * re-measures when a sidebar collapses. Without the stub the mount throws, and the failure
 * surfaces as an unhandled error attached to whichever test happened to be last.
 */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
