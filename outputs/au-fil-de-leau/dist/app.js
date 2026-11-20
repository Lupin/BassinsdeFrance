'use strict';
const D=window.HYDRO,$=s=>document.querySelector(s),canvas=$('#map'),ctx=canvas.getContext('2d'),flowCanvas=document.createElement('canvas'),fx=flowCanvas.getContext('2d',{alpha:true}),base=document.createElement('canvas'),bc=base.getContext('2d'),labelsLayer=document.createElement('canvas'),lc=labelsLayer.getContext('2d');flowCanvas.id='flowCanvas';flowCanvas.setAttribute('aria-hidden','true');$('#mapbox').append(flowCanvas);
const colors={'01':'#bb2952','02':'#7350a1','03':'#225ab2','04':'#b38200','05':'#00836c','06':'#d34c27','12':'#b03788'};
const oceans={'01':'Manche / mer du Nord','02':'Mer du Nord','03':'La Manche','04':'Océan Atlantique','05':'Océan Atlantique','06':'Mer Méditerranée','12':'Mer Méditerranée'};
const normalize=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,' ').replace(/^(le |la |les |l )/,'').trim();
function mercatorDegrees(lat) {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  return Math.asinh(Math.tan(clamped * Math.PI / 180)) * 180 / Math.PI;
}
const centerMercator = mercatorDegrees(46.45);
function fromAtlas(point) {
  point[1] = project(0, 51.2 - point[1] / 104)[1];
  return point;
}
function convertPolys(polys) {
  for (const polygon of polys) for (const ring of polygon) for (const point of ring) fromAtlas(point);
}
for (const river of D.rivers) for (const line of river.p) for (const point of line) fromAtlas(point);
for (const item of D.basins) convertPolys(item.polys);
convertPolys(D.land);
for (const item of window.ADMIN.departments) {
  fromAtlas(item.point);
  convertPolys(item.polys);
}
const names=new Map();D.rivers.forEach((r,i)=>{r.i=i;r.key=normalize(r.n);if(!names.has(r.key))names.set(r.key,r);r.box=[Infinity,Infinity,-Infinity,-Infinity];for(const line of r.p)for(const p of line){r.box[0]=Math.min(r.box[0],p[0]);r.box[1]=Math.min(r.box[1],p[1]);r.box[2]=Math.max(r.box[2],p[0]);r.box[3]=Math.max(r.box[3],p[1])}});
const overrides={maine:'04C0000002000855547'};for(const [key,id] of Object.entries(overrides)){let r=D.rivers.find(r=>r.id===id);if(r)names.set(key,r)}
for(const [key,ids,label] of [['somme',['01C0000002000824194','01C0000002000818638'],'la Somme'],['escaut',['01C0000002000815351','01C0000002000822354'],"l’Escaut"]]){let parts=ids.map(id=>D.rivers.find(r=>r.id===id)).filter(Boolean);if(parts.length){let r=parts[0];r.p=parts.flatMap(x=>x.p);r.n=label;r.key=key;names.set(key,r)}}
const mapPathGeometry = new WeakMap();
function polyPath(polys) {
  const path = new Path2D();
  for (const poly of polys) for (const ring of poly) {
    ring.forEach((point, index) => index ? path.lineTo(...point) : path.moveTo(...point));
    path.closePath();
  }
  mapPathGeometry.set(path, {polys});
  return path;
}
function combineMapPaths(context, paths) {
  if (context.combinePaths) return context.combinePaths(paths);
  const combined = new Path2D();
  for (const path of paths) combined.addPath(path);
  return combined;
}
D.basins.forEach(b=>b.path=polyPath(b.polys));const landPath=polyPath(D.land);const departments=window.ADMIN.departments;
const specs={
'loire':['Mont Gerbier-de-Jonc',null,'Océan Atlantique',[-2.2,47.26]],
'allier':['Massif central','loire'], 'cher':['Massif central','loire'], 'vienne':['Plateau de Millevaches','loire'], 'indre':['Massif central','loire'], 'maine':['Confluence Sarthe–Mayenne','loire'], 'sarthe':['Perche','maine'], 'mayenne':['Mont des Avaloirs','maine'], 'loir':['Perche','sarthe'], 'creuse':['Plateau de Millevaches','vienne'],
'seine':['Plateau de Langres',null,'La Manche',[.1,49.43]], 'marne':['Plateau de Langres','seine'], 'yonne':['Morvan','seine'], 'oise':['Ardennes belges','seine'], 'aisne':['Argonne','oise'], 'aube':['Plateau de Langres','seine'], 'eure':['Perche','seine'],
'garonne':['Pyrénées espagnoles',null,'Atlantique, via la Gironde',[-.72,45.05]], 'dordogne':['Puy de Sancy',null,'Atlantique, via la Gironde',[-.6,45.04]], 'lot':['Mont Lozère','garonne'], 'tarn':['Mont Lozère','garonne'], 'aveyron':['Massif central','tarn'], 'ariege':['Pyrénées','garonne'], 'vezere':['Plateau de Millevaches','dordogne'], 'correze':['Plateau de Millevaches','vezere'], 'adour':['Pyrénées',null,'Océan Atlantique',[-1.52,43.53]], 'charente':['Chéronnac',null,'Océan Atlantique',[-1.1,45.96]],
'rhone':['Glacier du Rhône, Suisse',null,'Mer Méditerranée',[4.84,43.33]], 'saone':['Vioménil, Vosges','rhone'], 'doubs':['Mouthe, Jura','saone'], 'isere':['Alpes','rhone'], 'durance':['Hautes-Alpes','rhone'], 'ardeche':['Massif central','rhone'], 'drome':['Préalpes','rhone'], 'ain':['Jura','rhone'], 'aude':['Lac d’Aude',null,'Mer Méditerranée',[3.24,43.22]], 'herault':['Mont Aigoual',null,'Mer Méditerranée',[3.45,43.28]], 'var':['Entraunes',null,'Mer Méditerranée',[7.2,43.65]],
'rhin':['Alpes suisses',null,'Mer du Nord, via Allemagne et Pays-Bas',[8.2,49.05]], 'meuse':['Pouilly-en-Bassigny',null,'Mer du Nord, via Belgique et Pays-Bas',[4.8,50.1]], 'moselle':['Vosges',null,'Rhin → mer du Nord, via Allemagne',[6.4,49.5]],
'somme':['Fonsomme',null,'La Manche',[1.62,50.19]], 'escaut':['Gouy',null,'Mer du Nord, via Belgique et Pays-Bas',[3.5,50.5]], 'vilaine':['Juvigné',null,'Océan Atlantique',[-2.45,47.5]], 'blavet':['Bourbriac',null,'Océan Atlantique',[-3.35,47.7]], 'orne':['Aunou-sur-Orne',null,'La Manche',[-.23,49.28]], 'golo':['Monte Cinto',null,'Mer Méditerranée',[9.53,42.52]], 'tavignano':['Lac de Nino',null,'Mer Méditerranée',[9.55,42.1]]};
function project(lon, lat) {
  return [(lon + 5.4) * 72, 494 - (mercatorDegrees(lat) - centerMercator) * 72];
}
function unproject([x, y]) {
  const mercator = ((494 - y) / 72 + centerMercator) * Math.PI / 180;
  return [x / 72 - 5.4, Math.atan(Math.sinh(mercator)) * 180 / Math.PI];
}
function dist2(a,b){return (a[0]-b[0])**2+(a[1]-b[1])**2}
function nearest(p,line){let best=Infinity,index=0;line.forEach((v,i)=>{let d=dist2(p,v);if(d<best){best=d;index=i}});return {d:best,i:index}}
// Course geometries may be multipart. Assemble connected pieces, retain any disjoint pieces for base rendering.
// Build an undirected graph for each official multipart course. Traverse from its actual outlet.
function assembled(r,targetLine=null,sea=null){
 const nodes=[],edges=[],lookup=new Map(),snap=.12;
 function nid(p){let gx=Math.round(p[0]/snap),gy=Math.round(p[1]/snap);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){let a=lookup.get((gx+dx)+','+(gy+dy));if(a!=null&&dist2(nodes[a].p,p)<snap*snap)return a}let id=nodes.length;nodes.push({p,links:[]});lookup.set(gx+','+gy,id);return id}
 for(const line of r.p){if(line.length<2)continue;let a=nid(line[0]),b=nid(line.at(-1)),len=0;for(let i=1;i<line.length;i++)len+=Math.sqrt(dist2(line[i-1],line[i]));let e=edges.length;edges.push({a,b,line,len});nodes[a].links.push(e);nodes[b].links.push(e)}
 if(!nodes.length)return [];
 let end=0,best=Infinity,where=sea?project(...sea):null;
 nodes.forEach((n,i)=>{let d=targetLine?nearest(n.p,targetLine).d:where?dist2(n.p,where):0;if(d<best){best=d;end=i}});
 const distances=new Float64Array(nodes.length).fill(Infinity),prev=new Int32Array(nodes.length).fill(-1),done=new Uint8Array(nodes.length);distances[end]=0;
 for(let step=0;step<nodes.length;step++){let v=-1,min=Infinity;for(let i=0;i<nodes.length;i++)if(!done[i]&&distances[i]<min){min=distances[i];v=i}if(v<0)break;done[v]=1;for(const ei of nodes[v].links){let e=edges[ei],to=e.a===v?e.b:e.a,d=min+e.len;if(d<distances[to]){distances[to]=d;prev[to]=ei}}}
 let start=end,max=0;distances.forEach((d,i)=>{if(d<Infinity&&d>max){max=d;start=i}});const out=[];let current=start;
 while(current!==end&&prev[current]>=0){let e=edges[prev[current]],line=e.a===current?e.line:e.line.slice().reverse();out.push(...(out.length?line.slice(1):line));current=e.a===current?e.b:e.a}
 return out.length?out:r.p.reduce((a,b)=>a.length>b.length?a:b,[])
}
let building=new Set();function routeFor(key){let r=names.get(key),s=specs[key];if(!r||!s?.length||building.has(key))return null;if(r.route)return r.route;building.add(key);let parent=s[1]?routeFor(s[1]):null;if(s[1]&&!parent){building.delete(key);return null}let line=assembled(r,parent?.line,s[3]),join=null;if(line.length<2){building.delete(key);return null}if(parent){let a=nearest(line[0],parent.line),b=nearest(line.at(-1),parent.line);if(a.d<b.d){line.reverse();join=a.i}else join=b.i;if(Math.min(a.d,b.d)>12**2){building.delete(key);return null}}else if(s[3]){let sea=project(...s[3]);if(dist2(line[0],sea)<dist2(line.at(-1),sea))line.reverse()}
const full=parent?line.concat(parent.line.slice(join+1),parent.after):line,after=parent?parent.line.slice(join+1).concat(parent.after):[];r.route={line,after,full,spec:s,parent};building.delete(key);return r.route}
Object.keys(specs).forEach(routeFor);

const basinById = new Map(D.basins.map(item => [item.id, item]));
const departmentById = new Map(departments.map(item => [item.code, item]));
const riverById = new Map(D.rivers.map(item => [item.id, item]));
const number = new Intl.NumberFormat('fr-FR', {maximumFractionDigits: 1});
const discharge = new Intl.NumberFormat('fr-FR', {maximumFractionDigits: 4});
const wantsMotion = matchMedia('(prefers-reduced-motion: reduce)');
let selected = names.get('loire') || D.rivers[0];
let basin = null, playing = !wantsMotion.matches && !window.mapLightweight, speed = 1, phase = 0;
let zoom = 1, tx = 0, ty = 0, w = 0, h = 0, dpr = 1, scale = 1, ox = 0, oy = 0;
let dirty = true, flowDirty = true, frameRequest = 0, lastFrame = 0, mapIsVisible = true;
let drag = null, hoverTime = 0, animatedBranches = [], visible = [];
const pointers = new Map();
let EX = null, geography = null, topology = null;
let highlightedCrossing = null, highlightedArea = null, localWatershed = null, locatedPoint = null, locatedPointLabel = '';
let flowPoints = [], clusters = [], plotted = [];
const areaLayers = {protected:'protectedLayer', aquifer:'aquiferLayer'};
const tileCache = new Map();
const overviewNames = new Set(['loire','seine','rhone','garonne','rhin','meuse','allier','dordogne','saone','somme','adour','vilaine','golo']);
const cityLabels = [
  ['Paris',2.35,48.86], ['Lyon',4.84,45.76], ['Bordeaux',-.58,44.84], ['Nantes',-1.55,47.22],
  ['Toulouse',1.44,43.6], ['Strasbourg',7.75,48.58], ['Lille',3.06,50.63], ['Marseille',5.37,43.3],
  ['Rennes',-1.68,48.11], ['Dijon',5.04,47.32], ['Clermont-Ferrand',3.09,45.78], ['Ajaccio',8.74,41.92]
];

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function boundsOf(lines) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const line of lines) for (const [x, y] of line) {
    box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y);
    box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y);
  }
  return box;
}
const overlaps = (a,b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
const contains = (b,p) => p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
const landBox = boundsOf(D.land.flat());
for (const item of D.basins) item.box = boundsOf(item.polys.flat());
const riverGrid = new Map();
const gridSize = 54;
function cellsFor(box, callback) {
  for (let y = Math.floor(box[1]/gridSize); y <= Math.floor(box[3]/gridSize); y++) {
    for (let x = Math.floor(box[0]/gridSize); x <= Math.floor(box[2]/gridSize); x++) callback(x+','+y);
  }
}
for (const river of D.rivers) {
  river.box = boundsOf(river.p);
  cellsFor(river.box, key => {
    if (!riverGrid.has(key)) riverGrid.set(key, []);
    riverGrid.get(key).push(river);
  });
}
for (const item of departments) item.box = boundsOf(item.polys.flat());
const riverCounts = new Map();
for (const item of D.rivers) riverCounts.set(item.b, (riverCounts.get(item.b) || 0) + 1);

function invalidate() {
  dirty = true;
  if (!frameRequest && !document.hidden) frameRequest = requestAnimationFrame(renderFrame);
}

function resize() {
  const rect = $('#mapbox').getBoundingClientRect();
  if (!rect.width || !rect.height || (w === rect.width && h === rect.height)) return;
  const center = w && h && (zoom !== 1 || tx || ty) ? world(w/2,h/2) : null;
  w = rect.width; h = rect.height;
  dpr = Math.min(devicePixelRatio || 1, 1.5);
  // Extra limits apply only when the visitor explicitly selects light mode.
  if (window.mapLightweight) {
    dpr = Math.min(dpr,1,4096 / Math.max(w,h),Math.sqrt(3_000_000 / (w*h)));
  }
  canvas.width = flowCanvas.width = base.width = labelsLayer.width = Math.round(w*dpr);
  canvas.height = flowCanvas.height = base.height = labelsLayer.height = Math.round(h*dpr);
  const padding = w < 570 ? 22 : 52;
  scale = Math.min((w-padding)/(landBox[2]-landBox[0]), (h-padding)/(landBox[3]-landBox[1]));
  ox = (w-(landBox[0]+landBox[2])*scale)/2;
  oy = (h-(landBox[1]+landBox[3])*scale)/2;
  if (center) centerOn(center, zoom);
  else { tx = 0; ty = 0; }
  invalidate();
}
function transform(c, ratio=dpr) {
  c.setTransform(ratio*scale*zoom,0,0,ratio*scale*zoom,ratio*(ox+tx),ratio*(oy+ty));
}
function world(x,y) { return [(x-ox-tx)/(scale*zoom),(y-oy-ty)/(scale*zoom)]; }
function screenPoint([x,y]) { return [ox+tx+x*scale*zoom,oy+ty+y*scale*zoom]; }
function viewBox(margin = 0) { return [...world(-margin,-margin), ...world(w+margin,h+margin)]; }
function maxZoom() { return 24; }
function centerOn(point, magnification) {
  zoom = Math.min(maxZoom(), Math.max(1, magnification));
  tx = w/2-ox-point[0]*scale*zoom;
  ty = h/2-oy-point[1]*scale*zoom;
  invalidate();
}
function revealMap() {
  if (matchMedia('(max-width: 760px)').matches) $('#mapbox').scrollIntoView({block:'nearest'});
}
function frameBounds(box) {
  const padding = 82;
  const magnification = Math.min((w-padding)/(Math.max(1,box[2]-box[0])*scale),
    (h-padding)/(Math.max(1,box[3]-box[1])*scale));
  centerOn([(box[0]+box[2])/2,(box[1]+box[3])/2],magnification);
  revealMap();
}
function zoomAt(factor,x=w/2,y=h/2) {
  const old = zoom;
  zoom = Math.max(1,Math.min(maxZoom(),old*factor));
  tx = x-ox-(x-ox-tx)*zoom/old;
  ty = y-oy-(y-oy-ty)*zoom/old;
  invalidate();
}
function panMap(dx,dy) { tx += dx; ty += dy; }
function resetMap() { zoom = 1; tx = ty = 0; invalidate(); }
function setText(element, value) { if (element.textContent !== value) element.textContent = value; }

function drawTiles(c, style, box, exporting=false) {
  const a = unproject(box.slice(0,2)), b = unproject(box.slice(2));
  const z = Math.max(2, Math.min(17, Math.round(Math.log2(scale*zoom*72*360/256))));
  const n = 2**z;
  const tileX = lon => Math.floor((lon+180)/360*n);
  const tileY = lat => Math.floor((180-mercatorDegrees(lat))/360*n);
  let ready = true;
  c.save();
  c.globalAlpha = style==='osm' ? .82 : style==='osm-muted' ? .48 : .75;
  c.filter = style==='osm-muted' ? 'grayscale(1)' : 'none';
  for (let y = Math.max(0,tileY(a[1])); y <= Math.min(n-1,tileY(b[1])); y++) {
    for (let x = Math.max(0,tileX(a[0])); x <= Math.min(n-1,tileX(b[0])); x++) {
      const tile = z+'/'+x+'/'+y;
      const key = (style==='ign'?'ign':'osm')+'/'+tile;
      if (!tileCache.has(key)) {
        const url = style==='ign'
          ? 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX='+z+'&TILEROW='+y+'&TILECOL='+x
          : 'https://tile.openstreetmap.org/'+tile+'.png';
        const loadTile = cors => {
          const image = new Image();
          if (cors) image.crossOrigin = 'anonymous';
          image.referrerPolicy = 'strict-origin-when-cross-origin';
          tileCache.set(key,image);
          image.onload = () => { if ($('#basemap').value !== 'none') invalidate(); };
          image.onerror = () => {
            if (tileCache.get(key) !== image) return;
            if (cors) loadTile(false);
            else tileCache.set(key,null);
          };
          image.src = url;
        };
        loadTile(true);
      }
      const image = tileCache.get(key);
      if (!image?.naturalWidth || (exporting && image.crossOrigin !== 'anonymous')) {
        ready = false;
        continue;
      }
      const tileSize = 72*360/n;
      const left = (x/n*360-180+5.4)*72;
      const top = 494-(180-y/n*360-centerMercator)*72;
      c.drawImage(image,left,top,tileSize+.04,tileSize+.04);
    }
  }
  while (tileCache.size>96) tileCache.delete(tileCache.keys().next().value);
  c.restore();
  return ready;
}

function linePath(line) {
  const path = new Path2D();
  line.forEach((point,index) => index ? path.lineTo(...point) : path.moveTo(...point));
  mapPathGeometry.set(path, {line});
  return path;
}
function drawRiver(c,river) {
  c.beginPath();
  for (const line of river.p) {
    if (!line.length) continue;
    c.moveTo(...line[0]);
    for (let i=1;i<line.length;i++) c.lineTo(...line[i]);
  }
  c.stroke();
}
function riverOpacity() { return Number($('#riverOpacity').value)/100; }
function threshold() { return [38,15,5,1.8][+$('#density').value]/Math.max(1,zoom*.8); }
function visibleRivers(box) {
  const pool = new Set();
  cellsFor(box,key => { for (const river of riverGrid.get(key) || []) pool.add(river); });
  const minimum = threshold();
  return [...pool].filter(r => overlaps(box,r.box) && (r === selected || r.l >= minimum)).sort((a,b) => a.l-b.l);
}
function outline(c, item, color, width, dash=[]) {
  if (!item.path) item.path = polyPath(item.polys);
  c.strokeStyle=color; c.lineWidth=width; c.setLineDash(dash); c.stroke(item.path); c.setLineDash([]);
}
function drawArea(c,item,fill,stroke,s,width=.65) {
  if (!item.path) item.path = polyPath(item.polys);
  c.fillStyle=fill; c.fill(item.path,'evenodd');
  outline(c,item,stroke,width/s);
}
function drawStatic() {
  bc.setTransform(1,0,0,1,0,0);
  bc.clearRect(0,0,base.width,base.height);
  const style = $('#basemap').value;
  if (style !== 'positron' || !vectorReady) {
    bc.fillStyle='#fff'; bc.fillRect(0,0,base.width,base.height);
  }
  transform(bc);
  const s = scale*zoom, box = viewBox(12);
  if (style === 'positron') syncPositron();
  else if (style !== 'none') drawTiles(bc,style,box);
  visible = drawMapGeometry(bc,box,s,drawFlood);
  lc.setTransform(1,0,0,1,0,0);
  lc.clearRect(0,0,labelsLayer.width,labelsLayer.height);
  drawMapAnnotations(lc,box,s,visible,style);

  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(base,0,0);
  ctx.drawImage(labelsLayer,0,0);
  const count = visible.filter(r => !basin || r.b===basin).length;
  setText($('#visibleCount'),number.format(count)+' cours d’eau dans la vue');
  updateScale();
  updateLegend();
  updateBranches();
  dirty=false; flowDirty=true;
  window.mapStartupReady?.();
}

function drawMapGeometry(c, box, s, paintMapFlood) {
  c.strokeStyle='#a9b6bd'; c.lineWidth=.8/s; c.stroke(landPath);

  if ($('#areas').checked) for (const b of D.basins) {
    if (basin && basin!==b.id) continue;
    c.fillStyle=colors[b.id]+'13'; c.fill(b.path,'evenodd');
  }
  paintMapFlood(c);
  if (EX) for (const [type,id] of Object.entries(areaLayers)) {
    if (!$('#'+id).checked) continue;
    const entries = type==='aquifer' ? EX.aquifers : EX.protected;
    for (const item of entries) {
      if (type==='protected' && !protectedInFilter(item)) continue;
      if (!overlaps(item.box,box)) continue;
      const aqua = type==='aquifer';
      drawArea(c,item,aqua?'#287bbc29':'#25764630',aqua?'#287bbc9c':'#217144a6',s);
    }
  }
  drawWatershedLimits(c,box,s);
  if (localWatershed) drawArea(c,localWatershed,'#284d9c35','#244eaa',s,2.3);
  if (highlightedCrossing) drawArea(c,highlightedCrossing,colors[highlightedCrossing.basin]+'48',colors[highlightedCrossing.basin],s);

  const rivers = visibleRivers(box);
  const opacity = riverOpacity();
  c.save();
  for (const river of opacity>0?rivers:[]) {
    if (river===selected) continue;
    const isRelevant = !basin || river.b===basin;
    c.globalAlpha = opacity * (isRelevant ? (river.l>100?.99:river.l>35?.74:.44) : .10);
    c.strokeStyle = colors[river.b];
    c.lineWidth = (river.l>350?1.8:river.l>100?1.22:river.l>35?.80:.46)/Math.pow(s,.91);
    drawRiver(c,river);
  }
  c.restore();
  drawWaterTransport(c,box,s);
  c.save();
  c.globalAlpha=opacity;
  if (selected && opacity>0) {
    const route = currentRoute(selected);
    if (route?.full?.length) {
      route.path ||= linePath(route.full);
      c.strokeStyle='#ffffffdf'; c.lineWidth=4.8/s; c.stroke(route.path);
      c.strokeStyle=colors[selected.b]; c.lineWidth=2.75/s; c.stroke(route.path);
    } else {
      c.strokeStyle=colors[selected.b]; c.lineWidth=2.6/s; drawRiver(c,selected);
    }
    if (highlightedArea) {
      c.save();
      highlightedArea.item.path ||= polyPath(highlightedArea.item.polys);
      c.clip(highlightedArea.item.path,'evenodd');
      c.strokeStyle=highlightedArea.type==='protected'?'#174f2f':'#185d95';
      c.lineWidth=4/s;
      if (route?.path) c.stroke(route.path); else drawRiver(c,selected);
      c.restore();
    }
  }

  c.restore();
  return rivers;
}

function drawMapAnnotations(c, box, s, rivers, style, ratio=dpr) {
  transform(c,ratio);
  if ($('#basinBoundaries').checked) for (const b of D.basins) {
    if (overlaps(b.box,box)) outline(c,b,colors[b.id]+(basin&&b.id!==basin?'45':'cb'),1.15/s);
  }
  if ($('#departments').checked) for (const item of departments) {
    if (overlaps(item.box,box)) outline(c,item,'#17191d',.8/s);
  }
  if ($('#regions').checked && geography) for (const item of geography.regions) {
    if (overlaps(item.box,box)) outline(c,item,'#3b4654',1.65/s,[5/s,3/s]);
  }
  drawWaterTransport(c,box,s,true);
  drawObservations(c,box,s);
  drawLabels(c,rivers,style,ratio);
  drawPoints(c,ratio);

}

function updateScale() {
  const [,lat] = unproject(world(w/2,h/2));
  const kmPerPixel = 111.32*Math.cos(lat*Math.PI/180)/(72*scale*zoom);
  const target = Math.max(.01,kmPerPixel*84);
  const pow = 10**Math.floor(Math.log10(target));
  const km = (target/pow>=5?5:target/pow>=2?2:1)*pow;
  const el = $('#mapScale');
  el.style.width = km/kmPerPixel+'px';
  setText(el,km<1 ? number.format(km*1000)+' m' : number.format(km)+' km');
}
function drawLabels(c,rivers,style,ratio) {
  c.setTransform(ratio,0,0,ratio,0,0);
  const placed = [];
  function label(text,point,color,size,mark=false) {
    const [x,y]=screenPoint(point);
    c.font = (mark?'550 ':'600 ')+size+'px Inter, sans-serif';
    const width=c.measureText(text).width, box=[x+3,y-size-4,x+width+8,y+3];
    if (x<4 || x>w-12 || y<12 || y>h-14) return false;
    if (mark) {
      c.beginPath(); c.arc(x,y,2.45,0,Math.PI*2); c.fillStyle=color; c.fill();
      c.lineWidth=1.2; c.strokeStyle='#fff'; c.stroke();
    }
    if (box[2]>w-5 || placed.some(b=>overlaps(b,box))) return false;
    placed.push(box);
    c.lineJoin='round'; c.lineWidth=3.4; c.strokeStyle='#ffffffeb';
    c.strokeText(text,x+5,y-4);
    c.fillStyle=color; c.fillText(text,x+5,y-4);
    return true;
  }
  // Reserve text space for department capitals before hydronyms compete for it.
  if ($('#prefectures').checked) {
    const major = new Set(cityLabels.map(x=>x[0]));
    const ordered = [...departments].sort((a,b)=>Number(major.has(b.chief))-Number(major.has(a.chief)));
    for (const d of ordered) {
      if ((zoom<1.8 && !major.has(d.chief)) || (style==='positron' && zoom<2.75)) {
        const [x,y]=screenPoint(d.point);
        c.beginPath(); c.arc(x,y,1.6,0,Math.PI*2); c.fillStyle='#536170'; c.fill();
      } else label(d.chief,d.point,'#354252',11,true);
    }
  }
  if ($('#cities').checked && riverOpacity()>0) {
    c.save();
    c.globalAlpha=riverOpacity();
    const candidates = [...rivers].reverse().filter(r => {
      if (basin && r.b!==basin) return false;
      if (zoom<1.45) return overviewNames.has(r.key) && names.get(r.key)===r;
      return r.l>150/Math.max(1,zoom*.65);
    }).slice(0,140);
    if (selected) candidates.unshift(selected);
    const used=new Set();
    for (const r of candidates) {
      if (r.n==='Cours d’eau sans nom' || used.has(r.n)) continue;
      const line=r.route?.line || r.p.reduce((a,b)=>a.length>b.length?a:b,[]);
      const p=line[Math.floor(line.length/2)];
      if (p && label(displayName(r.n),p,colors[r.b],r===selected?13:11)) used.add(r.n);
    }
    c.restore();
  }
  if (style==='none' && zoom<2.1) {
    for (const [name,lon,lat] of [['La Manche',-3.1,49.55],['Océan Atlantique',-4.5,45.4],['Méditerranée',5.7,42.15]]) {
      label(name,project(lon,lat),'#637c8a',11);
    }
  }
}

function protectedInFilter(item) {
  const filter=$('#protectedFilter').value;
  return filter==='all'||filter===item.kind||(filter==='reserves'&&['rnn','rnr','rnc'].includes(item.kind));
}
function flowInFilter(item,box) {
  const scope=$('#flowScope').value;
  if (scope==='auto' && basin && !item.basins.includes(basin)) return false;
  if (scope==='view' && !contains(box,item.p)) return false;
  const value=$('#flowFilter').value;
  if (value==='all') return true;
  if (value==='negative') return item.q<0;
  const [min,max]=value.split(':').slice(1).map(Number);
  return item.q>=min && item.q<max;
}
function drawPoints(c,ratio=dpr) {
  const box=viewBox(10);
  c.setTransform(ratio,0,0,ratio,0,0);
  plotted=[]; clusters=[]; flowPoints=[];
  function marker(type,item,color,radius,shape='circle') {
    const [x,y]=screenPoint(item.p);
    c.beginPath();
    if (shape==='circle') c.arc(x,y,radius,0,Math.PI*2);
    else {c.moveTo(x,y-radius);c.lineTo(x+radius,y);c.lineTo(x,y+radius);c.lineTo(x-radius,y);c.closePath();}
    c.fillStyle=color;c.fill();c.lineWidth=1.5;c.strokeStyle='#fff';c.stroke();
    plotted.push({type,item,p:[x,y],radius:Math.max(9,radius+3)});
  }
  if (EX && $('#hydroDams').checked) {
    const cells=new Map();
    for (const item of EX.dams) {
      if (!contains(box,item.p)) continue;
      const [x,y]=screenPoint(item.p);
      const key=Math.floor(x/20)+':'+Math.floor(y/20);
      if (!cells.has(key)) cells.set(key,[]);
      cells.get(key).push(item);
    }
    for (const items of cells.values()) {
      if (items.length===1) { marker('dam',items[0],'#3f6f9c',4.7,'diamond'); continue; }
      const [x,y]=screenPoint(items[0].p);
      c.beginPath();c.arc(x,y,8.5,0,Math.PI*2);c.fillStyle='#365f86';c.fill();c.strokeStyle='#fff';c.lineWidth=1.25;c.stroke();
      c.font='600 9px Inter';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#fff';c.fillText(items.length>99?'99+':items.length,x,y);
      clusters.push({p:[x,y],items});
    }
    c.textAlign='start';c.textBaseline='alphabetic';
  }
  if (EX && $('#nuclearPlants').checked) for (const item of EX.nuclear) {
    if (contains(box,item.p)) marker('nuclear',item,'#936213',5.7,'diamond');
  }
  if (EX && $('#flowsLayer').checked) {
    const filterBox = viewBox();
    flowPoints=EX.flows.filter(item=>flowInFilter(item,filterBox));
    for (const item of flowPoints) {
      if (!contains(box,item.p)) continue;
      const positive=Math.max(0,item.q);
      marker('flow',item,'#087f82',Math.min(7,3.1+Math.log10(1+positive)*1.4));
    }
  }
  if (locatedPoint) {
    const [x,y]=screenPoint(locatedPoint);
    c.beginPath();c.arc(x,y,8,0,Math.PI*2);c.fillStyle='#ffffffd9';c.fill();c.lineWidth=2.2;c.strokeStyle='#152b52';c.stroke();
    c.beginPath();c.arc(x,y,2.6,0,Math.PI*2);c.fillStyle='#152b52';c.fill();
    if (locatedPointLabel) {
      c.save();
      c.font='650 12px Inter, sans-serif';
      const padding=8, height=25, width=c.measureText(locatedPointLabel).width+padding*2;
      const gap=13;
      const candidates=[[x+gap,y-height-8],[x-width-gap,y-height-8],[x+gap,y+13],[x-width-gap,y+13]];
      let [left,top]=candidates.find(([px,py])=>px>=6&&px+width<=w-6&&py>=6&&py+height<=h-6)||candidates[0];
      left=Math.max(6,Math.min(w-width-6,left));
      top=Math.max(6,Math.min(h-height-6,top));
      c.fillStyle='#ffffff';c.strokeStyle='#1b4a67';c.lineWidth=1.25;
      c.fillRect(left,top,width,height);c.strokeRect(left,top,width,height);
      c.textAlign='left';c.textBaseline='middle';c.fillStyle='#173448';
      c.fillText(locatedPointLabel,left+padding,top+height/2);
      c.restore();
    }
  }
}

function prepareFlow(line) {
  const cum = new Float32Array(line.length);
  for (let i=1;i<line.length;i++) cum[i]=cum[i-1]+Math.sqrt(dist2(line[i-1],line[i]));
  return {line,cum,total:cum.at(-1)||0};
}
const flowCache=new Map();
function flowParts(river) {
  if (flowCache.has(river)) {
    const cached=flowCache.get(river);
    flowCache.delete(river);flowCache.set(river,cached);
    return cached;
  }
  const parts=[];
  river.p.forEach((line,index)=>{
    if (line.length<2) return;
    const signs=river.o?.[index] || '+'.repeat(line.length-1);
    let start=0;
    for (let i=1;i<=line.length-1;i++) {
      if (i!==line.length-1 && signs[i]===signs[start]) continue;
      const part=line.slice(start,i+1);
      if (signs[start]==='-') part.reverse();
      parts.push(prepareFlow(part));
      start=i;
    }
  });
  flowCache.set(river,parts);
  if (flowCache.size>3600) flowCache.delete(flowCache.keys().next().value);
  return parts;
}
function updateBranches() {
  animatedBranches=[];
  if (!playing) return;
  const s=scale*zoom, eligible=visible.filter(r=>!basin||r.b===basin);
  const step=Math.max(1,Math.ceil(eligible.length/1250));
  const offset=Math.floor(phase/700)%step;
  let budget=2200;
  for (let i=eligible.length-1-offset;i>=0 && budget>0;i-=step) {
    const r=eligible[i];
    for (const f of flowParts(r)) {
      if (f.total*s<1.6||budget<=0) continue;
      const count=Math.min(8,Math.ceil(f.total*s/55),budget);
      animatedBranches.push({r,f,count});
      budget-=count;
    }
  }
}
function drawParticle(c,flow,position,radius,color,highlight=false) {
  if (!flow.total) return;
  const distance=position%flow.total;
  let lo=0,hi=flow.cum.length-1;
  while(lo<hi) {const mid=(lo+hi)>>1;if(flow.cum[mid]<distance) lo=mid+1;else hi=mid;}
  const i=Math.max(1,lo), a=flow.line[i-1],b=flow.line[i];
  const ratio=(distance-flow.cum[i-1])/(flow.cum[i]-flow.cum[i-1]||1);
  const x=a[0]+ratio*(b[0]-a[0]), y=a[1]+ratio*(b[1]-a[1]);
  c.beginPath();c.arc(x,y,radius,0,Math.PI*2);c.fillStyle=color;c.fill();
  if (highlight) {
    c.beginPath();c.arc(x,y,.52*radius,0,Math.PI*2);c.fillStyle='#fff';c.fill();
  }
}
function renderFrame(time) {
  frameRequest=0;
  if (document.hidden || !w || !h) return;
  const interval=drag ? 1000/16 : 1000/28;
  const animate=playing && mapIsVisible && riverOpacity()>0;
  if ((dirty && !drag) || ((animate || dirty) && time-lastFrame>=interval) || flowDirty) {
    const s=scale*zoom,elapsed=lastFrame?Math.min(70,time-lastFrame):interval;
    lastFrame=time;
    if (animate) phase+=elapsed*.019*speed/s;
    if (dirty) {
      try { drawStatic(); }
      catch (error) {
        window.mapStartupFailure?.(error.message || String(error));
        return;
      }
    }
    fx.setTransform(1,0,0,1,0,0);fx.clearRect(0,0,flowCanvas.width,flowCanvas.height);
    flowDirty=false;
    if (animate) {
      transform(fx);
      fx.globalAlpha=.93*riverOpacity();
      for (const {r,f,count} of animatedBranches) for (let i=0;i<count;i++) {
        drawParticle(fx,f,phase+i*f.total/count+r.i*.37,(zoom>2?1.5:1.2)/s,colors[r.b],true);
      }
      const route=selected&&currentRoute(selected);
      if (route?.full?.length) {
        const f=route.flow ||= prepareFlow(route.full);
        const step=Math.max(36/s,f.total/190);
        for (let p=0;p<f.total;p+=step) drawParticle(fx,f,phase+p,1.3/s,'#fff');
      }
    }
  }
  if (animate || dirty || flowDirty) frameRequest=requestAnimationFrame(renderFrame);
}

function pointToSegment(p,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1];
  const ratio=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
  return dist2(p,[a[0]+ratio*dx,a[1]+ratio*dy]);
}
function nearestRiver(point,tolerance) {
  if (!riverOpacity()) return null;
  const neighborhood = [point[0]-tolerance,point[1]-tolerance,point[0]+tolerance,point[1]+tolerance];
  const candidates=new Set();
  cellsFor(neighborhood,key=>{for(const r of riverGrid.get(key)||[]) candidates.add(r);});
  let best=tolerance*tolerance,river=null;
  for (const r of candidates) {
    if ((basin&&r.b!==basin) || (r!==selected&&r.l<threshold()) || !overlaps(r.box,neighborhood)) continue;
    for (const line of r.p) for (let i=1;i<line.length;i++) {
      const d=pointToSegment(point,line[i-1],line[i]);
      if (d<best) {best=d;river=r;}
    }
  }
  return river;
}
function inside(item,point) {
  if (!contains(item.box,point)) return false;
  item.path ||= polyPath(item.polys);
  hitContext.setTransform(1,0,0,1,0,0);
  return hitContext.isPointInPath(item.path,...point,'evenodd');
}
const hitContext=document.createElement('canvas').getContext('2d');

function clickOptions(x,y,includeTerritories=true) {
  const p=world(x,y), screen=[x,y], hits=[];
  const nearby = plotted.filter(hit=>dist2(hit.p,screen)<=hit.radius**2).sort((a,b)=>dist2(a.p,screen)-dist2(b.p,screen));
  for (const hit of nearby.slice(0,4)) hits.push(hit);
  for (const group of clusters) if (dist2(group.p,screen)<=110) hits.push({type:'cluster',item:group});
  hits.push(...observationHits(screen));
  hits.push(...waterTransportHits(p,6/(scale*zoom)));
  const r=nearestRiver(p,7/(scale*zoom));
  if (r) hits.push({type:'river',item:r});
  if ($('#prefectures').checked) for(const d of departments) {
    if (dist2(screenPoint(d.point),screen)<45) hits.push({type:'department',item:d});
  }
  if (!includeTerritories) return hits;
  if (EX && $('#protectedLayer').checked) for (const item of EX.protected) {
    if (protectedInFilter(item)&&inside(item,p)) hits.push({type:'protected',item});
  }
  if (EX && $('#aquiferLayer').checked) for (const item of EX.aquifers) {
    if (inside(item,p)) hits.push({type:'aquifer',item});
  }
  if ($('#departments').checked) for (const item of departments) {
    if (!hits.some(h=>h.item===item)&&inside(item,p)) hits.push({type:'department',item});
  }
  if (geography && $('#regions').checked) for (const item of geography.regions) {
    if (inside(item,p)) hits.push({type:'region',item});
  }
  return hits;
}

function relative(event) {
  const rect=canvas.getBoundingClientRect();
  return [event.clientX-rect.left,event.clientY-rect.top];
}
canvas.addEventListener('pointerdown',event=>{
  if (event.button!==0) return;
  canvas.setPointerCapture(event.pointerId);
  const point=relative(event);
  pointers.set(event.pointerId,point);
  if (pointers.size===2) {
    const [a,b]=pointers.values();
    drag={moved:true,pinch:Math.sqrt(dist2(a,b)),center:[(a[0]+b[0])/2,(a[1]+b[1])/2]};
  } else drag={point,tx,ty,moved:false};
  $('#tooltip').hidden=true;
  closeChoices();
});
canvas.addEventListener('pointermove',event=>{
  const point=relative(event);
  if (drag && pointers.has(event.pointerId)) {
    pointers.set(event.pointerId,point);
    if (pointers.size>=2) {
      const [a,b]=pointers.values(), length=Math.sqrt(dist2(a,b));
      const center=[(a[0]+b[0])/2,(a[1]+b[1])/2];
      if (drag.pinch>0) {
        zoomAt(length/drag.pinch,...drag.center);
        tx+=center[0]-drag.center[0];ty+=center[1]-drag.center[1];
      }
      drag={moved:true,pinch:length,center};
    } else {
      const dx=point[0]-drag.point[0],dy=point[1]-drag.point[1];
      if (Math.abs(dx)+Math.abs(dy)>4) drag.moved=true;
      if (drag.moved) {tx=drag.tx+dx;ty=drag.ty+dy;}
    }
    invalidate();
    return;
  }
  if (performance.now()-hoverTime<110) return;
  hoverTime=performance.now();
  const [hit]=clickOptions(...point,false), tip=$('#tooltip');
  tip.hidden=!hit;
  if (!hit) {canvas.style.cursor='grab';return;}
  tip.textContent=hitLabel(hit);
  tip.style.left=Math.max(6,Math.min(w-190,point[0]+10))+'px';
  tip.style.top=Math.max(5,point[1]-32)+'px';
  canvas.style.cursor='pointer';
});
function pointerEnd(event) {
  if (!pointers.has(event.pointerId)) return;
  const point=relative(event), moved=drag?.moved;
  pointers.delete(event.pointerId);
  if (pointers.size===1) drag={point:[...pointers.values()][0],tx,ty,moved:true};
  else drag=null;
  if (event.type==='pointerup'&&!moved&&!pointers.size) inspectMapClick(...point);
  invalidate();
}
canvas.addEventListener('pointerup',pointerEnd);
canvas.addEventListener('pointercancel',pointerEnd);
canvas.addEventListener('pointerleave',()=>{$('#tooltip').hidden=true;});
canvas.addEventListener('wheel',event=>{
  event.preventDefault();closeChoices();zoomAt(event.deltaY>0?.88:1.14,...relative(event));
},{passive:false});
canvas.addEventListener('keydown',event=>{
  const actions={'+':()=>zoomAt(1.3),'=':()=>zoomAt(1.3),'-':()=>zoomAt(1/1.3),Home:resetMap,
    ArrowLeft:()=>panMap(45,0),ArrowRight:()=>panMap(-45,0),ArrowUp:()=>panMap(0,45),ArrowDown:()=>panMap(0,-45)};
  if (!actions[event.key]) return;
  event.preventDefault();actions[event.key]();closeChoices();invalidate();
});
document.addEventListener('visibilitychange',()=>{
  if (!document.hidden) {lastFrame=0;invalidate();}
  else if (frameRequest) {cancelAnimationFrame(frameRequest);frameRequest=0;}
});
if (window.ResizeObserver) new ResizeObserver(resize).observe($('#mapbox'));
else window.addEventListener('resize',resize);
if (window.IntersectionObserver) new IntersectionObserver(([entry])=>{
  if (entry.isIntersecting===mapIsVisible) return;
  mapIsVisible=entry.isIntersecting;
  lastFrame=0;flowDirty=true;invalidate();
}).observe($('#mapbox'));
if (document.fonts) document.fonts.ready.then(invalidate);
if (window.mapLightweight) {
  $('#basemap').value = 'none';
  $('#density').value = '0';
}
initExplorer();
resize();
for (const surface of [canvas,flowCanvas,base,labelsLayer]) {
  surface.addEventListener('contextlost',event => {
    event.preventDefault();
    window.mapStartupFailure?.('Le navigateur a perdu une surface de dessin.');
  });
  surface.addEventListener('contextrestored',invalidate);
}

initWaterTransport();

initFloodLayer();

initWatershedLayer();

initObservations();
