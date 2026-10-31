import {resourceQuanta} from './resource-quantities.js';
export function depositKnowledgeFor(template,depositId,civilizationId='human'){return template.initialResourceKnowledge?.find(k=>k.civilizationId===civilizationId)?.deposits.find(d=>d.depositId===depositId)??null;}
export function knownResourceSummary(template,tileId,civilizationId='human'){const result=[];for(const d of template.geology.cells[tileId]?.deposits??[]){const k=depositKnowledgeFor(template,d.depositId,civilizationId);if(!k||k.detectedFraction<=0)continue;result.push({resourceId:d.resourceId,confirmedU:d.initialReserveU*k.confirmedFraction,gradeConfidence:k.gradeConfidence,estimatedGradeProbabilities:k.estimatedGradeProbabilities??null});}return result;}
// Read-only player query. Hidden geology never contributes to the scale, and
// absence of a positive knowledge record is NOT negative survey evidence.
export function confirmedOreAtTile(template,tileId,{runtime=null,civilizationId='human',negativeSurveyEvidence=null}={}){
 let confirmedQ=0,discoveredCount=0;for(const d of template.geology.cells[tileId]?.deposits??[]){if(d.resourceId!=='ore')continue;const key=`${template.systemId}/${template.bodyId}/${d.depositId}`,override=runtime?.depositKnowledge?.[civilizationId]?.[key],knowledge=depositKnowledgeFor(template,d.depositId,civilizationId);if(!(override>0)&&!(knowledge?.detectedFraction>0&&knowledge.confirmedFraction>0))continue;
  const initialQ=override??Math.floor(resourceQuanta(d.initialReserveU)*knowledge.confirmedFraction),used=runtime?.oreExtracted?.[key]??0;confirmedQ+=Math.max(0,initialQ-used);discoveredCount++;
 }
 const confirmedU=confirmedQ/1000,negative=negativeSurveyEvidence?.has(tileId)===true;return {confirmedU,value:confirmedQ>0?confirmedU:negative?0:null,status:confirmedQ>0?'known':negative?'confirmed-zero':'unknown',discoveredCount};
}
export function addSurveyTier(knowledge,tier,progress){if(!Number.isInteger(tier)||tier<0||tier>5||!Number.isFinite(progress)||progress<0||progress>1)throw Error('조사 티어/진행 범위 오류');const next=structuredClone(knowledge),record=next.tiers.find(t=>t.tier===tier);if(record)record.surveyProgress=Math.max(record.surveyProgress,progress);else next.tiers.push({tier,surveyProgress:progress});next.tiers.sort((a,b)=>a.tier-b.tier);return next;}
