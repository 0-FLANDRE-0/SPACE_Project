export const RECOVERY_SCALE=1000000;
export const deepFreeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value);}return value;};
export const safeId=id=>typeof id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_:.\/-]{0,127}$/.test(id)&&!Object.hasOwn(Object.prototype,id)&&id!=='prototype';
export function integer(value,label,max=Number.MAX_SAFE_INTEGER){if(!Number.isSafeInteger(value)||value<0||value>max)throw Error('포장 정수 범위 오류: '+label);return value;}
export function scaledDecimal(value,scale,label){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw Error('포장 수치 오류: '+label);
 const n=value*scale,rounded=Math.round(n);if(Math.abs(n-rounded)>Math.max(1e-7,Math.abs(n)*Number.EPSILON*2)||!Number.isSafeInteger(rounded))throw Error('포장 수치 정밀도 초과: '+label);return rounded;
}
export function checkedProduct(a,b,label){const n=BigInt(a)*BigInt(b);if(n>BigInt(Number.MAX_SAFE_INTEGER))throw Error('포장 안전 범위 초과: '+label);return Number(n);}
