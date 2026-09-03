// src/routes/users.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../database.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const router = Router();

// Toutes les routes de ce fichier nécessitent d'être connecté et d'être administrateur
router.use(authenticateToken, requireRole('administrateur'));

// ==========================================
// READ : Lister tous les utilisateurs
// ==========================================
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare('SELECT id, username, email, role, created_at, updated_at FROM users').all();
    res.json(users);
  } catch (err) {
    console.error('[USERS GET]', err.message);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
  }
});

// ==========================================
// CREATE : Créer un utilisateur
// ==========================================
router.post('/', (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({ error: 'Tous les champs (username, email, password, role) sont requis' });
    }

    if (!['administrateur', 'partenaire', 'citoyen'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }

    const db = getDb();
    const hashedPassword = bcrypt.hashSync(password, 10);

    const stmt = db.prepare(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(username, email, hashedPassword, role);
    
    const newUser = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({ message: 'Utilisateur créé avec succès', user: newUser });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Ce nom d’utilisateur ou cet email est déjà utilisé' });
    }
    console.error('[USERS POST]', err.message);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ==========================================
// UPDATE : Modifier un utilisateur
// ==========================================
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role, password } = req.body;

    if (!['administrateur', 'partenaire', 'citoyen'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }

    const db = getDb();

    // Vérifier si l'utilisateur existe
    const existingUser = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!existingUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    if (password && password.trim() !== '') {
      const hashedPassword = bcrypt.hashSync(password, 10);
      db.prepare(`
        UPDATE users 
        SET username = ?, email = ?, role = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(username, email, role, hashedPassword, id);
    } else {
      db.prepare(`
        UPDATE users 
        SET username = ?, email = ?, role = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(username, email, role, id);
    }

    const updatedUser = db.prepare('SELECT id, username, email, role, updated_at FROM users WHERE id = ?').get(id);
    res.json({ message: 'Utilisateur mis à jour avec succès', user: updatedUser });
  } catch (err) {
    console.error('[USERS PUT]', err.message);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ==========================================
// DELETE : Supprimer un utilisateur
// ==========================================
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    // Sécurité : Empêcher l'administrateur connecté de se supprimer lui-même
    if (req.user.id == id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte administrateur' });
    }

    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (err) {
    console.error('[USERS DELETE]', err.message);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

export default router;