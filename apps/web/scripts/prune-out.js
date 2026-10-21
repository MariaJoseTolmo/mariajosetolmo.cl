// Removes what Next exports twice: `out/404/` duplicates `out/404.html`.
// Usage: node scripts/prune-out.js [outDir]
const fs = require('node:fs');
const path = require('node:path');

function pruneOut(outDir) {
  fs.rmSync(path.join(outDir, '404'), { recursive: true, force: true });
}

if (require.main === module) {
  pruneOut(process.argv[2] ?? path.join(__dirname, '..', 'out'));
}

module.exports = { pruneOut };
