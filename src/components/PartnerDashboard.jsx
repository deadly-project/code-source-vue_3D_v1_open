// src/components/PartnerDashboard.jsx
import { useState, useEffect } from 'react';
import { listElements } from '../api/elementsApi';

export default function PartnerDashboard() {
  const [elements, setElements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listElements()
      .then((res) => {
        const data = Array.isArray(res) ? res : (res?.elements || []);
        setElements(data);
      })
      .catch((err) => console.error("Erreur chargement:", err))
      .finally(() => setLoading(false));
  }, []);

  // Fonction pour attribuer une couleur selon le type d'élément 3D
  const getTypeBadgeStyle = (type) => {
    let background = '#3b82f6'; // Par défaut (building)
    if (type === 'highway') background = '#10b981';
    if (type === 'water') background = '#06b6d4';

    return {
      padding: '3px 10px',
      borderRadius: '12px',
      fontSize: '11px',
      background,
      color: '#fff',
      textTransform: 'uppercase',
      fontWeight: 'bold',
      letterSpacing: '0.5px',
    };
  };

  return (
    <div style={containerStyle}>
      <h1 style={{ marginBottom: 10 }}>Tableau de bord Partenaire</h1>
      <p style={{ opacity: 0.7, marginBottom: 25 }}>
        Espace de suivi des infrastructures et des éléments cartographiques enregistrés.
      </p>

      {/* Résumé rapide */}
      <div style={statsOverviewStyle}>
        <div style={miniCardStyle}>
          <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{elements.length}</span>
          <span style={{ fontSize: '12px', opacity: 0.7 }}>Éléments totaux</span>
        </div>
      </div>

      {/* Tableau détaillé des éléments */}
      <div style={cardStyle}>
        <h3 style={{ marginBottom: 15 }}>Éléments enregistrés récents</h3>
        {loading ? (
          <p style={{ padding: '20px', textAlign: 'center' }}>Chargement des données...</p>
        ) : elements.length === 0 ? (
          <p style={{ opacity: 0.5, marginTop: 10 }}>Aucun élément personnalisé créé pour le moment.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '13px' }}>
                  <th style={{ padding: '12px' }}>ID</th>
                  <th style={{ padding: '12px' }}>Nom</th>
                  <th style={{ padding: '12px' }}>Type</th>
                  <th style={{ padding: '12px' }}>Hauteur</th>
                  <th style={{ padding: '12px' }}>Date de création</th>
                </tr>
              </thead>
              <tbody>
                {elements.map((el) => (
                  <tr key={el.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '14px' }}>
                    <td style={{ padding: '12px', opacity: 0.6 }}>#{el.id}</td>
                    <td style={{ padding: '12px', fontWeight: '500' }}>{el.name}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={getTypeBadgeStyle(el.type)}>{el.type}</span>
                    </td>
                    <td style={{ padding: '12px' }}>{el.height ? `${el.height}m` : '-'}</td>
                    <td style={{ padding: '12px', opacity: 0.7, fontSize: '13px' }}>
                      {el.created_at ? new Date(el.created_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const containerStyle = {
  padding: '30px',
  color: '#fff',
  fontFamily: 'system-ui, sans-serif',
  background: '#111318',
  minHeight: 'calc(100vh - 60px)',
};

const statsOverviewStyle = {
  display: 'flex',
  gap: '15px',
  marginBottom: '25px',
};

const miniCardStyle = {
  background: 'rgba(20, 20, 24, 0.92)',
  padding: '15px 25px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const cardStyle = {
  background: 'rgba(20, 20, 24, 0.92)',
  padding: '24px',
  borderRadius: '12px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
  border: '1px solid rgba(255,255,255,0.08)',
};