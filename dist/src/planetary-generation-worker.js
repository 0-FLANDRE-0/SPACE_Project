import { generatePlanetSurfaceDraft } from './planetary-data-generator.js';
import { planSurfaceGeneration } from './planetary-generation-merge.js';
self.onmessage=event=>{try{const {generation,planning}=event.data,draft=generatePlanetSurfaceDraft(generation),preview=planSurfaceGeneration({...planning,draft});self.postMessage({ok:true,preview});}catch(error){self.postMessage({ok:false,error:error.message});}};
