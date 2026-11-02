// Authoring assumptions, not astronomical measurements or approved balance values.
export const DATA_GENERATOR_VERSION=1;
export const GENERATION_PROFILES=Object.freeze({
 'terrestrial-earthlike':{name:'암석·해양형',landTarget:.3,temperatureK:288,latitudeCoolingK:45,habitability:.8,terrain:'land'},
 'dry-rock':{name:'건조 암석형',landTarget:.98,temperatureK:220,latitudeCoolingK:35,habitability:.05,terrain:'desert'},
 'vacuum-rock':{name:'진공 암석·소형 위성',landTarget:1,temperatureK:null,latitudeCoolingK:0,habitability:0,terrain:'vacuum-rock'},
 'ice-surface':{name:'얼음 표면',landTarget:1,temperatureK:100,latitudeCoolingK:20,habitability:0,terrain:'ice'},
 'gas-giant':{name:'거대행성 대기 기준층',landTarget:null,temperatureK:null,latitudeCoolingK:0,habitability:0,terrain:'gas-atmosphere'},
 'unknown':{name:'미지·외계 암석형',landTarget:.8,temperatureK:null,latitudeCoolingK:0,habitability:null,terrain:'land'},
});
export function recommendGenerationProfile(body){
 if(body.surfaceType==='atmosphere')return {id:'gas-giant',reason:'명시적 surfaceType=atmosphere'};
 if(body.geologyProfileId){if(!Object.hasOwn(GENERATION_PROFILES,body.geologyProfileId))throw Error('등록되지 않은 geologyProfileId');return {id:body.geologyProfileId,reason:'천체 geologyProfileId 메타데이터'};}
 if(/giant|거대|가스/i.test(body.type??''))return {id:'gas-giant',reason:'기존 천체 유형 설명의 호환 분류'};
 return {id:body.kind==='moon'?'vacuum-rock':'unknown',reason:'유형 미지정: 보수적 공용 기본 프로필'};
}
export const defaultGenerationSeed=(systemId,bodyId)=>`${systemId}:${bodyId}:surface-data:v${DATA_GENERATOR_VERSION}`;
