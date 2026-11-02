// ECON-SIM-3 only. Integer double-entry cash/material books; no browser state.
export const CASH_Q=1000, MATERIAL_Q=1000, KWH_PER_GWH=1e6;
export const quantize=(x,scale=1000)=>Math.round(x*scale);
const valid=n=>Number.isSafeInteger(n)&&n>=0;
export class Ledger {
 constructor({trace=false}={}){this.balance={};this.expected={};this.initial={};this.sources={};this.sinks={};this.turnover={};this.trace=trace?[]:null;}
 open(key,n){if(key in this.balance||!valid(n))throw Error('Invalid opening: '+key);this.balance[key]=this.expected[key]=this.initial[key]=n;return n;}
 get(key){return this.balance[key]??0;}
 ensure(key){if(!(key in this.balance))this.open(key,0);}
 move(from,to,n,tag='transfer'){
  this.ensure(from);this.ensure(to);if(from===to||!valid(n)||this.get(from)<n)throw Error('Invalid transfer '+tag);
  this.balance[from]-=n;this.balance[to]+=n;this.expected[from]-=n;this.expected[to]+=n;this.record(tag,n,from,to);return n;
 }
 source(to,n,tag){this.ensure(to);if(!valid(n)||!tag)throw Error('Invalid source');this.balance[to]+=n;this.expected[to]+=n;this.sources[tag]=(this.sources[tag]??0)+n;this.record(tag,n,null,to);return n;}
 sink(from,n,tag){this.ensure(from);if(!valid(n)||this.get(from)<n||!tag)throw Error('Invalid sink '+tag);this.balance[from]-=n;this.expected[from]-=n;this.sinks[tag]=(this.sinks[tag]??0)+n;this.record(tag,n,from,null);return n;}
 record(tag,n,from,to){this.turnover[tag]=(this.turnover[tag]??0)+n;if(this.trace)this.trace.push({tag,n,from,to});}
 sum(predicate=()=>true){return Object.entries(this.balance).reduce((s,[k,v])=>s+(predicate(k)?v:0),0);}
 audit(){for(const [k,n]of Object.entries(this.balance))if(!valid(n)||n!==this.expected[k])throw Error('Ledger mismatch: '+k);return true;}
}
export const account=(planet,owner,resource='C')=>`${planet}/${owner}/${resource}`;
// Trade is atomic: liquidity constrains purchases; a reference quote never
// creates sellers, stock, currency, or a guaranteed price floor.
export function trade(book,{planet,from,to,resource,amountU,priceC,tag='trade'}){
 if(!(priceC>0)||!Number.isFinite(amountU)||amountU<0)throw Error('Invalid trade quote');
 const src=account(planet,from,resource),dst=account(planet,to,resource),buyer=account(planet,to),seller=account(planet,from);
 const n=Math.min(quantize(amountU),book.get(src),Math.floor(book.get(buyer)/priceC));
 const cash=Math.round(n*priceC);if(n){book.move(src,dst,n,tag+':U');book.move(buyer,seller,cash,tag+':C');}
 return {amountU:n/1000,cashC:cash/1000};
}
export function energyAudit({generationKWh,dischargeKWh=0,servedKWh,chargeKWh=0,curtailedKWh=0}){
 const values=[generationKWh,dischargeKWh,servedKWh,chargeKWh,curtailedKWh];
 if(!values.every(valid)||generationKWh+dischargeKWh!==servedKWh+chargeKWh+curtailedKWh)throw Error('Energy conservation');return true;
}
