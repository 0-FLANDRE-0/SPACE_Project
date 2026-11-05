// M2 prototype assumptions; future M4 changes capabilities, not completed work.
export const SURVEY_TUNING=Object.freeze({
  capability:Object.freeze({revealTier:2,veinConfirmCap:.6,deepEnabled:false,speedMultiplier:1}),
  roughSecondsPerRootSector:86400,preciseSecondsPerSector:4*86400,withoutRoughMultiplier:1.25,
  roughDifficulty:1,atmosphereMultiplier:1,thickAtmosphereMultiplier:1,
  intervalWidth:1.5,roughDetectedCap:.8,roughRangeCap:.2,hydrogenRevealProgress:.5,
  possibilityThresholds:Object.freeze([.35,.85,1.4]),positionToleranceGameAU:1e-6,
  industryStepSeconds:3600,completionTolerance:1e-7,eventLimit:160,
  colors:Object.freeze({unknown:'#263447',nearlyNone:'#434655',low:'#668b87',normal:'#b5af6d',high:'#e4b46b',active:'#66c5ec',complete:'#91d9ad',zero:'#a1a8b3',selected:'#f1d28a'})
});
