// src/App.jsx
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { AuthProvider } from './authentification/AuthContext.jsx';
import LoginPage from './authentification/LoginPage.jsx';
import RegisterPage from './authentification/RegisterPage.jsx';
import ProtectedRoute from './authentification/ProtectedRoute.jsx';

import Map3DViewer from './components/Map3DViewer.jsx';
import PartnerDashboard from './components/PartnerDashboard.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import Navbar from './components/Navbar.jsx';

function UnauthorizedPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1>Accès interdit</h1>
        <p>Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
      </div>
    </div>
  );
}

// Composant de disposition (Layout) qui gère l'espace de la sidebar
function MainLayout({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#111318' }}>
      {/* Sidebar fixe à gauche */}
      <Navbar />
      
      {/* Contenu principal décalé vers la droite de 260px pour ne pas être écrasé */}
      <div style={{ marginLeft: '260px', flex: 1, width: 'calc(100% - 260px)' }}>
        {children}
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Routes Publiques (Sans sidebar) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Routes Protégées (Avec la sidebar et le décalage) */}
          <Route
            path="/map"
            element={
              <ProtectedRoute allowedRoles={['citoyen', 'partenaire', 'administrateur']}>
                <MainLayout>
                  <Map3DViewer />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/partner/dashboard"
            element={
              <ProtectedRoute allowedRoles={['partenaire', 'administrateur']}>
                <MainLayout>
                  <PartnerDashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['administrateur']}>
                <MainLayout>
                  <AdminDashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* Page d'accès non autorisé (protégée ou avec layout optionnel) */}
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;