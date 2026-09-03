// src/components/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { listElements } from '../api/elementsApi';
import AdminUsers from './AdminUsers'; // Importation du composant CRUD utilisateurs

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('stats'); // 'stats' | 'users'
  const [stats, setStats] = useState({ total: 0, buildings: 0, highways: 0, waters: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    listElements()
      .then((res) => {
        const data = Array.isArray(res) ? res : (res?.elements || []);
        
        // Calcul des statistiques par type d'élément
        const buildings = data.filter(e => e.type === 'building').length;
        const highways = data.filter(e => e.type === 'highway').length;
        const waters = data.filter(e => e.type === 'water').length;

        setStats({
          total: data.length,
          buildings,
          highways,
          waters,
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={containerStyle}>
      <h1 style={{ marginBottom: 10 }}>Administration système</h1>
      <p style={{ opacity: 0.7, marginBottom: 20 }}>
        Panneau de contrôle global, métriques des éléments 3D et gestion des accès utilisateurs.
      </p>

      {/* Barre d'onglets pour naviguer entre les métriques et les utilisateurs */}
      <div style={tabsContainerStyle}>
        <button
          onClick={() => setActiveTab('stats')}
          style={{
            ...tabBtnStyle,
            ...(activeTab === 'stats' ? activeTabStyle : {}),
          }}
        >
          Métriques 3D
        </button>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            ...tabBtnStyle,
            ...(activeTab === 'users' ? activeTabStyle : {}),
          }}
        >
          Gestion des Utilisateurs
        </button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      {/* Contenu affiché selon l'onglet actif */}
      {activeTab === 'stats' ? (
        <div>
          {loading ? (
            <p>Calcul des statistiques en cours...</p>
          ) : (
            <div style={gridStyle}>
              <div style={statCardStyle}>
                <span style={statNumberStyle}>{stats.total}</span>
                <span style={statLabelStyle}>Total Éléments Personnalisés</span>
              </div>
              <div style={statCardStyle}>
                <span style={{ ...statNumberStyle, color: '#3b82f6' }}>{stats.buildings}</span>
                <span style={statLabelStyle}>Bâtiments Ajoutés</span>
              </div>
              <div style={statCardStyle}>
                <span style={{ ...statNumberStyle, color: '#10b981' }}>{stats.highways}</span>
                <span style={statLabelStyle}>Routes Ajoutées</span>
              </div>
              <div style={statCardStyle}>
                <span style={{ ...statNumberStyle, color: '#06b6d4' }}>{stats.waters}</span>
                <span style={statLabelStyle}>Cours d'eau Ajoutés</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: 'rgba(20, 20, 24, 0.92)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
          <AdminUsers />
        </div>
      )}
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

const tabsContainerStyle = {
  display: 'flex',
  gap: '10px',
  marginBottom: '25px',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  paddingBottom: '10px',
};

const tabBtnStyle = {
  padding: '10px 20px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#94a3b8',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '500',
  transition: 'all 0.2s',
};

const activeTabStyle = {
  background: '#3b82f6',
  color: '#fff',
  borderColor: '#3b82f6',
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '20px',
  maxWidth: '900px',
};

const statCardStyle = {
  background: 'rgba(20, 20, 24, 0.92)',
  padding: '24px',
  borderRadius: 12,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
  border: '1px solid rgba(255,255,255,0.08)',
};

const statNumberStyle = {
  fontSize: '36px',
  fontWeight: 'bold',
  marginBottom: '8px',
};

const statLabelStyle = {
  fontSize: '13px',
  opacity: 0.7,
  textAlign: 'center',
};

const errorStyle = {
  background: 'rgba(176,0,32,0.9)',
  color: '#fff',
  padding: '10px 14px',
  borderRadius: 8,
  marginBottom: 20,
  maxWidth: 400,
};