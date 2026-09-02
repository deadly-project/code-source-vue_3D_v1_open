// src/three/Scene3D.jsx
//
// Composant racine de la scène React Three Fiber.
//
// - Charge les données prétraitées (terrain, bâtiments, routes, cours d'eau)
// - Calcule le repère local commun et le centre / rayon du modèle
// - Monte le Canvas + éclairage + OrbitControls + auto-fit caméra
// - Gère l'état de sélection d'un bâtiment et le propage au panneau

import { useMemo, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { loadAllSceneData, createTerrainSampler } from '../utils/loadData';
import Terrain from './Terrain';
import Buildings from './Buildings';
import NetworkLines from './NetworkLines';
import CameraController from './CameraController';
import { COLORS } from './colors';

// Cadre la caméra sur le terrain (zone d'intérêt), qui contient aussi les
// bâtiments. Les lignes (routes/waterways) peuvent s'étendre bien au-delà du
// terrain (ex. canaux), on ne les inclut donc pas pour le cadrage.
function computeViewBounds(terrain, buildings) {
  const box = new THREE.Box3();

  if (terrain) {
    box.expandByPoint(
      new THREE.Vector3(terrain.minx, terrain.miny, terrain.minElevation)
    );
    box.expandByPoint(
      new THREE.Vector3(terrain.maxx, terrain.maxy, terrain.maxElevation)
    );
  }

  if (buildings && buildings.buildings && terrain) {
    let maxTop = 0;
    for (const b of buildings.buildings) {
      const h = b.height > 0 ? b.height : buildings.defaultHeight;
      maxTop = Math.max(maxTop, h);
    }
    box.expandByPoint(
      new THREE.Vector3(terrain.maxx, terrain.maxy, terrain.maxElevation + maxTop)
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

  // Échantillonneur du terrain (partagé par les lignes et les bâtiments)
  const terrainSampler = useMemo(() => {
    if (!data?.terrain) return null;
    return createTerrainSampler(data.terrain);
  }, [data]);

  // Bounding box du modèle (cadrage sur le terrain + bâtiments)
  const bounds = useMemo(() => {
    if (!data) return null;
    return computeViewBounds(data.terrain, data.buildings);
  }, [data]);

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

  if (!data || !terrainSampler || !bounds) {
    return (
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        Chargement du modèle 3D…
      </div>
    );
  }

  const { center, radius } = bounds;

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

      <Terrain data={data.terrain} />

      <Buildings
        buildingsData={data.buildings}
        terrain={data.terrain}
        onSelect={handleSelect}
        selectedId={selectedId}
      />

      <NetworkLines
        lines={data.highways.lines}
        sampler={terrainSampler}
        color={COLORS.highway}
        lineWidth={3}
        offsetZ={1.5}
      />

      <NetworkLines
        lines={data.waterways.lines}
        sampler={terrainSampler}
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
