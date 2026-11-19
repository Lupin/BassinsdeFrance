'use strict';

const waterTransportLayers = {
  lakes: {color:'#147a9a', label:'Plan d’eau'},
  captages: {color:'#075b8f', label:'Captage d’eau potable'},
  farms: {color:'#76519b', label:'Élevage recensé · ICPE'},
  navigation: {color:'#50218a', label:'Voie navigable'},
  locks: {color:'#976024', label:'Écluse'},
  wastewater: {color:'#04746f', label:'Station d’épuration'},
  industry: {color:'#4d5661', label:'Installation répertoriée'}
};

function prepareWaterLayer(key, records) {
  return records.map(([n, value, geometry, detail, commune, regime]) => {
    if (key === 'lakes') {
      const polys = geometry.map(polygon => polygon.map(ring => ring.map(p => project(...p))));
      return {n, hectares:value, polys, box:boundsOf(polys.flat())};
    }
    if (key === 'captages') {
      const point = project(...value);
      return {n, id:geometry, commune:detail, point, box:[...point,...point]};
    }
    if (key === 'farms') {
      const point = project(...value);
      return {n, id:geometry, types:detail, commune, point, box:[...point,...point]};
    }
    if (key === 'navigation') {
      const line = value.map(p => project(...p));
      return {n, line, box:boundsOf([line])};
    }
    const point = project(...value);
    const item = {n, id:geometry, point, box:[...point, ...point]};
    if (key === 'industry') return {...item, seuil:detail, commune, regime};
    return {...item, capacity:detail};
  });
}

function waterTransportGlobal(key) {
  return 'WATER_' + key.toUpperCase();
}

function initWaterTransport() {
  $('#wastewaterCapacity').addEventListener('change', invalidate);
  $('#industryFilter').addEventListener('change', invalidate);
  $('#farmFilter').addEventListener('change', invalidate);
  const optionPanels = {wastewater:'#wastewaterOptions', industry:'#industryOptions', farms:'#farmOptions'};
  for (const [key, layer] of Object.entries(waterTransportLayers)) {
    const checkbox = $(`#water-${key}`);
    const status = $(`#water-${key}-status`);
    const options = optionPanels[key] && $(optionPanels[key]);
    function refresh() {
      if (options) options.hidden = !checkbox.checked;
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
        if (options) options.hidden = true;
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
  const minCapacity = key === 'wastewater' ? Number($('#wastewaterCapacity').value) : 0;
  const industrialFilter = key === 'industry' ? $('#industryFilter').value : 'all';
  const farmFilter = key === 'farms' ? $('#farmFilter').value : 'all';
  return [...candidates].filter(item => overlaps(item.box, box)
    && inIndustrialFilter(item, industrialFilter)
    && (key !== 'farms' || farmFilter === 'all' || item.types.includes(farmFilter))
    && (key !== 'lakes' || item.hectares >= minArea)
    && (!minCapacity || item.capacity >= minCapacity));
}

function inIndustrialFilter(item, filter) {
  if (filter === 'all') return true;
  if (filter === 'seveso') return item.seuil > 0;
  if (filter === 'high') return item.seuil === 2;
  if (filter === 'low') return item.seuil === 1;
  return item.seuil === 0;
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
  drawWastewater(c, box, s);
  drawCaptages(c, box, s);
  drawFarms(c, box, s);
  drawIndustry(c, box, s);
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

function selectPointMarkers(layer, box, s, priority) {
  const cells = new Map();
  for (const item of visibleWaterItems(layer, box)) {
    const [x,y] = item.point;
    const key = Math.floor(x * s / 13) + ':' + Math.floor(y * s / 13);
    const previous = cells.get(key);
    if (!previous || priority(item) > priority(previous)) cells.set(key,item);
  }
  return [...cells.values()];
}

let plottedWastewater = [];
function drawWastewater(c, box, s) {
  plottedWastewater = selectPointMarkers('wastewater', box, s, item => item.capacity || 0);
  if (!plottedWastewater.length) return;
  c.beginPath();
  for (const {point:[x,y]} of plottedWastewater) {
    c.moveTo(x+3/s,y);
    c.arc(x,y,3/s,0,Math.PI*2);
  }
  c.fillStyle=waterTransportLayers.wastewater.color;
  c.fill();
  c.strokeStyle='#fff';
  c.lineWidth=.8/s;
  c.stroke();
}

let plottedCaptages = [];
function drawCaptages(c, box, s) {
  plottedCaptages = selectPointMarkers('captages', box, s, () => 0);
  if (!plottedCaptages.length) return;
  c.beginPath();
  for (const {point:[x,y]} of plottedCaptages) { c.moveTo(x+3.5/s,y); c.arc(x,y,3.5/s,0,Math.PI*2); }
  c.fillStyle=waterTransportLayers.captages.color; c.fill();
  c.strokeStyle='#fff'; c.lineWidth=.9/s; c.stroke();
}

let plottedFarms = [];
function drawFarms(c, box, s) {
  plottedFarms = selectPointMarkers('farms', box, s, item => item.types.length);
  const colors = {Bovins:'#76519b',Porcs:'#c56d38',Volailles:'#d39a21',Pisciculture:'#13817c'};
  const active = $('#farmFilter').value;
  for (const [type,color] of Object.entries(colors)) {
    c.beginPath();
    for (const item of plottedFarms) {
      if (active === 'all' ? item.types[0] !== type : active !== type || !item.types.includes(type)) continue;
      const [x,y]=item.point, r=3.6/s;
      c.moveTo(x+r,y); c.arc(x,y,r,0,Math.PI*2);
    }
    c.fillStyle=color; c.fill(); c.strokeStyle='#fff'; c.lineWidth=.9/s; c.stroke();
  }
}

let plottedIndustry = [];
function drawIndustry(c, box, s) {
  plottedIndustry = selectPointMarkers('industry', box, s, item => item.seuil);
  const colors = [waterTransportLayers.industry.color, '#be6215', '#9d2439'];
  for (const [tier,color] of colors.entries()) {
    c.beginPath();
    for (const {point:[x,y], seuil} of plottedIndustry) {
      if (seuil !== tier) continue;
      const r = (tier ? 4.6 : 2.6) / s;
      c.moveTo(x+r,y);
      if (tier) {
        c.lineTo(x,y+r); c.lineTo(x-r,y); c.lineTo(x,y-r); c.closePath();
      } else {
        c.arc(x,y,r,0,Math.PI*2);
      }
    }
    c.fillStyle = color;
    c.fill();
    c.lineWidth = .85 / s;
    c.strokeStyle = '#fff';
    c.stroke();
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
  const station = $('#water-wastewater').checked && plottedWastewater
    .filter(item => dist2(point,item.point) <= distance)
    .sort((a,b) => dist2(a.point,point) - dist2(b.point,point))[0];
  const captage = $('#water-captages').checked && plottedCaptages
    .filter(item => dist2(point,item.point) <= distance)
    .sort((a,b) => dist2(a.point,point) - dist2(b.point,point))[0];
  const farm = $('#water-farms').checked && plottedFarms
    .filter(item => dist2(point,item.point) <= distance)
    .sort((a,b) => dist2(a.point,point) - dist2(b.point,point))[0];
  const installation = $('#water-industry').checked && plottedIndustry
    .filter(item => dist2(point,item.point) <= distance)
    .sort((a,b) => dist2(a.point,point) - dist2(b.point,point))[0];
  return [
    ...(installation ? [{type:'industry', item:installation}] : []),
    ...(station ? [{type:'wastewater', item:station}] : []),
    ...(captage ? [{type:'captage', item:captage}] : []),
    ...(farm ? [{type:'farm', item:farm}] : []),
    ...locks.map(item => ({type:'locks', item})),
    ...routes.slice(0, 1).map(item => ({type:'navigation', item})),
    ...lakes.slice(0, 1).map(item => ({type:'lakes', item}))
  ];
}
