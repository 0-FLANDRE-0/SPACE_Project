export const TONNES_PER_RESOURCE_U=10;
export const PERSONS_PER_POP=1000000;
export const MAX_RESOURCE_U=1e12; // prototype numeric safety bound, not a reserve balance
export const MAX_POPULATION_PERSONS=1e12;
export const RESOURCE_DEFINITIONS=new Map([
 ['ore',{id:'ore',name:'광석',unit:'U',naturalDeposit:true}],
 ['alloy',{id:'alloy',name:'합금',unit:'U',naturalDeposit:false}],
 ['credits',{id:'credits',name:'크레딧',unit:'C',naturalDeposit:false}],
]);
export function registerResource(definition){if(!/^[a-z][a-z0-9_-]{0,47}$/.test(definition.id)||!['U','C'].includes(definition.unit)||RESOURCE_DEFINITIONS.has(definition.id))throw Error('자원 정의 ID/단위가 올바르지 않거나 중복됩니다.');if(definition.naturalDeposit&&definition.unit!=='U')throw Error('매장 자원은 U 단위를 사용해야 합니다.');RESOURCE_DEFINITIONS.set(definition.id,{...definition});}
export const personsToPOP=persons=>persons===null?null:persons/PERSONS_PER_POP;
export function popToPersons(value){if(value===null||String(value).trim()==='')return null;const text=String(value).trim();if(!/^\d+(\.\d{1,6})?$/.test(text))throw Error('POP는 음수가 아닌 소수 6자리까지 입력하세요.');const [whole,fraction='']=text.split('.');const n=BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0'));if(n>BigInt(MAX_POPULATION_PERSONS))throw Error('인구 안전 한도를 초과했습니다.');return Number(n);}
