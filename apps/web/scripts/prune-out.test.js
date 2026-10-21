/** @jest-environment node */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pruneOut } = require('./prune-out');

let out;
beforeEach(() => {
  out = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-out-'));
});
afterEach(() => fs.rmSync(out, { recursive: true, force: true }));

describe('pruneOut', () => {
  it('removes the duplicate 404/ directory and keeps 404.html', () => {
    fs.mkdirSync(path.join(out, '404'));
    fs.writeFileSync(path.join(out, '404', 'index.html'), '');
    fs.writeFileSync(path.join(out, '404.html'), '');
    pruneOut(out);
    expect(fs.existsSync(path.join(out, '404'))).toBe(false);
    expect(fs.existsSync(path.join(out, '404.html'))).toBe(true);
  });

  it('is a no-op when there is nothing to prune', () => {
    expect(() => pruneOut(out)).not.toThrow();
  });

  it('runs from the command line on the given dir', () => {
    fs.mkdirSync(path.join(out, '404'));
    const script = path.join(__dirname, 'prune-out.js');
    const result = spawnSync(process.execPath, [script, out]);
    expect(result.status).toBe(0);
    expect(fs.existsSync(path.join(out, '404'))).toBe(false);
  });
});
