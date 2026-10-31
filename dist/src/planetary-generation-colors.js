import { quantileDistribution } from './surface-distribution-model.js';
import { resolvedSurfaceCell, TERRAIN_TYPES } from './planetary-surface-model.js';
export const GENERATION_MAP_MODES={land:'육지·해양 비율',terrain:'지형',ore:'광석 매장량',population:'인구 분포',urbanization:'도시화',unset:'미설정 항목'};
export const TERRAIN_COLORS={land:'#83b56a',ocean:'#2877bd',mixed:'#58b6b0',ice:'#d4e5ed',desert:'#d5ae65',mountain:'#9b8275','vacuum-rock':'#9399a5','gas-atmosphere':'#b09bcb'};
export function generationMapData(template,grid,body,mode){
 if(!Object.hasOwn(GENERATION_MAP_MODES,mode))throw Error('지도 레이어 오류');const values=new Map();
 for(const t of grid.tiles){const {geology:g,scenario:s}=resolvedSurfaceCell(template,grid,body,t.id);let value=null;
  if(mode==='land')value=g.terrain.landFraction;if(mode==='terrain')value=g.terrain.terrainType;if(mode==='ore')value=g.deposits===null?null:g.deposits.filter(d=>d.resourceId==='ore').reduce((n,d)=>n+d.initialReserveU,0);if(mode==='population')value=s.populationPersons;if(mode==='urbanization')value=s.urbanizationRate;
  if(mode==='unset')value=[g.terrain.terrainType,g.surfaceType==='atmosphere'?0:g.terrain.landFraction,...Object.values(g.environment),g.deposits,s.populationPersons,s.urbanizationRate,s.infrastructureLevel].filter(v=>v===null).length;
  values.set(t.id,value);
 }
 const numbers=[...values.values()].filter(v=>typeof v==='number'),min=numbers.length?Math.min(...numbers):null,max=numbers.length?Math.max(...numbers):null,colors=new Map();let distributionLegend=null;
 for(const [id,value]of values){let color='#596375';if(value!==null){if(mode==='terrain')color=TERRAIN_COLORS[value];else{const t=mode==='land'||mode==='urbanization'?value:max===0?0:Math.log1p(value)/Math.log1p(max);const low=mode==='land'?[35,92,167]:[26,62,95],high=mode==='land'?[128,190,100]:[244,190,85];color='#'+low.map((n,i)=>Math.round(n+(high[i]-n)*t).toString(16).padStart(2,'0')).join('');}}colors.set(id,color);}
 if(['ore','population'].includes(mode)){const scale=quantileDistribution(values);for(const [id,color]of scale.colors)colors.set(id,color);const format=n=>(mode==='population'?n/1000000:n).toLocaleString('ko-KR',{maximumFractionDigits:mode==='population'?6:3}),unit=mode==='population'?'POP':'U';distributionLegend=[{name:'미설정',color:'#626A77'},{name:'확인된 0',color:'#080C13'},...scale.bands.map(b=>({name:format(b.min)+'–'+format(b.max)+' '+unit,color:b.color}))];}
 const unit={land:'육지 비율',ore:'U (1 U=10톤)',population:'명',urbanization:'0–1',unset:'미설정 필드 수',terrain:'분류'}[mode];
 return {colors,values,min,max,unit,nullCount:[...values.values()].filter(v=>v===null).length,legend:mode==='terrain'?Object.entries(TERRAIN_TYPES).map(([id,name])=>({name,color:TERRAIN_COLORS[id]})):distributionLegend};
}
