(function initPrepGenieAccessGuard() {
  const ADMIN_EMAIL = "hasiniappikatla11@gmail.com";
  const PREVIEW_MODE_KEY = "prepgeniePreviewMode";

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem("currentUser")) || null;
    } catch (_error) {
      return null;
    }
  }

  function isLoggedIn() {
    const user = getCurrentUser();
    return Boolean(user && user.email);
  }

  function isAdminUser(user = getCurrentUser()) {
    if (user && typeof user.isAdmin === "boolean") {
      return user.isAdmin;
    }

    return normalizeEmail(user && user.email) === ADMIN_EMAIL;
  }

  function hasPreviewSession() {
    try {
      return window.sessionStorage.getItem(PREVIEW_MODE_KEY) === "1";
    } catch (_error) {
      return false;
    }
  }

  function isLocalPreviewHost() {
    const host = String(window.location.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  }

  function isPreviewMode() {
    return window.location.protocol === "file:" || hasPreviewSession() || isLocalPreviewHost();
  }

  function enterPreviewMode() {
    try {
      window.sessionStorage.setItem(PREVIEW_MODE_KEY, "1");
    } catch (_error) {
      return false;
    }

    return true;
  }

  function clearPreviewMode() {
    try {
      window.sessionStorage.removeItem(PREVIEW_MODE_KEY);
    } catch (_error) {
      // Ignore session storage failures and keep the app usable.
    }
  }

  function requireAuth() {
    if (isLoggedIn()) {
      clearPreviewMode();
      return true;
    }

    if (isPreviewMode()) {
      enterPreviewMode();
      return true;
    }

    window.location.href = "index.html";
    return false;
  }

  window.PrepGenieAccess = {
    ADMIN_EMAIL,
    PREVIEW_MODE_KEY,
    getCurrentUser,
    isLoggedIn,
    isAdminUser,
    isPreviewMode,
    enterPreviewMode,
    clearPreviewMode,
    requireAuth
  };
})();
