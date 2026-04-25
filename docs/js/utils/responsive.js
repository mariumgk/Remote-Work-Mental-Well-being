/**
 * ResizeObserver helper.
 * Calls a callback with the new {width, height} whenever a container resizes.
 * Returns a cleanup function that disconnects the observer.
 */
export function watchResize(element, callback, debounceMs = 120) {
  let timer = null;

  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      clearTimeout(timer);
      timer = setTimeout(() => callback({ width, height }), debounceMs);
    }
  });

  observer.observe(element);

  return () => {
    clearTimeout(timer);
    observer.disconnect();
  };
}

/**
 * Get usable {width, height} for an SVG inside a container element.
 */
export function containerSize(el) {
  const rect = el.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}
