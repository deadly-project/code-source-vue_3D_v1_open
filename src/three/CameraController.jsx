// src/three/CameraController.jsx
//
// Ajuste automatiquement la caméra orbitale au modèle à partir des
// bounding boxes réelles de la scène (terrain + bâtiments).
//
// - Calcule le centre du modèle via THREE.Box3
// - Détermine une distance raisonnable à partir de la sphère englobante
// - Place la caméra avec une inclinaison adaptée et regarde le centre
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

    // Distance caméra = 1.4 * rayon de la sphère englobante, avec un minimum
    const distance = Math.max(radius * 1.4, 20);
    // Inclinaison (élévation fixe pour une vue en perspective utile)
    const phi = 0.5; // ~ 30°
    const polar = Math.PI / 2 - phi;

    const x = target.x + distance * Math.sin(polar) * Math.sin(Math.PI / 4);
    const y = target.y + distance * Math.sin(polar) * Math.cos(Math.PI / 4);
    const z = target.z + distance * Math.cos(polar);

    camera.position.set(x, y, z);
    camera.lookAt(target);
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
