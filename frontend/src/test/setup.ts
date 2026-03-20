import '@testing-library/jest-dom';

if (typeof window !== 'undefined') {
  window.scrollTo = () => {};
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class IntersectionObserver {
    observe = () => {};
    unobserve = () => {};
    disconnect = () => {};
    root = null;
    rootMargin = '';
    thresholds = [];
  } as any;
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe = () => {};
    unobserve = () => {};
    disconnect = () => {};
  } as any;
}
