// src/three/coordinateUtils.js
//
// Repère local commun (identique au projet QGIS 3D / scene.json) :
//   localX = X_utm - originX
//   localY = Y_utm - originY
//   localZ = altitude réelle (Z up, échelle verticale 1.0)
//
// L'origine provient de scene.json (Qgis2threejs) pour garantir une
// correspondance spatiale exacte avec le modèle QGIS 3D de référence.

export const ORIGIN = Object.freeze({
  x: 765510.1784336022,
  y: 7908299.210718792,
  z: 0.0,
});

export const Z_SCALE = 1.0;

// Renvoie la position locale d'un point UTM (EPSG:32738)
export function toLocal(x, y, z = 0.0) {
  return [x - ORIGIN.x, y - ORIGIN.y, z * Z_SCALE + ORIGIN.z];
}

// Renvoie les coordonnées UTM depuis une position locale
export function fromLocal(lx, ly, lz = 0.0) {
  return [lx + ORIGIN.x, ly + ORIGIN.y, lz];
}
