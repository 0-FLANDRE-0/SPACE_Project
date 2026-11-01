import {assertPackagingTime} from './packaging-clock.js';
import {integer} from './packaging-common.js';
import {quoteContainerPlan} from './cargo-scu.js';
import {atomicPackagingChange,packagingAccount,availableFreeQ,PACKAGING_INTERNALS as I} from './packaging-inventory.js';
import {containerQuantityQ,containerReservation,insertContainerGroup,recoverContainerGroup} from './container-state.js';
import {quoteContainerRepackage,takeContainersForQuantity,chargeNewContainers,orderedContainerGroups} from './container-inventory.js';
export function configureContainerAutomation(s,registry,ctx,options,timing={}){
 const now=assertPackagingTime(s,timing.atMs);
 return atomicPackagingChange(s,registry,w=>{const a=packagingAccount(w,ctx),line=a.scu.automation,allowed=['enabled','capacitySCUPerHour','batchSCU','forecastConsumptionQ','netBenefitMicroCPerU','protectedFreeQ'];for(const key of Object.keys(options))if(!allowed.includes(key))throw Error('SCU 자동화 설정 오류');settleContainerAccount(a,registry,now);for(const [key,value]of Object.entries(options))line[key]=structuredClone(value);return true;});
}
export function reserveContainerRepackageJob(s,registry,request){
 const now=assertPackagingTime(s,request.atMs);
 if(request.resourceId==='ore')throw Error('광석 로트 자동 재포장 미지원: 현지 개봉 후 명시 포장하세요.');
 if(request.objectivePolicy)throw Error('영속 SCU 큐의 사용자 정의 객관함수 정책 등록 미연결');
 const check=quoteContainerRepackage(s,registry,request);if(!check.allowed)throw Error(check.reason);
 return atomicPackagingChange(s,registry,w=>{const a=packagingAccount(w,request),line=a.scu.automation;if(!(line.capacitySCUPerHour>0))throw Error('SCU 설비 처리능력 미연결');if(line.jobs.some(j=>j.status==='reserved'))throw Error('SCU 설비 작업 중');settleContainerAccount(a,registry,now);
  const selected=takeContainersForQuantity(a,request.resourceId,request.amountQ,registry,{exact:true}),plan=quoteContainerPlan(request.resourceId,request.amountQ,registry,{...request,ownerId:a.ownerId});
  const reservation=containerReservation(selected.groups,plan,registry);for(const [id,q]of Object.entries(reservation.materialQ))if(availableFreeQ(a,id)-q<(line.protectedFreeQ[id]??0))throw Error('필수 소재 보호/SCU 예약 부족');
  if(a.creditsMicroC-I.reserved(a,'creditsMicroC')<reservation.creditsMicroC||a.energyWh-I.reserved(a,'energyWh')<reservation.energyWh)throw Error('SCU 예약 C/전력 부족');
  const planOptions={allowedContainerSizes:request.allowedContainerSizes??null,minGeneration:request.minGeneration??1,availableSpecIds:plan.combinations.map(c=>c.containerSpecId),materialWeights:structuredClone(request.materialWeights??{})};
  const job={startedMs:now,id:'container-job-'+line.nextJob++,resourceId:request.resourceId,amountQ:request.amountQ,status:'reserved',escrow:selected.groups,planOptions,reservation,workSCU:plan.occupiedSCU,processedSCU:0};line.jobs=line.jobs.slice(-63);line.jobs.push(job);line.pendingReason='SCU 처리능력/시간에 따른 재포장 중';return job.id;
 });
}
export function cancelContainerRepackageJob(s,registry,ctx,id,timing={}){const now=assertPackagingTime(s,timing.atMs);return atomicPackagingChange(s,registry,w=>{const a=packagingAccount(w,ctx),line=a.scu.automation;settleContainerAccount(a,registry,now);const j=line.jobs.find(j=>j.id===id);if(!j||j.status!=='reserved')throw Error('취소할 SCU 작업 없음');for(const g of j.escrow)insertContainerGroup(a,g);j.escrow=[];j.status='cancelled';line.carry=0;line.pendingReason='취소: 실물 컨테이너·예약 반환';return true;});}
function settleContainerAccount(a,registry,toMs){const line=a.scu.automation;if(toMs<line.lastMs)throw Error('SCU 시계 역행');const j=line.jobs.find(j=>j.status==='reserved'),elapsed=toMs-Math.max(line.lastMs,j?.startedMs??line.lastMs);line.lastMs=toMs;
  if(!j||!line.enabled||!(line.capacitySCUPerHour>0)){if(!j)line.carry=0;line.pendingReason=!line.enabled?'자동 현대화 꺼짐':!j?'작업 없음':'SCU 처리능력 미결정';return {completed:0,processedSCU:0};}
  const numerator=BigInt(elapsed)*BigInt(line.capacitySCUPerHour)+BigInt(line.carry),budget=numerator/3600000n;line.carry=Number(numerator%3600000n);const remaining=j.workSCU-j.processedSCU,processedSCU=Number(budget>BigInt(remaining)?BigInt(remaining):budget);j.processedSCU+=processedSCU;
  if(j.processedSCU<j.workSCU)return {completed:0,processedSCU};
  j.status='completed';for(const g of j.escrow)recoverContainerGroup(a,g,registry);const plan=quoteContainerPlan(j.resourceId,j.amountQ,registry,{ownerId:a.ownerId,...j.planOptions,availableContainerSpecs:()=>j.planOptions.availableSpecIds});chargeNewContainers(a,plan,registry,{reservationId:j.id});j.escrow=[];line.carry=0;line.pendingReason='작업 없음';return {completed:1,processedSCU};
}
export function advanceContainerQueue(s,registry,ctx,toMs){assertPackagingTime(s,toMs);return atomicPackagingChange(s,registry,w=>settleContainerAccount(packagingAccount(w,ctx),registry,toMs),{revisionStep:r=>r.completed});}
export function planContainerModernization(s,registry,ctx,{availableContainerSpecs=null}={}){
 const now=assertPackagingTime(s),a=packagingAccount(s,ctx),line=a.scu.automation;let reason=null,choice;
 if(!line.enabled)reason='자동 현대화 꺼짐';else if(!(line.capacitySCUPerHour>0))reason='SCU 설비 처리능력 미결정';else if(!(line.batchSCU>0))reason='점진적 SCU 처리 묶음 미결정';else if(line.forecastConsumptionQ===null)reason='선행 소비 예측 미결정';else if(line.netBenefitMicroCPerU===null)reason='순편익 평가 미결정';else if(line.netBenefitMicroCPerU<=0)reason='경제성 없는 현대화 보류';else if(line.jobs.some(j=>j.status==='reserved'))reason='SCU 설비 작업 중';
 if(!reason){for(const resourceId of new Set(Object.values(a.scu.groups).map(g=>g.resourceId))){for(const [,g]of orderedContainerGroups(a,resourceId,registry)){if(resourceId==='ore')continue;
  const current=registry.containers.get(g.containerSpecId),newer=registry.containers.available(a.ownerId,availableContainerSpecs,{minGeneration:current.generation+1});if(!newer.length)continue;
  const spare=Math.max(0,containerQuantityQ(a,resourceId,{includeReserved:false})-line.forecastConsumptionQ),count=Math.min(g.count,Math.floor(line.batchSCU/current.sizeSCU),Math.floor(spare/g.fillQ));
  if(count){choice={...ctx,atMs:now,resourceId,amountQ:count*g.fillQ,minGeneration:current.generation+1,availableContainerSpecs};break;}
 }if(choice)break;}if(!choice)reason='곧 소비될 재고/신형 컨테이너 없음';}
 if(choice)try{const target=quoteContainerPlan(choice.resourceId,choice.amountQ,registry,{...choice,ownerId:a.ownerId});if(target.occupiedSCU>line.batchSCU)throw Error('신형 외형 SCU가 자동 처리 묶음 한도 초과');return {queued:true,jobId:reserveContainerRepackageJob(s,registry,choice)};}catch(e){reason=e.message;}
 if(line.pendingReason!==reason)atomicPackagingChange(s,registry,w=>{packagingAccount(w,ctx).scu.automation.pendingReason=reason;});return {queued:false,reason};
}
