// Applies the saved theme before first paint, so a dark-mode user never sees a light flash.
// A same-origin file rather than an inline <script>: the CSP keeps `script-src 'self'` with no
// 'unsafe-inline'. Loaded blocking in <head>; deliberately tiny and dependency-free.
// Must match src/features/settings/theme/themeStore.ts (key + values).
(function () {
  try {
    var saved = JSON.parse(window.localStorage.getItem('weatherboard:theme:v1') || 'null');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
    // 'system', missing or tampered: no attribute → CSS follows prefers-color-scheme.
  } catch {
    // Storage blocked or bad JSON: fall back to the system theme.
  }
})();
