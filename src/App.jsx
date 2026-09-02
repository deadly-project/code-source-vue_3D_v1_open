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

        <p>
          Vous n'avez pas les permissions
          nécessaires pour accéder à cette page.
        </p>
      </div>
    </div>
  );
}

function App() {

  return (
    <BrowserRouter>

      <AuthProvider>

        <Routes>

          {/* =========================
              AUTHENTIFICATION
          ========================= */}

          <Route
            path="/login"
            element={<LoginPage />}
          />

          <Route
            path="/register"
            element={<RegisterPage />}
          />


          {/* =========================
              APPLICATION PROTÉGÉE
          ========================= */}

          <Route
            path="/map"
            element={
              <ProtectedRoute>
                <Map3DViewer />
              </ProtectedRoute>
            }
          />


          {/* =========================
              ACCÈS INTERDIT
          ========================= */}

          <Route
            path="/unauthorized"
            element={<UnauthorizedPage />}
          />


          {/* =========================
              ROUTE PAR DÉFAUT
          ========================= */}

          <Route
            path="/"
            element={
              <Navigate
                to="/login"
                replace
              />
            }
          />


          {/* =========================
              ROUTE INEXISTANTE
          ========================= */}

          <Route
            path="*"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />

        </Routes>

      </AuthProvider>

    </BrowserRouter>
  );
}

export default App;