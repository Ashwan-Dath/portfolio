/**
 * lib/scroll.ts
 * Scrolls an element into view smoothly, or instantly for visitors who asked their system for reduced motion.
 * Safe to call anywhere: it does nothing if the element is missing or the browser (or test runner) lacks
 * scrollIntoView.
 * Used by: components/Guestbook (scroll to the timing chart) and components/ChatWidget (jump to the demo).
 */
export function scrollToElement(element: Element | null, block: ScrollLogicalPosition = 'center'): void {
  if (!element || typeof element.scrollIntoView !== 'function') return;
  const reduceMotion =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block });
}
