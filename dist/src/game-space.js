// Simulation AU values stay fixed. Only the distance-to-render mapping expands.
// Mercury keeps 53 AU; its rendered semimajor axis now spans the PREVIOUS
// Jupiter–Saturn gap (420 - 280 = 140 world units). Size units stay independent.
export const DISTANCE_BASELINE = Object.freeze({mercuryOrbitGameAU:53,jupiterOrbitGameAU:280,saturnOrbitGameAU:420});
export const WORLD_UNITS_PER_GAME_AU = (DISTANCE_BASELINE.saturnOrbitGameAU-DISTANCE_BASELINE.jupiterOrbitGameAU)/DISTANCE_BASELINE.mercuryOrbitGameAU;
export const gameAUToWorld=value=>value*WORLD_UNITS_PER_GAME_AU;
export const worldToGameAU=value=>value/WORLD_UNITS_PER_GAME_AU;
export const PLANET_ORBITS_GAME_AU = Object.freeze({mercury:53,venus:79,earth:100,mars:142,jupiter:280,saturn:420,uranus:570,neptune:730});
export const EARTH_PLANET_SIZE = 15;
export const EARTH_REFERENCE_RADIUS_KM = 6371;
export const STAR_SPECTRAL_FAMILIES = Object.freeze(['O','B','A','F','G','K','M']);
export const STAR_SIZE_PROFILES = Object.freeze({V:Object.freeze({diameterWorldUnitsPerSize:70/90})});
export const SATURN_RING_RADII = Object.freeze({inner:1.24,outer:2.32});
export const MIN_CLEARANCE_GAME_AU = 1;
export const SATELLITE_ORBITS_GAME_AU = Object.freeze({moon:9.4,phobos:7,deimos:9.5,io:30,europa:33,ganymede:36,callisto:39,enceladus:54.5,titan:59,titania:21,triton:21});

export function planetSizeFromRadiusKm(radiusKm) {
  return Math.round(EARTH_PLANET_SIZE*Math.sqrt(radiusKm/EARTH_REFERENCE_RADIUS_KM));
}
// Separate satellite diameter rule: Moon baseline 0.8 size/world units, minimum 0.3.
// This is not Planet Size. Small targets receive screen-space selection assistance.
export function satelliteDiameterFromRadiusKm(radiusKm) {
  return Math.max(.3,Math.round(.8*Math.sqrt(radiusKm/1737.4)*10)/10);
}
export function starDiameterWorldUnits(star) {
  const profile=STAR_SIZE_PROFILES[star.luminosityClass];
  if(!profile||!STAR_SPECTRAL_FAMILIES.includes(star.spectralClass))throw new Error('Unsupported star classification');
  return star.starSize*profile.diameterWorldUnitsPerSize;
}
export function bodyDiameterWorldUnits(body) {
  if(body.kind==='star')return starDiameterWorldUnits(body);
  if(body.kind==='planet')return body.planetSize;
  if(body.kind==='moon')return body.satelliteDiameterWorldUnits;
  return 0;
}
export const bodyRadiusWorldUnits=body=>bodyDiameterWorldUnits(body)/2;
export const starDiameterGameAU=star=>worldToGameAU(starDiameterWorldUnits(star));
export const bodyDiameterGameAU=body=>worldToGameAU(bodyDiameterWorldUnits(body));
export const bodyRadiusGameAU=body=>bodyDiameterGameAU(body)/2;
