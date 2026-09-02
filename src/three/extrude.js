// src/three/extrude.js
//
// Fonctions de géométrie partagées pour extruder un anneau fermé
// (empreinte au sol) en volume 3D (murs + toit, sans face inférieure).
// Utilisées à la fois par les bâtiments par défaut (Buildings.jsx) et par
// les bâtiments personnalisés (CustomElements.jsx), pour éviter la
// duplication de code.

import * as THREE from 'three';

// Extrude un anneau en géométries BufferGeometry (3D), murs+toit, sans sol.
export function extrudeBuilding(ring, baseZ, height) {
  const roof = polygonGeometry(ring, baseZ + height, +1);
  const walls = wallsGeometry(ring, baseZ, baseZ + height);
  return [walls, roof];
}

// Triangule un anneau dans le plan horizontal à l'altitude z.
export function polygonGeometry(ring, z, dir) {
  const shape = new THREE.Shape();
  shape.moveTo(ring[0][0], ring[0][1]);
  for (let i = 1; i < ring.length; i++) shape.lineTo(ring[i][0], ring[i][1]);
  shape.closePath();

  const shapeGeo = new THREE.ShapeGeometry(shape);
  shapeGeo.translate(0, 0, z);

  const indices = shapeGeo.getIndex();
  if (indices && dir < 0) {
    const arr = indices.array.slice();
    for (let i = 0; i < arr.length; i += 3) {
      const tmp = arr[i];
      arr[i] = arr[i + 2];
      arr[i + 2] = tmp;
    }
    shapeGeo.setIndex(new THREE.BufferAttribute(arr, 1));
    shapeGeo.computeVertexNormals();
  }

  return shapeGeo;
}

// Murs pour un anneau fermé entre z0 (bas) et z1 (haut).
export function wallsGeometry(ring, z0, z1) {
  const n = ring.length;
  const positions = new Array(n * 4 * 3);
  const uvs = new Array(n * 4 * 2);
  const indices = new Array(n * 6);
  const normals = new Array(n * 4 * 3);

  let p = 0;
  let i = 0;
  let vi = 0;

  for (let k = 0; k < n; k++) {
    const a = ring[k];
    const b = ring[(k + 1) % n];
    const x1 = a[0], y1 = a[1];
    const x2 = b[0], y2 = b[1];

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    const verts = [
      [x1, y1, z0],
      [x2, y2, z0],
      [x1, y1, z1],
      [x2, y2, z1],
    ];
    for (const [vx, vy, vz] of verts) {
      positions[p++] = vx;
      positions[p++] = vy;
      positions[p++] = vz;
    }

    for (let m = 0; m < 4; m++) {
      normals[(vi + m) * 3] = nx;
      normals[(vi + m) * 3 + 1] = ny;
      normals[(vi + m) * 3 + 2] = 0;
    }

    uvs[vi * 2] = 0; uvs[vi * 2 + 1] = 0;
    uvs[(vi + 1) * 2] = 1; uvs[(vi + 1) * 2 + 1] = 0;
    uvs[(vi + 2) * 2] = 0; uvs[(vi + 2) * 2 + 1] = 1;
    uvs[(vi + 3) * 2] = 1; uvs[(vi + 3) * 2 + 1] = 1;

    indices[i++] = vi;
    indices[i++] = vi + 2;
    indices[i++] = vi + 1;
    indices[i++] = vi + 1;
    indices[i++] = vi + 2;
    indices[i++] = vi + 3;

    vi += 4;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

// Construit un anneau rectangulaire centré sur (cx, cy) — utilisé pour
// poser un bâtiment personnalisé à partir d'un simple clic (centre) +
// largeur/profondeur saisies dans le formulaire.
export function rectRing(cx, cy, largeur, profondeur) {
  const hw = largeur / 2;
  const hd = profondeur / 2;
  return [
    [cx - hw, cy - hd],
    [cx + hw, cy - hd],
    [cx + hw, cy + hd],
    [cx - hw, cy + hd],
  ];
}