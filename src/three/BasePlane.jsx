// src/three/BasePlane.jsx
//
// Le socle du BAS : une surface plane discrète couvrant toute l'emprise,
// sur laquelle reposent les lignes qui restent en bas (hors du fokotany).
// Représente le « carré » laissé en bas quand le fokotany (relief) est
// enlevé et monté en haut.

import { useMemo } from 'react';
import * as THREE from 'three';

export default function BasePlane({ minx, maxx, miny, maxy, z = 0 }) {
  const geo = useMemo(() => {
    const w = maxx - minx;
    const h = maxy - miny;
    const g = new THREE.PlaneGeometry(w, h);
    g.rotateX(-Math.PI / 2);
    g.translate((minx + maxx) / 2, (miny + maxy) / 2, z);
    return g;
  }, [minx, maxx, miny, maxy, z]);

  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial
        color="#2f3b33"
        roughness={0.95}
        metalness={0.0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
