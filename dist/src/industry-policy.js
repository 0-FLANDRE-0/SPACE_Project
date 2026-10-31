// v0.5E tuning proposals. None of these curves, slot thresholds or upgrade
// prices establish a final economy. Agreed costs/yields are labelled separately.
export const INDUSTRY_POLICY=Object.freeze({version:1,provisional:true,monthDays:30,ticksPerDay:24,minimumConfirmedOreU:1000,maximumLevel:5,maximumDepth:25,maximumDiscoveryTier:1,historyMonths:12,eventLimit:80,lotLimit:20000,maxTicksPerAdvance:24000});
export const MINING='government_mining_complex',SMELTING='government_smelting_complex';
export const FACILITY_TYPES=Object.freeze({
 [MINING]:{name:'국영 광업단지',icon:'⛏',creditC:14500,alloyU:1200,hydrogenU:0,months:6,capacityU:5000},
 [SMELTING]:{name:'국영 제련단지',icon:'♨',creditC:24500,alloyU:3150,hydrogenU:120,months:8,capacityU:5000/1.15}
});
const clamp=d=>Math.max(0,Math.min(100,d));
export const extractionEfficiency=d=>1-.75*clamp(d)/100;
export const rampDurationMonths=d=>3+5*clamp(d)/100;
export const processingEfficiency=d=>1-.5*clamp(d)/100;
export function constructionEnvironment(geology,scenario){
 const e=geology.environment,t=e.temperatureK;
 const terms=[e.terrainObstacle??0,t===null?0:Math.min(1,Math.abs(t-288)/450),Math.min(1,(e.radiationLevel??0)/10),['ocean','mountain'].includes(geology.terrain.terrainType)?.5:0];
 // Use the largest correlated environmental burden, rather than multiplying it.
 return {factor:1+Math.max(...terms)*.5-Math.min(5,scenario.infrastructureLevel??0)*.02,blocked:geology.surfaceType==='atmosphere'?'대기 채집 시설은 후속 범위입니다.':t!==null&&t>600?'극한 고온 건설 기술이 준비되지 않았습니다.':null};
}
export function constructionSlots(tile,body,geology,scenario){
 // areaWeight already describes the spherical fraction. Multiply by 4πr² ONCE.
 const radius=body.realRadiusKm??6371,areaKm2=4*Math.PI*radius*radius*tile.areaWeight;
 const maximum=Math.max(1,Math.min(4,1+Math.floor(Math.log2(1+areaKm2/100000))));
 return {maxSlots:maximum,unlockedSlots:Math.min(maximum,1+Math.floor((scenario.infrastructureLevel??0)/2)),slotFacilityIds:Array(maximum).fill(null),areaKm2,policyVersion:1};
}
export function investmentCost(type,level=1,kind='build',factor=1){
 const d=FACILITY_TYPES[type];if(!d)throw Error('알 수 없는 시설 종류');
 const scale=kind==='build'?1:Math.pow(level,.9)*(kind==='upgrade'?.35:.65);
 return {creditC:Math.ceil(d.creditC*scale*factor),alloyQ:Math.ceil(d.alloyU*1000*scale*factor),hydrogenQ:Math.ceil(d.hydrogenU*1000*scale*factor),durationTicks:Math.ceil(d.months*30*24*scale*factor)};
}
