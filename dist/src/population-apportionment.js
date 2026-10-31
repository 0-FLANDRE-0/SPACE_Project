// Exact largest remainder on the decimal representation of source weights.
// Raster cell counts are already persons; never apply sector area again.
export function apportionPopulation(weights,totalPersons){
 if(!Number.isSafeInteger(totalPersons)||totalPersons<0||!Array.isArray(weights)||!weights.length||new Set(weights.map(w=>w.id)).size!==weights.length)throw Error('인구 배분 입력 오류');
 const parts=weights.map(({id,weight})=>{if(typeof id!=='string'||!Number.isFinite(weight)||weight<0)throw Error('인구 가중치 오류');const [c,e='0']=String(weight).toLowerCase().split('e'),[whole,fraction='']=c.split('.');return {id,digits:BigInt(whole+fraction),power:Number(e)-fraction.length};}),precision=Math.max(0,...parts.map(d=>-d.power)),units=parts.map(d=>({...d,weight:d.digits*10n**BigInt(precision+d.power)})),sum=units.reduce((n,d)=>n+d.weight,0n);if(sum===0n)throw Error('인구 가중치 합은 양수여야 합니다.');
 const rows=units.map(d=>({id:d.id,n:Number(BigInt(totalPersons)*d.weight/sum),remainder:BigInt(totalPersons)*d.weight%sum}));rows.sort((a,b)=>a.remainder===b.remainder?(a.id<b.id?-1:1):a.remainder>b.remainder?-1:1);const remainder=totalPersons-rows.reduce((n,r)=>n+r.n,0);for(let i=0;i<remainder;i++)rows[i].n++;return Object.fromEntries(rows.sort((a,b)=>a.id<b.id?-1:1).map(r=>[r.id,r.n]));
}
