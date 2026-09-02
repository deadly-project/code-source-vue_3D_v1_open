// src/three/NetworkLines.jsx
//
// Rend les routes et cours d'eau comme des polylignes 3D suivant le terrain.
//
// Chaque point de chaque ligne est reprojeté en altitude via
// l'échantillonneur du terrain (interpolation bilinéaire) pour que les
// lignes épousent le relief.
//
// Utilise <Line> de drei (Line2) pour obtenir une largeur de trait
// fiable sur tous les GPU (contrairement à lineBasicMaterial.linewidth).

import { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

export default function NetworkLines({
  lines,
  sampler,
  color,
  lineWidth = 3,
  offsetZ = 0,
}) {
  const shapedLines = useMemo(() => {
    if (!lines || !sampler) return [];
    return lines
      .map((line, i) => {
        if (!line.pts || line.pts.length < 2) return null;
        const pts = line.pts.map(([x, y]) => {
          const elev = sampler.sample(x, y);
          const z = (elev === null || Number.isNaN(elev) ? 0 : elev) + offsetZ;
          return new THREE.Vector3(x, y, z);
        });
        return { key: `line-${i}`, pts };
      })
      .filter(Boolean);
  }, [lines, sampler, offsetZ]);

  if (shapedLines.length === 0) return null;

  return (
    <group>
      {shapedLines.map((l) => (
        <Line
          key={l.key}
          points={l.pts}
          color={color}
          lineWidth={lineWidth}
          transparent={false}
        />
      ))}
    </group>
  );
}
