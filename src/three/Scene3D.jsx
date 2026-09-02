// src/three/Scene3D.jsx
//
// Composant racine de la scène React Three Fiber.
//
// Structure verticale (repère Z-up : X=est, Y=nord, Z=altitude) :
//
//   BAS  : le socle plat (surface de base, toute l'emprise) sur lequel
//          reposent les lignes qui restent en bas — celles qui sont HORS
//          du fokotany.
//   HAUT : le fokotany (le relief/MNT) qui est « enlevé » et monté en haut
//          (survolé), emportant avec lui les lignes qui sont À L'INTÉRIEUR.
//
// Mécanisme (que l'utilisateur décrit comme un carré + un cercle enlevé) :
//   - Le fokotany = la zone couverte par le relief valide.
//   - Les lignes DANS le fokotany montent avec lui (en haut).
//   - Les lignes HORS du fokotany restent en bas, sans jamais monter.
//   - Les bâtiments suivent le relief (donc se retrouvent avec le fokotany,
//     en haut).

import { useMemo, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  loadAllSceneData,
  createTerrainSampler,
  createFokotanyTester,
} from '../utils/loadData';
import Terrain from './Terrain';
import BasePlane from './BasePlane';
import Buildings from './Buildings';
import NetworkLines from './NetworkLines';
import CameraController from './CameraController';
import { COLORS } from './colors';

// De combien le fokotany (relief) est survolé au-dessus du socle du bas.
const SURVOL = 20;

// Cadre la caméra sur l'ensemble du modèle (socle du bas + fokotany en haut).
function computeViewBounds(terrain, buildings, baseZ) {
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
        terrain.maxElevation + SURVOL + maxTop
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

export default function Scene3D({ onBuildingSelect }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

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

  // Altitude du socle du bas
  const baseZ = useMemo(() => {
    return data?.terrain ? data.terrain.minElevation : 0;
  }, [data]);

  // Bounding box du modèle (cadrage sur tout le modèle)
  const bounds = useMemo(() => {
    if (!data) return null;
    return computeViewBounds(data.terrain, data.buildings, baseZ);
  }, [data, baseZ]);

  const handleSelect = (bid) => {
    setSelectedId(bid);
    if (onBuildingSelect) {
      const b = data?.buildings?.buildings?.[bid];
      onBuildingSelect(b ? { id: b.id, ...b } : { id: bid });
    }
  };

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

      {/* BAS : socle plat + lignes restées en bas */}
      <BasePlane
        minx={t.minx}
        maxx={t.maxx}
        miny={t.miny}
        maxy={t.maxy}
        z={baseZ}
      />

      {/* HAUT : le fokotany (relief) enlevé et monté en haut */}
      <Terrain data={t} offsetZ={SURVOL} />

      {/* Bâtiments : dans le fokotany -> en haut ; hors -> en bas */}
      <Buildings
        buildingsData={data.buildings}
        terrain={t}
        fokotany={fokotany}
        baseZ={baseZ}
        survol={SURVOL}
        onSelect={handleSelect}
        selectedId={selectedId}
      />

      {/* Routes : dans le fokotany -> haut (sur relief survolé) ; sinon bas */}
      <NetworkLines
        lines={data.highways.lines}
        sampler={terrainSampler}
        fokotany={fokotany}
        baseZ={baseZ}
        survol={SURVOL}
        color={COLORS.highway}
        lineWidth={3}
        offsetZ={1.5}
      />

      {/* Cours d'eau : idem */}
      <NetworkLines
        lines={data.waterways.lines}
        sampler={terrainSampler}
        fokotany={fokotany}
        baseZ={baseZ}
        survol={SURVOL}
        color={COLORS.waterway}
        lineWidth={4}
        offsetZ={1.5}
      />

      <CameraController target={center} radius={radius} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={5}
        maxDistance={radius * 8}
        target={[center.x, center.y, center.z]}
      />
    </Canvas>
  );
}
