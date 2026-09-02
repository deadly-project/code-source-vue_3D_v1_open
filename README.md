# Vue 3D cartographique — React + React Three Fiber

Application Web React qui reproduit fidèlement le modèle 3D cartographique
obtenu dans **QGIS 3D**, construite à partir des **données géospatiales réelles**
(GPKG + TIFF), sans iframe, sans capture d'écran, sans modèle fictif.

## Architecture

```
QGIS/GPKG/TIFF
      │  (scripts/inspect-data.py : diagnostic)
      ▼
analyse géospatiale (CRS, bounds, statistiques)
      │
      ▼
repère local commun (origine du projet QGIS 3D)
      │  (scripts/preprocess.py : conversion + reprojection)
      ▼
données optimisées pour le navigateur (public/data/*.json)
      │
      ▼
React + React Three Fiber
      │
      ▼
terrain + bâtiments + routes + cours d'eau → scène 3D interactive
```

## Commencer

### Prérequis

- Node.js ≥ 18
- Python 3 avec **GDAL** (`gdal`, `ogr`, `osr` via `osgeo`)
  et `numpy`. Sur la plupart des distributions :

  ```bash
  # Ubuntu/Debian
  apt install python3-gdal python3-numpy
  # ou via pip
  pip install gdal numpy
  ```

### Installer les dépendances

```bash
npm install
```

### 1 — Lancer le preprocessing (à partir des données source)

Les données sources se trouvent dans `scripts/source-data/` :

- `buildingfinale.gpkg`
- `highwayfinale.gpkg`
- `waterwayfinale.gpkg`
- `fokotanyfinale.tif` (+ `.aux.xml`)
- `terrain.webp` (texture du DEM)

```bash
npm run preprocess
```

Cette commande lit les GPKG/TIFF et génère :

```
public/data/
├── meta.json          (origine + métadonnées du repère local)
├── terrain.json       (grille DEM + emprise + altitudes)
├── terrain.webp       (texture du terrain)
├── buildings.json     (footprints + hauteurs + attributs)
├── highways.json      (routes, reprojetées EPSG:4326 → 32738)
└── waterways.json     (cours d'eau)
```

> Reproducible : effacez `public/data/*` et relancez `npm run preprocess`,
> les mêmes fichiers sont régénérés. Les fichiers sources originaux ne sont
> **jamais modifiés**.

### 2 — Lancer le serveur de dev

```bash
npm run dev
```

puis ouvrez l'URL affichée (par défaut `http://localhost:5173/`).

### 3 — Build de production

```bash
npm run build
npm run preview
```

## Diagnostic des données

Affiche le CRS, le nombre d'entités, les bounds, les unités et les
statistiques de chaque couche :

```bash
npm run inspect
```

## Transformations géographiques utilisées

Toutes les transformations reposent sur des **valeurs réelles** mesurées
dans les fichiers (aucune valeur arbitraire).

### Origine du repère local (EPSG:32738)

L'origine provient du **projet QGIS 3D de référence**
(`Previews/data/index/scene.json`) :

```
originX = 765510.1784336022
originY = 7908299.210718792
originZ = 0.0
```

Transformation vers le repère local (métrique, Z up) :

```
X_local = X_utm − originX
Y_local = Y_utm − originY
Z_local = altitude réelle × zScale  (zScale = 1.0)
```

Utiliser la **même origine** que QGIS garantit une correspondance spatiale
exacte entre le rendu React et le modèle QGIS 3D de référence.

### CRS de chaque couche

| Couche      | CRS source          | Reprojection |
|-------------|---------------------|--------------|
| Bâtiments   | EPSG:32738          | —            |
| Routes      | **EPSG:4326**       | → EPSG:32738 |
| Cours d'eau | EPSG:32738          | —            |
| DEM (TIF)   | EPSG:32738          | —            |

Les routes (EPSG:4326, degrés) sont reprojetées en EPSG:32738 via GDAL
avant d'entrer dans le repère local commun. **Aucun mélange direct** de CRS
n'est effectué.

### Terrain (fokotanyfinale.tif)

- Grille : **30 × 40** cellules
- Résolution : ~29.8 m × ~30.3 m (UTM)
- Emprise : x ∈ [764857, 765753], y ∈ [7907449, 7908661]
- Altitudes : **1249 → 1263 m** (réelles)
- NoData = **0** (≈ 69 % des cellules)

Le NoData est traité par **interpolation des voisins valides** (remplissage
itératif) afin d'éviter les pics/trous artificiels ; les cellules restantes
isolées prennent la moyenne globale. L'échelle verticale est **1.0** avec un
décalage de **0** (valeurs QGIS respectées).

### Bâtiments (buildingfinale.gpkg)

- **3 465** bâtiments, géométrie **MultiPolygon** réelle
- Footprints préservés (pas de centroïde pour reconstruire la forme)
- Aucune hauteur exploitable dans les attributs (`height` = 0 partout,
  `building:levels` = 2 bâtiments), sauf 2 bâtiments à partir de `levels`.
- Stratégie documentée :
  - `height` > 0 → utilisé
  - sinon `building:levels` × 3 m → utilisé
  - sinon **hauteur par défaut = 8 m** (constante, identique pour tous)
- Chaque bâtiment est posé à l'**altitude du terrain** échantillonnée au
  centroïde de son footprint (interpolation bilinéaire).

### Routes (highwayfinale.gpkg)

- 290 LineStrings réelles, reprojetées EPSG:4326 → EPSG:32738
- Suivent le relief : chaque point est projeté verticalement à l'altitude
  du terrain (échantillonnage bilinéaire).

### Cours d'eau (waterwayfinale.gpkg)

- 9 LineStrings réelles, traitées comme les routes
- Attributs conservés (`waterway`, `name`, `width`, `tunnel`, `layer`).

## Rendu 3D

- React Three Fiber + drei
- `OrbitControls` (zoom / rotation / pan / damping)
- Auto-fit de la caméra via `THREE.Box3` (centre + distance calculés de
  l'emprise réelle, aucun `position` codé en dur)
- Éclairage (ambiant + directionnel avec ombres + hémisphérique)
- Matériaux : terrain texturé (WebP), bâtiments gris avec flat shading,
  routes brunes claires, cours d'eau bleus

## Interactivité

- Clic sur un bâtiment → sélection
- Bâtiment sélectionné surligné en jaune
- Panneau d'information montrant les attributs (nom, osm_id, hauteur, etc.)
- Bouton fermer

La grande géométrie (tous les bâtiments) est fusionnée en **une seule
`BufferGeometry`** (perf) ; la correspondance `face → buildingId` est
conservée pour la sélection individuelle au clic.

## Structure

```
src/
├── components/
│   └── Map3DViewer.jsx        (point d'entrée, panneau d'info)
├── three/
│   ├── Scene3D.jsx            (Canvas, éclairage, montage)
│   ├── Terrain.jsx            (maillage DEM)
│   ├── Buildings.jsx          (extrusions + sélection)
│   ├── NetworkLines.jsx       (routes + cours d'eau)
│   ├── CameraController.jsx   (auto-fit caméra)
│   └── coordinateUtils.js     (origine du repère local)
└── utils/
    └── loadData.js            (chargement + échantillonnage terrain)

scripts/
├── inspect-data.py            (diagnostic CRS/bounds/stats)
└── preprocess.py              (conversion géospatiale)

public/data/                   (données générées, à ne pas committer si l'on
                                préfère les régénérer via npm run preprocess)
```
