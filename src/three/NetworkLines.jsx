// src/three/NetworkLines.jsx
//
// Rend les routes et les cours d'eau en lignes 3D.
//
// Répartition selon le fokotany (zone survolée), par TRONÇONS :
//   - tronçon DANS  le fokotany -> posé sur le relief survolé (haut) :
//       altitude = hauteur du relief + SURVOL.
//   - tronçon HORS  le fokotany -> posé sur le socle du bas :
//       altitude = baseZ (surface plate du bas).
// Une ligne qui traverse le fokotany sera donc découpée : les morceaux dans
// le fokotany montent, les morceaux hors du fokotany restent en bas (sans
// jamais monter).
//
// Utilise <Line> de drei (Line2) pour une largeur de trait fiable.

import { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

export default function NetworkLines({
  lines,
  sampler,
  fokotany,
  baseZ,
  survol = 0,
  color,
  lineWidth = 3,
  offsetZ = 0,
}) {
  const shapedLines = useMemo(() => {
    if (!lines || !sampler || !fokotany) return [];
    const out = [];
    lines.forEach((line, i) => {
      if (!line.pts || line.pts.length < 2) return;

      // Classe chaque point : 1 = dans le fokotany, 0 = hors
      const flags = line.pts.map(([x, y]) =>
        fokotany.isInside(x, y) ? 1 : 0
      );

      // Découpe en runs consécutifs de même état
      const runs = [];
      let start = 0;
      for (let k = 1; k <= flags.length; k++) {
        if (k === flags.length || flags[k] !== flags[start]) {
          runs.push({ start, end: k, flag: flags[start] });
          start = k;
        }
      }

      // Construit une polyligne 3D par run (2 points min pour <Line>).
      runs.forEach((run, rIdx) => {
        if (run.end - run.start < 2) return;
        const pts = [];
        for (let k = run.start; k < run.end; k++) {
          const [x, y] = line.pts[k];
          const elev = sampler.sample(x, y);
          let z;
          if (run.flag === 1) {
            const zRelief =
              elev === null || Number.isNaN(elev) ? baseZ : elev;
            z = zRelief + survol;
          } else {
            z = baseZ;
          }
          pts.push(new THREE.Vector3(x, y, z + offsetZ));
        }
        out.push({ key: `${i}-${rIdx}`, pts, flag: run.flag });
      });
    });
    return out;
  }, [lines, sampler, fokotany, baseZ, survol, offsetZ]);

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
