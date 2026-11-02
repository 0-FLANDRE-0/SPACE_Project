export const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
export const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
export const mul=(a,k)=>({x:a.x*k,y:a.y*k,z:a.z*k});
export const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
export const length=a=>Math.hypot(a.x,a.y,a.z);
export const distance=(a,b)=>length(sub(a,b));
export const unit=a=>length(a)>1e-12?mul(a,1/length(a)):{x:0,y:0,z:1};
export const lerp=(a,b,t)=>add(mul(a,1-t),mul(b,t));
export const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,dot(unit(a),unit(b)))));
export const finiteVector=a=>a&&['x','y','z'].every(k=>Number.isFinite(a[k]));
export function directionBetween(a,b,t){const u=unit(a),v=unit(b),theta=angle(u,v);if(theta<1e-8)return v;let axis=cross(u,v);if(length(axis)<1e-8)axis=cross(u,Math.abs(u.y)<.9?{x:0,y:1,z:0}:{x:1,y:0,z:0});axis=unit(axis);const phi=theta*t;return add(add(mul(u,Math.cos(phi)),mul(cross(axis,u),Math.sin(phi))),mul(axis,dot(axis,u)*(1-Math.cos(phi))));}
export function sphereDirections(n){return Array.from({length:n},(_,i)=>{const y=1-2*(i+.5)/n,r=Math.sqrt(1-y*y),a=i*Math.PI*(3-Math.sqrt(5));return{x:r*Math.cos(a),y,z:r*Math.sin(a)};});}
export function segmentDistance(a,b,p){const d=sub(b,a),t=Math.max(0,Math.min(1,dot(sub(p,a),d)/Math.max(1e-20,dot(d,d))));return distance(lerp(a,b,t),p);}
