import fs from 'node:fs/promises';
import {createSolContext} from '../dist/src/system-context.js';
import {createPlanetarySurfaceGrid} from '../dist/src/planetary-surface-grid.js';
const grid=createPlanetarySurfaceGrid('sol',createSolContext().bodyById.get('earth'));
if(!process.argv[2])throw Error('Usage: node scripts/export-earth-population-grid.mjs <output.json>');
await fs.writeFile(process.argv[2],JSON.stringify({fingerprint:grid.gridFingerprint,tiles:grid.tiles.map(t=>({id:t.id,center:t.center,edgeNormals:t.edgeNormals,cosRadius:t.cosRadius,latitudeDegrees:t.latitudeDegrees,longitudeDegrees:t.longitudeDegrees}))}));
