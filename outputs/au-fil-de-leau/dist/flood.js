'use strict';

const metresPerAtlasUnit = 6378137 * Math.PI / (180 * 72);
const floodEndpoint = 'https://mapsref.brgm.fr/wxs/georisques/risques';
let floodTimer, floodFrame, floodKey;
let floodRequest;

function initFloodLayer() {
  for (const selector of ['#floodLayer', '#floodType']) {
    $(selector).addEventListener('change', () => {
      clearTimeout(floodTimer);
      if (floodRequest) {
        floodRequest.onload = floodRequest.onerror = null;
        floodRequest.removeAttribute('src');
        floodRequest = null;
      }
      floodKey = null;
      $('#floodOptions').hidden = !$('#floodLayer').checked;
      $('#floodStatus').textContent = '';
      invalidate();
    });
  }
}

function drawFlood(c) {
  if (!$('#floodLayer').checked) return;
  const status = $('#floodStatus');
  const box = viewBox();
  const [x1,y1,x2,y2] = box;
  const width = Math.max(1, Math.min(1400, Math.round(w*dpr)));
  const height = Math.max(1, Math.min(1400, Math.round(h*dpr)));
  const metresPerPixel = Math.max((x2-x1)/width,(y2-y1)/height)*metresPerAtlasUnit;
  // The service only renders the detailed EAIP below 1:500 000 (OGC pixel: 0.28 mm).
  if (metresPerPixel >= 138) {
    status.textContent = 'Zoomez pour afficher les enveloppes.';
    floodKey = null;
    clearTimeout(floodTimer);
    return;
  }
  const layer = $('#floodType').value;
  if (floodFrame?.layer === layer) {
    const [left,top,right,bottom] = floodFrame.box;
    c.save();
    c.globalAlpha = .55;
    c.drawImage(floodFrame.image,left,top,right-left,bottom-top);
    c.restore();
  }
  const mercator = (point) => {
    const [lon,lat] = unproject(point);
    return [lon,mercatorDegrees(lat)].map(value => Math.round(value * metresPerAtlasUnit * 72));
  };
  const [west,south] = mercator([x1,y2]);
  const [east,north] = mercator([x2,y1]);
  const params = new URLSearchParams({
    SERVICE:'WMS', VERSION:'1.3.0', REQUEST:'GetMap', LAYERS:layer, STYLES:'',
    CRS:'EPSG:3857', BBOX:[west,south,east,north].join(','), WIDTH:width, HEIGHT:height,
    FORMAT:'image/png', TRANSPARENT:'TRUE'
  });
  const key = params.toString();
  if (key === floodKey) return;
  floodKey = key;
  clearTimeout(floodTimer);
  status.textContent = 'Chargement de Géorisques…';
  floodTimer = setTimeout(() => {
    if (floodRequest) {
      floodRequest.onload = floodRequest.onerror = null;
      floodRequest.removeAttribute('src');
    }
    const image = new Image();
    floodRequest = image;
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (key !== floodKey) return;
      floodFrame = {image, box, layer};
      status.textContent = 'Enveloppe indicative';
      invalidate();
    };
    image.onerror = () => {
      if (key === floodKey) status.textContent = 'Géorisques indisponible pour cette vue.';
    };
    image.src = floodEndpoint + '?' + key;
  }, 240);
}
