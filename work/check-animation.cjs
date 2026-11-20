'use strict';

const assert = require('node:assert/strict');
const { evaluate } = require('./check-map-context.cjs');

const results = evaluate(`(() => {
  const levels = [1, 3, 6, 12];
  const checks = [];
  let clock = 1000;

  for (const level of levels) {
    zoomAt(level / zoom);
    const frames = [];
    let currentDots = [];
    fx.arc = (x, y, radius) => {
      const screenX = ox + tx + x * scale * zoom;
      const screenY = oy + ty + y * scale * zoom;
      if (screenX >= 0 && screenX <= w && screenY >= 0 && screenY <= h) {
        currentDots.push([screenX, screenY, radius * scale * zoom]);
      }
    };

    renderFrame(clock += 500);
    frames.push(currentDots);
    currentDots = [];
    renderFrame(clock += 500);
    frames.push(currentDots);

    const moved = frames[0].some((dot, index) => {
      const next = frames[1][index];
      return next && Math.hypot(dot[0] - next[0], dot[1] - next[1]) > 0.1;
    });
    if (!frames[0].length || !moved) {
      throw new Error('Écoulement absent ou immobile au zoom ' + level);
    }
    checks.push({ zoom: level, visibleParticles: frames[0].length, moved });
  }
  return checks;
})()`);

assert.deepEqual(JSON.parse(JSON.stringify(results)).map(item => item.zoom), [1, 3, 6, 12]);
console.log('Animation vérifiée à quatre niveaux de zoom :');
console.log(JSON.stringify(results, null, 2));
