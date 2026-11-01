// Only files explicitly required by RESOURCE-UNIT-1 / PACKAGING-1 may differ.
// Numerical ECON assertions, offline models, configurations and outputs stay frozen.
export const RESOURCE_FOUNDATION_UPDATES=new Set([
 'dist/src/resource-definitions.js','dist/src/industry-runtime.js',
 'dist/src/industry-storage.js','dist/src/industry-fixture.js',
 'dist/src/industry-ui.js','dist/src/earth-population-update.js',
 'tests/economy-model.test.js','tests/economy-round2.test.js'
]);
