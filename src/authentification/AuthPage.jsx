import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

export default function AuthPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: '#0f172a',
          color: '#e2e8f0',
          fontFamily: 'sans-serif',
        }}
      >
        Chargement...
      </div>
    );
  }

  if (user) {
    return <Navigate to="/map" replace />;
  }

  return <Navigate to="/login" replace />;
}