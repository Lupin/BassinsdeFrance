'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dist = path.join(__dirname, '..', 'outputs', 'au-fil-de-leau', 'dist');
const elements = new Map();
let frameId = 0;

function element(selector = '') {
  const drawingContext = new Proxy({}, {
    get(target, property) {
      if (property in target) return target[property];
      if (property === 'measureText') return () => ({ width: 12 });
      return () => {};
    }
  });
  const item = {
    value: selector === '#basemap' ? 'none' : selector === '#riverOpacity' ? '100' : '2',
    checked: false,
    hidden: false,
    width: 900,
    height: 800,
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    append() {}, appendChild() {}, replaceChildren() {}, setAttribute() {},
    removeAttribute() {}, addEventListener() {}, querySelector() { return null; },
    querySelectorAll() { return []; }, focus() {},
    getBoundingClientRect() { return { width: 900, height: 800, left: 0, top: 0 }; },
    getContext() { return drawingContext; }
  };
  return item;
}

const window = {
  addEventListener() {},
  mapStartupFailure(message) { throw new Error(`Map rendering failed: ${message}`); }
};
const document = {
  hidden: false,
  activeElement: null,
  addEventListener() {},
  querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, element(selector));
    return elements.get(selector);
  },
  createElement(tag) { return element(tag); },
  createTextNode(text) { return text; }
};

const context = {
  window,
  document,
  console,
  devicePixelRatio: 1,
  performance: { now: () => 0 },
  requestAnimationFrame: () => ++frameId,
  cancelAnimationFrame() {},
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  Path2D: class {
    moveTo() {}
    lineTo() {}
    closePath() {}
    addPath() {}
  },
  initExplorer() {},
  initWaterTransport() {},
  initFloodLayer() {},
  initWatershedLayer() {},
  initObservations() {},
  drawFlood() {},
  drawWaterTransport() {},
  drawWatershedLimits() {},
  drawObservations() {},
  updateLegend() {},
  currentRoute() { return null; }
};

vm.createContext(context);
for (const filename of ['data.js', 'admin.js', 'app.js']) {
  const source = fs.readFileSync(path.join(dist, filename), 'utf8');
  vm.runInContext(source, context, { filename });
}

module.exports = {
  context,
  evaluate(source) { return vm.runInContext(source, context); }
};
