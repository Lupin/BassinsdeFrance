const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const values = {
  withdrawalYear:'2024', withdrawalUsage:'all', withdrawalMinimum:'0',
  qualityParameter:'1340', qualityMonth:'2025', droughtMonth:'2026-07', droughtState:'all'
};
const context = vm.createContext({
  console,
  document:{},
  $:selector=>({value:values[selector.slice(1)]}),
  cellsFor:(box,visit)=>visit('cell')
});
vm.runInContext(fs.readFileSync('outputs/au-fil-de-leau/dist/observations.js','utf8'),context);
function run(code) { return vm.runInContext(code,context); }
run(`
observationLayers.withdrawals.items=[{
  id:'a',box:[0,0,0,0],rows:[[2023,'AEP',500],[2024,'AEP',100],[2024,'IRR',200],[2024,'BAR',1000000]]
}];
observationLayers.quality.items=[{
  id:'q',box:[0,0,0,0],rows:[
    ['2024-12-31','1340',90,'1','mg/L'],
    ['2025-01-01','1340',80,'1','mg/L'],
    ['2025-02-01','1340',10,'1','mg/L'],
    ['2025-02-01','1340',20,'1','mg/L'],
    ['2025-03-01','1433',100,'1','mg/L']
  ]
}];
observationLayers.drought.items=[
  {id:'observed',box:[0,0,0,0],rows:[['2026-07-01','3','Assec'],['2026-07-20','1','Écoulement visible']]},
  {id:'not-observed',box:[0,0,0,0],rows:[['2026-06-01','3','Assec']]}
];
`);
assert.equal(run("observationSelection('withdrawals').items[0].volume"),300);
assert.equal(run("observationSelection('withdrawals').items[0].rows.length"),4);
values.withdrawalUsage='IRR';
assert.equal(run("observationSelection('withdrawals').items[0].volume"),200);
values.withdrawalUsage='BAR';
assert.equal(run("observationSelection('withdrawals').items[0].volume"),1000000);
values.withdrawalYear='2022';
assert.equal(run("observationSelection('withdrawals').items.length"),0);
assert.equal(run("observationSelection('quality').items[0].latest[0]"),'2025-02-01');
assert.equal(run("observationSelection('quality').items[0].latest[2]"),15);
assert.equal(run("observationSelection('quality').items[0].sameDayCount"),2);
assert.equal(run("qualityColor(['2025-01-01','1340',90,'2','mg/L'])"),'#637480');
assert.equal(run("qualityColor(['2025-01-01','1340',90,'1','mg(NO3)/L','Correcte'])"),'#55266f');
values.qualityMonth='2025-01';
assert.equal(run("observationSelection('quality').items[0].latest[2]"),80);
assert.equal(run("observationSelection('drought').items.length"),1);
assert.equal(run("observationSelection('drought').items[0].latest[1]"),'1');
values.droughtState='dry';
assert.equal(run("observationSelection('drought').items.length"),0);
console.log('Validé : périodes, usages, volumes, médiane datée, limites analytiques et absence d’observation.');
