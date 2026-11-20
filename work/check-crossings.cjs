'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({
  Intl,
  number: new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
});
const source = fs.readFileSync(
  path.join(__dirname, '..', 'outputs', 'au-fil-de-leau', 'dist', 'explore.js'),
  'utf8'
);
vm.runInContext(source, context, { filename: 'explore.js' });

assert.equal(vm.runInContext('crossingCountSummary(1)', context), '1 recoupement d’au moins 1 km².');
assert.equal(vm.runInContext('crossingCountSummary(2)', context), '2 recoupements d’au moins 1 km².');
console.log('Validé : singulier et pluriel du compteur de recoupements.');
