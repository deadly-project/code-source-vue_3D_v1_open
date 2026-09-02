// src/three/Scene3D.jsx
//
// Composant racine de la scène React Three Fiber.
//
// Structure verticale (repère Z-up : X=est, Y=nord, Z=altitude) :
//
//   BAS  : les éléments (routes, eaux, bâtiments) qui sont HORS de la
//          surface du fokotany, posés à l'altitude du bas (baseZ).
//   HAUT : le fokotany (le relief/MNT) qui est « enlevé » et monté en haut
//          (survolé), emportant avec lui les éléments qui sont À L'INTÉRIEUR
//          de sa surface.
//   VIDE : l'espace entre le bas et le haut, sans liaison.
//
// La hauteur de survol est DYNAMIQUE (prop `survol`) : ajustable depuis le
// panneau de l'interface (0 m -> à l'infini).
//
// AJOUT — éléments personnalisés (bâtiments/route/eau ajoutés depuis
// l'interface) :
//   - `customElements` est rendu par <CustomElements>, avec des couleurs
//     distinctes des données par défaut.
//   - `mode` pilote l'interaction : 'view' (navigation normale),
//     'building' | 'water' | 'highway' (placement, un <PointerGroundPlane>
//     invisible capte les clics et les remonte via `onPick`), ou
//     'edit-geometry' (poignées glissables sur `editingGeometry` via
//     <GeometryEditor>, qui désactive les OrbitControls pendant le glissé).
//   - La sélection des éléments personnalisés est CONTRÔLÉE par le parent
//     (Map3DViewer) via `selectedCustomId` / `onSelectCustom`, contrairement
//     à la sélection des bâtiments par défaut qui reste gérée ici
//     (comportement existant inchangé).

import { useMemo, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import {
  loadAllSceneData,
  createTerrainSampler,
  createFokotanyTester,
} from '../utils/loadData';
import Terrain from './Terrain';
import Buildings from './Buildings';
import NetworkLines from './NetworkLines';

import CustomElements from './Customelements';
import PointerGroundPlane from './Pointergroundplane';
import GeometryEditor from './GeometryEditor';
import CameraController from './CameraController';
import { computeDisplayZ } from './placement';
import { COLORS } from './colors';

const ADD_MODES = ['building', 'water', 'highway'];

// Cadre la caméra sur l'ensemble du modèle (bas + fokotany en haut).
function computeViewBounds(terrain, buildings, baseZ, survol) {
  const box = new THREE.Box3();
  let maxTop = 0;

  if (buildings && buildings.buildings) {
    for (const b of buildings.buildings) {
      const h = b.height > 0 ? b.height : buildings.defaultHeight;
      maxTop = Math.max(maxTop, h);
    }
  }

  if (terrain) {
    box.expandByPoint(new THREE.Vector3(terrain.minx, terrain.miny, baseZ));
    box.expandByPoint(
      new THREE.Vector3(
        terrain.maxx,
        terrain.maxy,
        terrain.maxElevation + survol + maxTop
      )
    );
  }

  if (box.isEmpty()) {
    box.set(new THREE.Vector3(-100, -100, 0), new THREE.Vector3(100, 100, 50));
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) / 2;

  return { box, center, radius };
}

export default function Scene3D({
  onBuildingSelect,
  survol = 40,

  // --- Éléments personnalisés ---
  customElements = [],
  mode = 'view',
  draftPoints = [],
  onPick,
  selectedCustomId = null,
  onSelectCustom,
  editingGeometry = null,
  onGeometryChange,
  editingSelectedPointIndex = null,
  onEditingSelectPoint,
}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [controlsEnabled, setControlsEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadAllSceneData()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        console.error('[Scene3D] Échec chargement', err);
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Échantillonneur du terrain (hauteurs du relief)
  const terrainSampler = useMemo(() => {
    if (!data?.terrain) return null;
    return createTerrainSampler(data.terrain);
  }, [data]);

  // Test d'appartenance au fokotany (répartition haut/bas des lignes)
  const fokotany = useMemo(() => {
    if (!data?.terrain) return null;
    return createFokotanyTester(data.terrain);
  }, [data]);

  // Altitude de pose des éléments du bas (base du relief)
  const baseZ = useMemo(() => {
    return data?.terrain ? data.terrain.minElevation : 0;
  }, [data]);

  // Bounding box du modèle (cadrage sur tout le modèle)
  const bounds = useMemo(() => {
    if (!data) return null;
    return computeViewBounds(data.terrain, data.buildings, baseZ, survol);
  }, [data, baseZ, survol]);

  const handleSelect = (bid) => {
    setSelectedId(bid);
    if (onBuildingSelect) {
      const b = data?.buildings?.buildings?.[bid];
      onBuildingSelect(b ? { id: b.id, ...b } : { id: bid });
    }
  };

  const handleDraggingChange = (dragging) => setControlsEnabled(!dragging);

  if (error) {
    return (
      <div style={{ padding: 24, color: '#b00020', fontFamily: 'sans-serif' }}>
        <strong>Erreur de chargement du modèle 3D</strong>
        <br />
        {error}
        <br />
        <br />
        <ul>
          <li>Vérifiez que public/data/*.json existe (lancez npm run preprocess)</li>
          <li>Consultez la console du navigateur</li>
        </ul>
      </div>
    );
  }

  if (!data || !terrainSampler || !fokotany || !bounds) {
    return (
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        Chargement du modèle 3D…
      </div>
    );
  }

  const { center, radius } = bounds;
  const t = data.terrain;

  const zAt = (x, y) =>
    computeDisplayZ(x, y, { sampler: terrainSampler, fokotany, baseZ, survol });

  const draftLinePoints =
    draftPoints.length >= 2
      ? draftPoints.map(([x, y]) => new THREE.Vector3(x, y, zAt(x, y) + 1.5))
      : null;

  return (
    <Canvas
      shadows
      camera={{ fov: 45, near: 0.5, far: 5000, up: [0, 0, 1] }}
      style={{ width: '100%', height: '100%' }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[center.x + 800, center.y - 800, center.z + 600]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <hemisphereLight args={['#ffffff', '#3a2e2e', 0.35]} />

      {/* HAUT : le fokotany (relief) enlevé et monté en haut */}
      <Terrain data={t} offsetZ={survol} />

      {/* Bâtiments par défaut : dans le fokotany -> en haut ; hors -> en bas */}
      <Buildings
        buildingsData={data.buildings}
        terrain={t}
        fokotany={fokotany}
        baseZ={baseZ}
        survol={survol}
        onSelect={mode === 'view' ? handleSelect : undefined}
        selectedId={selectedId}
      />

      {/* Routes par défaut : dans le fokotany -> haut ; sinon bas */}
      <NetworkLines
        lines={data.highways.lines}
        sampler={terrainSampler}
        fokotany={fokotany}
        baseZ={baseZ}
        survol={survol}
        color={COLORS.highway}
        lineWidth={3}
        offsetZ={1.5}
      />

      {/* Cours d'eau par défaut : idem */}
      <NetworkLines
        lines={data.waterways.lines}
        sampler={terrainSampler}
        fokotany={fokotany}
        baseZ={baseZ}
        survol={survol}
        color={COLORS.waterway}
        lineWidth={4}
        offsetZ={1.5}
      />

      {/* Éléments personnalisés (couleurs distinctes) */}
      <CustomElements
        elements={customElements}
        sampler={terrainSampler}
        fokotany={fokotany}
        baseZ={baseZ}
        survol={survol}
        selectedId={selectedCustomId}
        onSelect={mode === 'view' ? onSelectCustom : undefined}
      />

      {/* Aperçu du tracé en cours de saisie (route/eau, avant validation) */}
      {draftLinePoints && (
        <Line points={draftLinePoints} color={COLORS.draft} lineWidth={3} dashed dashScale={4} />
      )}

      {/* Plan de clic invisible : actif uniquement en mode ajout */}
      <PointerGroundPlane bounds={bounds} active={ADD_MODES.includes(mode)} onPick={onPick} />

      {/* Poignées de tracé en mode édition de géométrie (courbe) */}
      {mode === 'edit-geometry' && editingGeometry && (
        <GeometryEditor
          points={editingGeometry}
          z={zAt}
          bounds={bounds}
          onChange={onGeometryChange}
          selectedIndex={editingSelectedPointIndex}
          onSelectPoint={onEditingSelectPoint}
          onDraggingChange={handleDraggingChange}
        />
      )}

      <CameraController target={center} radius={radius} />

      <OrbitControls
        makeDefault
        enabled={controlsEnabled}
        enableDamping
        dampingFactor={0.08}
        minDistance={5}
        maxDistance={radius * 8}
        target={[center.x, center.y, center.z]}
      />
    </Canvas>
  );
}