// src/utils/loadData.js
//
// Charge les données prétraitées (public/data/*.json) et fournit
// des fonctionnalités d'interrogation du terrain (échantillonnage Z).

const BASE = 'data';

async function fetchJSON(path) {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) {
    throw new Error(`Impossible de charger ${path} (HTTP ${res.status})`);
  }
  return res.json();
}

export async function loadMeta() {
  return fetchJSON('meta.json');
}

export async function loadTerrain() {
  return fetchJSON('terrain.json');
}

export async function loadBuildings() {
  return fetchJSON('buildings.json');
}

export async function loadHighways() {
  return fetchJSON('highways.json');
}

export async function loadWaterways() {
  return fetchJSON('waterways.json');
}

export async function loadAllSceneData() {
  const [meta, terrain, buildings, highways, waterways] = await Promise.all([
    loadMeta(),
    loadTerrain(),
    loadBuildings(),
    loadHighways(),
    loadWaterways(),
  ]);
  return { meta, terrain, buildings, highways, waterways };
}

// ---------------------------------------------------------------------------
// Échantillonnage de la hauteur du terrain (interpolation bilinéaire)
// ---------------------------------------------------------------------------
// Le terrain est une grille régulière en repère local :
//   - colonne c ∈ [0, gridWidth-1], ligne r ∈ [0, gridHeight-1]
//   - x = minx + c * (width / (gridWidth - 1))
//   - y = miny + r * (height / (gridHeight - 1))
// La grille de hauteurs est stockée ligne par ligne (row-major) :
// z[r][c] = values[r * gridWidth + c]
export function createTerrainSampler(terrain) {
  const {
    gridWidth: w,
    gridHeight: h,
    minx,
    miny,
    width,
    height,
    z: values,
  } = terrain;

  const stepX = (gridWidth = w) => (gridWidth > 1 ? width / (gridWidth - 1) : 0);
  const stepY = (gridHeight = h) => (gridHeight > 1 ? height / (gridHeight - 1) : 0);
  const sx = stepX();
  const sy = stepY();

  function getAt(col, row) {
    const idx = row * w + col;
    return values[idx];
  }

  // Interpolation bilinéaire à la position locale (lx, ly)
  function sample(lx, ly) {
    const cx = (lx - minx) / sx;
    const cy = (ly - miny) / sy;
    if (cx < 0 || cy < 0 || cx > w - 1 || cy > h - 1) {
      return null;
    }
    const c0 = Math.floor(cx);
    const r0 = Math.floor(cy);
    const c1 = Math.min(c0 + 1, w - 1);
    const r1 = Math.min(r0 + 1, h - 1);
    const fx = cx - c0;
    const fy = cy - r0;

    const z00 = getAt(c0, r0);
    const z10 = getAt(c1, r0);
    const z01 = getAt(c0, r1);
    const z11 = getAt(c1, r1);

    return (
      z00 * (1 - fx) * (1 - fy) +
      z10 * fx * (1 - fy) +
      z01 * (1 - fx) * fy +
      z11 * fx * fy
    );
  }

  return { sample, getAt, gridWidth: w, gridHeight: h };
}
