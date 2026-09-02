// src/components/ElementFormModal.jsx
//
// Formulaire modal affiché après un placement (bâtiment ou tracé) pour
// saisir le nom et, selon le type : la hauteur + l'emprise (bâtiment), ou
// la largeur/distance (route, cours d'eau). La date de création n'est pas
// demandée ici : elle est posée automatiquement par le serveur
// (created_at, cf. server/db.js).

import { useState } from 'react';

const inputStyle = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  fontSize: 13,
  boxSizing: 'border-box',
};

const btnGhost = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'transparent',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 12.5,
};

const btnPrimary = { ...btnGhost, background: '#7c4dff', border: '1px solid #7c4dff' };

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11.5, opacity: 0.75, marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function ElementFormModal({ type, submitting, error, onSubmit, onCancel }) {
  const [name, setName] = useState('');
  const [height, setHeight] = useState(3);
  const [largeur, setLargeur] = useState(8);
  const [profondeur, setProfondeur] = useState(8);
  const [width, setWidth] = useState(type === 'water' ? 3 : 4);

  const isBuilding = type === 'building';
  const label = isBuilding ? 'Bâtiment' : type === 'water' ? "Cours d'eau" : 'Route';

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    onSubmit({ name: name.trim(), height, largeur, profondeur, width });
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          background: '#1c1c22',
          color: '#fff',
          padding: 20,
          borderRadius: 12,
          width: 280,
          fontFamily: 'system-ui, sans-serif',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Nouveau : {label}</div>

        <FormField label="Nom">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </FormField>

        {isBuilding ? (
          <>
            <FormField label="Hauteur (m)">
              <input
                type="number"
                min="0"
                step="0.5"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                style={inputStyle}
              />
            </FormField>
            <FormField label="Largeur (m)">
              <input
                type="number"
                min="1"
                step="0.5"
                value={largeur}
                onChange={(e) => setLargeur(e.target.value)}
                style={inputStyle}
              />
            </FormField>
            <FormField label="Profondeur (m)">
              <input
                type="number"
                min="1"
                step="0.5"
                value={profondeur}
                onChange={(e) => setProfondeur(e.target.value)}
                style={inputStyle}
              />
            </FormField>
          </>
        ) : (
          <FormField label="Largeur / distance (m)">
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              style={inputStyle}
            />
          </FormField>
        )}

        {error && <div style={{ color: '#ff6d6d', fontSize: 12, marginBottom: 8 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} style={btnGhost} disabled={submitting}>
            Annuler
          </button>
          <button type="submit" style={btnPrimary} disabled={submitting}>
            {submitting ? 'Création…' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  );
}