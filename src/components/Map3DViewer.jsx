// src/components/Map3DViewer.jsx
//
// Point d'entrée principal de la vue 3D.
// Monte la scène React Three Fiber et le panneau d'information du
// bâtiment sélectionné.

import { useState } from 'react';
import Scene3D from '../three/Scene3D';
import { COLORS } from '../three/colors';

const LEGEND_ITEMS = [
  { label: 'Fokotany (relief, survol)', color: COLORS.terrain, hint: 'Couche montée en haut' },
  { label: 'Socle du bas', color: COLORS.basePlane, hint: 'Lignes restées en bas' },
  { label: 'Bâtiments', color: COLORS.building, hint: 'Cliquer pour les détails' },
  { label: 'Routes (highway)', color: COLORS.highway, hint: 'Tronçons haut + bas' },
  { label: 'Cours d\u2019eau', color: COLORS.waterway, hint: 'Tronçons haut + bas' },
];

export default function Map3DViewer() {
  const [selectedBuilding, setSelectedBuilding] = useState(null);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 500,
        background: '#111318',
      }}
    >
      <Scene3D onBuildingSelect={setSelectedBuilding} />

      {/* Légende permanente de la carte */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          minWidth: 180,
          background: 'rgba(18, 18, 22, 0.9)',
          color: '#fff',
          padding: '12px 14px',
          borderRadius: 10,
          fontSize: 12.5,
          lineHeight: 1.4,
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          zIndex: 10,
          fontFamily: 'system-ui, sans-serif',
          backdropFilter: 'blur(4px)',
        }}
      >
        <div
          style={{
            fontWeight: 600,
            marginBottom: 8,
            letterSpacing: 0.4,
            opacity: 0.9,
          }}
        >
          Légende
        </div>
        {LEGEND_ITEMS.map((item) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 7,
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                flexShrink: 0,
                borderRadius: 3,
                background: item.color,
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25)',
              }}
            />
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <span>{item.label}</span>
              <span style={{ opacity: 0.6, fontSize: 11 }}>{item.hint}</span>
            </span>
          </div>
        ))}
      </div>

      {selectedBuilding && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 300,
            maxHeight: 'calc(100% - 32px)',
            overflow: 'auto',
            background: 'rgba(20, 20, 24, 0.92)',
            color: '#fff',
            padding: '14px 16px',
            borderRadius: 10,
            fontSize: 13,
            lineHeight: 1.5,
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            zIndex: 10,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            <span>Bâtiment sélectionné</span>
            <button
              onClick={() => {
                setSelectedBuilding(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                background: 'rgba(255,255,255,0.12)',
                border: 'none',
                color: '#fff',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: '20px',
              }}
              aria-label="Fermer"
            >
              ×
            </button>
          </div>

          {selectedBuilding.attrs && (
            <>
              <div
                style={{
                  opacity: 0.85,
                  marginBottom: 4,
                }}
              >
                {selectedBuilding.attrs.name ||
                  selectedBuilding.attrs.osm_id ||
                  'Bâtiment sans nom'}
              </div>

              {selectedBuilding.height != null && (
                <div style={{ opacity: 0.7, marginBottom: 8 }}>
                  Hauteur : {selectedBuilding.height.toFixed(1)} m
                </div>
              )}
            </>
          )}

          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {JSON.stringify(
              selectedBuilding.attrs ?? selectedBuilding.properties,
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
