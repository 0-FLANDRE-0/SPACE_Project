import {DEFAULT_PACKAGE_REGISTRY,integer} from './packaging-specs.js';
import {atomicPackagingChange,packagingAccount,availableFreeQ,packagedQuantityQ,quoteRepackage,repackageReservation,PACKAGING_INTERNALS as I} from './packaging-inventory.js';
const registryOr=r=>r??DEFAULT_PACKAGE_REGISTRY;
export function configurePackagingAutomation(s,registry,ctx,options){registry=registryOr(registry);return atomicPackagingChange(s,registry,w=>{
 const a=packagingAccount(w,ctx).automation,allowed=['enabled','capacityQPerHour','batchQ','protectedFreeQ','forecastConsumptionQ','benefitMicroCPerU'];for(const [k,v]of Object.entries(options)){if(!allowed.includes(k))throw Error('알 수 없는 포장 자동화 설정');a[k]=structuredClone(v);}return true;
});}
export function reserveRepackageJob(s,registry,request){registry=registryOr(registry);const check=quoteRepackage(s,registry,request);if(!check.allowed)throw Error(check.reason);
 return atomicPackagingChange(s,registry,w=>{
  const a=packagingAccount(w,request),line=a.automation;if(!(line.capacityQPerHour>0))throw Error('재포장 설비 처리능력 미연결');if(line.jobs.some(j=>j.status==='reserved'))throw Error('현재 계정의 포장 설비가 작업 중입니다.');
  const spec=registry.assertExecutable(request.toSpecId),escrow=I.takeGroups(a,request.resourceId,request.amountQ,registry,request.fromSpecId);
  // Rounding counters can advance during production. Reserve their worst-case
  // integer quantum, using the minimum guaranteed old-material recovery. The
  // unused <1Q/<1microC/<1Wh margin is released at completion, never charged.
  const {materialQ,creditsMicroC,energyWh}=repackageReservation(escrow,spec,request.amountQ,registry);for(const [id,needed]of Object.entries(materialQ))if(availableFreeQ(a,id)-needed<(line.protectedFreeQ[id]??0))throw Error('필수 유지보수 보호/예약 소재 부족');
  if(a.creditsMicroC<creditsMicroC||a.energyWh<energyWh)throw Error('예약 C/전력 부족');
  line.jobs=line.jobs.slice(-63);const job={availableSpecIds:[request.toSpecId],id:'package-job-'+line.nextJob++,resourceId:request.resourceId,fromSpecId:request.fromSpecId??null,toSpecId:request.toSpecId,amountQ:request.amountQ,processedQ:0,status:'reserved',escrow,reservation:{materialQ,creditsMicroC,energyWh}};
  line.jobs.push(job);line.pendingReason='처리능력/시간에 따라 재포장 중';return job.id;
 });
}
export function cancelRepackageJob(s,registry,ctx,jobId){return atomicPackagingChange(s,registryOr(registry),w=>{const a=packagingAccount(w,ctx),j=a.automation.jobs.find(j=>j.id===jobId);if(!j||j.status!=='reserved')throw Error('취소 가능한 포장 작업이 없습니다.');for(const g of j.escrow)I.insertGroup(a,g);j.escrow=[];j.status='cancelled';a.automation.carry=0;a.automation.pendingReason='취소: 소재/내용물 예약 반환';return true;});}
export function advancePackagingQueue(s,registry,ctx,toMs){registry=registryOr(registry);integer(toMs,'포장 작업 시간');return atomicPackagingChange(s,registry,w=>{
 const a=packagingAccount(w,ctx),line=a.automation;if(toMs<line.lastMs)throw Error('포장 작업 시계 역행');const delta=toMs-line.lastMs;line.lastMs=toMs;const job=line.jobs.find(j=>j.status==='reserved');
 if(!job||!(line.capacityQPerHour>0)||!line.enabled){line.carry=0;line.pendingReason=!line.enabled?'자동 개선 꺼짐':!job?'작업 없음':'설비 처리능력 미결정';return {processedQ:0,completed:0};}
 const work=BigInt(delta)*BigInt(line.capacityQPerHour)+BigInt(line.carry),budget=work/3600000n;line.carry=Number(work%3600000n);
 const processed=Number(budget>BigInt(job.amountQ-job.processedQ)?BigInt(job.amountQ-job.processedQ):budget);job.processedQ+=processed;
 if(job.processedQ<job.amountQ)return {processedQ:processed,completed:0};
 // Temporarily release this job's reservation inside the isolated transaction.
 // Any failure leaves the entire live state (and reserved inputs) unchanged.
 job.status='completed';for(const g of job.escrow)I.recover(a,g,registry);I.add(a.freeQ,job.resourceId,job.amountQ);I.packing(a,{resourceId:job.resourceId,amountQ:job.amountQ,packageSpecId:job.toSpecId,availablePackageSpecs:()=>job.availableSpecIds},registry);job.escrow=[];line.carry=0;line.pendingReason='작업 없음';return {processedQ:processed,completed:1};
 },{revisionStep:result=>result.completed});}
export function planAutomaticPackaging(s,registry,ctx,{availablePackageSpecs=null,chunkQ=null}={}){
 registry=registryOr(registry);const a=packagingAccount(s,ctx),line=a.automation;let reason=null;
 if(!line.enabled)reason='자동 개선 꺼짐';else if(!(line.capacityQPerHour>0))reason='설비 처리능력/시간 미결정';else if(line.forecastConsumptionQ===null)reason='선행 소비 예측 미결정';else if(line.benefitMicroCPerU===null)reason='경제성 평가 미결정';else if(line.benefitMicroCPerU<=0)reason='경제성 없는 재포장 보류';else if(line.jobs.some(j=>j.status==='reserved'))reason='현재 포장 설비 작업 중';else if(!Number.isSafeInteger(chunkQ)||chunkQ<=0)reason='점진적 처리 묶음 미결정';
 let choice;
 if(!reason){const groups=Object.values(a.groups).sort((x,y)=>registry.get(x.packageSpecId).generation-registry.get(y.packageSpecId).generation||x.packageSpecId.localeCompare(y.packageSpecId));for(const g of groups){const current=registry.get(g.packageSpecId),latest=registry.latest(g.resourceId,a.ownerId,availablePackageSpecs);if(!latest||latest.compatibility||latest.generation<=current.generation)continue;const available=Math.max(0,packagedQuantityQ(a,g.resourceId,{includeReserved:false})-line.forecastConsumptionQ),amountQ=Math.min(chunkQ,g.amountQ,available);if(amountQ){choice={...ctx,resourceId:g.resourceId,fromSpecId:g.packageSpecId,toSpecId:latest.id,amountQ,availablePackageSpecs};break;}}if(!choice)reason='곧 소비될 재고/신형 규격 없음';}
 if(choice)try{return {queued:true,jobId:reserveRepackageJob(s,registry,choice)};}catch(e){reason=e.message;}
 if(line.pendingReason!==reason)atomicPackagingChange(s,registry,w=>{packagingAccount(w,ctx).automation.pendingReason=reason;});return {queued:false,reason};
}
