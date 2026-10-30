import * as THREE from 'three';
import { SURFACE_FILES } from './data.js';
export function random(seed=42) {return ()=>{seed=(Math.imul(1664525,seed)+1013904223)|0;return (seed>>>0)/4294967296;};}
export async function loadSurfaceMaps(files=SURFACE_FILES) {
  const loader=new THREE.TextureLoader();
  const entries=await Promise.all(Object.entries(files).map(async([id,url])=>{
    const texture=await loader.loadAsync(url);
    texture.colorSpace=id==='clouds'?THREE.NoColorSpace:THREE.SRGBColorSpace;
    texture.anisotropy=4;
    return [id,texture];
  }));
  return Object.fromEntries(entries);
}
export function glowTexture() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(128,128,0,128,128,128);
  g.addColorStop(0,'rgba(255,230,150,1)');g.addColorStop(.16,'rgba(255,193,88,.6)');g.addColorStop(.32,'rgba(255,150,45,.16)');g.addColorStop(.65,'rgba(243,120,28,.035)');g.addColorStop(1,'rgba(255,120,20,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,256,256);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
