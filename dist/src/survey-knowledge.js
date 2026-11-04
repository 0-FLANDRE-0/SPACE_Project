import {SURVEY_TUNING as T} from './survey-data.js';
import {INDUSTRY_POLICY as P} from './industry-policy.js';
const layers=new WeakMap();
export function bindSurveyKnowledge(runtime,layer){if(runtime)layers.set(runtime,layer);}
export function unbindSurveyKnowledge(runtime){if(runtime)layers.delete(runtime);}
export const surveyKnowledgeLayer=runtime=>runtime?layers.get(runtime)??null:null;
export function visibleToSurvey(deposit,capability=T.capability){return deposit.resourceId==='ore'&&(deposit.discoveryTier??5)<=capability.revealTier&&(deposit.depositKind!=='deep'||capability.deepEnabled);}
export function surveySeed(worldSeed,id){let h=2166136261;for(const ch of `${worldSeed}/${id}`)h=Math.imul(h^ch.charCodeAt(0),16777619);return((h>>>0)+.5)/4294967296;}
export function estimateRange(total,progress,seed,width=T.intervalWidth){const w=width*(1-Math.max(0,Math.min(1,progress)));return[total*Math.max(0,1-seed*w),total*(1+(1-seed)*w)];}
export function miningReasons(deposit){const reasons=[];if((deposit.discoveryTier??5)>P.maximumDiscoveryTier)reasons.push('현재 채굴 탐사 단계 한도 밖');if((deposit.accessDepth??100)>P.maximumDepth)reasons.push('현재 채굴 깊이 한도 밖');if(deposit.extractionDifficulty==null||deposit.processingDifficulty==null)reasons.push('채굴·가공 조건 미확인');return reasons;}
export function depositSurveyKnowledge(template,deposit,{precise=0,rough=0,capability=T.capability,prior={low:1/3,medium:1/3,high:1/3}}={}){
 if(!visibleToSurvey(deposit,capability))return null;
 const start=template.initialResourceKnowledge?.find(k=>k.civilizationId==='human')?.deposits.find(k=>k.depositId===deposit.depositId),cap=deposit.depositKind==='vein'?capability.veinConfirmCap:1;
 const confirmedFraction=Math.max(start?.confirmedFraction??0,cap*precise),detectedFraction=Math.max(start?.detectedFraction??0,T.roughDetectedCap*rough,precise),gradeConfidence=Math.max(start?.gradeConfidence??0,(start?.gradeConfidence??0)+(cap-(start?.gradeConfidence??0))*precise);
 const p=Math.max(start?.confirmedFraction??0,T.roughRangeCap*rough,Math.min(precise,cap)),range=estimateRange(deposit.initialReserveU,p,surveySeed(template.resourceConfiguration?.worldSeed??template.systemId,deposit.depositId)),estimatedGradeProbabilities={};
 for(const grade of ['low','medium','high'])estimatedGradeProbabilities[grade]=prior[grade]*(1-gradeConfidence)+(deposit.gradeProbabilities?.[grade]??prior[grade])*gradeConfidence;
 return{depositId:deposit.depositId,depositKind:deposit.depositKind,detectedFraction,confirmedFraction,gradeConfidence,estimatedGradeProbabilities,range,confirmedU:deposit.initialReserveU*confirmedFraction,miningReasons:miningReasons(deposit)};
}
