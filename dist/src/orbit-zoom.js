import {M1B_TUNING as B} from './orbit-data.js';
// Ratios supplied by the view; no camera state enters physical navigation.
export class OrbitZoomState {
  bodyId=null;layer=null;
  reset(){this.bodyId=null;this.layer=null;}
  update(candidates){
    let current=candidates.find(c=>c.bodyId===this.bodyId);
    if(!current||current.distanceHighRadii>B.zoomExitHighRadii||current.centerHighRadii>B.centerExitHighRadii){this.reset();current=candidates.filter(c=>c.distanceHighRadii<B.zoomEnterHighRadii&&c.centerHighRadii<B.centerEnterHighRadii).sort((a,b)=>a.distanceHighRadii-b.distanceHighRadii)[0];if(current)this.bodyId=current.bodyId;}
    if(!current){this.layer=null;return this;}
    const d=current.distanceBodyRadii,t=B.layerDistanceBodyRadii,ordered=['high','middle','low','surface'];let layer=d<t.surface?'surface':d<t.low?'low':d<t.middle?'middle':'high';
    if(this.layer&&layer!==this.layer){const previous=ordered.indexOf(this.layer),next=ordered.indexOf(layer),boundary=next>previous?t[ordered[previous+1]]:t[this.layer];if(Math.abs(d-boundary)<B.layerHysteresis)layer=this.layer;}
    this.layer=layer;return this;
  }
}
