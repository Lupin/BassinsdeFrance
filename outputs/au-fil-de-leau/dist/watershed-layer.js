'use strict';

const watershedLevels = new Map();
const watershedLoads = new Map();

function loadWatershedLevel(level) {
  if (watershedLevels.has(level)) return Promise.resolve(watershedLevels.get(level));
  if (watershedLoads.has(level)) return watershedLoads.get(level);
  const id = 'watersheds-' + level;
  const task = loadDataset(id, id+'-data.js', 'WATERSHEDS_'+level.toUpperCase()).then(records => {
    const grid = new Map();
    for (const [id,name,outlet,geometry] of records) {
      const polys = geometry.map(poly => poly.map(ring => ring.map(([lon,lat]) => project(lon,lat))));
      const item = {
        id, polys, box:boundsOf(polys.flat()),
        n:name ? displayName(name === name.toLocaleUpperCase('fr') ? name.toLocaleLowerCase('fr') : name) : 'Sous-bassin topographique',
        outlet:riverById.get(outlet)?.n || outlet
      };
      cellsFor(item.box, cell => {
        if (!grid.has(cell)) grid.set(cell,[]);
        grid.get(cell).push(item);
      });
    }
    const data = {grid, count:records.length};
    watershedLevels.set(level,data);
    return data;
  }).finally(() => watershedLoads.delete(level));
  watershedLoads.set(level,task);
  return task;
}

function watershedItems(data,box) {
  const items = new Set();
  cellsFor(box, cell => {
    for (const item of data.grid.get(cell) || []) if (overlaps(item.box,box)) items.add(item);
  });
  return items;
}

function drawWatershedLimits(c,box,s) {
  if (!$('#watersheds').checked) return;
  const detail = watershedLevels.get('detail');
  const data = (zoom >= 3 && detail) || watershedLevels.get('overview');
  if (!data) return;
  if (zoom >= 3 && !detail && !watershedLoads.has('detail') && !watershedDetailFailed) {
    loadWatershedLevel('detail').then(invalidate).catch(() => { watershedDetailFailed = true; });
  }
  const path = new Path2D();
  for (const item of watershedItems(data,box)) {
    item.path ||= polyPath(item.polys);
    path.addPath(item.path);
  }
  c.strokeStyle = zoom >= 3 ? '#385b858f' : '#385b8569';
  c.lineWidth = (zoom >= 3 ? .85 : .68) / s;
  c.stroke(path);
}

let watershedDetailFailed = false;
let watershedRun = 0;

function initWatershedLayer() {
  const checkbox = $('#watersheds');
  checkbox.addEventListener('change',() => {
    const enabled = checkbox.checked;
    const status = $('#watershedStatus');
    $('#watershedHelp').hidden = !enabled;
    watershedRun++;
    localWatershed = null;
    if ($('#featureDetail').dataset.kind === 'watershed') $('#featureDetail').hidden = true;
    invalidate();
    if (!enabled) {
      status.textContent = '';
      return;
    }
    watershedDetailFailed = false;
    status.textContent = 'Chargement…';
    loadWatershedLevel('overview').then(data => {
      if (!checkbox.checked) return;
      status.textContent = number.format(data.count);
      invalidate();
    }).catch(() => {
      if (checkbox.checked) status.textContent = 'Chargement impossible. Réessayez.';
    });
  });
}

async function showWatershed(point) {
  if (!$('#watersheds').checked) return;
  const run = ++watershedRun;
  const holder = $('#featureDetail');
  holder.dataset.kind = 'watershed';
  holder.replaceChildren(node('p','Recherche du sous-bassin autour de ce point…','note'));
  holder.hidden = false;
  try {
    const data = await loadWatershedLevel('detail').catch(() => loadWatershedLevel('overview'));
    if (run !== watershedRun) return;
    const [x,y] = point;
    const candidates = [...watershedItems(data,[x,y,x,y])].filter(item => inside(item,point));
    const area = ({box:[a,b,c,d]}) => (c-a) * (d-b);
    localWatershed = candidates.sort((a,b) => area(a)-area(b))[0] || null;
    locatedPoint = localWatershed ? point : null;
    if (localWatershed) showFeature({type:'watershed',item:localWatershed});
    else holder.replaceChildren(node('p','Aucun sous-bassin du référentiel à cet endroit.','note'));
    invalidate();
  } catch {
    if (run !== watershedRun) return;
    holder.replaceChildren(node('p','Les données des sous-bassins sont indisponibles.','note'),
      makeButton('Réessayer','text-button',()=>showWatershed(point)));
  }
}
