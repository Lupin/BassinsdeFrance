'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'outputs', 'au-fil-de-leau', 'dist');
const scripts = fs.readdirSync(dist).filter(name => name.endsWith('.js')).sort();
let failures = 0;

for (const script of scripts) {
  const result = spawnSync(process.execPath, ['--check', path.join(dist, script)], {
    cwd: root,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    failures++;
    process.stderr.write(`Échec de syntaxe : ${script}\n${result.stderr}`);
  }
}
if (failures) process.exitCode = 1;
else console.log(`Syntaxe JavaScript valide : ${scripts.length} fichiers.`);

if (!process.exitCode) {
  const accessibility = spawnSync('python3', [path.join(__dirname, 'check-accessibility.py')], {
    cwd: root,
    stdio: 'inherit'
  });
  if (accessibility.status !== 0) process.exitCode = accessibility.status || 1;
}

for (const test of ['check-animation.cjs', 'check-network.cjs', 'check-crossings.cjs', 'check-observations.cjs']) {
  if (process.exitCode) break;
  const result = spawnSync(process.execPath, [path.join(__dirname, test)], {
    cwd: root,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    break;
  }
}

if (!process.exitCode) console.log('Tous les contrôles ciblés ont réussi.');
