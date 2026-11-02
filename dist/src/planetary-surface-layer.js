// Future-state composition example only. No game loop calls this helper in v0.5C.
import { clone } from './planetary-surface-model.js';
export function resolveEffectiveSurfaceState(original,scenario,current={}){
 const environment={...clone(original.environment),...clone(current.environment??{})},terrain={...clone(original.terrain),...clone(current.terrain??{})};
 const effective=key=>clone(Object.hasOwn(current,key)?current[key]:scenario[key]);
 const {landFraction:land,waterFraction:water}=terrain;
 if(original.surfaceType==='atmosphere'&&(land!==null||water!==null))throw Error('대기 기준층은 육지/해양으로 변환할 수 없습니다.');
 if(original.surfaceType!=='atmosphere'&&!((land===null&&water===null)||(typeof land==='number'&&typeof water==='number'&&land>=0&&water>=0&&land<=1&&water<=1&&Math.abs(land+water-1)<1e-9)))throw Error('현재 육지/해양 비율 쌍 오류');
 return {surfaceType:original.surfaceType,terrain,environment,deposits:clone(original.deposits),populationPersons:effective('populationPersons'),urbanizationRate:effective('urbanizationRate'),infrastructureLevel:effective('infrastructureLevel'),facilities:effective('facilities'),knowledge:effective('knowledge'),runtimeDepositState:clone(current.depositState??null)};
}
