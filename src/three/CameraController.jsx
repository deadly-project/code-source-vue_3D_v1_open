// src/three/CameraController.jsx
//
// Ajuste automatiquement la caméra orbitale au modèle à partir des
// bounding boxes réelles de la scène (terrain + bâtiments).
//
// REPÈRE Z-up (identique à QGIS) : X=est, Y=nord, Z=haut.
// La caméra orbite autour de la cible avec la verticale selon Z.
//
// - Calcule le centre du modèle via THREE.Box3
// - Détermine une distance raisonnable à partir de la sphère englobante
// - Place la caméra au-dessus (Z) avec une inclinaison adaptée
// - Permet ensuite à l'utilisateur de zoomer/orbiter librement

import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

export default function CameraController({ target, radius, onReady }) {
  const { camera, invalidate } = useThree();
  const initialized = useRef(false);

  useEffect(() => {
    if (!target || radius == null) return;
    if (initialized.current) return;
    initialized.current = true;

    // Distance caméra = 1.4 * rayon de la sphère englobante (minimum 20)
    const distance = Math.max(radius * 1.4, 20);
    // Inclinaison : angle de l'axe de vue par rapport à la verticale Z.
    // ~35° de dépression pour une vue utile en perspective.
    const elevation = 55 * (Math.PI / 180); // angle depuis l'horizon
    const polar = Math.PI / 2 - elevation;

    // Position selon une orbite autour de la cible, avec la verticale = Z
    const x = target.x + distance * Math.sin(polar) * Math.sin(Math.PI / 4);
    const y = target.y + distance * Math.sin(polar) * Math.cos(Math.PI / 4);
    const z = target.z + distance * Math.cos(polar);

    camera.up.set(0, 0, 1);
    camera.position.set(x, y, z);
    camera.lookAt(target.x, target.y, target.z);
    camera.near = Math.max(radius / 5000, 0.5);
    camera.far = Math.max(radius * 20, 5000);
    camera.updateProjectionMatrix();

    if (onReady) {
      onReady({ target, distance, radius });
    }
    invalidate();
  }, [target, radius, camera, onReady, invalidate]);

  return null;
}
