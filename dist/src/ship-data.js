import {M1B_TUNING as B} from './orbit-data.js';
// M1b confirmed drive contracts; prototype choices live in M1A_TUNING / M1B_TUNING.
export const HULL_CLASSES=Object.freeze(['마이크로','초소형','소형','중소형','중형','중대형','대형','초대형','타이탄']);
export const DRIVES=Object.freeze({
  pulse:Object.freeze({name:'펄스',speedGameAUPerHour:4,chargeSeconds:600,maxHullClass:null}),
  hyperpulse:Object.freeze({name:'실험형 하이퍼펄스',speedGameAUPerHour:640,chargeSeconds:3600,maxHullClass:'소형'})
});
export const SHIP_DESIGNS=Object.freeze({
  support:Object.freeze({hullClass:'중소형',lengthMeters:170,driveId:'pulse',turnDegreesPerSecond:.3,reactor:'개량 핵분열'}),
  explorer:Object.freeze({surveyCapable:true,hullClass:'소형',lengthMeters:60,driveId:'hyperpulse',turnDegreesPerSecond:2.5,reactor:'개량 핵분열'})
});
export const M1A_TUNING=Object.freeze({
  propulsionGameAUPerMinute:.04,acceleration:'constant-speed',massFactor:1,
  orbitRadiusMultipliers:Object.freeze({low:1.05,middle:1.3,high:1.6}),
  obstacleMarginGameAU:.4,obstacleMarginRadiusFraction:.2,
  stationDirections:Object.freeze([{x:.95,y:.25,z:.2},{x:.7,y:.3,z:.7},{x:.25,y:.2,z:1}].map(Object.freeze)),
  detourMode:'turn-and-charge-at-each-waypoint',detourChargeMultiplier:1,maxDetours:8,maxRouteNodes:160,
  detourCandidateCount:8,detourRadiusMultipliers:Object.freeze([1.8,3,6]),
  solverToleranceSeconds:.005,solverMaxIterations:48,collisionMaxDepth:24,
  directionMaxIterations:12,bracketMaxExpansions:40,bracketMaxIterations:96,collisionMinIntervalSeconds:.001,
  asteroidCount:60,beltPointCount:30,beltInnerGameAU:190,beltOuterGameAU:230,asteroidSeed:77191,
  asteroidInnerGameAU:40,asteroidMinimumOuterGameAU:250,asteroidInclinationSpreadRad:.65,beltInclinationSpreadRad:.12,
});
export function validateDrive(design){const d=DRIVES[design.driveId];if(!d||!HULL_CLASSES.includes(design.hullClass))throw Error('알 수 없는 함급/드라이브');if(d.maxHullClass&&HULL_CLASSES.indexOf(design.hullClass)>HULL_CLASSES.indexOf(d.maxHullClass))throw Error('하이퍼펄스는 소형 이하만 탑재할 수 있습니다.');return d;}
export function chargeMassFactor(){return M1A_TUNING.massFactor;}
export function shipDisplayLength(lengthMeters){if(!Number.isFinite(lengthMeters)||lengthMeters<=0)throw Error('Invalid ship length');return B.referenceDisplayLength*Math.sqrt(lengthMeters/60);}
export function shipDisplayMode(previous,ratio){if(ratio<B.iconEnterHeightRatio)return 'icon';if(ratio>=B.modelEnterHeightRatio)return 'model';return previous??'icon';}
export const STARTING_SHIPS=Object.freeze([
  Object.freeze({id:'support-1',name:'건설지원함 01',designId:'support'}),
  Object.freeze({id:'explorer-1',name:'탐사함 01',designId:'explorer'}),
  Object.freeze({id:'explorer-2',name:'탐사함 02',designId:'explorer'})
]);
