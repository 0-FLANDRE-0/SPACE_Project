import fs from 'node:fs';
export const populationPackage=JSON.parse(fs.readFileSync(new URL('../../dist/data/planet-surfaces/earth-population-e1.json',import.meta.url)));
// Reconstruct the pre-E.1 population fields solely for legacy preservation
// assertions; the new distribution is checked independently against GHSL data.
export function beforePopulationTemplate(template){const t=structuredClone(template);if(t.systemId==='sol'&&t.bodyId==='earth')for(const [id,n]of Object.entries(populationPackage.before.populationPersons))t.startingScenario.cells[id].populationPersons=n;return t;}
