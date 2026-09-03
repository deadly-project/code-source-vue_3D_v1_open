// src/authentification/LoginPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import './auth.css';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError('');
    setLoading(true);

    try {
      // La fonction login retourne les données de l'utilisateur (userData)
      const user = await login(email, password);

      // Redirection dynamique selon le rôle de l'utilisateur
      if (user?.role === 'administrateur') {
        navigate('/admin/dashboard', { replace: true });
      } else if (user?.role === 'partenaire') {
        navigate('/partner/dashboard', { replace: true });
      } else {
        navigate('/map', { replace: true });
      }

    } catch (err) {
      const msg =
        err.response?.data?.error ||
        'Erreur de connexion au serveur';

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Opencode</h1>
          <p className="auth-subtitle">
            Connectez-vous à votre compte
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="auth-btn"
            disabled={loading}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Pas encore de compte ?{' '}
            <button
              type="button"
              className="auth-link"
              onClick={() => navigate('/register')}
            >
              Créer un compte
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}