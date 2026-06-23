(function () {
  const localBackendOrigin = "http://localhost:5000";
  const defaultOrigin = localBackendOrigin;
  const configuredOrigin =
    window.PREPGENIE_API_ORIGIN ||
    document.querySelector('meta[name="prepgenie-api-origin"]')?.content ||
    "";
  const customOrigin = window.localStorage.getItem("prepgenieApiOrigin");
  const retryableStatuses = new Set([404, 408, 425, 429, 500, 502, 503, 504]);

  function sanitizeOrigin(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function getStoredToken() {
    try {
      return String(window.localStorage.getItem("token") || "").trim();
    } catch (_error) {
      return "";
    }
  }

  function normalizeHeaders(headers) {
    if (headers instanceof Headers) {
      return new Headers(headers);
    }

    return new Headers(headers || {});
  }

  function getAuthHeaders(headers = {}, config = {}) {
    const resolvedHeaders = normalizeHeaders(headers);
    const token = getStoredToken();

    if (config.includeAuth !== false && token && !resolvedHeaders.has("Authorization")) {
      resolvedHeaders.set("Authorization", `Bearer ${token}`);
    }

    return resolvedHeaders;
  }

  function buildRequestOptions(options = {}, config = {}) {
    return {
      ...options,
      headers: getAuthHeaders(options.headers, config)
    };
  }

  function isLocalHost(hostname = window.location.hostname) {
    const host = String(hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  }

  function getCurrentOrigin() {
    if (!/^https?:$/.test(window.location.protocol)) {
      return "";
    }

    return window.location.origin;
  }

  function inferOrigin() {
    if (!/^https?:$/.test(window.location.protocol)) {
      return defaultOrigin;
    }

    if (!isLocalHost()) {
      return getCurrentOrigin();
    }

    if (window.location.port === "5000") {
      return getCurrentOrigin();
    }

    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }

  function unique(items) {
    return [...new Set(items.filter(Boolean))];
  }

  function getCandidateOrigins() {
    return unique([
      sanitizeOrigin(window.localStorage.getItem("prepgenieApiOrigin")),
      sanitizeOrigin(configuredOrigin),
      sanitizeOrigin(inferOrigin()),
      sanitizeOrigin(getCurrentOrigin()),
      isLocalHost() ? sanitizeOrigin(localBackendOrigin) : ""
    ]);
  }

  let origin = sanitizeOrigin(customOrigin || configuredOrigin || inferOrigin() || defaultOrigin);
  let apiBase = `${origin}/api`;

  function setResolvedOrigin(nextOrigin, persist = false) {
    origin = sanitizeOrigin(nextOrigin || origin || defaultOrigin) || defaultOrigin;
    apiBase = `${origin}/api`;
    window.PrepGenieConfig.API_ORIGIN = origin;
    window.PrepGenieConfig.API_BASE = apiBase;

    if (persist) {
      window.localStorage.setItem("prepgenieApiOrigin", origin);
    }
  }

  function buildApiUrl(path, preferredOrigin) {
    const rawPath = String(path || "").trim();
    if (/^https?:\/\//i.test(rawPath)) return rawPath;

    const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    const baseOrigin = sanitizeOrigin(preferredOrigin || origin || defaultOrigin);
    return `${baseOrigin}/api${normalizedPath}`;
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = 7000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(`Request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function fetchApi(path, options = {}, config = {}) {
    const timeoutMs = Number(config.timeoutMs) || 7000;
    const candidates = unique([
      sanitizeOrigin(config.preferredOrigin),
      ...getCandidateOrigins()
    ]);
    const requestOptions = buildRequestOptions(options, config);

    let lastResponse = null;
    let lastError = null;

    for (const candidate of candidates) {
      try {
        const response = await fetchWithTimeout(buildApiUrl(path, candidate), requestOptions, timeoutMs);
        if (response.ok || !retryableStatuses.has(response.status) || candidate === candidates[candidates.length - 1]) {
          setResolvedOrigin(candidate, true);
          return response;
        }

        lastResponse = response;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastResponse) return lastResponse;
    throw lastError || new Error("API unavailable");
  }

  async function fetchApiJson(path, options = {}, config = {}) {
    const response = await fetchApi(path, options, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(
        data.message ||
        data.error ||
        `Request failed with status ${response.status}`
      );
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  window.PrepGenieConfig = {
    API_ORIGIN: origin,
    API_BASE: apiBase,
    buildApiUrl,
    getAuthHeaders,
    fetchWithTimeout,
    fetchApi,
    fetchApiJson,
    setApiOrigin(nextOrigin) {
      const sanitized = sanitizeOrigin(nextOrigin);
      if (!sanitized) return;
      window.localStorage.setItem("prepgenieApiOrigin", sanitized);
      setResolvedOrigin(sanitized, true);
      window.location.reload();
    },
    clearApiOrigin() {
      window.localStorage.removeItem("prepgenieApiOrigin");
      setResolvedOrigin(inferOrigin() || defaultOrigin, false);
      window.location.reload();
    }
  };
})();
