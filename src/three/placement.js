// src/three/placement.js
//
// Calcule l'altitude d'affichage d'un point (x, y) selon la même règle
// que les données par défaut (Buildings.jsx / NetworkLines.jsx) :
//   - à l'intérieur du fokotany -> posé sur le relief survolé (haut)
//   - à l'extérieur             -> posé à l'altitude de base (bas)
//
// Centralisé ici pour être réutilisé par le placement de nouveaux
// éléments, leur rendu (CustomElements.jsx) et l'édition de tracé
// (GeometryEditor.jsx), sans dupliquer la logique à chaque endroit.

export function computeDisplayZ(x, y, { sampler, fokotany, baseZ, survol = 0 }) {
  const inside = fokotany ? fokotany.isInside(x, y) : false;
  if (inside) {
    const elev = sampler ? sampler.sample(x, y) : null;
    return (elev === null || Number.isNaN(elev) ? baseZ : elev) + survol;
  }
  return baseZ;
}