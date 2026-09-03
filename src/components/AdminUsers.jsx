// src/components/AdminUsers.jsx
import { useState, useEffect } from 'react';
import { api } from '../authentification/AxiosConfig.js';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // États du formulaire (Création / Édition)
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'citoyen',
  });

  // Charger les utilisateurs (Correction de l'URL pour correspondre à /api/admin/users)
  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (err) {
      setError('Impossible de charger la liste des utilisateurs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Gérer la soumission du formulaire (Création ou Modification)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (isEditing) {
        await api.put(`/admin/users/${currentId}`, formData);
      } else {
        await api.post('/admin/users', formData);
      }
      
      // Réinitialiser le formulaire et recharger la liste
      setFormData({ username: '', email: '', password: '', role: 'citoyen' });
      setIsEditing(false);
      setCurrentId(null);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Une erreur est survenue.');
    }
  };

  // Préparer l'édition d'un utilisateur
  const handleEdit = (user) => {
    setIsEditing(true);
    setCurrentId(user.id);
    setFormData({
      username: user.username,
      email: user.email,
      password: '', // Laisser vide si on ne souhaite pas modifier le mot de passe
      role: user.role,
    });
  };

  // Supprimer un utilisateur
  const handleDelete = async (id) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet utilisateur ?')) return;

    try {
      await api.delete(`/admin/users/${id}`);
      setUsers(users.filter((u) => u.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur lors de la suppression.');
    }
  };

  if (loading) return <div style={{ color: '#fff', padding: 20 }}>Chargement des utilisateurs...</div>;

  return (
    <div style={{ padding: '20px', color: '#fff', fontFamily: 'sans-serif' }}>
      <h2>Gestion des Utilisateurs</h2>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', padding: 10, borderRadius: 6, marginBottom: 15 }}>
          {error}
        </div>
      )}

      {/* Formulaire de création / modification */}
      <form onSubmit={handleSubmit} style={{ background: '#1e293b', padding: 20, borderRadius: 8, marginBottom: 30, display: 'grid', gap: 15, maxWidth: 600 }}>
        <h3>{isEditing ? "Modifier l'utilisateur" : 'Ajouter un nouvel utilisateur'}</h3>
        
        <div>
          <label style={{ display: 'block', marginBottom: 5 }}>Nom d'utilisateur</label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            required
            style={{ width: '100%', padding: 8, borderRadius: 4, background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 5 }}>Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            style={{ width: '100%', padding: 8, borderRadius: 4, background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 5 }}>
            Mot de passe {isEditing && '(laisser vide pour ne pas modifier)'}
          </label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            {...(!isEditing && { required: true })}
            style={{ width: '100%', padding: 8, borderRadius: 4, background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 5 }}>Rôle</label>
          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            style={{ width: '100%', padding: 8, borderRadius: 4, background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
          >
            <option value="citoyen">Citoyen</option>
            <option value="partenaire">Partenaire</option>
            <option value="administrateur">Administrateur</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" style={{ padding: '10px 15px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>
            {isEditing ? 'Mettre à jour' : 'Créer'}
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setFormData({ username: '', email: '', password: '', role: 'citoyen' });
              }}
              style={{ padding: '10px 15px', background: '#64748b', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      {/* Tableau des utilisateurs */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e293b', borderRadius: 8, overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: '#334155', textAlign: 'left' }}>
              <th style={{ padding: 12 }}>ID</th>
              <th style={{ padding: 12 }}>Nom d'utilisateur</th>
              <th style={{ padding: 12 }}>Email</th>
              <th style={{ padding: 12 }}>Rôle</th>
              <th style={{ padding: 12 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #334155' }}>
                <td style={{ padding: 12 }}>{u.id}</td>
                <td style={{ padding: 12 }}>{u.username}</td>
                <td style={{ padding: 12 }}>{u.email}</td>
                <td style={{ padding: 12 }}>
                  <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 12, background: u.role === 'administrateur' ? '#ef4444' : u.role === 'partenaire' ? '#f59e0b' : '#3b82f6', color: '#fff', textTransform: 'uppercase' }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: 12, display: 'flex', gap: 10 }}>
                  <button onClick={() => handleEdit(u)} style={{ padding: '5px 10px', background: '#f59e0b', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>
                    Modifier
                  </button>
                  <button onClick={() => handleDelete(u.id)} style={{ padding: '5px 10px', background: '#ef4444', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}