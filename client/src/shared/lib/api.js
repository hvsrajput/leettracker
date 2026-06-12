import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

const responseCache = new Map();
const inflightGets = new Map();
const DEFAULT_CACHE_TTL = 15000;

function buildCacheKey(url, config = {}) {
  const token = localStorage.getItem('token') || '';
  const params = config.params ? JSON.stringify(config.params) : '';
  return `${token}::${url}::${params}`;
}

function invalidateCache(prefix = '') {
  for (const key of responseCache.keys()) {
    if (!prefix || key.includes(prefix)) {
      responseCache.delete(key);
    }
  }
}

// Add JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
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
