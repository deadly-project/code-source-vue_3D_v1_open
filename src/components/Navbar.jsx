// src/components/Navbar.jsx
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../authentification/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (!user) return null;

  return (
    <nav style={sidebarStyle}>
      {/* En-tête de la Sidebar : Rôle / Marque */}
      <div style={sidebarHeaderStyle}>
        <span style={{ fontWeight: 'bold', fontSize: 18, color: '#fff' }}>Opencode</span>
        <span style={roleBadgeStyle}>{user.role}</span>
      </div>

      {/* Liens de navigation verticaux avec NavLink */}
      <div style={sidebarLinksStyle}>
        <NavLink 
          to="/map" 
          style={({ isActive }) => ({
            ...linkStyle,
            ...(isActive ? activeLinkStyle : {})
          })}
        >
          🗺️ Carte 3D
        </NavLink>

        {(user.role === 'partenaire' || user.role === 'administrateur') && (
          <NavLink 
            to="/partner/dashboard" 
            style={({ isActive }) => ({
              ...linkStyle,
              ...(isActive ? activeLinkStyle : {})
            })}
          >
            📊 Espace Partenaire
          </NavLink>
        )}

        {user.role === 'administrateur' && (
          <NavLink 
            to="/admin/dashboard" 
            style={({ isActive }) => ({
              ...linkStyle,
              ...(isActive ? activeLinkStyle : {})
            })}
          >
            ⚙️ Administration
          </NavLink>
        )}
      </div>

      {/* Section Utilisateur / Déconnexion en bas de la sidebar */}
      <div style={sidebarFooterStyle}>
        <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8, wordBreak: 'break-all' }}>
          {user.username}
        </div>
        <button onClick={handleLogout} style={logoutBtnStyle}>
          Déconnexion
        </button>
      </div>
    </nav>
  );
}

// ==========================================
// STYLES DE LA SIDEBAR LATÉRALE
// ==========================================

const sidebarStyle = {
  width: '260px',
  height: '100vh',
  backgroundColor: 'rgba(15, 23, 42, 0.98)',
  borderRight: '1px solid rgba(255,255,255,0.1)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: '20px',
  color: '#fff',
  fontFamily: 'system-ui, sans-serif',
  position: 'fixed',
  top: 0,
  left: 0,
  zIndex: 100,
  boxSizing: 'border-box',
};

const sidebarHeaderStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  paddingBottom: '20px',
};

const roleBadgeStyle = {
  fontSize: '11px',
  padding: '4px 10px',
  borderRadius: '12px',
  background: '#3b82f6',
  color: '#fff',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  fontWeight: 'bold',
  alignSelf: 'flex-start',
};

const sidebarLinksStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  marginTop: '20px',
  flexGrow: 1,
};

const linkStyle = {
  color: '#cbd5e1',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: '500',
  padding: '10px 12px',
  borderRadius: '8px',
  transition: 'all 0.2s',
  display: 'block',
};

// Style appliqué spécifiquement au lien actif (Page courante)
const activeLinkStyle = {
  backgroundColor: 'rgba(59, 130, 246, 0.15)',
  color: '#3b82f6',
  fontWeight: '600',
  borderLeft: '4px solid #3b82f6',
  paddingLeft: '8px', // Compense légèrement la bordure pour l'alignement
};

const sidebarFooterStyle = {
  borderTop: '1px solid rgba(255,255,255,0.1)',
  paddingTop: '15px',
  display: 'flex',
  flexDirection: 'column',
};

const logoutBtnStyle = {
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid rgba(239, 68, 68, 0.4)',
  background: 'rgba(239, 68, 68, 0.1)',
  color: '#fca5a5',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '500',
  textAlign: 'center',
  width: '100%',
};