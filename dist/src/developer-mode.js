export const DEVELOPER_GESTURE=Object.freeze({taps:7,windowMs:5000,moveTolerance:8});
export class DeveloperMode {
 constructor({logo,button,drawer,exit,onChange,onOpen=()=>{}}){this.logo=logo;this.button=button;this.drawer=drawer;this.onChange=onChange;this.onOpen=onOpen;this.enabled=false;this.taps=[];this.abort=new AbortController();const options={signal:this.abort.signal};let start=null,cancelled=false;
  logo.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY};cancelled=!e.isPrimary;},options);
  logo.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>DEVELOPER_GESTURE.moveTolerance)cancelled=true;},options);
  logo.addEventListener('pointercancel',()=>{cancelled=true;this.taps=[];},options);
  logo.addEventListener('contextmenu',e=>e.preventDefault(),options);
  logo.addEventListener('click',e=>{if(e.detail!==0&&(cancelled||!start))return;start=null;const now=performance.now();this.taps=this.taps.filter(t=>now-t<=DEVELOPER_GESTURE.windowMs);this.taps.push(now);if(this.taps.length>=DEVELOPER_GESTURE.taps){this.taps=[];this.setEnabled(true,true);}},options);
  button.addEventListener('click',()=>{drawer.hidden=!drawer.hidden;button.setAttribute('aria-expanded',String(!drawer.hidden));if(!drawer.hidden)this.onOpen();},options);
  exit.addEventListener('click',()=>this.setEnabled(false),options);drawer.querySelector('[data-close-dev]').addEventListener('click',()=>{drawer.hidden=true;button.setAttribute('aria-expanded','false');},options);
 }
 setEnabled(enabled,open=false){this.taps=[];this.enabled=enabled;this.button.hidden=!enabled;this.drawer.hidden=!enabled||!open;this.button.setAttribute('aria-expanded',String(enabled&&open));this.logo.setAttribute('data-dev-enabled',String(enabled));if(enabled&&open)this.onOpen();this.onChange(enabled);}
 dispose(){this.abort.abort();this.taps=[];}
}
