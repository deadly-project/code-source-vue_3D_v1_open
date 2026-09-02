// src/three/PointerGroundPlane.jsx
//
// Plan invisible utilisé pour capter la position du pointeur sur le plan
// horizontal du modèle (repère local X/Y). Sert à deux usages :
//   - le clic de placement (ajout d'un bâtiment / d'un point de tracé) ;
//   - le glissé des poignées de courbe (voir GeometryEditor.jsx).
//
// Placé loin sous le modèle (toujours invisible) : seule l'intersection
// géométrique (x, y) du rayon de la souris avec ce plan nous intéresse,
// l'altitude réelle étant recalculée ailleurs via le terrain (voir
// placement.js) plutôt que lue sur ce plan.
//
// N'est monté (et donc actif) que lorsque `active` est vrai, pour ne
// jamais intercepter les clics en navigation normale.

export default function PointerGroundPlane({ bounds, active, onPick, onMove, onUp }) {
  if (!active || !bounds) return null;

  const { box } = bounds;
  const cx = (box.min.x + box.max.x) / 2;
  const cy = (box.min.y + box.max.y) / 2;
  const sizeX = (box.max.x - box.min.x) * 3 + 200;
  const sizeY = (box.max.y - box.min.y) * 3 + 200;

  return (
    <mesh
      position={[cx, cy, box.min.z - 500]}
      visible={false}
      onClick={(e) => {
        e.stopPropagation();
        if (onPick) onPick({ x: e.point.x, y: e.point.y });
      }}
      onPointerMove={(e) => {
        if (!onMove) return;
        e.stopPropagation();
        onMove({ x: e.point.x, y: e.point.y });
      }}
      onPointerUp={(e) => {
        if (!onUp) return;
        e.stopPropagation();
        onUp();
      }}
    >
      <planeGeometry args={[sizeX, sizeY]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}