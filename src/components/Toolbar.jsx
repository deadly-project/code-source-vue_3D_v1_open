// src/components/Toolbar.jsx
//
// Barre d'outils : bascule entre les modes de placement d'éléments
// personnalisés (bâtiment / route / cours d'eau) et affiche les actions
// contextuelles (terminer un tracé, annuler le dernier point, etc.).

const btnStyle = (active) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 12px',
  borderRadius: 8,
  border: active ? '1px solid rgba(124,77,255,0.9)' : '1px solid rgba(255,255,255,0.22)',
  background: active ? 'rgba(124,77,255,0.28)' : 'rgba(255,255,255,0.08)',
  color: '#fff',
  fontSize: 12.5,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
});

export default function Toolbar({ mode, onStartAdd, onCancel, draftCount, onFinishLine, onUndoPoint }) {
  const isDrawingLine = mode === 'water' || mode === 'highway';

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(18, 18, 22, 0.9)',
        padding: '8px 10px',
        borderRadius: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        fontFamily: 'system-ui, sans-serif',
        backdropFilter: 'blur(4px)',
        maxWidth: 'calc(100% - 32px)',
      }}
    >
      {mode === 'view' && (
        <>
          <button style={btnStyle(false)} onClick={() => onStartAdd('building')}>+ Bâtiment</button>
          <button style={btnStyle(false)} onClick={() => onStartAdd('water')}>+ Cours d&rsquo;eau</button>
          <button style={btnStyle(false)} onClick={() => onStartAdd('highway')}>+ Route</button>
        </>
      )}

      {mode === 'building' && (
        <>
          <span style={{ color: '#fff', fontSize: 12.5 }}>
            Cliquez sur la maquette pour poser le bâtiment
          </span>
          <button style={btnStyle(false)} onClick={onCancel}>Annuler</button>
        </>
      )}

      {isDrawingLine && (
        <>
          <span style={{ color: '#fff', fontSize: 12.5 }}>
            Cliquez pour ajouter des points ({draftCount})
          </span>
          <button style={btnStyle(false)} onClick={onUndoPoint} disabled={draftCount === 0}>
            Annuler le dernier point
          </button>
          <button style={btnStyle(true)} onClick={onFinishLine} disabled={draftCount < 2}>
            Terminer le tracé
          </button>
          <button style={btnStyle(false)} onClick={onCancel}>Annuler</button>
        </>
      )}
    </div>
  );
}