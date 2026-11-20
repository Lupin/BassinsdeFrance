'use strict';

const metresPerAtlasUnit = 6378137 * Math.PI / (180 * 72);
const floodEndpoint = 'https://mapsref.brgm.fr/wxs/georisques/risques';
const floodPreviews = new Map();
const floodTargetResolution = 125;
const floodMaxSide = 2800;
const floodPixelBudget = 5_000_000;
let floodTimer, floodFrame, floodKey, floodRequest, displayedFlood;

function cancelFloodDetail() {
  clearTimeout(floodTimer);
  if (floodRequest && !floodRequest.complete) {
    floodRequest.onload = floodRequest.onerror = null;
    floodRequest.removeAttribute('src');
  }
  floodRequest = null;
  floodKey = null;
}

function initFloodLayer() {
  $('#floodFocus').addEventListener('click', () => {
    const [x1,y1,x2,y2] = viewBox();
    const {ratio} = floodRequestSize(x2-x1,y2-y1);
    zoomAt(Math.max(1.1, ratio * 1.08));
  });
  for (const selector of ['#floodLayer', '#floodType']) {
    $(selector).addEventListener('change', () => {
      cancelFloodDetail();
      $('#floodOptions').hidden = !$('#floodLayer').checked;
      invalidate();
    });
  }
}

function floodPreview(layer) {
  if (floodPreviews.has(layer)) return floodPreviews.get(layer);
  const preview = {};
  floodPreviews.set(layer, preview);
  loadDataset('flood-overview','flood-overview-data.js','FLOOD_OVERVIEW')
    .then(({box:[west,south,east,north], layers}) => {
      const offsetX = 5.4 * 72;
      const offsetY = project(0,0)[1];
      preview.box = [west/metresPerAtlasUnit+offsetX, offsetY-north/metresPerAtlasUnit,
                      east/metresPerAtlasUnit+offsetX, offsetY-south/metresPerAtlasUnit];
      const image = new Image();
      image.onload = () => { preview.image = image; invalidate(); };
      image.onerror = () => { preview.failed = true; invalidate(); };
      image.src = layers[layer];
    }).catch(() => { preview.failed = true; invalidate(); });
  return preview;
}

function paintFlood(c, raster) {
  if (!raster?.image) return;
  const [left,top,right,bottom] = raster.box;
  c.save();
  c.globalAlpha = .68;
  c.drawImage(raster.image,left,top,right-left,bottom-top);
  c.restore();
}

function floodHasCoverage(image) {
  const sample = document.createElement('canvas');
  sample.width = sample.height = 128;
  const context = sample.getContext('2d');
  context.drawImage(image,0,0,sample.width,sample.height);
  const pixels = context.getImageData(0,0,sample.width,sample.height).data;
  for (let i=3;i<pixels.length;i+=4) if (pixels[i]) return true;
  return false;
}

// The WMS scale depends on the requested image size, not the screen size.
function floodRequestSize(spanX, spanY) {
  const width = Math.max(Math.ceil(spanX * metresPerAtlasUnit / floodTargetResolution), Math.min(1400,Math.round(w*dpr)));
  const height = Math.max(Math.ceil(spanY * metresPerAtlasUnit / floodTargetResolution), Math.min(1400,Math.round(h*dpr)));
  const ratio = Math.max(width / floodMaxSide, height / floodMaxSide,
                         Math.sqrt(width * height / floodPixelBudget));
  return {width:Math.max(1,width), height:Math.max(1,height), ratio};
}

function drawFlood(c) {
  displayedFlood = null;
  if (!$('#floodLayer').checked) return;
  const status = $('#floodStatus');
  const layer = $('#floodType').value;
  const preview = floodPreview(layer);
  const box = viewBox();
  const [x1,y1,x2,y2] = box;
  const {width,height,ratio} = floodRequestSize(x2-x1,y2-y1);
  $('#floodFocus').hidden = ratio <= 1;
  if (ratio > 1) {
    if (floodKey) cancelFloodDetail();
    paintFlood(c, displayedFlood = preview);
    status.textContent = preview.image ? 'Vue d’ensemble · détail disponible à l’échelle d’une vallée.'
      : preview.failed ? 'Aperçu indisponible.' : 'Chargement des enveloppes…';
    return;
  }
  const offsetX = 5.4 * 72;
  const offsetY = project(0,0)[1];
  const bbox = [x1-offsetX,offsetY-y2,x2-offsetX,offsetY-y1].map(value => Math.round(value*metresPerAtlasUnit));
  const params = new URLSearchParams({
    SERVICE:'WMS', VERSION:'1.3.0', REQUEST:'GetMap', LAYERS:layer, STYLES:'',
    CRS:'EPSG:3857', BBOX:bbox.join(','), WIDTH:width, HEIGHT:height,
    FORMAT:'image/png', TRANSPARENT:'TRUE'
  });
  const key = params.toString();
  if (floodFrame?.key === key) {
    paintFlood(c, displayedFlood = floodFrame.image ? floodFrame : preview);
    status.textContent = floodFrame.message;
    return;
  }
  paintFlood(c, displayedFlood = preview);
  if (key === floodKey) return;
  cancelFloodDetail();
  floodKey = key;
  status.textContent = 'Chargement du détail Géorisques…';
  floodTimer = setTimeout(() => {
    const image = new Image();
    floodRequest = image;
    image.crossOrigin = 'anonymous';
    function finish(raster, message) {
      if (key !== floodKey) return;
      floodFrame = {key, box, image:raster, message};
      invalidate();
    }
    image.onload = () => {
      if (floodHasCoverage(image)) finish(image,'Enveloppe indicative · Géorisques');
      else finish(null,'Aucune enveloppe détaillée renvoyée pour cette vue.');
    };
    image.onerror = () => finish(null,'Détail Géorisques indisponible · aperçu national.');
    image.src = floodEndpoint + '?' + key;
  },240);
}
