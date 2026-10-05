// CommonJS wrapper для Passenger 4.0 / Sprinthost
// Точка входа — server.mjs (ESM).
const path = require('path');

const mainFile = 'file://' + path.join(__dirname, 'server.mjs');

console.log('Passenger starting Bi-bi, loading:', mainFile);

import(mainFile).catch((err) => {
  console.error('Failed to load server.mjs:', err);
  process.exit(1);
});
