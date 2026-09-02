// src/api/elementsApi.js
//
// Client HTTP vers l'API Express (server/) des éléments personnalisés.
// Adaptez API_BASE si votre backend n'écoute pas sur localhost:4000
// (variable d'env Vite : VITE_API_URL).

const API_BASE = (import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:3001/api';

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function listElements() {
  return fetch(`${API_BASE}/elements`).then(handle);
}

export function createElement(payload) {
  return fetch(`${API_BASE}/elements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function updateElement(id, payload) {
  return fetch(`${API_BASE}/elements/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function deleteElement(id) {
  return fetch(`${API_BASE}/elements/${id}`, { method: 'DELETE' }).then(handle);
}