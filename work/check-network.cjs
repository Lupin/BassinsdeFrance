'use strict';

const assert = require('node:assert/strict');
const { evaluate } = require('./check-map-context.cjs');

const routes = evaluate(`Object.keys(specs).map(key => {
  const river = names.get(key);
  const route = river && river.route;
  const parentKey = specs[key][1];
  const parent = parentKey && names.get(parentKey)?.route;
  const joinDistance = parent
    ? Math.min(...parent.full.map(point => Math.sqrt(dist2(route.line.at(-1), point))))
    : 0;
  return {
    name: key,
    river: Boolean(river),
    length: river?.l,
    linePoints: route?.line.length || 0,
    fullPoints: route?.full.length || 0,
    hasParent: !parentKey || Boolean(parent),
    joinDistance,
    finite: Boolean(route?.full.every(point => point.length >= 2 && point.every(Number.isFinite)))
  };
})`);
const rows = JSON.parse(JSON.stringify(routes));

assert.ok(rows.length >= 40, `Seulement ${rows.length} parcours documentés`);
for (const route of rows) {
  assert.ok(route.river, `${route.name}: cours d’eau absent`);
  assert.ok(route.length > 0, `${route.name}: longueur non positive`);
  assert.ok(route.linePoints >= 2, `${route.name}: tracé trop court`);
  assert.ok(route.fullPoints >= route.linePoints, `${route.name}: parcours aval tronqué`);
  assert.ok(route.hasParent, `${route.name}: cours d’eau parent absent`);
  assert.ok(route.finite, `${route.name}: coordonnées invalides`);
  assert.ok(route.joinDistance <= 12.01, `${route.name}: jonction trop éloignée (${route.joinDistance})`);
}

console.log(`Réseau validé : ${rows.length} parcours, géométries finies et confluences dans la tolérance.`);
