// M1b prototype choices, separate from confirmed drive contracts.
export const M1B_TUNING=Object.freeze({
  referenceDisplayLength:.5,iconEnterHeightRatio:.03,modelEnterHeightRatio:.037,
  localObstacleMultiplier:1.02,lineEdgeSubdivisions:4,entryNeighbors:6,maxSearchStates:100000,
  pointRotation:'surface-spin',cameraMinRadiusMultiplier:1.2,
  zoomEnterHighRadii:6,zoomExitHighRadii:7,centerEnterHighRadii:.45,centerExitHighRadii:.8,
  layerDistanceBodyRadii:Object.freeze({middle:6,low:3.5,surface:2}),layerHysteresis:.15,
  lagrange:Object.freeze({planetSphereFactor:2,outerMoonFactor:1.3,planetGapFactor:.6,moonOrbitFactor:.1,moonSphereFactor:2,moonGapFactor:.45,parentGapFactor:.45,pushClearanceGameAU:.001,maxPushIterations:32}),
  graphCostToleranceSeconds:1e-7,orbitPointPickPixels:14,orbitPointTouchPixels:20,lagrangeLabelDistanceGameAU:60
});
