// src/three/colors.js
// Couleurs partagées entre la scène 3D et la légende de l'interface.
// Doivent rester cohérentes avec Scene3D.jsx, Buildings.jsx et
// CustomElements.jsx.

export const COLORS = {
  terrain: '#ffffff',
  building: '#c9c9c9',
  buildingSelected: '#ffd400',
  highway: '#d98a3d',
  waterway: '#4A94D8',

  // Éléments ajoutés depuis l'interface : palette distincte des données
  // par défaut (issues de QGIS) pour les identifier au premier coup d'œil.
  customBuilding: '#7c4dff',
  customBuildingSelected: '#ffe14d',
  customHighway: '#ff6d3d',
  customWaterway: '#00c2c2',

  // Aide au placement / à l'édition de tracé
  draft: '#ff2ee0',
  handle: '#ffffff',
  handleSelected: '#ff2ee0',
};