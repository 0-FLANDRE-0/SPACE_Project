export const RESOURCE_GENERATOR_VERSION=2;
export const DEPOSIT_KINDS=new Map([['surface',{name:'표면 전역형'}],['vein',{name:'연결 광맥형'}],['deep',{name:'심층형'}]]);
export const HYDROGEN_SOURCE_TYPES=new Set(['finite-source','atmospheric-collector']);
const p=(low,medium,high)=>({low,medium,high});
export const SOL_RESOURCE_SETTINGS={
 earth:{totalOreU:78600000000,typeShares:{surface:.25,vein:.65,deep:.10},gradeTargets:{surface:p(.60,.38,.02),vein:p(.45,.50,.05),deep:p(.23,.44,.33)},placementPolicy:{veinPreferredLandThreshold:.2,oceanSurfaceWaterThreshold:.7,oceanExtractionFloor:80,oceanDiscoveryTierMin:3},certainty:'confirmed',notes:'사용자 확정 786억 U / 25·65·10 / 품질 확정. 광맥은 육지·대륙붕 우선, 해양 표면형은 고난도·고탐사 해저 단괴. 대륙붕은 육해혼합 구역 근사, 수치 임시'},
 venus:{totalOreU:114200000000,typeShares:{surface:.38,vein:.12,deep:.50},gradeTargets:{surface:p(.33,.42,.25),vein:p(.08,.22,.70),deep:p(.01,.17,.82)},certainty:'confirmed',extractionFloor:80,notes:'사용자 확정 1142억 U / 38·12·50 / 고온·고압 접근 난도 별도'},
 mars:{totalOreU:48900000000,typeShares:{surface:.7,vein:.2,deep:.1},gradeTargets:{surface:p(.55,.40,.05),vein:p(.28,.42,.30),deep:p(.15,.35,.50)},certainty:'mixed',notes:'489억 U·70/20/10 확정. 품질 세 숫자와 식민지 수치/위치는 잠정 제안'},
 moon:{totalOreU:100000000000,typeShares:{surface:1,vein:0,deep:0},gradeTargets:{surface:p(.8,.17,.03),vein:p(.6,.35,.05),deep:p(.3,.4,.3)},certainty:'mixed',processingFloor:80,notes:'1000억 U·표면형100%·저품질80% 확정. 중17/고3·식민지는 잠정'},
};
export const PROVISIONAL_SCENARIOS={moon:{populationPersons:200000,urbanizationRate:.2,infrastructureLevel:1,knowledgeDetected:.3,knowledgeConfirmed:.15},mars:{populationPersons:50000,urbanizationRate:.15,infrastructureLevel:1,knowledgeDetected:.2,knowledgeConfirmed:.1}};
export const PROCEDURAL_RESOURCE_PARAMETERS=Object.freeze({minimumRichness:.25,maximumRichness:3,absenceProbability:.06,baseOreU:40000000000,jitter:.05});

// v0.5D.1 provisional shared constraints; independent of Sol/body IDs.
export const RESOURCE_CONCENTRATION_POLICY=Object.freeze({minimumFixedGroups:3,minimumProceduralGroups:2,maximumGroups:6,minimumGroupCells:3,minimumCoverage:.25,maximumCellShare:.10,maximumGroupShare:.50});
