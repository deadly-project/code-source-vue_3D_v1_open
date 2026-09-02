// routes/dynamicElements.js
//
// API CRUD pour les éléments dynamiques placés sur la maquette 3D
// (cours d'eau, routes, bâtiments) et enregistrés dans la base SQLite.
// Ces éléments sont ajoutés par l'utilisateur directement sur la scène 3D
// et réaffichés selon leur emplacement (dans / hors fokotany).

import { Router } from 'express';
import { getDb } from '../database.js';

const router = Router();

const VALID_TYPES = ['eau', 'route', 'batiment'];

function parsePath(path) {
  try {
    const arr = JSON.parse(path);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

// Liste tous les éléments dynamiques
router.get('/elements', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM dynamic_elements ORDER BY id DESC'
    ).all();
    res.json({
      elements: rows.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        height: r.height,
        distance: r.distance,
        path: parsePath(r.path),
        x: r.x,
        y: r.y,
        in_fokotany: r.in_fokotany === 1,
        created_at: r.created_at,
      })),
    });
  } catch (err) {
    console.error('[ELEMENTS GET]', err.message);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Crée un élément dynamique
// body : { name, type, height?, distance?, path?, in_fokotany }
router.post('/elements', (req, res) => {
  try {
    const { name, type, height = null, distance = null, path = [], in_fokotany = false } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Le nom de l\'élément est requis' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type doit être ${VALID_TYPES.join(', ')}` });
    }

    const coords = Array.isArray(path) ? path : [];
    if (coords.length === 0) {
      return res.status(400).json({ error: 'L\'élément doit avoir au moins un point d\'emplacement' });
    }

    const first = coords[0];
    const x = typeof first[0] === 'number' ? first[0] : 0;
    const y = typeof first[1] === 'number' ? first[1] : 0;

    const db = getDb();
    const result = db.prepare(
      `INSERT INTO dynamic_elements
         (name, type, height, distance, path, x, y, in_fokotany)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      String(name).trim(),
      type,
      height != null ? Number(height) : null,
      distance != null ? Number(distance) : null,
      JSON.stringify(coords),
      x,
      y,
      in_fokotany ? 1 : 0
    );

    const element = db.prepare('SELECT * FROM dynamic_elements WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({
      message: 'Élément créé avec succès',
      element: {
        id: element.id,
        name: element.name,
        type: element.type,
        height: element.height,
        distance: element.distance,
        path: parsePath(element.path),
        x: element.x,
        y: element.y,
        in_fokotany: element.in_fokotany === 1,
        created_at: element.created_at,
      },
    });
  } catch (err) {
    console.error('[ELEMENTS POST]', err.message);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Supprime un élément dynamique
router.delete('/elements/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const db = getDb();
    const existing = db.prepare('SELECT id FROM dynamic_elements WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Élément introuvable' });
    }
    db.prepare('DELETE FROM dynamic_elements WHERE id = ?').run(id);
    res.json({ message: 'Élément supprimé', id });
  } catch (err) {
    console.error('[ELEMENTS DELETE]', err.message);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

export default router;
