// src/three/Buildings.jsx
//
// Extrude les bâtiments (MultiPolygon) en 3D, répartis en DEUX niveaux selon
// la surface du fokotany (zone survolée) :
//   - Bâtiment DANS le fokotany (centroïde dans la surface) -> EN HAUT,
//     posé sur le relief survolé (base = hauteur relief + survol).
//   - Bâtiment HORS   du fokotany                        -> EN BAS,
//     posé à l'altitude de base du bas (baseZ).
// Chaque bâtiment est assigné EN ENTIER à son niveau, donc aucun ne flotte
// au milieu de l'espace vide entre le haut et le bas.
//
// Rendu QGIS : "Walls|Roof" uniquement (pas de face inférieure) + centroïde
// pour l'altitude (alt-binding=centroid).
//
// NOTE : les fonctions d'extrusion (murs/toit) vivent désormais dans
// ./extrude.js, partagées avec les bâtiments personnalisés
// (CustomElements.jsx) pour éviter la duplication de code.

import { useMemo } from 'react';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createTerrainSampler } from '../utils/loadData';
import { extrudeBuilding } from './extrude';
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
      {renderGroup(built.groups.high, 'high', onSelect ? handleClick('high') : undefined, selectedId)}
      {renderGroup(built.groups.low, 'low', onSelect ? handleClick('low') : undefined, selectedId)}
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