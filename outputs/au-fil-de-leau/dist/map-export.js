'use strict';

const exportStorageKey = 'bassinsdefrance.views.v1';
const exportControls = [...document.querySelectorAll('#settings input[id], #settings select[id], #speed')];
const exportLayerCredits = [
  ['basinBoundaries','Limites des grands bassins','Sandre','#3b6570','line'],
  ['areas','Aplats des bassins','Sandre','#638594','area'],
  ['departments','Limites départementales','Etalab','#17191d','line'],
  ['regions','Limites régionales','Etalab','#3b4654','dash'],
  ['prefectures','Chefs-lieux','API Découpage administratif','#354252','point'],
  ['flowsLayer','Stations de débit','Hub’Eau','#087f82','point','flowFilter'],
  ['protectedLayer','Zones protégées','INPN','#257646','area','protectedFilter'],
  ['aquiferLayer','Nappes captives','BD LISA','#287bbc','area'],
  ['watersheds','Sous-bassins topographiques','BD TOPAGE®','#34495a','line'],
  ['water-lakes','Lacs et plans d’eau','BD TOPAGE®','#147a9a','area'],
  ['water-captages','Captages d’eau potable','Sandre PRL','#075b8f','point'],
  ['water-farms','Élevages recensés (ICPE)','Géorisques','#76519b','point','farmFilter'],
  ['water-navigation','Voies navigables','IGN BD CARTO®','#50218a','dash'],
  ['water-locks','Écluses','Sandre ROE','#976024','square'],
  ['water-wastewater','Stations d’épuration','Portail de l’assainissement collectif','#04746f','point','wastewaterCapacity'],
  ['floodLayer','Enveloppes d’inondation potentielles','Géorisques EAIP','#1b709e','area','floodType'],
  ['hydroDams','Ouvrages hydroélectriques','Sandre ROE','#3f6f9c','diamond'],
  ['nuclearPlants','Centrales nucléaires','Open Data EDF','#936213','diamond'],
  ['water-industry','Sites industriels et Seveso','Géorisques','#4d5661','point','industryFilter']
];
const exportFarmColors = {Bovins:'#76519b',Porcs:'#c56d38',Volailles:'#d39a21',Pisciculture:'#13817c'};

function exportMapName() {
  return (currentTerritory?.item.name || (selected && displayName(selected.n)) || basinById.get(basin)?.name || 'France métropolitaine').slice(0,100);
}

function exportGroundCredits(ground) {
  if (ground==='positron') return ['OpenFreeMap','© OpenMapTiles','© OpenStreetMap (openstreetmap.org/copyright)'];
  if (ground==='ign') return ['© IGN · Géoportail'];
  if (ground.startsWith('osm')) return ['© OpenStreetMap (openstreetmap.org/copyright)'];
  return [];
}

function describeExportMap(ground, includeFlood) {
  const credits = new Set(['BD TOPAGE® (IGN, OFB, Sandre, 2026)',...exportGroundCredits(ground)]);
  const legend = (riverOpacity()>0 ? (basin ? [basinById.get(basin)] : D.basins) : [])
    .map(item => ({label:item.name,color:colors[item.id],shape:'line'}));
  const activeLabels = [];
  for (const [id,label,source,color,shape,filter] of exportLayerCredits) {
    if (!$('#'+id).checked || (id==='floodLayer' && !includeFlood)) continue;
    credits.add(source);
    const select = filter ? $('#'+filter) : null;
    const value = select?.value;
    const name = select && (value!=='all' && value!=='0') ? label+' · '+select.selectedOptions[0].text : label;
    activeLabels.push(name);
    if (id==='water-farms') {
      for (const [type,tone] of Object.entries(exportFarmColors)) {
        if (value==='all' || value===type) legend.push({label:type+' · ICPE',color:tone,shape});
      }
    } else if (id==='water-industry') {
      if (['all','industry'].includes(value)) legend.push({label:'Installations industrielles',color,shape});
      if (['all','seveso','low'].includes(value)) legend.push({label:'Seveso · seuil bas',color:'#be6215',shape:'diamond'});
      if (['all','seveso','high'].includes(value)) legend.push({label:'Seveso · seuil haut',color:'#9d2439',shape:'diamond'});
    } else {
      legend.push({label:name,color,shape});
    }
  }
  for (const entry of observationExportLegend()) legend.push(entry);
  for (const [key,layer] of Object.entries(observationLayers)) {
    if ($('#water-'+key).checked) {
      credits.add((key==='withdrawals'?'BNPE':key==='quality'?'Naïades':'ONDE / OFB')+' via Hub’Eau');
      activeLabels.push(observationPeriodLabel(key));
    }
  }
  const [west,north] = unproject(world(0,0));
  const [east,south] = unproject(world(w,h));
  const lat = value => number.format(Math.abs(Math.round(value*100)/100))+'° '+(value>=0?'N':'S');
  const lon = value => number.format(Math.abs(Math.round(value*100)/100))+'° '+(value>=0?'E':'O');
  const description = 'Carte des cours d’eau · '+exportMapName()+'. Emprise de '+lat(south)+' à '+lat(north)+
    ', de '+lon(west)+' à '+lon(east)+'.'+(activeLabels.length ? ' Couches actives : '+activeLabels.join(', ')+'.' : '');
  return {legend,credits:'Sources · '+[...credits].join(' · '),description};
}

function exportSize(longSide) {
  const ratio = longSide / Math.max(w,h);
  return {width:Math.max(1,Math.round(w*ratio)), height:Math.max(1,Math.round(h*ratio)), ratio};
}

function paintExportScale(context, ratio) {
  const [,lat] = unproject(world(w/2,h/2));
  const kmPerPixel = 111.32*Math.cos(lat*Math.PI/180)/(72*scale*zoom);
  const target = Math.max(.001,kmPerPixel*78);
  const power = 10**Math.floor(Math.log10(target));
  const km = (target/power>=5?5:target/power>=2?2:1)*power;
  const length = km/kmPerPixel;
  const label = km<1 ? number.format(km*1000)+' m' : number.format(km)+' km';
  context.save();
  context.setTransform(ratio,0,0,ratio,0,0);
  context.font = '600 12px Inter, sans-serif';
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillStyle = '#ffffffef';
  context.fillRect(10,h-33,Math.max(length,context.measureText(label).width)+46,24);
  context.fillStyle = '#172734';
  context.fillText('↑ N',16,h-17);
  context.fillText(label,48,h-18);
  context.strokeStyle = '#283c4b';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(48,h-15); context.lineTo(48+length,h-15); context.stroke();
  context.restore();
}

function paintExportAtlas(context, ground, ratio, includeFlood) {
  const box = viewBox(12), s = scale*zoom;
  context.save();
  transform(context,ratio);
  const rivers = drawMapGeometry(context,box,s,c => {
    if (includeFlood && $('#floodLayer').checked) paintFlood(c,displayedFlood);
  });
  context.restore();
  context.save();
  drawMapAnnotations(context,box,s,rivers,ground,ratio);
  context.restore();
  paintExportScale(context,ratio);
}

async function copyPositronFrame(context, width, height) {
  const current = vectorMap;
  if (!current || !vectorReady) throw new Error('Le fond Positron est en cours de chargement. Réessayez dans un instant ou choisissez le fond blanc.');
  syncPositron();
  return new Promise((resolve,reject) => {
    const timer = setTimeout(() => finish(new Error('Le fond Positron ne s’est pas chargé à temps. Réessayez ou choisissez le fond blanc.')),5000);
    function finish(error) {
      clearTimeout(timer);
      current.off('render',paint);
      if (error) reject(error);
      else resolve();
    }
    function paint() {
      if (current!==vectorMap) {
        finish(new Error('Le fond de carte a changé. Relancez l’aperçu.'));
        return;
      }
      if (!current.areTilesLoaded()) return;
      try {
        context.drawImage(current.getCanvas(),0,0,width,height);
        // Detect blocked cross-origin pixel access before enabling the export.
        context.getImageData(0,0,1,1);
        finish();
      } catch {
        finish(new Error('Le navigateur ne permet pas de copier ce fond. Choisissez le fond blanc.'));
      }
    }
    current.on('render',paint);
    current.triggerRepaint();
  });
}

function ensureExportLayers(includeFlood) {
  const check = id => $('#'+id).checked;
  const missing = [];
  for (const [key,layer] of Object.entries(waterTransportLayers)) {
    if (check('water-'+key) && !layer.grid) missing.push(layer.label);
  }
  if (check('regions') && !geography) missing.push('limites régionales');
  if (check('watersheds') && !watershedLevels.size) missing.push('sous-bassins topographiques');
  if ((check('flowsLayer') || check('hydroDams') || check('nuclearPlants')) && !loadedLayers.has('points')) missing.push('stations ou ouvrages');
  if (check('protectedLayer') && !loadedLayers.has('protected')) missing.push('zones protégées');
  if (check('aquiferLayer') && !loadedLayers.has('aquifers')) missing.push('nappes captives');
  if (includeFlood && check('floodLayer') && !displayedFlood?.image) missing.push('enveloppes d’inondation');
  for (const [key,layer] of Object.entries(observationLayers)) {
    if (check('water-'+key) && !layer.data) missing.push(layer.label);
  }
  if (missing.length) throw new Error('Couches indisponibles ou en cours de chargement · '+missing.join(', ')+'. Réessayez l’aperçu ou ajustez la vue.');
}

async function rasterExportMap(longSide, ground, includeFlood) {
  if (!w || !h) throw new Error('La carte n’est pas encore prête.');
  if (dirty) drawStatic();
  ensureExportLayers(includeFlood);
  const viewport = [w,h,zoom,tx,ty];
  const {width,height,ratio} = exportSize(longSide);
  const result = makeExportCanvas(width,height);
  const context = result.getContext('2d',{alpha:false});
  context.fillStyle = '#fff'; context.fillRect(0,0,width,height);
  if (ground==='positron') await copyPositronFrame(context,width,height);
  else if (ground!=='none') {
    transform(context,ratio);
    const ready = drawTiles(context,ground,viewBox(),true);
    if (!ready) throw new Error('Certaines tuiles du fond ne sont pas chargées ou elles ne peuvent pas être copiées. Réessayez ou choisissez le fond blanc.');
    context.setTransform(1,0,0,1,0,0);
  }
  if ([w,h,zoom,tx,ty].some((value,index)=>value!==viewport[index])) {
    throw new Error('Le cadrage a changé pendant la préparation. Relancez l’aperçu.');
  }
  paintExportAtlas(context,ground,ratio,includeFlood);
  return result;
}

function makeMapPNG(map, options) {
  const layoutWidth = Math.max(w+32,460);
  const page = layoutExportPage(makeExportCanvas(1,1).getContext('2d'),layoutWidth,options);
  const ratio = map.width/page.usable;
  const mapHeight = map.height/ratio;
  const top = page.margin+page.titleHeight;
  const height = top+mapHeight+2*page.margin+page.metaHeight;
  const finalRatio = Math.min(ratio,4096/Math.max(layoutWidth,height),Math.sqrt(9_000_000/(layoutWidth*height)));
  const result = makeExportCanvas(layoutWidth*finalRatio,height*finalRatio);
  const context = result.getContext('2d',{alpha:false});
  context.setTransform(finalRatio,0,0,finalRatio,0,0);
  context.fillStyle = '#fff'; context.fillRect(0,0,layoutWidth,height);
  context.drawImage(map,page.margin,top,page.usable,mapHeight);
  paintExportText(context,page,top+mapHeight);
  return exportCanvasBlob(result).finally(() => { result.width = result.height = 1; });
}

function makeMapSVG(options) {
  ensureExportLayers(false);
  const context = new MapSVGContext(makeExportCanvas(1,1).getContext('2d'));
  const width = Math.max(w+32,460);
  const page = layoutExportPage(context.measureContext,width,options);
  const ratio = page.usable/w;
  const mapHeight = h*ratio;
  const top = page.margin+page.titleHeight;
  const height = top+mapHeight+2*page.margin+page.metaHeight;
  paintExportAtlas(context,'none',1,false);
  const map = '<svg x="'+page.margin+'" y="'+top+'" width="'+page.usable+'" height="'+exportNumber(mapHeight)+
    '" viewBox="0 0 '+w+' '+h+'" overflow="hidden"><defs>'+context.definitions.join('')+'</defs>'+
    context.elements.join('')+'</svg>';
  context.elements = [];
  context.setTransform(1,0,0,1,0,0);
  context.textAlign = 'left';
  paintExportText(context,page,top+mapHeight);
  return new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" role="img" '+
    'aria-labelledby="map-title map-desc" xml:lang="fr" width="'+exportNumber(width)+'" height="'+exportNumber(height)+
    '" viewBox="0 0 '+exportNumber(width)+' '+exportNumber(height)+'">'+
    '<title id="map-title">'+exportXML(options.title || 'Bassins de France')+'</title><desc id="map-desc">'+exportXML(options.description)+
    '</desc><rect width="100%" height="100%" fill="#fff"/>'+map+context.elements.join('')+'</svg>'],{type:'image/svg+xml;charset=utf-8'});
}

function readSavedViews() {
  const data = localStorage.getItem(exportStorageKey);
  if (!data) return [];
  const saved = JSON.parse(data);
  return Array.isArray(saved) ? saved.filter(view => view?.version===1 && typeof view.name==='string' &&
    Array.isArray(view.center) && view.center.length===2 && view.center.every(Number.isFinite) &&
    Number.isFinite(view.zoom) && view.controls && typeof view.controls==='object') : [];
}

function viewThumbnail(source) {
  if (!source?.width || !source?.height) return '';
  const width=240,height=145,ratio=Math.min(width/source.width,height/source.height);
  const thumbnail=document.createElement('canvas');
  thumbnail.width=width;thumbnail.height=height;
  const context=thumbnail.getContext('2d',{alpha:false});
  context.fillStyle='#f2f5f6';context.fillRect(0,0,width,height);
  context.drawImage(source,(width-source.width*ratio)/2,(height-source.height*ratio)/2,source.width*ratio,source.height*ratio);
  let data=thumbnail.toDataURL('image/webp',.62);
  if (!data.startsWith('data:image/webp,')) data=thumbnail.toDataURL('image/png');
  if (data.length>90000) {
    thumbnail.width=180;thumbnail.height=110;
    const small=thumbnail.getContext('2d',{alpha:false});
    small.fillStyle='#f2f5f6';small.fillRect(0,0,180,110);
    const smallRatio=Math.min(180/source.width,110/source.height);
    small.drawImage(source,(180-source.width*smallRatio)/2,(110-source.height*smallRatio)/2,source.width*smallRatio,source.height*smallRatio);
    data=thumbnail.toDataURL('image/webp',.48);
    if (!data.startsWith('data:image/webp,')) data=thumbnail.toDataURL('image/png');
  }
  return data.length<=90000 ? data : '';
}

function saveCurrentView(name, thumbnail) {
  const views = readSavedViews();
  const controls = Object.fromEntries(exportControls.map(input=>[input.id,input.type==='checkbox'?input.checked:input.value]));
  const view = {version:1,id:globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),
    name,savedAt:new Date().toISOString(),thumbnail,center:unproject(world(w/2,h/2)),zoom,controls,playing,basin,river:selected?.id || null,
    territory:currentTerritory && {type:currentTerritory.type,id:currentTerritory.item.code},
    point:locatedPoint && unproject(locatedPoint),watershed:!!localWatershed};
  localStorage.setItem(exportStorageKey,JSON.stringify([view,...views]));
}

async function restoreSavedView(view) {
  closeChoices();
  clearSearch();
  for (const input of exportControls) {
    const observationDefaults = {riverOpacity:'100','water-withdrawals':false,'water-quality':false,'water-drought':false};
    const value = view.controls[input.id] ?? observationDefaults[input.id];
    if (typeof value==='string' && input.tagName==='SELECT' &&
        Object.values(observationFilters).flat().includes(input.id) &&
        ![...input.options].some(option=>option.value===value)) {
      input.dataset.pendingValue=value;
    }
    if (input.type==='checkbox' && typeof value==='boolean') input.checked = value;
    else if (typeof value==='string' && (input.tagName!=='SELECT' || [...input.options].some(option=>option.value===value))) input.value = value;
  }
  const province = view.territory;
  selectBasin(basinById.has(view.basin)?view.basin:null,{frame:false});
  if (riverById.has(view.river)) chooseRiver(riverById.get(view.river));
  if (province?.type==='department' && departmentById.has(province.id)) selectTerritory(departmentById.get(province.id),'department');
  let loadingNotice = '';
  if (province?.type==='region') {
    try {
      const data = await getGeography();
      const region = data.regions.find(item=>item.code===province.id);
      if (region) selectTerritory(region,'region');
    } catch { loadingNotice = ' La fiche de la région est actuellement indisponible.'; }
  }
  centerOn(project(...view.center),view.zoom);
  for (const input of exportControls) input.dispatchEvent(new Event(input.id==='density'?'input':'change'));
  const motion = view.playing===true && !wantsMotion.matches;
  if (motion!==playing) $('#play').click();
  if (Array.isArray(view.point) && view.point.length===2 && view.point.every(Number.isFinite)) {
    const point = project(...view.point);
    if (view.watershed) showWatershed(point);
    else { locatedPoint=point; invalidate(); }
  }
  return 'Vue « '+view.name+' » réouverte.'+loadingNotice;
}

function downloadMapFile(blob, title, format) {
  const filename = (title || 'bassins-de-france').normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]+/g,' ')
    .trim().replace(/\s+/g,'-').replace(/^[.\s-]+|[.\s-]+$/g,'') || 'bassins-de-france';
  const url = URL.createObjectURL(blob);
  const link = node('a');
  link.href = url;
  link.download = filename+'.'+format;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url),30000);
}

function initMapExport() {
  const dialog = $('#mapExport'), opener = $('#exportOpen'), canvasPreview = $('#exportPreview');
  const status = $('#exportStatus'), restoredStatus = $('#mapExportRestored');
  const error = $('#exportProblem'), retry = $('#exportRetry'), button = $('#exportDownload');
  const ground = $('#exportGround'), alt = $('#exportAlt'), resolution = $('#exportResolution');
  const title = $('#exportTitle'), legendToggle = $('#exportLegend');
  const filePanel = $('#exportFilePanel'), savePanel = $('#exportSavePanel'), galleryPanel = $('#exportGalleryPanel');
  const fileMode = $('#exportFileMode'), saveMode = $('#exportSaveMode'), viewsMode = $('#exportViewsMode');
  let mode = 'file', generation = 0, previewKey = '', busy = false;
  let returnFocus = opener;
  let capturedGround = 'none', previewReady = false;
  let previewLegendKey = '';
  const format = () => $('input[name="exportFormat"]:checked').value;
  const style = () => mode==='save' || (format()!=='svg' && ground.value==='current') ? capturedGround : 'none';
  const includeFlood = () => mode==='save' || format()!=='svg';

  function selectedDetails() {
    const info = describeExportMap(style(),includeFlood());
    return {...info,title:mode==='save'?$('#exportViewName').value.trim():title.value.trim(),
      description:mode==='file' && alt.value.trim() ? alt.value.trim() : info.description,
      legend:mode==='save'||legendToggle.checked ? info.legend : []};
  }

  function refreshMetadata() {
    const info = selectedDetails(), fileType = format(), saved = mode==='save';
    const vector = !saved && fileType==='svg', print = !saved && fileType==='pdf';
    const caption = $('#exportPreviewTitle');
    setText(caption,info.title); caption.hidden = !info.title;
    canvasPreview.setAttribute('aria-label',info.description);
    if (!alt.value) alt.placeholder = info.description;
    setText($('#exportPreviewCredits'),info.credits);
    const items = $('#exportPreviewLegend');
    const legendKey = JSON.stringify(info.legend);
    if (previewLegendKey!==legendKey) {
      previewLegendKey = legendKey;
      items.replaceChildren(...info.legend.map(({label,color,shape}) => {
        const li = node('li'), mark = node('span',null,'export-swatch');
        mark.style.setProperty('--export-swatch',color);
        mark.dataset.shape = shape;
        mark.setAttribute('aria-hidden','true');
        li.append(mark,document.createTextNode(label));
        return li;
      }));
    }
    items.hidden = !info.legend.length;
    $('#exportSheet').toggleAttribute('data-paper',print);
    $('#exportResolutionRow').hidden = fileType!=='png';
    ground.disabled = vector;
    ground.options[0].text = 'Fond actuel · '+[...$('#basemap').options].find(option=>option.value===capturedGround).text;
    $('#exportCopyGroup').hidden = fileType!=='png';
    setText($('#exportAltHint'),fileType==='png'?'À reprendre comme texte alternatif en partageant le PNG.':'La description accompagne la carte dans le fichier.');
    const note = vector ? 'Fond blanc et tracés modifiables.'+
      ($('#floodLayer').checked?' Les enveloppes d’inondation, fournies sous forme d’image, sont retirées de cet export.':'')+
      (capturedGround!=='none'?' Choisissez PNG ou PDF pour inclure le fond actuel.':'') :
      print ? 'Le PDF conserve le cadrage avec des marges et s’oriente selon la vue.' : '';
    setText($('#exportFormatNote'),note);
    const page = w>=h?'paysage':'portrait';
    const {width,height} = exportSize(Number(resolution.value));
    setText($('#exportDimensions'),saved?'Vue actuelle':print?'PDF · A4 '+page:vector?'SVG · cadrage actuel':'PNG · carte '+number.format(width)+' × '+number.format(height)+' px');
    setText(button,'Télécharger le '+fileType.toUpperCase());
    button.disabled = !previewReady || busy;
    $('#exportSaveSubmit').disabled = !previewReady || busy;
  }

  async function refreshPreview(force=false) {
    const requestKey = [style(),includeFlood(),w,h].join('/');
    if (!force && requestKey===previewKey) { refreshMetadata(); return; }
    previewKey = requestKey;
    const run = ++generation;
    previewReady = false;
    error.textContent = '';
    retry.hidden = true;
    status.textContent = 'Préparation de l’aperçu…';
    canvasPreview.dataset.empty = '';
    canvasPreview.width = canvasPreview.height = 1;
    refreshMetadata();
    try {
      const rendered = await rasterExportMap(1050,style(),includeFlood());
      if (run!==generation) {
        rendered.width = rendered.height = 1;
        return;
      }
      canvasPreview.width = rendered.width; canvasPreview.height = rendered.height;
      canvasPreview.getContext('2d').drawImage(rendered,0,0);
      rendered.width = rendered.height = 1;
      delete canvasPreview.dataset.empty;
      previewReady = true;
      status.textContent = 'Aperçu prêt.';
    } catch (problem) {
      if (run!==generation) return;
      error.textContent = problem.message;
      if (mode==='save') status.textContent = problem.message;
      else status.textContent = '';
      retry.hidden = false;
    }
    refreshMetadata();
  }

  function loadViewList() {
    const list = $('#exportSavedList');
    let saved = [];
    try { saved = readSavedViews(); }
    catch { status.textContent = 'Les vues enregistrées sont inaccessibles dans ce navigateur.'; }
    $('#exportNoViews').hidden = !!saved.length;
    list.replaceChildren(...saved.map((view,index) => {
      const li = node('li');
      const restore = makeButton('Afficher','export-button',async () => {
        if (busy) return;
        busy = true;
        try {
          dialog.close();
          restoredStatus.textContent = await restoreSavedView(view);
          if (!view.thumbnail) void captureSavedViewThumbnail(view,index);
        } catch { restoredStatus.textContent = 'Cette vue n’a pas pu être réouverte.'; }
        finally { busy = false; }
      });
      restore.setAttribute('aria-label','Afficher la vue '+view.name);
      let thumbnail;
      if (typeof view.thumbnail==='string' && /^data:image\/(?:webp|png);base64,/.test(view.thumbnail) && view.thumbnail.length<=90000) {
        thumbnail=node('img',null,'saved-view-thumbnail');
        thumbnail.src=view.thumbnail;
        thumbnail.alt='Aperçu de la vue « '+view.name+' »';
        thumbnail.loading='lazy';
        thumbnail.decoding='async';
      } else {
        thumbnail=node('div',null,'saved-view-thumbnail saved-view-thumbnail--empty');
        thumbnail.setAttribute('role','img');
        thumbnail.setAttribute('aria-label','Aperçu non disponible. Il sera créé à la prochaine ouverture de cette vue.');
        thumbnail.append(node('span','Aperçu à créer'));
      }
      const label=node('div',null,'saved-view-label');
      label.append(node('strong',view.name));
      const count=Object.entries(view.controls).filter(([id,value])=>value===true && (id.startsWith('water-') || ['flowsLayer','protectedLayer','aquiferLayer','watersheds','floodLayer','hydroDams','nuclearPlants'].includes(id))).length;
      const groundLabel=[...$('#basemap').options].find(option=>option.value===view.controls.basemap)?.text || '';
      const savedDate=Date.parse(view.savedAt || '');
      const dateLabel=Number.isFinite(savedDate) ? new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium'}).format(savedDate) : '';
      label.append(node('span',[groundLabel,count+' couche'+(count>1?'s':''),dateLabel].filter(Boolean).join(' · ')));
      const content=node('div',null,'saved-view-content');
      content.append(label,restore);
      li.className='saved-view-card';
      li.append(thumbnail,content);
      return li;
    }));
  }

  function restoredViewStillOpen(view) {
    if (basin!==view.basin || Math.abs(zoom-view.zoom)>.001) return false;
    const center=unproject(world(w/2,h/2));
    if (Math.abs(center[0]-view.center[0])>.01 || Math.abs(center[1]-view.center[1])>.01) return false;
    for (const input of exportControls) {
      if (!(input.id in view.controls)) continue;
      const expected=view.controls[input.id];
      const actual=input.type==='checkbox'?input.checked:input.value;
      if (actual!==expected && input.dataset.pendingValue!==expected) return false;
    }
    return true;
  }

  async function captureSavedViewThumbnail(view,index) {
    for (let attempt=0;attempt<16;attempt++) {
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      if (!restoredViewStillOpen(view)) return;
      try {
        const rendered=await rasterExportMap(360,$('#basemap').value,true);
        const thumbnail=viewThumbnail(rendered);
        rendered.width=rendered.height=1;
        if (!thumbnail || !restoredViewStillOpen(view)) return;
        const views=readSavedViews(), id=view.id;
        const signature=item=>JSON.stringify([item.name,item.center,item.zoom,item.controls,item.basin,item.river,item.territory,item.point]);
        const target=id ? views.findIndex(item=>item.id===id) : views.findIndex(item=>signature(item)===signature(view));
        if (target<0 || !views[target] || views[target].thumbnail) return;
        views[target].thumbnail=thumbnail;
        localStorage.setItem(exportStorageKey,JSON.stringify(views));
        if (dialog.open && mode==='views') loadViewList();
        return;
      } catch {
        await new Promise(resolve=>setTimeout(resolve,300));
      }
    }
  }

  function switchMode(next) {
    mode = next;
    filePanel.hidden = next!=='file'; savePanel.hidden = next!=='save'; galleryPanel.hidden = next!=='views';
    $('#exportModes').hidden = next==='views';
    fileMode.setAttribute('aria-pressed',String(next==='file'));
    saveMode.setAttribute('aria-pressed',String(next==='save'));
    viewsMode.setAttribute('aria-pressed',String(next==='views'));
    $('.export-preview').hidden = next==='views';
    $('.export-grid').dataset.mode = next;
    setText($('#exportHeading'),next==='views'?'Vues enregistrées':'Enregistrer ou exporter la carte');
    if (next==='views') {
      generation++;
      previewKey='';
      status.textContent='';
      loadViewList();
    } else refreshPreview();
  }

  function setResolutions() {
    const chosen = resolution.value || '1200';
    resolution.replaceChildren(...[1200,2400].map(side => {
      const {width,height} = exportSize(side), option = node('option',number.format(width)+' × '+number.format(height)+' px');
      option.value = String(side); return option;
    }));
    resolution.value = chosen;
  }

  function openPanel(next,trigger) {
    if (busy) return;
    capturedGround = $('#basemap').value;
    title.value = $('#exportViewName').value = exportMapName();
    alt.value = '';
    alt.placeholder = describeExportMap(capturedGround,true).description;
    setResolutions();
    previewKey = '';
    restoredStatus.textContent = '';
    returnFocus=trigger;
    dialog.showModal();
    switchMode(next);
  }
  opener.addEventListener('click',()=>openPanel('file',opener));
  $('#savedViewsOpen').addEventListener('click',()=>openPanel('views',$('#savedViewsOpen')));
  $('#exportClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',() => {
    generation++;
    previewReady = false;
    canvasPreview.width = canvasPreview.height = 1;
    returnFocus.focus();
  });
  if (window.ResizeObserver) new ResizeObserver(() => {
    if (!dialog.open || busy || mode==='save') return;
    resize();
    setResolutions();
    refreshPreview();
  }).observe($('#mapbox'));
  fileMode.addEventListener('click',()=>switchMode('file'));
  saveMode.addEventListener('click',()=>switchMode('save'));
  viewsMode.addEventListener('click',()=>switchMode('views'));
  saveMode.addEventListener('click',()=>$('#exportViewName').focus());
  $('#exportGallerySave').addEventListener('click',()=>{switchMode('save');$('#exportViewName').focus();});
  retry.addEventListener('click',()=>refreshPreview(true));
  filePanel.addEventListener('change',event => {
    if (event.target.name==='exportFormat' || event.target===ground) refreshPreview();
    else refreshMetadata();
  });
  for (const input of [title,alt,$('#exportViewName')]) input.addEventListener('input',refreshMetadata);
  $('#exportCopyAlt').addEventListener('click',async () => {
    try {
      await navigator.clipboard.writeText(selectedDetails().description);
      status.textContent = 'Description copiée.';
    } catch {
      if (!alt.value) alt.value = selectedDetails().description;
      alt.focus(); alt.select();
      status.textContent = 'Le texte est sélectionné. Utilisez le raccourci de copie de votre appareil.';
    }
  });
  savePanel.addEventListener('submit',event => {
    event.preventDefault();
    const name = $('#exportViewName').value.trim();
    if (!name) {
      status.textContent = 'Saisissez un nom pour la vue.';
      $('#exportViewName').focus();
      return;
    }
    try {
      const thumbnail=viewThumbnail(canvasPreview);
      if (!thumbnail) throw new Error('Aperçu indisponible');
      saveCurrentView(name,thumbnail);
      status.textContent = 'Vue « '+name+' » enregistrée.';
      saveMode.setAttribute('aria-pressed','false');
      viewsMode.setAttribute('aria-pressed','true');
      switchMode('views');
      status.textContent = 'Vue « '+name+' » enregistrée avec son aperçu.';
      $('#exportGallerySave').focus();
    } catch { status.textContent = 'Le navigateur n’a pas pu enregistrer cette vue avec son aperçu.'; }
  });
  filePanel.addEventListener('submit',async event => {
    event.preventDefault();
    if (!previewReady || busy) return;
    const type = format(), settings = selectedDetails(), run = generation;
    const exportGround = style(), exportFlood = includeFlood(), size = Number(resolution.value);
    busy = true;
    button.disabled = true;
    error.textContent = '';
    status.textContent = 'Préparation du '+type.toUpperCase()+'…';
    let map;
    try {
      let blob;
      if (type==='svg') {
        // Give the status message a frame before serializing the network.
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve,0)));
        if (run!==generation || !dialog.open) return;
        blob = makeMapSVG(settings);
      } else {
        map = await rasterExportMap(type==='pdf'?2400:size,exportGround,exportFlood);
        blob = await (type==='pdf' ? makeMapPDF(map,settings) : makeMapPNG(map,settings));
      }
      if (run!==generation || !dialog.open) return;
      downloadMapFile(blob,settings.title,type);
      status.textContent = 'Téléchargement du '+type.toUpperCase()+' lancé.';
    } catch (problem) {
      if (run!==generation) return;
      error.textContent = problem.message || 'L’export a échoué. Réessayez ou choisissez une définition plus basse.';
      status.textContent = '';
    } finally {
      if (map) map.width = map.height = 1;
      busy = false;
      if (dialog.open) refreshMetadata();
    }
  });
}

initMapExport();
