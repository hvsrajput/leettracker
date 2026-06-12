import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  // Send the HttpOnly session cookie with every request (cross-site, so the
  // server must respond with a specific origin + Access-Control-Allow-Credentials).
  withCredentials: true,
});

const responseCache = new Map();
const inflightGets = new Map();
const DEFAULT_CACHE_TTL = 15000;

const buildCacheKey = (url, config = {}) => {
  // Scope cached reads to the signed-in user so switching accounts can't surface
  // another user's cached response. The token now lives in an HttpOnly cookie
  // (unreadable here), so we key on the stored user id instead.
  let userId = '';
  try {
    userId = JSON.parse(localStorage.getItem('user') || '{}')?.id || '';
  } catch {
    userId = '';
  }
  const params = config.params ? JSON.stringify(config.params) : '';
  return `${userId}::${url}::${params}`;
};

const invalidateCache = (prefix = '') => {
  for (const key of responseCache.keys()) {
    if (!prefix || key.includes(prefix)) {
      responseCache.delete(key);
    }
  }
};

// The session JWT is carried automatically by the HttpOnly cookie
// (withCredentials above), so there's no Authorization header to attach here.

// Handle 401 responses and clear cached reads after mutations.
api.interceptors.response.use(
  (response) => {
    const method = response.config?.method?.toLowerCase();
    if (method && !['get', 'head', 'options'].includes(method)) {
      invalidateCache();
    }
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // Cookie expired or missing — drop the cached user and bounce to login.
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

api.getCached = (url, config = {}, ttlMs = DEFAULT_CACHE_TTL) => {
  const key = buildCacheKey(url, config);
  const cachedEntry = responseCache.get(key);

  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    return Promise.resolve(cachedEntry.response);
  }

  if (inflightGets.has(key)) {
    return inflightGets.get(key);
  }

  const request = api.get(url, config)
    .then((response) => {
      responseCache.set(key, {
        response,
        expiresAt: Date.now() + ttlMs,
      });
      return response;
    })
    .finally(() => {
      inflightGets.delete(key);
    });

  inflightGets.set(key, request);
  return request;
};

api.invalidateCache = invalidateCache;

export default api;
