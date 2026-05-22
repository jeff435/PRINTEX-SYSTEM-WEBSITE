// ═══════════════════════════════════════════════════════════════════
// PRINTEX CENTRALIZED API CONFIG
// Single source of truth for all API endpoints.
// Auto-detects: Vercel production, InsForge, or local dev.
// ═══════════════════════════════════════════════════════════════════

(function() {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');

  // In production (Vercel), all /api/* calls are handled by api/index.ts serverless function.
  // In development, calls go to the local Express server on port 3000.
  const API_BASE = isLocalhost ? 'http://localhost:3000' : '';

  // The live deployed frontend URL (used for QR code generation)
  const APP_URL = isLocalhost ? window.location.origin : window.location.origin;

  window.PRINTEX_CONFIG = {
    apiBase: API_BASE,
    appUrl: APP_URL,
    isProduction: !isLocalhost,

    // Build a full API URL
    api: function(path) {
      return API_BASE + (path.startsWith('/') ? path : '/' + path);
    },

    // Build a delivery tracking URL for QR codes
    deliveryUrl: function(deliveryId, token) {
      return APP_URL + '/delivery/' + deliveryId + (token ? '?token=' + token : '');
    }
  };

  // Expose shorthand
  window.PRINTEX_API = window.PRINTEX_CONFIG.api;

  console.log('[Printex] API Base:', API_BASE || '(relative — production Vercel)');
  console.log('[Printex] App URL:', APP_URL);
})();
