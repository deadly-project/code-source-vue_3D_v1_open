// src/three/Terrain.jsx
//
// Construit le maillage 3D du terrain à partir de la grille DEM
// prétraitée (fokotanyfinale.tif -> public/data/terrain.json).
//
// REPÈRE : Z-up pur, identique à QGIS 3D (EPSG:32738).
//   - X = est  (minx -> maxx)
//   - Y = nord (miny -> maxy)
//   - Z = altitude (Z est la verticale)
// Aucune rotation n'est appliquée : la géométrie est écrite telle quelle,
// la caméra est configurée avec up=[0,0,1] dans Scene3D.
//
// - Emprise : minx, miny, maxx, maxy (repère local)
// - Résolution : gridWidth x gridHeight
// - Valeurs Z : altitudes réelles (Z up), échelle verticale 1.0
// - Le MNT est en "survol" : ses bords ne sont pas fermés par des parois
//   latérales (pas de rabats vers le sol).

import { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';

export default function Terrain({ data }) {
  const texture = useTexture(data.textureUrl);

  const geometry = useMemo(() => {
    const w = data.gridWidth;
    const h = data.gridHeight;

    const positions = new Float32Array(w * h * 3);
    let p = 0;
    for (let row = 0; row < h; row++) {
      // row 0 = sud (miny), conformément au preprocessing
      const y = data.miny + (row / (h - 1)) * data.height;
      for (let col = 0; col < w; col++) {
        const x = data.minx + (col / (w - 1)) * data.width;
        const z = data.z[row * w + col] ?? 0;
        positions[p++] = x;
        positions[p++] = y;
        positions[p++] = z;
      }
    }

    // UV : coin bas-gauche (0,0) -> coin haut-droit (1,1).
    // La texture (vue aérienne) est orientée nord en haut, donc v inversé
    // pour que le haut de la texture (nord) soit au lignes nord du maillage.
    const uvs = new Float32Array(w * h * 2);
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const u = col / Math.max(w - 1, 1);
        const v = 1 - row / Math.max(h - 1, 1);
        uvs[(row * w + col) * 2] = u;
        uvs[(row * w + col) * 2 + 1] = v;
      }
    }

    // Alpha map : rend les zones NoData transparentes afin que le relief
    // "flotte" sans bord/contour gris autour des données valides.
    // data.alpha est plat(row-major, row 0 = sud) ; on le réoriente pour que
    // l'image texture (ligne 0 = nord, v=1) corresponde aux UV du maillage.
    const alphaTex = buildAlphaMap(data.alpha, w, h);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(buildGridIndex(w, h));
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return { geometry: geo, alphaTex };
  }, [data]);

  return (
    <mesh geometry={geometry.geometry} castShadow receiveShadow>
      <meshStandardMaterial
        map={texture}
        alphaMap={geometry.alphaTex}
        transparent
        alphaTest={0.4}
        color="#ffffff"
        roughness={0.9}
        metalness={0.0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// Construit une DataTexture d'opacité (1 = relief valide, 0 = NoData).
// data.alpha est plat row-major avec row 0 = sud ; on inverse les lignes
// pour que la ligne d'image 0 (v=1 = nord) corresponde aux UV du maillage.
function buildAlphaMap(alpha, w, h) {
  const size = w * h;
  const arr = new Uint8Array(size);
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      // source : data.alpha[row*w+col] (row 0 = sud)
      // image : ligne (h-1-row) en haut = nord, doit correspondre à v=1
      const texRow = h - 1 - row;
      arr[texRow * w + col] = alpha[row * w + col] ? 255 : 0;
    }
  }
  const tex = new THREE.DataTexture(arr, w, h);
  tex.format = THREE.RedFormat;
  tex.type = THREE.UnsignedByteType;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// Index de maillage (row-major) : 2 triangles par cellule
function buildGridIndex(w, h) {
  const indices = [];
  for (let row = 0; row < h - 1; row++) {
    for (let col = 0; col < w - 1; col++) {
      const a = row * w + col;
      const b = row * w + col + 1;
      const c = (row + 1) * w + col;
      const d = (row + 1) * w + col + 1;
      // ordre des coins pour une normale +Z (vers le haut)
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }
  return indices;
}
