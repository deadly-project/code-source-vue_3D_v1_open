// src/three/Buildings.jsx
//
// Affiche tous les bâtiments comme des extrusions 3D posées sur le terrain.
//
// - Geometry réelle : footprints polygonaux des GPKG (reprojetés et passés
//   en repère local par le preprocessing).
// - Chaque bâtiment est extrudé de sa hauteur (attributs ou hauteur par
//   défaut documentée) au-dessus de l'altitude du terrain échantillonnée
//   au centroïde du footprint.
// - Tous les bâtiments sont fusionnés en UNE BufferGeometry (performance) ;
//   la correspondance face -> buildingId est conservée pour la sélection
//   au clic.
// - Sélection : un mesh de surbrillance (avec la géométrie complète du
//   bâtiment sélectionné) est rendu par-dessus.

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createTerrainSampler } from '../utils/loadData';
import { COLORS } from './colors';

export default function Buildings({ buildingsData, terrain, onSelect, selectedId }) {
  const meshRef = useRef();

  // Construction de la géométrie fusionnée de tous les bâtiments.
  // Chaque bâtiment est posé sur le terrain : sa base est à l'altitude du
  // relief échantillonnée au centroïde du footprint.
  const built = useMemo(() => {
    if (!buildingsData || !buildingsData.buildings || !terrain) return null;

    const sampler = createTerrainSampler(terrain);
    const geoms = [];
    const faceToBuilding = [];
    const buildingGeoms = {}; // [bid] -> liste de géometries (pour highlight)
    const heightRange = { min: Infinity, max: -Infinity };

    buildingsData.buildings.forEach((b, bi) => {
      const cx = b.centroid[0];
      const cy = b.centroid[1];
      const baseZ = sampler.sample(cx, cy);
      const altitude = Number.isFinite(baseZ) ? baseZ : (terrain.z[0] ?? 0);
      const height = b.height > 0 ? b.height : buildingsData.defaultHeight;

      const bGeoms = [];

      for (const ring of b.rings) {
        const solids = extrudeBuilding(ring, altitude, height);

        for (const solid of solids) {
          bGeoms.push(solid);
          geoms.push(solid);

          const triCount = solid.index ? solid.index.count : solid.attributes.position.count / 3;
          for (let f = 0; f < triCount; f++) faceToBuilding.push(bi);
        }
      }

      heightRange.min = Math.min(heightRange.min, altitude);
      heightRange.max = Math.max(heightRange.max, altitude + height);
      buildingGeoms[bi] = bGeoms;
    });

    let merged = null;
    try {
      merged = mergeGeometries(geoms, false);
    } catch (e) {
      console.error('Erreur fusion bâtiments', e);
    }
    if (merged) merged.computeVertexNormals();

    return { geometry: merged, faceToBuilding, buildingGeoms, heightRange };
  }, [buildingsData, terrain]);

  // Surbrillance : géométrie du bâtiment sélectionné
  const highlightGeometry = useMemo(() => {
    if (!built || selectedId == null) return null;
    const geoms = built.buildingGeoms[selectedId];
    if (!geoms) return null;
    try {
      const g = mergeGeometries(geoms, false);
      g.computeVertexNormals();
      return g;
    } catch (e) {
      console.warn('Erreur highlight', e);
      return null;
    }
  }, [built, selectedId]);

  const handleClick = (event) => {
    if (!built || !built.geometry) return;
    const face = event.faceIndex;
    if (face === undefined) return;
    const bid = built.faceToBuilding[face];
    if (bid === undefined) return;
    if (onSelect) onSelect(bid);
  };

  if (!built || !built.geometry) return null;

  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={built.geometry}
        onClick={handleClick}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={COLORS.building}
          roughness={0.7}
          metalness={0.05}
          flatShading
        />
      </mesh>

      {highlightGeometry && (
        <mesh geometry={highlightGeometry} castShadow>
          <meshBasicMaterial color={COLORS.buildingSelected} />
        </mesh>
      )}
    </group>
  );
}

// Extrude un anneau en géométries BufferGeometry (dimension 3D).
// Retourne un tableau de BufferGeometry, toutes avec les attributs
// position + normal + uv + index pour être compatibles à la fusion.
//
// Fidèle au rendu QGIS 3D de référence (rendered-facade="Walls|Roof") :
// on ne génère que les MURS et le TOIT, PAS la face inférieure (sol).
// Le bâtiment est donc "en survol" : sans face de fond connectée au sol.
function extrudeBuilding(ring, baseZ, height) {
  const geometries = [];

  // ----- Toit (dessus, normale vers ... top) -----
  const roof = polygonGeometry(ring, baseZ + height, +1);
  // ----- Murs -----
  const walls = wallsGeometry(ring, baseZ, baseZ + height);

  geometries.push(walls, roof);
  return geometries;
}

// Triangule un anneau dans le plan horizontal à l'altitude z.
// La normale pointe vers le haut (dir=1) ou le bas (dir=-1).
function polygonGeometry(ring, z, dir) {
  const shape = new THREE.Shape();
  shape.moveTo(ring[0][0], ring[0][1]);
  for (let i = 1; i < ring.length; i++) shape.lineTo(ring[i][0], ring[i][1]);
  shape.closePath();

  const shapeGeo = new THREE.ShapeGeometry(shape);
  // ShapeGeometry est dans le plan XY; on le translate en Z
  shapeGeo.translate(0, 0, z);

  const indices = shapeGeo.getIndex();
  if (!indices) return shapeGeo;

  if (dir < 0) {
    // inverser l'ordre des triangles -> normales vers le bas.
    // indices est un BufferAttribute : on clone son tableau .array.
    const arr = indices.array.slice();
    for (let i = 0; i < arr.length; i += 3) {
      const tmp = arr[i];
      arr[i] = arr[i + 2];
      arr[i + 2] = tmp; // swap a et c
    }
    shapeGeo.setIndex(new THREE.BufferAttribute(arr, 1));
    shapeGeo.computeVertexNormals();
  }

  return shapeGeo;
}

// Murs pour un anneau fermé entre z0 (bas) et z1 (haut).
function wallsGeometry(ring, z0, z1) {
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

    // Vecteur de côté et normale (dans le plan, perpendiculaire au mur)
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    // normale horizontale (pointe vers l'extérieur gauche du segment)
    const nx = -dy / len;
    const ny = dx / len;

    // 4 sommets : v0(bas,a) v1(bas,b) v2(haut,a) v3(haut,b)
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

    // Normales
    for (let m = 0; m < 4; m++) {
      normals[(vi + m) * 3] = nx;
      normals[(vi + m) * 3 + 1] = ny;
      normals[(vi + m) * 3 + 2] = 0;
    }

    // UV (largeur du mur)
    uvs[(vi) * 2] = 0; uvs[(vi) * 2 + 1] = 0;
    uvs[(vi + 1) * 2] = 1; uvs[(vi + 1) * 2 + 1] = 0;
    uvs[(vi + 2) * 2] = 0; uvs[(vi + 2) * 2 + 1] = 1;
    uvs[(vi + 3) * 2] = 1; uvs[(vi + 3) * 2 + 1] = 1;

    // triangles (v0,v2,v1) et (v1,v2,v3)
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
