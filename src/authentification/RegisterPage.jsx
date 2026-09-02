import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import './auth.css';

const ROLES = [
  { value: 'citoyen', label: 'Citoyen' },
  { value: 'partenaire', label: 'Partenaire' },
  { value: 'administrateur', label: 'Administrateur' },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'citoyen',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (formData.password.length < 8) {
      setError(
        'Le mot de passe doit contenir au moins 8 caractères'
      );
      return;
    }

    setLoading(true);

    try {
      await register(
        formData.username,
        formData.email,
        formData.password,
        formData.role
      );

      navigate('/map', { replace: true });

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
          <h1 className="auth-title">
            Opencode
          </h1>

          <p className="auth-subtitle">
            Créer un nouveau compte
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">
              Nom d'utilisateur
            </label>

            <input
              id="username"
              name="username"
              type="text"
              value={formData.username}
              onChange={handleChange}
              placeholder="mon_username"
              required
              minLength={3}
              maxLength={30}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-email">
              Email
            </label>

            <input
              id="reg-email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="votre@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-password">
              Mot de passe
            </label>

            <input
              id="reg-password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Min. 8 caractères"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              Confirmer le mot de passe
            </label>

            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Retapez le mot de passe"
              required
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">
              Rôle
            </label>

            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
            >
              {ROLES.map((r) => (
                <option
                  key={r.value}
                  value={r.value}
                >
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="auth-btn"
            disabled={loading}
          >
            {loading
              ? 'Création...'
              : "S'inscrire"}
          </button>

        </form>

        <div className="auth-footer">
          <p>
            Déjà un compte ?{' '}

            <button
              type="button"
              className="auth-link"
              onClick={() => navigate('/login')}
            >
              Se connecter
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}