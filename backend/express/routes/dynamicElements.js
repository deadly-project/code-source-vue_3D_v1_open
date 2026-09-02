// routes/dynamicElements.js
import { Router } from 'express';
import { getDb } from '../database.js';

const router = Router();

const VALID_TYPES = ['water', 'highway', 'building', 'eau', 'route', 'batiment'];

// Traduction anglais -> français (pour l'insertion)
const TYPE_MAP_TO_FRENCH = {
    'water': 'eau',
    'highway': 'route',
    'building': 'batiment'
};

// Traduction français -> anglais (pour l'affichage)
const TYPE_MAP_TO_ENGLISH = {
    'eau': 'water',
    'route': 'highway',
    'batiment': 'building'
};

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
        type: TYPE_MAP_TO_ENGLISH[r.type] || r.type, // Traduction en anglais
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
router.post('/elements', (req, res) => {
  try {
    const { name, type, height = null, distance = null, path, geometry, in_fokotany = false } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Le nom de l\'élément est requis' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type doit être ${VALID_TYPES.join(', ')}` });
    }
    
    // Traduction anglais -> français pour la base de données
    let dbType = TYPE_MAP_TO_FRENCH[type] || type;

    // Récupère les points depuis 'path' ou 'geometry' indifféremment
    const rawCoords = Array.isArray(path) && path.length > 0 ? path : geometry;
    const coords = Array.isArray(rawCoords) ? rawCoords : [];
    
    if (coords.length === 0) {
      return res.status(400).json({ error: 'L\'élément doit avoir au moins un point d\'emplacement' });
    }

    const first = coords[0];
    const x = typeof req.body.x === 'number'
      ? req.body.x
      : (typeof first?.[0] === 'number' ? first[0] : 0);

    const y =
    typeof req.body.y === 'number'
      ? req.body.y
      : (typeof first?.[1] === 'number' ? first[1] : 0);
    
      const db = getDb();
    const result = db.prepare(
      `INSERT INTO dynamic_elements
         (name, type, height, distance, path, x, y, in_fokotany)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      String(name).trim(),
      dbType,  // Type en français pour la base
      height != null ? Number(height) : null,
      distance != null ? Number(distance) : null,
      JSON.stringify(coords),
      x,
      y,
      in_fokotany ? 1 : 0
    );

    const element = db.prepare('SELECT * FROM dynamic_elements WHERE id = ?').get(result.lastInsertRowid);
    
    // ⚠️ CORRECTION : Retourner le type en anglais pour le frontend
    res.status(201).json({
      message: 'Élément créé avec succès',
      element: {
        id: element.id,
        name: element.name,
        type: TYPE_MAP_TO_ENGLISH[element.type] || element.type, // Traduction en anglais
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