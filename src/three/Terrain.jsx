// src/three/Terrain.jsx
//
// Construit le maillage 3D du terrain à partir de la grille DEM
// prétraitée (fokotanyfinale.tif -> public/data/terrain.json).
//
// - Emprise réelle : minx, miny, maxx, maxy (repère local)
// - Résolution : gridWidth x gridHeight
// - Valeurs Z : altitudes réelles (Z up), échelle verticale 1.0
//
// Le maillage couvre exactement l'emprise géographique. NoData a été
// traité en amont (interpolation de bord) pour éviter pics/trous.

import { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';

export default function Terrain({ data }) {
  const texture = useTexture(data.textureUrl);

  const geometry = useMemo(() => {
    const w = data.gridWidth;
    const h = data.gridHeight;

    // Geometry: PlaneGeometry fait un plan "dans le plan XY" orienté
    // vers +Z par défaut (partage le plan du sol). Nous appliquons une
    // rotation pour que le terrain soit orienté vers le haut (Y-up dans
    // notre scène : nous travaillons en Z-up, donc pas de rotation).
    const geo = new THREE.PlaneGeometry(data.width, data.height, w - 1, h - 1);

    // Rotation pour ramener le plan XY vers XZ (Y-up three.js)
    geo.rotateX(-Math.PI / 2);

    // Mise à jour des Z en gardant le repère local (X: est, Y: nord)
    // Dans PlaneGeometry, la largeur (segmentsX) suit l'axe local U,
    // la hauteur (segmentsY) l'axe V. Après rotateX(-PI/2), l'axe U
    // devient +X et V devient -Z pour un "up" en Y. On reconfigure les
    // positions pour le repère X=est, Y=nord, Z=haut.

    const count = w * h;

    // Recrée le tableau de positions explicitement pour le repère
    // local géospatial : X=est (minx->maxx), Y=nord (miny->maxy), Z=haut.
    const positions = new Float32Array(count * 3);
    let p = 0;
    for (let row = 0; row < h; row++) {
      // la 1re ligne de la grille correspond au nord (y=maxy)
      const y = data.miny + (row / (h - 1)) * data.height;
      for (let col = 0; col < w; col++) {
        const x = data.minx + (col / (w - 1)) * data.width;
        const z = data.z[row * w + col] ?? 0;
        positions[p++] = x;
        positions[p++] = y;
        positions[p++] = z;
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(
      // index triangle regénéré pour la grille regonflée
      buildGridIndex(w, h)
    );
    geo.computeVertexNormals();

    // UV : du coin bas-gauche (0,0) au coin haut-droit (1,1)
    const uvs = new Float32Array(count * 2);
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const u = col / (w - 1);
        const v = row / (h - 1);
        uvs[(row * w + col) * 2] = u;
        uvs[(row * w + col) * 2 + 1] = 1 - v;
      }
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  }, [data]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        map={texture}
        color="#ffffff"
        roughness={0.9}
        metalness={0.0}
      />
    </mesh>
  );
}

function buildGridIndex(w, h) {
  const indices = [];
  for (let row = 0; row < h - 1; row++) {
    for (let col = 0; col < w - 1; col++) {
      const a = row * w + col;
      const b = row * w + col + 1;
      const c = (row + 1) * w + col;
      const d = (row + 1) * w + col + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  return indices;
}
