// Clock authority is external to the cargo ledger. The scalar is serializable;
// an industrial binding also prevents callers from advancing ahead of its tick.
import {integer} from './packaging-common.js';
const clocks=new WeakMap();
export function bindPackagingClock(book,currentMs){if(typeof currentMs!=='function')throw Error('권위 있는 포장 시계 공급자 필요');clocks.set(book,currentMs);return book;}
export function bindIndustryPackagingClock(state){bindPackagingClock(state.packaging,()=>state.settledTick*3600000);return state;}
export function packagingNowMs(book){integer(book.clockMs,'권위 포장 시각');const authority=clocks.get(book);if(authority&&authority()!==book.clockMs)throw Error('산업 정산 시계와 포장 시계 불일치');return book.clockMs;}
export function assertPackagingTime(book,atMs=undefined){const now=packagingNowMs(book);if(atMs!==undefined&&(atMs!==now||!Number.isSafeInteger(atMs)))throw Error('현재 시각과 다른 과거/미래 포장 요청');return now;}
export function advancePackagingClock(book,toMs){integer(toMs,'현재 포장 시각');if(toMs<book.clockMs)throw Error('포장 시계 역행');const authority=clocks.get(book);if(authority&&toMs!==authority())throw Error('미래/위조 산업 포장 시각');book.clockMs=toMs;return toMs;}
