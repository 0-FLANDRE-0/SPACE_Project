export function resourceQuanta(value){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e12)throw Error('자원 예산은 0–1e12 U의 유한 수여야 합니다.');
 const [coefficient,exponent='0']=String(value).toLowerCase().split('e'),[whole,fraction='']=coefficient.split('.'),digits=BigInt(whole+fraction),shift=3+Number(exponent)-fraction.length;
 if(shift>=0)return Number(digits*10n**BigInt(shift));const divisor=10n**BigInt(-shift);if(digits%divisor!==0n)throw Error('자원 예산/고정 매장량은 0.001 U 단위로 맞추세요.');return Number(digits/divisor);
}
