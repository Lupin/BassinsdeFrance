'use strict';

const waterTransportLayers = {
  lakes: {color:'#147a9a', label:'Plan d’eau'},
  navigation: {color:'#50218a', label:'Voie navigable'},
  locks: {color:'#976024', label:'Écluse'}
};

function prepareWaterLayer(key, records) {
  return records.map(([n, value, geometry]) => {
    if (key === 'lakes') {
      const polys = geometry.map(polygon => polygon.map(ring => ring.map(p => project(...p))));
      return {n, hectares:value, polys, box:boundsOf(polys.flat())};
    }
    if (key === 'navigation') {
      const line = value.map(p => project(...p));
      return {n, line, box:boundsOf([line])};
    }
    const point = project(...value);
    return {n, id:geometry, point, box:[...point, ...point]};
  });
}

function waterTransportGlobal(key) {
  return 'WATER_' + key.toUpperCase();
}

function initWaterTransport() {
  for (const [key, layer] of Object.entries(waterTransportLayers)) {
    const checkbox = $(`#water-${key}`);
    const status = $(`#water-${key}-status`);
    function refresh() {
      invalidate();
      if (!checkbox.checked || layer.grid || layer.loading) return;
      layer.loading = true;
      status.textContent = 'Chargement…';
      loadDataset(key, key+'-data.js', waterTransportGlobal(key)).then(records => {
        const items = prepareWaterLayer(key, records);
        layer.grid = new Map();
        for (const item of items) cellsFor(item.box, cell => {
          if (!layer.grid.has(cell)) layer.grid.set(cell, []);
          layer.grid.get(cell).push(item);
        });
        status.textContent = number.format(items.length);
        invalidate();
      }).catch(() => {
        checkbox.checked = false;
        status.textContent = 'Chargement impossible. Réessaie.';
      }).finally(() => {
        layer.loading = false;
      });
    }
    checkbox.addEventListener('change', refresh);
    if (checkbox.checked) refresh();
  }
}

function visibleWaterItems(key, box) {
  const grid = waterTransportLayers[key].grid;
  if (!grid || !$(`#water-${key}`).checked) return [];
  const candidates = new Set();
  cellsFor(box, cell => {
    for (const item of grid.get(cell) || []) candidates.add(item);
  });
  const minArea = Math.max(5, 60 / zoom ** 2);
  return [...candidates].filter(item => overlaps(item.box, box)
    && (key !== 'lakes' || item.hectares >= minArea));
}

function drawWaterTransport(c, box, s, points = false) {
  if (!points) {
    for (const item of visibleWaterItems('lakes', box)) {
      drawArea(c, item, '#1489b34d', waterTransportLayers.lakes.color, s);
    }
    const routes = visibleWaterItems('navigation', box);
    if (!routes.length) return;
    const network = new Path2D();
    for (const item of routes) {
      item.path ||= linePath(item.line);
      network.addPath(item.path);
    }
    c.save();
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = '#fffffff0';
    c.lineWidth = 4.8 / s;
    c.stroke(network);
    c.strokeStyle = waterTransportLayers.navigation.color;
    c.lineWidth = 2.7 / s;
    if (zoom >= 2.5) c.setLineDash([7 / s, 4 / s]);
    c.stroke(network);
    c.restore();
    return;
  }
  // Keep locks legible at national scale by drawing one symbol per screen cell.
  const cells = new Set();
  for (const item of visibleWaterItems('locks', box)) {
    const [x,y] = item.point;
    const cell = Math.floor(x * s / 10) + ':' + Math.floor(y * s / 10);
    if (cells.has(cell)) continue;
    cells.add(cell);
    c.fillStyle = '#fff';
    c.fillRect(x - 3.6 / s, y - 3.6 / s, 7.2 / s, 7.2 / s);
    c.strokeStyle = waterTransportLayers.locks.color;
    c.lineWidth = 1.4 / s;
    c.strokeRect(x - 2.5 / s, y - 2.5 / s, 5 / s, 5 / s);
  }
}

function waterTransportHits(point, tolerance) {
  const [x,y] = point;
  const box = [x-tolerance,y-tolerance,x+tolerance,y+tolerance];
  const distance = tolerance ** 2;
  const locks = visibleWaterItems('locks', box)
    .filter(item => dist2(point,item.point) <= distance)
    .sort((a,b) => dist2(point,a.point) - dist2(point,b.point)).slice(0, 3);
  const routes = visibleWaterItems('navigation', box).filter(item =>
    item.line.some((vertex,index) => index && pointToSegment(point,item.line[index-1],vertex) <= distance));
  const lakes = visibleWaterItems('lakes', box).filter(item => inside(item,point));
  return [
    ...locks.map(item => ({type:'locks', item})),
    ...routes.slice(0, 1).map(item => ({type:'navigation', item})),
    ...lakes.slice(0, 1).map(item => ({type:'lakes', item}))
  ];
}
