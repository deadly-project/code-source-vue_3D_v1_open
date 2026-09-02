// src/three/Buildings.jsx
//
// Extrude les bâtiments (MultiPolygon) en 3D, répartis en DEUX niveaux selon
// la surface du fokotany (zone survolée) :
//   - Bâtiment DANS le fokotany (centroïde dans la surface) -> EN HAUT,
//     posé sur le relief survolé (base = hauteur relief + survol).
//   - Bâtiment HORS   du fokotany                        -> EN BAS,
//     posé sur le socle plat du bas (base = baseZ).
// Chaque bâtiment est assigné EN ENTIER à son niveau, donc aucun ne flotte
// au milieu de l'espace vide entre le haut et le bas.
//
// Rendu QGIS : "Walls|Roof" uniquement (pas de face inférieure) + centroïde
// pour l'altitude (alt-binding=centroid).

import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createTerrainSampler } from '../utils/loadData';
import { COLORS } from './colors';

export default function Buildings({
  buildingsData,
  terrain,
  fokotany,
  baseZ,
  survol = 0,
  onSelect,
  selectedId,
}) {
  const built = useMemo(() => {
    if (!buildingsData || !buildingsData.buildings || !terrain) return null;
    const sampler = createTerrainSampler(terrain);

    // Deux groupes : 'high' (dans le fokotany -> en haut) et 'low' (hors -> en bas)
    const groups = {
      high: { geoms: [], faceToBuilding: [], buildingGeoms: {}, ids: new Set() },
      low: { geoms: [], faceToBuilding: [], buildingGeoms: {}, ids: new Set() },
    };

    buildingsData.buildings.forEach((b, bi) => {
      const height = b.height > 0 ? b.height : buildingsData.defaultHeight;
      const inside = fokotany ? fokotany.isInside(b.centroid[0], b.centroid[1]) : false;
      const g = inside ? groups.high : groups.low;

      // Base de pose du bâtiment
      let baseZ0;
      if (inside) {
        const elev = sampler.sample(b.centroid[0], b.centroid[1]);
        baseZ0 = (elev === null || Number.isNaN(elev) ? baseZ : elev) + survol;
      } else {
        baseZ0 = baseZ;
      }

      const bGeoms = [];
      for (const ring of b.rings) {
        const solids = extrudeBuilding(ring, baseZ0, height);
        for (const solid of solids) {
          g.geoms.push(solid);
          bGeoms.push(solid);
          const triCount = solid.index
            ? solid.index.count
            : solid.attributes.position.count / 3;
          for (let f = 0; f < triCount; f++) g.faceToBuilding.push(bi);
        }
      }
      g.buildingGeoms[bi] = bGeoms;
      g.ids.add(bi);
    });

    const result = { groups: {} };
    for (const key of ['high', 'low']) {
      const g = groups[key];
      let merged = null;
      try {
        merged = mergeGeometries(g.geoms, false);
      } catch (e) {
        console.error('Erreur fusion bâtiments', key, e);
      }
      if (merged) merged.computeVertexNormals();
      result.groups[key] = {
        geometry: merged,
        faceToBuilding: g.faceToBuilding,
        buildingGeoms: g.buildingGeoms,
        ids: g.ids,
      };
    }
    return result;
  }, [buildingsData, terrain, fokotany, baseZ, survol]);

  const handleClick = (groupKey) => (event) => {
    if (!built || event.faceIndex === undefined) return;
    const g = built.groups[groupKey];
    if (!g || !g.geometry) return;
    const bid = g.faceToBuilding[event.faceIndex];
    if (bid === undefined) return;
    if (onSelect) onSelect(bid);
  };

  if (!built) return null;

  return (
    <group>
      {renderGroup(built.groups.high, 'high', handleClick('high'), selectedId)}
      {renderGroup(built.groups.low, 'low', handleClick('low'), selectedId)}
    </group>
  );
}

function renderGroup(group, key, onClick, selectedId) {
  if (!group || !group.geometry) return null;
  return selectedHighlight(group, key, onClick, selectedId);
}

function selectedHighlight(group, key, onClick, selectedId) {
  return (
    <group key={`grp-${key}`}>
      <mesh geometry={group.geometry} onClick={onClick} castShadow receiveShadow>
        <meshStandardMaterial
          color={COLORS.building}
          roughness={0.7}
          metalness={0.05}
          flatShading
        />
      </mesh>
      {selectedId != null && group.buildingGeoms[selectedId]
        ? (() => {
            const g = mergeGeometries(group.buildingGeoms[selectedId], false);
            g.computeVertexNormals();
            return (
              <mesh geometry={g} castShadow>
                <meshBasicMaterial color={COLORS.buildingSelected} />
              </mesh>
            );
          })()
        : null}
    </group>
  );
}

// Extrude un anneau en géométries BufferGeometry (3D), murs+toit, sans sol.
function extrudeBuilding(ring, baseZ, height) {
  const roof = polygonGeometry(ring, baseZ + height, +1);
  const walls = wallsGeometry(ring, baseZ, baseZ + height);
  return [walls, roof];
}

// Triangule un anneau dans le plan horizontal à l'altitude z.
function polygonGeometry(ring, z, dir) {
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
