import fs from 'node:fs';
// Historical exceptions plus the exact, independently audited FOLLOW-UP-1 list.
// Numerical ECON assertions, offline models, configurations and outputs stay frozen.
export const RESOURCE_FOUNDATION_UPDATES=new Set([
 // M1a explicitly authorizes live ship UI integration and additional speed presets.
 // Official data, industry/SCU contracts and offline ECON sources remain frozen.
 // M2 authorizes the surface selection/overlay and read-only knowledge bridge; official presets and ECON remain byte-exact.
 // UI1 authorizes draggable/context HUD bounds integration; a new 547-file manifest audits all official data and sim code.
 'dist/src/draggable-sector-panel.js','dist/src/context-panel.js',
 'dist/src/planetary-surface-ui.js','dist/src/resource-knowledge.js','dist/src/surface-distribution-ui.js',
 'dist/index.html','dist/style.css','dist/src/main.js','dist/src/scene.js','dist/src/time-control.js',
 'dist/src/resource-definitions.js','dist/src/industry-runtime.js',
 'dist/src/industry-storage.js','dist/src/industry-fixture.js',
 'dist/src/industry-ui.js','dist/src/earth-population-update.js',
 'tests/economy-model.test.js','tests/economy-round2.test.js',
 ...JSON.parse(fs.readFileSync('docs/resource-cargo-scu/followup-1/preservation-manifest.json')).allowedChanges.filter(f=>f.startsWith('dist/'))
]);
