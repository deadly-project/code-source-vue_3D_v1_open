// src/three/CustomElements.jsx
//
// Rend les éléments personnalisés créés depuis l'interface (bâtiments,
// routes, cours d'eau ajoutés en plus des données QGIS par défaut) avec
// des couleurs distinctes (voir colors.js) afin de les identifier
// facilement sur la maquette.
//
// Même règle haut/bas que les données par défaut (placement.js) : un
// élément dont le centre est dans le fokotany est posé sur le relief
// survolé, un élément hors du fokotany reste en bas.
//
// Les routes/cours d'eau sont lissés en courbe (Catmull-Rom) à partir de
// leurs points de contrôle dès qu'il y en a 3 ou plus, ce qui permet de
// les rendre non rectilignes simplement en déplaçant un point (voir
// GeometryEditor.jsx) plutôt qu'en segments strictement droits.

import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Line } from '@react-three/drei';
import { extrudeBuilding } from './extrude';
import { computeDisplayZ } from './placement';
import { COLORS } from './colors';

const CURVE_SEGMENTS_PER_POINT = 12;
const LINE_OFFSET_Z = 1.5;

// Fonction pour normaliser le type (gère anglais et français)
function normalizeType(type) {
  if (!type) return type;
  const typeMap = {
    'batiment': 'building',
    'eau': 'water',
    'route': 'highway'
  };
  return typeMap[type] || type;
}

// Fonction centroid robuste avec validation
function centroid(ring) {
  // Vérifier que ring est un tableau valide
  if (!ring || !Array.isArray(ring) || ring.length === 0) {
    console.warn('⚠️ Ring invalide pour centroid:', ring);
    return [0, 0];
  }
  
  let x = 0;
  let y = 0;
  let count = 0;
  
  ring.forEach((point) => {
    // Vérifier que le point est un tableau [x, y]
    if (Array.isArray(point) && point.length >= 2) {
      x += point[0];
      y += point[1];
      count++;
    }
  });
  
  if (count === 0) {
    console.warn('⚠️ Aucun point valide dans le ring:', ring);
    return [0, 0];
  }
  
  return [x / count, y / count];
}

export default function CustomElements({
  elements,     // liste des éléments personnalisés (venant de l'API)
  sampler,
  fokotany,
  baseZ,
  survol = 0,
  selectedId,
  onSelect,     // (id) => void — laisser undefined pour désactiver la sélection
}) {
  // Filtre les bâtiments (gère 'building' et 'batiment')
  const buildings = useMemo(
    () => elements.filter((e) => {
      const type = normalizeType(e.type);
      return type === 'building';
    }),
    [elements]
  );
  
  // Filtre les lignes (gère 'water'/'eau' et 'highway'/'route')
  const lines = useMemo(
    () => elements.filter((e) => {
      const type = normalizeType(e.type);
      return type === 'water' || type === 'highway';
    }),
    [elements]
  );

  const builtBuildings = useMemo(() => {
    if (!sampler || !fokotany || buildings.length === 0) return null;

    const geoms = [];
    const faceToId = [];
    const perElement = {};

    buildings.forEach((b) => {
      // Récupère la géométrie depuis 'path' ou 'geometry'
      const ring = b.path || b.geometry || [];
      
      // Vérifier que ring est un tableau valide
      if (!Array.isArray(ring) || ring.length === 0) {
        console.warn('⚠️ Bâtiment sans géométrie valide:', b);
        return;
      }
      
      const [cx, cy] = centroid(ring);
      const z0 = computeDisplayZ(cx, cy, { sampler, fokotany, baseZ, survol });
      const solids = extrudeBuilding(ring, z0, b.height > 0 ? b.height : 3);
      const own = [];
      solids.forEach((solid) => {
        geoms.push(solid);
        own.push(solid);
        const triCount = solid.index
          ? solid.index.count
          : solid.attributes.position.count / 3;
        for (let f = 0; f < triCount; f++) faceToId.push(b.id);
      });
      perElement[b.id] = own;
    });

    let merged = null;
    try {
      merged = mergeGeometries(geoms, false);
      merged.computeVertexNormals();
    } catch (e) {
      console.error('Erreur fusion bâtiments personnalisés', e);
    }
    return { merged, faceToId, perElement };
  }, [buildings, sampler, fokotany, baseZ, survol]);

  const handleBuildingClick = (event) => {
    if (!builtBuildings || event.faceIndex === undefined) return;
    const id = builtBuildings.faceToId[event.faceIndex];
    if (id !== undefined && onSelect) onSelect(id);
  };

  return (
    <group>
      {builtBuildings?.merged && (
        <group>
          <mesh
            geometry={builtBuildings.merged}
            onClick={onSelect ? handleBuildingClick : undefined}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={COLORS.customBuilding}
              roughness={0.6}
              metalness={0.05}
              flatShading
            />
          </mesh>
          {selectedId != null && builtBuildings.perElement[selectedId] && (
            <mesh
              geometry={mergeGeometries(builtBuildings.perElement[selectedId], false)}
              castShadow
            >
              <meshBasicMaterial color={COLORS.customBuildingSelected} />
            </mesh>
          )}
        </group>
      )}

      {lines.map((l) => (
        <CustomLine
          key={l.id}
          element={l}
          sampler={sampler}
          fokotany={fokotany}
          baseZ={baseZ}
          survol={survol}
          selected={selectedId === l.id}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

function CustomLine({ element, sampler, fokotany, baseZ, survol, selected, onSelect }) {
  const pts3d = useMemo(() => {
    // Récupère la géométrie depuis 'path' ou 'geometry'
    const raw = element.path || element.geometry || [];
    if (!raw || raw.length < 2) return [];
    const withZ = raw.map(([x, y]) => {
      const z = computeDisplayZ(x, y, { sampler, fokotany, baseZ, survol });
      return new THREE.Vector3(x, y, z + LINE_OFFSET_Z);
    });
    if (withZ.length < 3) return withZ;
    // Lissage en courbe à partir des points de contrôle bruts.
    const curve = new THREE.CatmullRomCurve3(withZ, false, 'catmullrom', 0.5);
    return curve.getPoints(withZ.length * CURVE_SEGMENTS_PER_POINT);
  }, [element.path, element.geometry, sampler, fokotany, baseZ, survol]);

  if (pts3d.length < 2) return null;

  // Normalise le type pour déterminer la couleur
  const type = normalizeType(element.type);
  
  let color;
  if (selected) {
    color = COLORS.customBuildingSelected;
  } else if (type === 'water') {
    color = COLORS.customWaterway;
  } else if (type === 'highway') {
    color = COLORS.customHighway;
  } else {
    color = COLORS.customBuilding; // fallback
  }

  // Détermine la largeur de la ligne en fonction du type
  const lineWidth = type === 'water' ? 5 : 4;

  return (
    <Line
      points={pts3d}
      color={color}
      lineWidth={lineWidth}
      onClick={
        onSelect
          ? (event) => {
              event.stopPropagation();
              onSelect(element.id);
            }
          : undefined
      }
    />
  );
}