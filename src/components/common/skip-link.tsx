/** First focusable element on every page; jumps to the page's `<main id="main-content">`. */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only rounded bg-primary px-4 py-2 text-label-lg text-on-primary focus:not-sr-only focus:fixed focus:top-gutter-sm focus:left-gutter-sm focus:z-50"
    >
      Skip to main content
    </a>
  );
}
