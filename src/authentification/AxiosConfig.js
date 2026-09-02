import axios from 'axios';

function getSessionKey() {
  let sessionKey = sessionStorage.getItem('_oc_sid');

  if (!sessionKey) {
    sessionKey =
      'oc_' +
      Date.now() +
      '_' +
      Math.random()
        .toString(36)
        .slice(2, 10);

    sessionStorage.setItem(
      '_oc_sid',
      sessionKey
    );
  }

  return sessionKey;
}

function getStoredToken() {
  const sid =
    sessionStorage.getItem('_oc_sid');

  if (!sid) {
    return null;
  }

  return sessionStorage.getItem(
    `_oc_token_${sid}`
  );
}

function storeToken(token) {
  const sid = getSessionKey();

  sessionStorage.setItem(
    `_oc_token_${sid}`,
    token
  );
}

function clearStoredToken() {
  const sid =
    sessionStorage.getItem('_oc_sid');

  if (sid) {
    sessionStorage.removeItem(
      `_oc_token_${sid}`
    );
  }
}

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {

  const token = getStoredToken();

  if (token) {
    config.headers.Authorization =
      `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {

    // On laisse AuthContext / ProtectedRoute
    // gérer l'état d'authentification.
    return Promise.reject(error);
  }
);

export {
  api,
  getStoredToken,
  storeToken,
  clearStoredToken,
  getSessionKey,
};

export default api;