// src/three/GeometryEditor.jsx
//
// Poignées glissables affichées sur les points de contrôle d'un tracé
// (route ou cours d'eau) en cours d'édition. Glisser un point déplace son
// (x, y) ; comme le rendu (CustomElements.jsx) lisse les points de
// contrôle avec une courbe de Catmull-Rom dès qu'il y en a 3 ou plus,
// déplacer un point suffit à courber le tracé — inutile de "dessiner" une
// courbe à la main.
//
// Pendant le glissé, on désactive les OrbitControls (via onDraggingChange)
// pour ne pas faire pivoter la caméra en même temps qu'on déplace le point.

import { useState } from 'react';
import { COLORS } from './colors';
import PointerGroundPlane from './Pointergroundplane';
const HANDLE_RADIUS = 2.5;

export default function GeometryEditor({
  points,             // [[x, y], ...] tracé en cours d'édition (copie de travail)
  z,                  // (x, y) => altitude d'affichage, cf. placement.js
  bounds,
  onChange,           // (nextPoints) => void
  selectedIndex,
  onSelectPoint,
  onDraggingChange,   // (isDragging) => void
}) {
  const [dragIndex, setDragIndex] = useState(null);

  const startDrag = (i) => (event) => {
    event.stopPropagation();
    setDragIndex(i);
    if (onSelectPoint) onSelectPoint(i);
    if (onDraggingChange) onDraggingChange(true);
  };

  const handleMove = ({ x, y }) => {
  console.log('🟢 GEOMETRY EDITOR MOVE', {
    mouseWorld: {
      x,
      y,
    },
    dragIndex,
  });

  if (dragIndex === null) return;

  const next = points.map((p, i) =>
    i === dragIndex ? [x, y] : p
  );

  onChange(next);
};

  const handleUp = () => {
    setDragIndex(null);
    if (onDraggingChange) onDraggingChange(false);
  };

  return (
    <group>
      <PointerGroundPlane
        bounds={bounds}
        active={dragIndex !== null}
        onMove={handleMove}
        onUp={handleUp}
      />
      {points.map(([x, y], i) => (
        <mesh key={i} position={[x, y, z(x, y) + 2]} onPointerDown={(e) => {
      console.log('🔴 HANDLE DOWN', {
        index: i,
        handleX: e.object.position.x,
        handleY: e.object.position.y,
        pointerX: e.point.x,
        pointerY: e.point.y,
      });

      startDrag(i)(e);
    }}>
          <sphereGeometry args={[HANDLE_RADIUS, 16, 16]} />
          <meshBasicMaterial
            color={i === selectedIndex ? COLORS.handleSelected : COLORS.handle}
          />
        </mesh>
      ))}
    </group>
  );
}