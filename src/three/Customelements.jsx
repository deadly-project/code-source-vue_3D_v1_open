// src/three/CustomElements.jsx
//
// Rend les éléments personnalisés créés depuis l'interface (bâtiments,
// routes, cours d'eau ajoutés en plus des données QGIS par défaut).
//
// Les bâtiments sont rendus individuellement afin que la sélection
// corresponde toujours exactement au bâtiment cliqué.
//
// Les routes/cours d'eau sont lissés en courbe (Catmull-Rom) à partir
// de leurs points de contrôle dès qu'il y en a 3 ou plus.

import { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

import { extrudeBuilding } from './extrude';
import { computeDisplayZ } from './placement';
import { COLORS } from './colors';

const CURVE_SEGMENTS_PER_POINT = 12;
const LINE_OFFSET_Z = 1.5;

// Fonction pour normaliser le type
// Gère les types anglais et français.
function normalizeType(type) {
  if (!type) return type;

  const typeMap = {
    batiment: 'building',
    eau: 'water',
    route: 'highway',
  };

  return typeMap[type] || type;
}

// Calcule le centre moyen d'un ring [ [x,y], [x,y], ... ]
function centroid(ring) {
  if (!ring || !Array.isArray(ring) || ring.length === 0) {
    console.warn('⚠️ Ring invalide pour centroid:', ring);
    return [0, 0];
  }

  let x = 0;
  let y = 0;
  let count = 0;

  ring.forEach((point) => {
    if (Array.isArray(point) && point.length >= 2) {
      x += Number(point[0]);
      y += Number(point[1]);
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
  elements,
  sampler,
  fokotany,
  baseZ,
  survol = 0,
  selectedId,
  onSelect,
}) {
  // ------------------------------------------------------------
  // BÂTIMENTS
  // ------------------------------------------------------------

  const buildings = useMemo(
    () =>
      Array.isArray(elements)
        ? elements.filter((e) => {
            const type = normalizeType(e.type);
            return type === 'building';
          })
        : [],
    [elements]
  );

  // ------------------------------------------------------------
  // ROUTES / COURS D'EAU
  // ------------------------------------------------------------

  const lines = useMemo(
    () =>
      Array.isArray(elements)
        ? elements.filter((e) => {
            const type = normalizeType(e.type);
            return type === 'water' || type === 'highway';
          })
        : [],
    [elements]
  );

  // ------------------------------------------------------------
  // RENDU
  // ------------------------------------------------------------

  return (
    <group>
      {/* ========================================================
          BÂTIMENTS PERSONNALISÉS

          IMPORTANT :
          Chaque bâtiment est rendu séparément.

          Ainsi :
              clic bâtiment A
                    ↓
              onClick du mesh A
                    ↓
              onSelect(A.id)

          Il n'y a plus de faceIndex / faceToId.
      ======================================================== */}

      {buildings.map((b) => {
        const ring = b.path || b.geometry || [];

        if (!Array.isArray(ring) || ring.length === 0) {
          console.warn(
            '⚠️ Bâtiment sans géométrie valide:',
            b
          );
          return null;
        }

        // Vérification minimale des points
        const validRing = ring.filter(
          (point) =>
            Array.isArray(point) &&
            point.length >= 2 &&
            Number.isFinite(Number(point[0])) &&
            Number.isFinite(Number(point[1]))
        );

        if (validRing.length < 3) {
          console.warn(
            '⚠️ Bâtiment avec moins de 3 points:',
            b
          );
          return null;
        }

         

        // Centre du bâtiment
        const [cx, cy] = centroid(validRing);
        
        console.log('🏢 RENDU CUSTOM BUILDING', {
            id: b.id,
            name: b.name,
            geometry: validRing,
            centroid: [cx, cy],
          });
        // Hauteur
        const height =
          Number(b.height) > 0
            ? Number(b.height)
            : 3;

        // Altitude de base
        const z0 = computeDisplayZ(cx, cy, {
          sampler,
          fokotany,
          baseZ,
          survol,
        });

        // Création du solide du bâtiment
        const solids = extrudeBuilding(
          validRing,
          z0,
          height
        );

        const isSelected = selectedId === b.id;

        return (
          <group key={b.id}>
            {solids.map((geometry, index) => (
              <mesh
                key={`${b.id}-${index}`}
                geometry={geometry}
                castShadow
                receiveShadow
                onClick={
                  onSelect
                    ? (event) => {
                        event.stopPropagation();

                        console.log(
                          '🏢 BÂTIMENT CLIQUÉ:',
                          {
                            id: b.id,
                            type: typeof b.id,
                            name: b.name,
                          }
                        );

                        onSelect(b.id);
                      }
                    : undefined
                }
              >
                <meshStandardMaterial
                  color={
                    isSelected
                      ? COLORS.customBuildingSelected
                      : COLORS.customBuilding
                  }
                  roughness={0.6}
                  metalness={0.05}
                  flatShading
                />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* ========================================================
          ROUTES / COURS D'EAU
      ======================================================== */}

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

// ================================================================
// ROUTE / COURS D'EAU
// ================================================================

function CustomLine({
  element,
  sampler,
  fokotany,
  baseZ,
  survol,
  selected,
  onSelect,
}) {
  const pts3d = useMemo(() => {
    const raw =
      element.path ||
      element.geometry ||
      [];

    if (!Array.isArray(raw) || raw.length < 2) {
      return [];
    }

    const withZ = raw
      .filter(
        (point) =>
          Array.isArray(point) &&
          point.length >= 2 &&
          Number.isFinite(Number(point[0])) &&
          Number.isFinite(Number(point[1]))
      )
      .map(([x, y]) => {
        const px = Number(x);
        const py = Number(y);

        const z = computeDisplayZ(
          px,
          py,
          {
            sampler,
            fokotany,
            baseZ,
            survol,
          }
        );

        return new THREE.Vector3(
          px,
          py,
          z + LINE_OFFSET_Z
        );
      });

    if (withZ.length < 2) {
      return [];
    }

    // Avec seulement 2 points :
    // on garde une ligne droite.
    if (withZ.length < 3) {
      return withZ;
    }

    // À partir de 3 points :
    // lissage Catmull-Rom.
    const curve =
      new THREE.CatmullRomCurve3(
        withZ,
        false,
        'catmullrom',
        0.5
      );

    return curve.getPoints(
      withZ.length * CURVE_SEGMENTS_PER_POINT
    );
  }, [
    element.path,
    element.geometry,
    sampler,
    fokotany,
    baseZ,
    survol,
  ]);

  if (pts3d.length < 2) {
    return null;
  }

  const type = normalizeType(element.type);

  let color;

  if (selected) {
    color =
      COLORS.customBuildingSelected;
  } else if (type === 'water') {
    color =
      COLORS.customWaterway;
  } else if (type === 'highway') {
    color =
      COLORS.customHighway;
  } else {
    color =
      COLORS.customBuilding;
  }

  const lineWidth =
    type === 'water'
      ? 5
      : 4;

  return (
    <Line
      points={pts3d}
      color={color}
      lineWidth={lineWidth}
      onClick={
        onSelect
          ? (event) => {
              event.stopPropagation();

              console.log(
                '📍 LIGNE CLIQUÉE:',
                {
                  id: element.id,
                  type: typeof element.id,
                  name: element.name,
                }
              );

              onSelect(element.id);
            }
          : undefined
      }
    />
  );
}