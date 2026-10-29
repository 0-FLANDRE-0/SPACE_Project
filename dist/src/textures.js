import * as THREE from 'three';

export function random(seed = 42) {
  return () => { seed = (Math.imul(1664525, seed) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
}

function canvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function planetTexture(body, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const rng = random(seed);
  const image = ctx.createImageData(canvas.width, canvas.height);
  const base = new THREE.Color(body.color);
  // Work in sRGB for the canvas image.
  base.convertLinearToSRGB();
  const gas = ['jupiter', 'saturn', 'venus', 'uranus', 'neptune', 'titan'].includes(body.id);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const wave = Math.sin(y * .15 + Math.sin(x * .011) * .7) * .05 + Math.sin(y * .047) * .09 + Math.sin(y * .48) * .025;
      const variation = gas ? .78 + wave + rng() * .045 : .67 + rng() * .34 + Math.sin(x * .047) * Math.sin(y * .05) * .08;
      if (body.id === 'earth') {
        image.data[i] = 18 + rng() * 5; image.data[i + 1] = 60 + rng() * 12; image.data[i + 2] = 111 + rng() * 25;
      } else {
        image.data[i] = Math.min(255, base.r * 255 * variation);
        image.data[i + 1] = Math.min(255, base.g * 255 * variation);
        image.data[i + 2] = Math.min(255, base.b * 255 * variation);
      }
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  if (body.id === 'earth') {
    // Stylized, hand-authored equirectangular continental silhouettes.
    const continents = [
      [[.08,.20],[.16,.12],[.24,.14],[.29,.24],[.25,.31],[.23,.40],[.18,.46],[.14,.35],[.10,.30]],
      [[.24,.43],[.30,.46],[.33,.55],[.31,.64],[.28,.77],[.25,.83],[.23,.65],[.21,.52]],
      [[.43,.27],[.48,.21],[.52,.24],[.53,.32],[.49,.36],[.45,.33]],
      [[.45,.37],[.53,.34],[.58,.45],[.55,.58],[.52,.70],[.48,.63],[.44,.48]],
      [[.52,.20],[.60,.16],[.67,.20],[.72,.15],[.82,.22],[.86,.31],[.76,.37],[.71,.46],[.65,.41],[.60,.46],[.56,.32]],
      [[.76,.63],[.83,.59],[.88,.66],[.87,.74],[.80,.75],[.76,.70]],
      [[.31,.10],[.36,.08],[.38,.17],[.35,.24],[.31,.19]],
    ];
    for (const points of continents) {
      ctx.beginPath(); points.forEach(([x,y],i) => i ? ctx.lineTo(x*1024,y*512) : ctx.moveTo(x*1024,y*512)); ctx.closePath();
      ctx.fillStyle = '#758567'; ctx.fill();
      ctx.save(); ctx.clip();
      for(let i=0;i<1300;i++) { ctx.fillStyle = rng()>.5 ? '#a39a72' : '#4f7359'; ctx.globalAlpha=.4; ctx.fillRect(rng()*1024,rng()*512,9,5); }
      ctx.restore();
    }
    ctx.fillStyle = '#d5e4e3'; ctx.beginPath(); ctx.ellipse(510,505,530,28,0,0,Math.PI*2); ctx.fill();
    for(let i=0;i<140;i++) { ctx.globalAlpha = .04 + rng()*.17; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(rng()*1024,rng()*512,15+rng()*65,1+rng()*5,rng()*.3,0,Math.PI*2); ctx.fill(); }
    ctx.globalAlpha=1;
  } else if (!gas) {
    for (let i=0;i<130;i++) {
      const x=rng()*1024, y=rng()*512, r=2+rng()*14;
      ctx.strokeStyle='rgba(30,26,23,.15)'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(x,y,r*1.3,r,0,0,Math.PI*2); ctx.stroke();
    }
  }
  if (body.id === 'jupiter') {
    ctx.fillStyle = '#b57558'; ctx.beginPath(); ctx.ellipse(680,325,54,18,-.08,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#d2ae8c'; ctx.lineWidth=5; ctx.stroke();
  }
  return canvasTexture(canvas);
}

export function glowTexture() {
  const canvas=document.createElement('canvas'); canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d'); const g=ctx.createRadialGradient(128,128,0,128,128,128);
  g.addColorStop(0,'rgba(255,230,150,1)'); g.addColorStop(.16,'rgba(255,193,88,.6)'); g.addColorStop(.32,'rgba(255,150,45,.16)'); g.addColorStop(.65,'rgba(243,120,28,.035)'); g.addColorStop(1,'rgba(255,120,20,0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,256,256); return canvasTexture(canvas);
}

export function ringTexture() {
  const canvas=document.createElement('canvas'); canvas.width=256; canvas.height=1;
  const ctx=canvas.getContext('2d'); const rng=random(85);
  for(let i=0;i<256;i++) { const alpha=i>125&&i<139 ? .05 : .25+rng()*.5; ctx.fillStyle=`rgba(207,188,151,${alpha})`; ctx.fillRect(i,0,1,1); }
  return canvasTexture(canvas);
}
