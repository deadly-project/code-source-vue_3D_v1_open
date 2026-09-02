// src/components/Map3DViewer.jsx
//
// Point d'entrée principal de la vue 3D.
// Monte la scène React Three Fiber, le panneau d'information du bâtiment
// par défaut sélectionné, ainsi que la gestion des éléments personnalisés
// (bâtiments/routes/cours d'eau ajoutés depuis l'interface) :
//   - barre d'outils (Toolbar) pour démarrer un placement ;
//   - clic sur la maquette -> point capté par Scene3D/PointerGroundPlane ;
//   - formulaire (ElementFormModal) pour saisir nom + hauteur/largeur ;
//   - sauvegarde en base via l'API Express (src/api/elementsApi.js) ;
//   - panneau de détail avec actions "Modifier le tracé" / "Supprimer" ;
//   - édition de tracé en courbe via des poignées glissables (Scene3D
//     bascule en mode 'edit-geometry').

import { useState, useEffect, useCallback } from 'react';
import Scene3D from '../three/Scene3D';
import Toolbar from './Toolbar';
import ElementFormModal from './ElementFormModal';
import { COLORS } from '../three/colors';
import { rectRing } from '../three/extrude';
import {
  listElements,
  createElement,
  updateElement,
  deleteElement,
} from '../api/elementsApi';

const LEGEND_ITEMS = [
  { label: 'Fokotany (relief, survol)', color: COLORS.terrain, hint: 'Couche montée en haut' },
  { label: 'Bâtiments', color: COLORS.building, hint: 'Cliquer pour les détails' },
  { label: 'Routes (highway)', color: COLORS.highway, hint: 'Tronçons haut + bas' },
  { label: 'Cours d\u2019eau', color: COLORS.waterway, hint: 'Tronçons haut + bas' },
  { label: 'Bâtiments ajoutés', color: COLORS.customBuilding, hint: 'Créés depuis l\u2019interface' },
  { label: 'Routes ajoutées', color: COLORS.customHighway, hint: 'Créées depuis l\u2019interface' },
  { label: 'Cours d\u2019eau ajoutés', color: COLORS.customWaterway, hint: 'Créés depuis l\u2019interface' },
];

const panelStyle = {
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
};

const panelHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontWeight: 600,
  marginBottom: 6,
};

const closeBtnStyle = {
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
};

const smallBtnStyle = {
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.28)',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 12,
  whiteSpace: 'nowrap',
};

export default function Map3DViewer() {
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [survol, setSurvol] = useState(40);

  // --- Éléments personnalisés : chargement initial depuis l'API ---
  const [customElements, setCustomElements] = useState([]);
  const [elementsError, setElementsError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listElements()
      .then((res) => {
        if (!cancelled) {
          // Extraction sécurisée du tableau qu'il s'agisse d'un tableau direct ou d'un objet { elements: [...] }
          const data = Array.isArray(res) ? res : (res?.elements || []);
          setCustomElements(data);
        }
      })
      .catch((err) => { if (!cancelled) setElementsError(err.message); });
    return () => { cancelled = true; };
  }, []);

  // --- Mode d'interaction ---
  // 'view' | 'building' | 'water' | 'highway' | 'edit-geometry'
  const [mode, setMode] = useState('view');
  const [draftPoints, setDraftPoints] = useState([]);

  // --- Formulaire de création ---
  const [pendingPayload, setPendingPayload] = useState(null); // { type, center? , geometry? }
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // --- Sélection / édition d'un élément personnalisé existant ---
  const [selectedCustomId, setSelectedCustomId] = useState(null);
  const [editingGeometry, setEditingGeometry] = useState(null);
  const [editingSelectedPointIndex, setEditingSelectedPointIndex] = useState(null);

  const selectedElement = Array.isArray(customElements) 
    ? customElements.find((e) => e.id === selectedCustomId) || null 
    : null;

  // --- Sélection bâtiment par défaut (comportement existant, adapté pour
  //     désélectionner un éventuel élément personnalisé en parallèle) ---
  const handleDefaultBuildingSelect = useCallback((b) => {
    setSelectedCustomId(null);
    setSelectedBuilding(b);
  }, []);

  const handleSelectCustom = useCallback((id) => {
    setSelectedBuilding(null);
    setSelectedCustomId(id);
  }, []);

  // --- Démarrage / annulation d'un placement ---
  const startAddMode = (type) => {
    setSelectedBuilding(null);
    setSelectedCustomId(null);
    setDraftPoints([]);
    setMode(type);
  };

  const cancelPlacement = () => {
    setMode('view');
    setDraftPoints([]);
  };

  const undoLastPoint = () => setDraftPoints((pts) => pts.slice(0, -1));

  // --- Réception d'un clic de placement depuis Scene3D ---
  const handlePick = ({ x, y }) => {

    console.log('📍 Point cliqué - coordonnées brutes:', { x, y });
    
    if (mode === 'building') {
      setPendingPayload({ type: 'building', center: [x, y] });
      setShowForm(true);
    } else if (mode === 'water' || mode === 'highway') {
      setDraftPoints((pts) => [...pts, [x, y]]);
    }
  };

  const finishLine = () => {
    if (draftPoints.length < 2) return;
    setPendingPayload({ type: mode, geometry: draftPoints });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setPendingPayload(null);
    setDraftPoints([]);
    setMode('view');
    setFormError(null);
  };

  // --- Soumission du formulaire -> création en base ---
  const handleFormSubmit = async ({ name, height, largeur, profondeur, width }) => {
    setSubmitting(true);
    setFormError(null);
    try {
      let payload;
      if (pendingPayload.type === 'building') {
        const [cx, cy] = pendingPayload.center;
        const geometry = rectRing(cx, cy, Number(largeur) || 8, Number(profondeur) || 8);
        payload = { type: 'building', name, geometry, height: Number(height) || 3 };
      } else {
        payload = {
          type: pendingPayload.type,
          name,
          path: pendingPayload.geometry, // Correspond à la propriété attendue par le backend (path)
          width: Number(width) || 2,
        };
      }
      const res = await createElement(payload);
      const created = res.element || res; // S'adapte si l'API renvoie { element: {...} } ou l'objet direct
      setCustomElements((els) => [...els, created]);
      setShowForm(false);
      setPendingPayload(null);
      setDraftPoints([]);
      setMode('view');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Suppression ---
  const deleteSelected = async () => {
    if (!selectedElement) return;
    if (!window.confirm(`Supprimer "${selectedElement.name}" ?`)) return;
    try {
      await deleteElement(selectedElement.id);
      setCustomElements((els) => els.filter((e) => e.id !== selectedElement.id));
      setSelectedCustomId(null);
    } catch (err) {
      setElementsError(err.message);
    }
  };

  // --- Édition de tracé (courbe) ---
  const startGeometryEdit = () => {
    if (!selectedElement || selectedElement.type === 'building') return;
    // Utilise 'path' ou 'geometry' selon la structure stockée
    const targetPath = selectedElement.path || selectedElement.geometry || [];
    setEditingGeometry(targetPath.map((p) => [...p]));
    setEditingSelectedPointIndex(null);
    setMode('edit-geometry');
  };

  const cancelGeometryEdit = () => {
    setEditingGeometry(null);
    setEditingSelectedPointIndex(null);
    setMode('view');
  };

  const addPointToEditingLine = () => {
    setEditingGeometry((pts) => {
      if (!pts || pts.length < 2) return pts;
      const [lx, ly] = pts[pts.length - 1];
      const [px, py] = pts[pts.length - 2];
      // Nouveau point prolongeant légèrement le dernier segment ; à
      // glisser ensuite à l'endroit voulu avec la poignée.
      return [...pts, [lx + (lx - px) * 0.3, ly + (ly - py) * 0.3]];
    });
  };

  const removeSelectedEditingPoint = () => {
    setEditingGeometry((pts) => {
      if (!pts || pts.length <= 2 || editingSelectedPointIndex == null) return pts;
      return pts.filter((_, i) => i !== editingSelectedPointIndex);
    });
    setEditingSelectedPointIndex(null);
  };

  const saveGeometryEdit = async () => {
    if (!selectedElement || !editingGeometry) return;
    try {
      // On envoie 'path' pour correspondre au backend SQLite qui gère cette colonne
      const res = await updateElement(selectedElement.id, { 
        name: selectedElement.name,
        type: selectedElement.type,
        height: selectedElement.height,
        distance: selectedElement.distance,
        path: editingGeometry,
        in_fokotany: selectedElement.in_fokotany 
      });
      const updated = res.element || res;
      setCustomElements((els) => els.map((e) => (e.id === updated.id ? updated : e)));
      setEditingGeometry(null);
      setEditingSelectedPointIndex(null);
      setMode('view');
    } catch (err) {
      setElementsError(err.message);
    }
  };

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
      <Scene3D
        onBuildingSelect={handleDefaultBuildingSelect}
        survol={survol}
        customElements={customElements}
        mode={mode}
        draftPoints={draftPoints}
        onPick={handlePick}
        selectedCustomId={selectedCustomId}
        onSelectCustom={handleSelectCustom}
        editingGeometry={editingGeometry}
        onGeometryChange={setEditingGeometry}
        editingSelectedPointIndex={editingSelectedPointIndex}
        onEditingSelectPoint={setEditingSelectedPointIndex}
      />

      {/* Barre d'outils d'ajout (masquée pendant l'édition de tracé) */}
      {mode !== 'edit-geometry' && (
        <Toolbar
          mode={mode}
          onStartAdd={startAddMode}
          onCancel={cancelPlacement}
          draftCount={draftPoints.length}
          onFinishLine={finishLine}
          onUndoPoint={undoLastPoint}
        />
      )}

      {/* Barre d'édition de tracé (courbe) */}
      {mode === 'edit-geometry' && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(18, 18, 22, 0.9)',
            color: '#fff',
            padding: '8px 10px',
            borderRadius: 10,
            fontSize: 12.5,
            fontFamily: 'system-ui, sans-serif',
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <span>Glissez les points pour courber le tracé</span>
          <button style={smallBtnStyle} onClick={addPointToEditingLine}>+ Point</button>
          <button
            style={smallBtnStyle}
            onClick={removeSelectedEditingPoint}
            disabled={editingSelectedPointIndex == null}
          >
            Supprimer le point
          </button>
          <button
            style={{ ...smallBtnStyle, background: '#7c4dff', borderColor: '#7c4dff' }}
            onClick={saveGeometryEdit}
          >
            Enregistrer
          </button>
          <button style={smallBtnStyle} onClick={cancelGeometryEdit}>Annuler</button>
        </div>
      )}

      {/* Contrôle du survol (dynamique, 0 m -> infini) */}
      <div
        style={{
          position: 'absolute',
          top: mode === 'view' ? 16 : 68,
          left: 16,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(18, 18, 22, 0.9)',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: 10,
          fontSize: 12.5,
          fontFamily: 'system-ui, sans-serif',
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          backdropFilter: 'blur(4px)',
        }}
      >
        <label htmlFor="survol-input" style={{ opacity: 0.9, whiteSpace: 'nowrap' }}>
          Survol :
        </label>
        <input
          id="survol-input"
          type="number"
          min="0"
          step="1"
          value={survol}
          onChange={(e) => {
            const v = Number(e.target.value);
            setSurvol(Number.isFinite(v) && v >= 0 ? v : 0);
          }}
          style={{
            width: 72,
            padding: '4px 6px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.25)',
            color: '#fff',
            borderRadius: 6,
            fontSize: 12.5,
          }}
        />
        <span style={{ opacity: 0.6, whiteSpace: 'nowrap' }}>m</span>
      </div>

      {/* Légende permanente de la carte */}
      <div
        style={{
          position: 'absolute',
          top: mode === 'view' ? 64 : 116,
          left: 16,
          minWidth: 190,
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
        <div style={{ fontWeight: 600, marginBottom: 8, letterSpacing: 0.4, opacity: 0.9 }}>
          Légende
        </div>
        {LEGEND_ITEMS.map((item) => (
          <div
            key={item.label}
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, whiteSpace: 'nowrap' }}
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

      {/* Panneau du bâtiment par défaut sélectionné (comportement existant) */}
      {selectedBuilding && (
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>Bâtiment sélectionné</span>
            <button onClick={() => setSelectedBuilding(null)} style={closeBtnStyle} aria-label="Fermer">
              ×
            </button>
          </div>

          {selectedBuilding.attrs && (
            <>
              <div style={{ opacity: 0.85, marginBottom: 4 }}>
                {selectedBuilding.attrs.name || selectedBuilding.attrs.osm_id || 'Bâtiment sans nom'}
              </div>
              {selectedBuilding.height != null && (
                <div style={{ opacity: 0.7, marginBottom: 8 }}>
                  Hauteur : {selectedBuilding.height.toFixed(1)} m
                </div>
              )}
            </>
          )}

          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {JSON.stringify(selectedBuilding.attrs ?? selectedBuilding.properties, null, 2)}
          </pre>
        </div>
      )}

      {/* Panneau de l'élément personnalisé sélectionné */}
      {selectedElement && mode !== 'edit-geometry' && (
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>
              {selectedElement.type === 'building'
                ? 'Bâtiment ajouté'
                : selectedElement.type === 'water'
                ? "Cours d'eau ajouté"
                : 'Route ajoutée'}
            </span>
            <button onClick={() => setSelectedCustomId(null)} style={closeBtnStyle} aria-label="Fermer">
              ×
            </button>
          </div>

          <div style={{ opacity: 0.85, marginBottom: 4 }}>{selectedElement.name}</div>

          {selectedElement.type === 'building' ? (
            <div style={{ opacity: 0.7, marginBottom: 4 }}>Hauteur : {selectedElement.height} m</div>
          ) : (
            <div style={{ opacity: 0.7, marginBottom: 4 }}>Largeur : {selectedElement.width} m</div>
          )}

          <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 12 }}>
            Créé le {new Date(selectedElement.created_at || selectedElement.createdAt).toLocaleString('fr-FR')}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {selectedElement.type !== 'building' && (
              <button style={smallBtnStyle} onClick={startGeometryEdit}>
                Modifier le tracé
              </button>
            )}
            <button
              style={{ ...smallBtnStyle, borderColor: '#ff6d6d', color: '#ff6d6d' }}
              onClick={deleteSelected}
            >
              Supprimer
            </button>
          </div>
        </div>
      )}

      {elementsError && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            zIndex: 20,
            background: 'rgba(176,0,32,0.9)',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 12.5,
            fontFamily: 'system-ui, sans-serif',
            maxWidth: 320,
          }}
        >
          {elementsError}
        </div>
      )}

      {showForm && pendingPayload && (
        <ElementFormModal
          type={pendingPayload.type}
          submitting={submitting}
          error={formError}
          onSubmit={handleFormSubmit}
          onCancel={cancelForm}
        />
      )}
    </div>
  );
}