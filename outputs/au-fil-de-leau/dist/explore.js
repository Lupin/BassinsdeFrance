'use strict';

const extraPromise = new Map();
let vectorMap = null, vectorReady = false, vectorKey = '', vectorRun = 0;
let vectorScript;
let currentTerritory = null, territoryMode = 'department', compareRun = 0;
let searchResults = [], searchIndex = -1;
let communeItems = null, communeLoading = null, searchGeneration = 0;
const routeAreaCache = new WeakMap();
const pointLayers = {dam:'hydroDams', flow:'flowsLayer', nuclear:'nuclearPlants'};
const areaNames = {protected:'Zones protégées traversées', aquifer:'Nappes captives en recouvrement'};
function loadDataset(id, file, key) {
  if (window[key]) return Promise.resolve(window[key]);
  if (extraPromise.has(id)) return extraPromise.get(id);
  const placeholder = document.getElementById(id+'-data-lazy');
  const script = document.createElement('script');
  const pending = new Promise((resolve,reject)=>{
    script.onload=()=>window[key] ? resolve(window[key]) : reject(new Error('Données absentes'));
    script.onerror=()=>reject(new Error('Chargement impossible'));
    if (placeholder?.type==='text/plain') {
      script.text=placeholder.textContent;
      document.head.append(script);
      script.remove();
      if (window[key]) resolve(window[key]); else reject(new Error('Données absentes'));
    } else {
      script.src=placeholder?.dataset.src || file;
      document.head.append(script);
    }
  }).catch(error=>{extraPromise.delete(id);throw error;});
  extraPromise.set(id,pending);
  return pending;
}

const loadedLayers = new Set(), layerLoads = new Map();
let comparisonLoading, topologyLoading;
const datasetFor = {
  hydroDams:'points', nuclearPlants:'points', flowsLayer:'points',
  protectedLayer:'protected', aquiferLayer:'aquifers'
};
function getLayers(kind='points') {
  if (loadedLayers.has(kind)) return Promise.resolve(EX);
  if (layerLoads.has(kind)) return layerLoads.get(kind);
  const promise=loadDataset(kind,kind+'-data.js',kind.toUpperCase()).then(data=>{
    EX ||= {dams:[],nuclear:[],flows:[],protected:[],aquifers:[]};
    if (kind==='points') {
      for (const [key,count] of [['dams','damCount'],['nuclear','nuclearCount'],['flows','flowCount']]) {
        for (const item of data[key]) {
          fromAtlas(item.p);
          item.basins ||= [];
        }
        EX[key]=data[key];
        setText($('#'+count),number.format(data[key].length));
      }
    } else {
      for (const item of data) {
        convertPolys(item.polys);
        item.box=boundsOf(item.polys.flat());
      }
      EX[kind]=data;
      setText($(kind==='protected'?'#protectedCount':'#aquiferCount'),number.format(data.length));
    }
    loadedLayers.add(kind);
    invalidate();
    return EX;
  }).catch(error=>{layerLoads.delete(kind);throw error;});
  layerLoads.set(kind,promise);
  return promise;
}
function getGeography() {
  if (geography) return Promise.resolve(geography);
  if (!comparisonLoading) comparisonLoading=loadDataset('crossings','crossings-data.js','CROSSINGS').then(data=>{
    for (const item of data.regions) {
      convertPolys(item.polys);
      item.box=boundsOf(item.polys.flat());
    }
    const rows=data.rows.map(([basin,code,area,percent,polys])=>{
      convertPolys(polys);
      return {basin,code,area,percent,polys,box:boundsOf(polys.flat())};
    });
    geography={rows,regions:data.regions, byRegion:new Map(data.regions.map(r=>[r.code,r]))};
    invalidate();
    return geography;
  }).catch(error=>{comparisonLoading=null;throw error;});
  return comparisonLoading;
}

function getTopology() {
  if (topology) return Promise.resolve(topology);
  if (!topologyLoading) topologyLoading=loadDataset('topology','topology-data.js','TOPOLOGY').then(data=>{
    const main=riverById.get('04C0000002000808543');
    topology=new Map();
    if (!main?.route) return topology;
    for (const [id,[local,steps,join]] of Object.entries(data)) {
      local.forEach(fromAtlas);
      steps.forEach(step=>fromAtlas(step[1]));
      fromAtlas(join);
      const nearestLoire=nearest(join,main.route.line);
      const end=nearestLoire.d<3**2 ? main.route.line.slice(nearestLoire.i+1) : [];
      topology.set(id,{line:local,full:[...local,...end],local,steps,join,main,extended:!!end.length});
    }
    return topology;
  }).catch(error=>{topologyLoading=null;throw error;});
  return topologyLoading;
}

function currentRoute(river) { return river.route || topology?.get(river.id); }
function displayName(name) { return name ? name[0].toLocaleUpperCase('fr')+name.slice(1) : ''; }
function labelLength(river) { return '≈ '+number.format(Math.round(river.l))+' km'; }
function makeButton(text,className='text-button',action) {
  const button=node('button',text,className);
  button.type='button';
  if (action) button.onclick=action;
  return button;
}
function textLink(label,url) {
  const a=node('a',label);
  a.href=url;a.target='_blank';a.rel='noopener';
  return a;
}
function setMapTitle() { setText($('#viewtitle'),basinById.get(basin)?.name || 'Tous les bassins'); }
function crossingCountSummary(count) {
  return number.format(count)+(count===1?' recoupement':' recoupements')+' d’au moins 1 km².';
}
function selectBasin(id, {frame=true}={}) {
  basin=id; selected=null; currentTerritory=null;
  clearContext();
  if (frame) id ? frameBounds(basinById.get(id).box) : resetMap();
  setMapTitle(); basinButtons(); renderDetail(); invalidate();
}

function basinButtons() {
  const holder=$('#basins');
  holder.replaceChildren();
  for (const item of [{id:null,name:'France métropolitaine'},...D.basins]) {
    const button=makeButton('','basin-option',()=>selectBasin(item.id));
    button.setAttribute('aria-pressed',String(basin===item.id));
    const mark=node('span',null,'basin-swatch');
    mark.style.backgroundColor=colors[item.id]||'#1a3445';
    button.append(mark,node('span',item.name),node('span',number.format(item.id?riverCounts.get(item.id):D.rivers.length),'basin-count'));
    holder.append(button);
  }
}
function clearContext() {
  highlightedCrossing=null; highlightedArea=null; locatedPoint=null; locatedPointLabel='';
  watershedRun++;
  localWatershed=null;
  const feature=$('#featureDetail'),returnFocus=feature.contains(document.activeElement);
  feature.hidden=true;
  feature.replaceChildren();
  if (returnFocus) $('#map').focus({preventScroll:true});
}
function clearSelection() {
  selected=null;currentTerritory=null;
  clearContext();renderDetail();invalidate();
}
function chooseRiver(river,{focus=false,scope=false}={}) {
  if (scope || (basin && river.b!==basin)) basin=river.b;
  selected=river; currentTerritory=null;
  clearContext(); clearSearch();
  if (focus) frameBounds(river.box);
  setMapTitle(); basinButtons(); renderDetail(); invalidate();
  const exactSelection=river;
  if (!river.route && !topology) getTopology().then(()=>{
    if (selected===exactSelection && topology.has(river.id)) {renderDetail();invalidate();}
  }).catch(()=>{});

}
function selectTerritory(item,type,{focus=false,reveal=false}={}) {
  currentTerritory={item,type}; basin=null; selected=null;clearContext();clearSearch();
  setMapTitle();basinButtons();
  if (focus) frameBounds(item.box);
  $('#'+(type==='region'?'regions':'departments')).checked=true;
  renderDetail();invalidate();
  if (reveal) {
    const heading=$('#detail h2');
    if (heading) {
      heading.tabIndex=-1;
      if (window.matchMedia('(min-width: 761px)').matches) {
        $('#details').scrollTop=0;
        heading.focus({preventScroll:true});
      } else heading.focus();
    }
  }
}
function focusPoint(point, magnification=5, label='') {
  locatedPoint=point;
  locatedPointLabel=label;
  centerOn(point,Math.max(magnification,zoom));
  revealMap();
}

function routeSteps(river,route) {
  if (route.local) {
    const steps=[['Début du tracé connu',displayName(river.n),route.line[0]]];
    for (const [id,point] of route.steps.slice(1)) {
      const parent=riverById.get(id);
      if (parent) steps.push(['Se jette dans',displayName(parent.n),point]);
    }
    steps.push(['Confluence','La Loire',route.join]);
    if (route.extended) steps.push(['Vers la mer','Océan Atlantique',route.full.at(-1)]);
    return steps;
  }
  const steps=[['Source',route.spec[0],route.line[0]]];
  let current=river;
  while (current.route?.spec[1]) {
    const parent=names.get(current.route.spec[1]);
    if (!parent) break;
    steps.push(['Confluence',displayName(parent.n),current.route.line.at(-1)]);
    current=parent;
  }
  const goesAbroad=['rhin','meuse','moselle','escaut'].includes(current.key);
  if (goesAbroad) steps.push(['Sortie du tracé en France','La suite du cours est hors carte',route.full.at(-1)]);
  steps.push(['Destination',current.route?.spec[2]||oceans[river.b],goesAbroad?null:route.full.at(-1)]);
  return steps;
}
function appendSteps(container, river, route) {
  const list=node('ol',null,'route');
  for (const [label,value,point] of routeSteps(river,route)) {
    const item=node('li');
    const content=point
      ? makeButton('','route-stop',()=>focusPoint(point))
      : node('div',null,'route-stop static');
    if (point) content.setAttribute('aria-label',label+' : '+value+' · Localiser sur la carte');
    content.append(node('span',label,'route-label'),node('strong',value));
    item.append(content);list.append(item);
  }
  container.append(list);
}

function renderDetail() {
  const detail=$('#detail'), related=$('#related');
  detail.replaceChildren();related.replaceChildren();
  if (currentTerritory) {
    const {item,type}=currentTerritory;
    detail.append(node('p',type==='region'?'Région administrative':'Département '+item.code,'detail-type'),node('h2',item.name));
    if (item.chief) {
      detail.append(node('p','Chef-lieu : '+item.chief,'note'),
        makeButton('Localiser le chef-lieu','text-button',()=>focusPoint(item.point)));
    }
    compareTerritories(related,currentTerritory);
    return;
  }
  if (!selected) {
    const b=basinById.get(basin);
    detail.append(node('p',b?'Grand bassin de gestion':'France métropolitaine','detail-type'),
      node('h2',b?.name||'Explorez la carte'));
    if (b) {
      detail.style.setProperty('--river-color',colors[b.id]);
      detail.append(node('p',number.format(riverCounts.get(b.id))+' cours d’eau dans les données de l’atlas','note'));
    } else detail.append(node('p','Choisissez un bassin, cherchez un lieu ou cliquez sur le réseau.','note'));
    if (b) compareTerritories(related);
    return;
  }

  const river=selected, b=basinById.get(river.b), route=currentRoute(river);
  detail.style.setProperty('--river-color',colors[river.b]);
  detail.append(node('p','Cours d’eau','detail-type'),node('h2',displayName(river.n)));
  const tag=makeButton(b?.name,'basin-tag',()=>selectBasin(river.b));
  tag.style.setProperty('--river-color',colors[river.b]);
  detail.append(tag);
  const metric=node('div',null,'metric');
  metric.append(node('strong',labelLength(river)),node('span','Longueur estimée dans l’atlas'));
  detail.append(metric);
  detail.append(makeButton('Cadrer le cours d’eau','text-button fit-river',()=>frameBounds(river.box)));
  if (route) {
    appendSteps(detail,river,route);
    if (route.local) detail.append(node('p',route.extended
      ? 'Tronçons reliés par les nœuds officiels jusqu’à la Loire. La suite emprunte son parcours reconstitué.'
      : 'Tronçons reliés par les nœuds officiels jusqu’à la Loire.','note'));
    if (!route.local && ['rhone','rhin','garonne'].includes(river.key)) {
      detail.append(node('p','La source nommée est hors de France. Le bouton situe le début du tracé disponible dans l’atlas.','note'));
    }
  } else detail.append(node('p','Le tracé et l’animation sont disponibles. Le parcours détaillé jusqu’à l’exutoire reste à documenter.','note'));
  const children=D.rivers.filter(item=>item.route?.spec[1]===river.key);
  if (children.length) {
    const section=node('details',null,'detail-section');
    section.append(node('summary','Affluents documentés · '+children.length));
    for (const child of children) section.append(makeButton(displayName(child.n),'item-button',()=>chooseRiver(child,{focus:true})));
    related.append(section);
  }

  const links=node('details',null,'detail-section');
  links.append(node('summary','Stations et ouvrages associés'));
  const linkContent=node('div');
  links.append(linkContent);
  links.addEventListener('toggle',()=>{if(links.open) showAssociated(river,linkContent);});
  const areas=node('details',null,'detail-section');
  areas.append(node('summary','Parcours et milieux'));
  const areaContent=node('div');
  areas.append(areaContent);
  areas.addEventListener('toggle',()=>{if(areas.open) showAreaChoices(river,areaContent);});
  related.append(links,areas);
}

function compareTerritories(container, territory=null) {
  const run=++compareRun, id=basin;
  const section=node('section',null,'compare-section');
  section.append(node('h3',territory?'Grands bassins en commun':'Territoires en commun'));
  const content=node('div');
  section.append(content);container.append(section);
  function render() {
    if (run!==compareRun || !section.isConnected) return;
    content.replaceChildren();
    if (!territory) {
      const tabs=node('div',null,'segments');
      for (const [mode,label] of [['department','Départements'],['region','Régions']]) {
        const button=makeButton(label,'segment',()=>{territoryMode=mode;render();});
        button.setAttribute('aria-pressed',String(territoryMode===mode));
        tabs.append(button);
      }
      content.append(tabs);
    }
    const matches=geography.rows.filter(row=>territory
      ? row.code===territory.item.code
      : row.basin===id && row.code.startsWith('r-')===(territoryMode==='region'));
    content.append(node('p',matches.length
      ? crossingCountSummary(matches.length)+' La part affichée se rapporte au territoire administratif.'
      : 'Aucun recoupement d’au moins 1 km².','note'));
    const list=node('div',null,'compare-list');
    for (const row of matches) {
      const item=territory ? basinById.get(row.basin) : departmentById.get(row.code)||geography.byRegion.get(row.code);
      if (!item) continue;
      const button=makeButton('','compare-row',()=>{
        highlightedCrossing=row;
        if (!territory) $('#'+(row.code.startsWith('r-')?'regions':'departments')).checked=true;
        section.querySelectorAll('.compare-row').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));
        if (row.polys.length) frameBounds(row.box);
        invalidate();
      });
      button.setAttribute('aria-pressed',String(highlightedCrossing===row));
      button.append(node('strong',item.name),node('span',number.format(row.area)+' km² · '+number.format(row.percent)+' % du territoire'));
      list.append(button);
    }
    content.append(list);
  }
  if (geography) render();
  else {
    content.append(node('p','Calculs cartographiques en cours de chargement…','note'));
    getGeography().then(render).catch(()=>{content.replaceChildren(makeButton('Réessayer','text-button',()=>{
      section.remove();compareTerritories(container,territory);
    }));});
  }
}

function associationLabel(item) {
  const link=item.link;
  if (!link) return '';
  if (link[1]==='id') return 'Identifiant commun';
  if (link[1]==='nom') return 'Nom et proximité · '+number.format(link[2])+' m';
  return 'Proximité estimée · '+number.format(link[2])+' m';
}
function showAssociated(river,container) {
  container.replaceChildren(node('p','Chargement des stations et des ouvrages…','note'));
  getLayers().then(()=>{
    if (!container.isConnected) return;
    container.replaceChildren();
    const groups=[
      ['Stations de mesure','flow',EX.flows.filter(item=>item.link?.[0]===river.id)],
      ['Ouvrages hydroélectriques','dam',EX.dams.filter(item=>item.link?.[0]===river.id)]
    ];
    for (const [label,type,items] of groups) {
      container.append(node('h4',label+' · '+items.length));
      if (!items.length) {container.append(node('p','Aucune association dans les données chargées.','note'));continue;}
      const list=node('div',null,'compact-list');
      for (const item of items) {
        const button=makeButton('','compare-row',()=>{
          $('#'+pointLayers[type]).checked=true;
          if (type==='flow') {
            $('#flowFilter').value='all';$('#flowScope').value='france';$('#flowControls').hidden=false;
          }
          focusPoint(item.p,6); showFeature({type,item}); invalidate();
        });
        button.append(node('strong',item.n),node('span',associationLabel(item)));
        list.append(button);
      }
      container.append(list);
    }
  }).catch(()=>container.replaceChildren(makeButton('Réessayer','text-button',()=>showAssociated(river,container))));
}

function segmentTouches(a,b,c,d) {
  const ab=[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])];
  const cd=[Math.min(c[0],d[0]),Math.min(c[1],d[1]),Math.max(c[0],d[0]),Math.max(c[1],d[1])];
  if (!overlaps(ab,cd)) return false;
  const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  return cross(a,b,c)*cross(a,b,d)<=0 && cross(c,d,a)*cross(c,d,b)<=0;
}
function intersectsRoute(item,lines) {
  for (const line of lines) {
    const lineBox=boundsOf([line]);
    if (!overlaps(item.box,lineBox)) continue;
    for (const p of line) if (inside(item,p)) return true;
    if (!item.rings) item.rings=item.polys.flat().map(ring=>({ring,box:boundsOf([ring])}));
    for (const {ring,box} of item.rings) {
      if (!overlaps(lineBox,box)) continue;
      for (let i=1;i<line.length;i++) {
        const a=line[i-1],b=line[i];
        const segment=[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])];
        if (!overlaps(segment,box)) continue;
        for (let j=1;j<ring.length;j++) if (segmentTouches(a,b,ring[j-1],ring[j])) return true;
      }
    }
  }
  return false;
}
function showAreaChoices(river,container) {
  if (container.childElementCount) return;
  const status=node('div',null,'area-results');
  for (const [type,label] of Object.entries(areaNames)) {
    container.append(makeButton(label,'item-button',()=>showAreaMatches(river,type,status)));
  }
  container.append(node('p','Calcul effectué sur le parcours affiché et les périmètres simplifiés.','note'),status);
}
async function showAreaMatches(river,type,container) {
  const token=Symbol();
  container.dataset.request=type;
  container.request=token;
  container.replaceChildren(node('p','Recherche des recouvrements…','note'));
  try {
    await getLayers(type==='protected'?'protected':'aquifers');
    await new Promise(resolve=>setTimeout(resolve,0));
    if (!container.isConnected || container.request!==token) return;
    const route=currentRoute(river);
    const lines=route?.full?[route.full]:river.p;
    const box=boundsOf(lines);
    const cache=routeAreaCache.get(river)||new Map();
    routeAreaCache.set(river,cache);
    const key=type+(route?.local?'pilot':route?'curated':'geometry');
    if (!cache.has(key)) {
      const areas=type==='protected'?EX.protected:EX.aquifers;
      cache.set(key,areas.filter(item=>overlaps(item.box,box)&&intersectsRoute(item,lines)));
    }
    const matches=cache.get(key);
    container.replaceChildren(node('h4',areaNames[type]+' · '+matches.length));
    if (!matches.length) container.append(node('p','Aucun recouvrement dans les périmètres de l’atlas.','note'));
    const list=node('div',null,'compact-list');
    for (const item of matches) {
      const button=makeButton('','compare-row',()=>{
        highlightedArea={item,type};
        $('#'+areaLayers[type]).checked=true;
        if (type==='protected'&&!protectedInFilter(item)) $('#protectedFilter').value='all';
        $('#protectedControls').hidden=!$('#protectedLayer').checked;
        frameBounds(item.box);
        showFeature({type,item});invalidate();
      });
      button.append(node('strong',item.n));
      if (item.label) button.append(node('span',item.label));
      list.append(button);
    }
    container.append(list);
  } catch {
    if (container.request===token) container.replaceChildren(makeButton('Réessayer','text-button',()=>showAreaMatches(river,type,container)));
  }
}

function clearSearch() {
  searchGeneration++;
  $('#search').value='';$('#results').replaceChildren();$('#results').hidden=true;searchIndex=-1;
}
function getCommunes() {
  if (communeItems) return Promise.resolve(communeItems);
  if (!communeLoading) communeLoading=loadDataset('communes','communes-data.js','COMMUNES').then(records=>{
    communeItems=records.map(([code,name,lon,lat,departmentCode])=>{
      const department=departmentById.get(departmentCode);
      return department ? {code,name,department,departmentCode,point:project(lon,lat),key:normalize(name)} : null;
    }).filter(Boolean);
    return communeItems;
  }).catch(error=>{communeLoading=null;throw error;});
  return communeLoading;
}
function communeSearch(query) {
  const matches=[];
  for (const item of communeItems) {
    const rank=item.key===query?0:item.key.startsWith(query)?1:item.code.startsWith(query)?2:item.key.includes(query)?3:-1;
    if (rank>=0) matches.push({rank,item});
  }
  matches.sort((a,b)=>a.rank-b.rank||a.item.name.localeCompare(b.item.name,'fr')||a.item.code.localeCompare(b.item.code));
  return matches.slice(0,8).map(({item})=>({type:'commune',item,name:item.name,
    meta:'Commune · '+item.department.name+' ('+item.departmentCode+') · '+item.code}));
}
function renderSearchResults(holder,results,message='') {
  searchResults=results;
  holder.replaceChildren();
  if (!results.length && !message) holder.append(node('p','Aucun résultat pour « '+$('#search').value+' ».','note'));
  for (const result of results) {
    const button=makeButton('','result',()=>openSearchResult(result));
    button.append(node('strong',result.name),node('span',result.meta));
    holder.append(button);
  }
  if (message) {
    const status=node('p',message,'note');
    status.setAttribute('role','status');
    holder.append(status);
  }
  holder.hidden=false;
}
function renderSearch() {
  const input=$('#search'), holder=$('#results'), query=normalize(input.value);
  const generation=++searchGeneration;
  searchIndex=-1; holder.replaceChildren();holder.hidden=!query||query.length<2;
  if (holder.hidden) return;
  const exact = r=>r.key===query ? 0 : r.key.startsWith(query) ? 1 : 2;
  const rivers=D.rivers.filter(r=>r.key.includes(query)&&r.n!=='Cours d’eau sans nom')
    .sort((a,b)=>exact(a)-exact(b)||b.l-a.l).slice(0,9)
    .map(item=>({type:'river',item,name:displayName(item.n),meta:(basinById.get(item.b)?.name||'')+' · '+labelLength(item)}));
  const admin=departments.filter(d=>[d.name,d.chief,d.code].some(name=>normalize(name).startsWith(query))).slice(0,6)
    .map(item=>({type:'department',item,name:item.chief,meta:'Chef-lieu · '+item.name+' ('+item.code+')'}));
  const regions=geography?.regions.filter(r=>normalize(r.name).includes(query))
    .map(item=>({type:'region',item,name:item.name,meta:'Région administrative'})) || [];
  const existing=[...rivers,...admin,...regions,...observationSearch(query)];
  if (communeItems) {
    renderSearchResults(holder,[...rivers,...communeSearch(query),...admin,...regions,...observationSearch(query)]);
    return;
  }
  renderSearchResults(holder,existing,'Recherche des communes…');
  getCommunes().then(()=>{
    if (generation!==searchGeneration||normalize(input.value)!==query) return;
    renderSearchResults(holder,[...rivers,...communeSearch(query),...admin,...regions,...observationSearch(query)]);
  }).catch(()=>{
    if (generation!==searchGeneration||normalize(input.value)!==query) return;
    renderSearchResults(holder,existing,existing.length?'La recherche des communes est indisponible.':'La recherche des communes est indisponible; les cours d’eau restent recherchables.');
  });
}
function openSearchResult(result) {
  if (result.type==='river') chooseRiver(result.item,{focus:true,scope:true});
  else if (observationLayers[result.type]) {
    clearSearch();focusPoint(result.item.point,8);showObservationFeature(result.type,result.item);
  } else if (result.type==='commune') {
    clearSearch();focusPoint(result.item.point,8,result.item.name);showFeature({type:'commune',item:result.item});
  } else selectTerritory(result.item,result.type,{focus:true,reveal:true});
}
function searchKey(event) {
  if (event.key==='Escape') {clearSearch();return;}
  const buttons=[...$('#results').querySelectorAll('button')];
  if ($('#results').hidden||!buttons.length) return;
  if (event.key==='Enter') {event.preventDefault();buttons[Math.max(0,searchIndex)].click();}
  if (!['ArrowDown','ArrowUp'].includes(event.key)) return;
  event.preventDefault();
  searchIndex=searchIndex<0 ? (event.key==='ArrowDown'?0:buttons.length-1)
    : (searchIndex + (event.key==='ArrowDown'?1:buttons.length-1))%buttons.length;
  buttons.forEach((button,index)=>button.classList.toggle('active',searchIndex===index));
  buttons[searchIndex].scrollIntoView({block:'nearest'});
}

function hitLabel({type,item}) {
  if (observationLayers[type]) return item.n+' · '+observationLayers[type].label;
  if (waterTransportLayers[type]) return item.n === waterTransportLayers[type].label
    ? item.n : item.n + ' · ' + waterTransportLayers[type].label;
  if(type==='river') return displayName(item.n);
  if(type==='cluster') return item.items.length+' ouvrages hydroélectriques';
  if(type==='flow') return item.n+' · '+discharge.format(item.q)+' m³/s';
  if(type==='department') return item.name+' · Département '+item.code;
  if(type==='region') return item.name+' · Région';
  return item.n;
}
function closeChoices() { $('#mapChoices').hidden=true; }
function inspectMapClick(x,y) {
  const hits=clickOptions(x,y);
  if (!hits.length) {
    if ($('#watersheds').checked) showWatershed(world(x,y));
    return;
  }
  if (hits.length===1 && !$('#watersheds').checked) {openHit(hits[0]);return;}
  const choices=$('#mapChoices');
  choices.replaceChildren(node('h3','À cet endroit'));
  const close=makeButton('×','close-button',closeChoices);
  close.setAttribute('aria-label','Fermer les objets de la carte');
  choices.append(close);
  if ($('#watersheds').checked) choices.append(makeButton('Voir le bassin versant topographique','item-button',()=>{
    closeChoices();showWatershed(world(x,y));
  }));
  for (const hit of hits) {
    choices.append(makeButton(hitLabel(hit),'item-button',()=>{closeChoices();openHit(hit);}));
  }
  choices.style.left=Math.max(8,Math.min(x+12,w-270))+'px';
  choices.style.top=Math.max(8,Math.min(y+8,h-225))+'px';
  choices.hidden=false;
  choices.querySelector('.item-button')?.focus({preventScroll:true});
}
function openHit(hit) {
  const {type,item}=hit;
  if (type==='river') chooseRiver(item);
  else if (type==='department' || type==='region') {
    if (selected) showFeature(hit);
    else selectTerritory(item,type,{reveal:true});
  } else if (type==='cluster') {
    const container=$('#featureDetail');
    container.dataset.kind='cluster';
    featureHeader(container,'dam',item.items.length+' ouvrages à cet endroit');
    const list=node('div',null,'compact-list');
    for (const entry of item.items) list.append(makeButton(entry.n,'item-button',()=>showFeature({type:'dam',item:entry})));
    container.append(node('p','Choisissez un ouvrage pour afficher son détail.','note'),list);
    container.hidden=false;revealFeatureDetail();
  } else showFeature(hit);
}
function featureList(fields) {
  const list=node('dl');
  for (const [label,value] of fields) {
    if (value===undefined||value===null||value==='') continue;
    list.append(node('dt',label),node('dd',String(value)));
  }
  return list;
}
function featureLayerLabel(type) {
  const labels={withdrawals:'Prélèvements par usage',quality:'Qualité des rivières',drought:'Écoulements et assecs',
    captage:'Captages d’eau potable',farm:'Élevages recensés (ICPE)',industry:'Sites industriels et Seveso',
    flow:'Stations et débits',dam:'Ouvrages hydroélectriques',nuclear:'Centrales nucléaires',
    protected:'Zones protégées',aquifer:'Nappes captives',watershed:'Sous-bassins topographiques',
    commune:'Commune recherchée',department:'Limites départementales',region:'Limites régionales'};
  return labels[type] || waterTransportLayers[type]?.label || observationLayers[type]?.label || 'Donnée cartographique';
}
function closeFeatureDetail() {
  const container=$('#featureDetail');
  container.hidden=true;highlightedArea=null;invalidate();
  $('#map').focus({preventScroll:true});
}
function revealFeatureDetail() {
  const container=$('#featureDetail');
  if (container.hidden) return;
  if (window.matchMedia('(min-width: 761px)').matches) $('#details').scrollTop=0;
  container.querySelector('h3')?.focus({preventScroll:true});
}
function featureHeader(container,type,title) {
  const heading=node('h3',title);heading.tabIndex=-1;
  const close=makeButton('×','close-button',closeFeatureDetail);
  close.setAttribute('aria-label','Fermer cette fiche et revenir à la carte');
  container.replaceChildren(node('p',featureLayerLabel(type),'feature-layer-label'),heading,close);
}
function appendFeatureFacts(container,fields,supplementary=[],note='',summary='Informations complémentaires') {
  const main=fields.slice(0,3),extra=fields.slice(3);
  if (main.length) container.append(featureList(main));
  if (note) container.append(node('p',note,'note'));
  if (extra.length||supplementary.length) {
    const details=node('details',null,'feature-more');
    details.append(node('summary',summary));
    if (extra.length) details.append(featureList(extra));
    details.append(...supplementary);
    container.append(details);
  }
}
function showFeature({type,item}) {
  if (['withdrawals','quality','drought'].includes(type)) { showObservationFeature(type,item); return; }
  const container=$('#featureDetail');
  container.dataset.kind=type;
  featureHeader(container,type,type==='department'||type==='region'||type==='commune'?item.name:item.n);
  let fields=[],note='';
  const supplementary=[],actions=[];
  if (type==='lakes') {
    fields=[['Surface',number.format(item.hectares)+' ha'],['Source','BD TOPAGE® 2026']];
  } else if (type==='industry') {
    const classification = ['', 'Seveso seuil bas', 'Seveso seuil haut'][item.seuil];
    fields=[['Classement',classification||'Non précisé'],['Commune',item.commune],['Identifiant AIOT',item.id],
      ['Régime déclaré par la source',item.regime],['Source','Géorisques']];
    note='Le classement décrit l’installation. Il ne délimite pas une zone d’exposition.';
  } else if (type==='wastewater') {
    fields=[['Identifiant Sandre',item.id],
      ['Capacité nominale',item.capacity == null ? 'Non renseignée' : number.format(item.capacity)+' EH'],
      ['Source','Base Eaux résiduaires urbaines · 2024']];
    note='EH signifie équivalent-habitant, une unité de dimensionnement du traitement.';
  } else if (type==='captage') {
    fields=[['Commune',item.commune],['Identifiant Sandre',item.id],['Source','Référentiel des ouvrages de prélèvement · 2026']];
    note='L’usage déclaré est AEP ou domestique. Le référentiel localise les ouvrages recensés, pas leur débit actuel.';
  } else if (type==='farm') {
    fields=[['Commune',item.commune],['Types recensés',item.types.join(', ')],['Identifiant AIOT',item.id],['Source','Géorisques · ICPE']];
    note='Inventaire des élevages classés ICPE, pas de tous les élevages français.';
  } else if (type==='navigation' || type==='locks') {
    fields=[['Type',waterTransportLayers[type].label],['Identifiant ROE',item.id],
      ['Source',type==='navigation'?'BD CARTO® · IGN':'Référentiel des obstacles à l’écoulement · Sandre']];
    note='Données de repérage. Consultez VNF Navi pour les conditions de navigation.';
  } else if (type==='flow') {
    fields=[['Débit observé',discharge.format(item.q)+' m³/s'],['Cours d’eau',item.river],
      ['Date et heure à Paris',new Date(item.date).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Paris'})],
      ['Qualification',item.qualification||'Non précisée'],['Statut',item.status],['Code station',item.station||item.site]];
  } else if (type==='dam') {
    fields=[['Type','Obstacle à usage hydroélectrique'],['Cours d’eau',item.river],['Commune',item.commune],
      ['Identifiant ROE',item.id],['Hauteur de chute',item.height?item.height+' m':'Non renseignée']];
  } else if (type==='nuclear') {
    fields=[['Commune',item.commune],['Réacteurs recensés',item.reactors],
      ['Puissance installée',number.format(item.mw)+' MW'],['Source','Registre EDF']];
  } else if (type==='protected') {
    fields=[['Catégorie',item.label],['Identifiant INPN',item.id]];
  } else if (type==='aquifer') {
    fields=[['Identifiant BD LISA',item.id],['Niveau',item.level]];
    note='Le recouvrement cartographique ne suffit pas à établir un échange d’eau.';
  } else if (type==='department'||type==='region') {
    fields=type==='department'?[['Département',item.code],['Chef-lieu',item.chief]]:[['Type','Région administrative']];
  } else if (type==='commune') {
    fields=[['Département',item.department.name+' ('+item.departmentCode+')'],['Code INSEE',item.code],['Repère','Mairie de la commune']];
    note='Seule la commune recherchée est repérée. Ses limites et celles des autres communes ne sont pas dessinées.';
  } else if (type==='watershed') {
    fields=[['Référentiel','BD TOPAGE® 2026 · Sandre'],['Identifiant',item.id],['Exutoire',item.outlet]];
    note='Périmètre qui contient le point choisi.';
  }
  if (item.link) fields.push(['Association au réseau',associationLabel(item)]);
  if (item.url && /^https:\/\//.test(item.url)) supplementary.push(textLink('Voir la fiche INPN',item.url));
  if (type==='commune') supplementary.push(textLink('Fiche de la commune · API officielle','https://geo.api.gouv.fr/communes/'+encodeURIComponent(item.code)));
  if (type==='industry'||type==='farm') supplementary.push(textLink('Voir la fiche Géorisques','https://www.georisques.gouv.fr/risques/installations/donnees/details/'+encodeURIComponent(item.id)));
  if (type==='flow' && item.station) supplementary.push(textLink('Voir la station sur HydroPortail','https://www.hydro.eaufrance.fr/stationhydro/'+encodeURIComponent(item.station||item.site)+'/fiche'));
  if (item.point) actions.push(makeButton('Localiser cet élément','text-button',()=>focusPoint(item.point,8,type==='commune'?item.name:'')));
  if (type==='watershed') actions.push(makeButton('Cadrer le bassin versant','text-button',()=>frameBounds(item.box)));
  if (type==='department'||type==='region') actions.push(makeButton('Voir les bassins en commun','text-button',()=>selectTerritory(item,type,{focus:true,reveal:true})));
  if (item.link && selected?.id!==item.link[0]) {
    const river=riverById.get(item.link[0]);
    if (river) actions.push(makeButton('Explorer '+displayName(river.n),'text-button',()=>chooseRiver(river,{focus:true})));
  }
  appendFeatureFacts(container,fields,supplementary,note);
  if (actions.length) {const row=node('div',null,'feature-actions');row.append(...actions);container.append(row);}
  container.hidden=false;
  revealFeatureDetail();
}

function updateLegend() {
  const holder=$('#layerInfo'), descriptors=[];
  if ($('#departments').checked) descriptors.push(['department','Départements']);
  if ($('#regions').checked) descriptors.push(['region','Régions']);
  if ($('#hydroDams').checked) descriptors.push(['dam','Ouvrages hydroélectriques']);
  if ($('#nuclearPlants').checked) descriptors.push(['nuclear','Centrales nucléaires']);
  if ($('#protectedLayer').checked) descriptors.push(['protected',loadedLayers.has('protected')?'Zones protégées':'Chargement des zones protégées…']);
  if ($('#aquiferLayer').checked) descriptors.push(['aquifer',loadedLayers.has('aquifers')?'Nappes captives':'Chargement des nappes captives…']);
  if ($('#watersheds').checked) descriptors.push(['watershed',localWatershed?'Sous-bassin sélectionné':'Limites des sous-bassins']);
  if ($('#flowsLayer').checked) {
    const scope=$('#flowScope').value;
    const text=scope==='view'?'vue actuelle':scope==='auto'&&basin?basinById.get(basin).name:'France métropolitaine';
    descriptors.push(['flow',loadedLayers.has('points') ? number.format(flowPoints.length)+' stations · '+text+' · 26 oct. 2026' : 'Chargement des stations…']);
  }
  const key=JSON.stringify(descriptors);
  if (holder.dataset.key===key) return;
  holder.dataset.key=key;holder.hidden=!descriptors.length;holder.replaceChildren();
  for (const [type,label] of descriptors) {
    const item=node('span',null,'legend-item');
    item.append(node('i',null,'legend-swatch '+type),document.createTextNode(label));holder.append(item);
  }
}
function basemapAttribution(style) {
  const holder=$('#mapAttribution');
  holder.hidden=style==='none';holder.replaceChildren();
  if(style==='ign') holder.append(textLink('© IGN · Géoportail','https://geoservices.ign.fr/'));
  else if(style==='positron') holder.append(textLink('OpenFreeMap','https://openfreemap.org/'),document.createTextNode(' · '),
    textLink('© OpenMapTiles','https://openmaptiles.org/'),document.createTextNode(' · '),
    textLink('© OpenStreetMap','https://www.openstreetmap.org/copyright'));
  else if(style.startsWith('osm')) holder.append(textLink('© OpenStreetMap','https://www.openstreetmap.org/copyright'));
}
function stopPositron() {
  vectorRun++;
  vectorMap?.remove();
  vectorMap=null;vectorReady=false;vectorKey='';
  $('#vectorMap').hidden=true;
}
function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (vectorScript) return vectorScript;
  vectorScript=new Promise((resolve,reject)=>{
    const script=node('script');
    script.src='https://cdn.jsdelivr.net/npm/maplibre-gl@5.12.0/dist/maplibre-gl.js';
    script.onload=()=>window.maplibregl?resolve(window.maplibregl):reject(new Error('MapLibre indisponible'));
    script.onerror=()=>{script.remove();reject(new Error('MapLibre indisponible'));};
    document.head.append(script);
  }).catch(error=>{vectorScript=null;throw error;});
  return vectorScript;
}
function syncPositron() {
  if (!vectorMap) return;
  const identifier=[w,h,scale,zoom,tx,ty].join(',');
  if (vectorKey===identifier) return;
  vectorKey=identifier;
  vectorMap.resize();
  vectorMap.jumpTo({center:unproject(world(w/2,h/2)),zoom:Math.log2(scale*zoom*72*360/512)});
}
async function setBasemap() {
  const style=$('#basemap').value, status=$('#basemapStatus');
  stopPositron();basemapAttribution(style);status.hidden=true;
  invalidate();
  if (style!=='positron') return;
  const run=vectorRun;
  status.textContent='Chargement de Positron…';status.hidden=false;
  function fallback() {
    if(run!==vectorRun || vectorReady) return;
    stopPositron();$('#basemap').value='none';basemapAttribution('none');
    status.textContent='Positron est indisponible sur cet appareil ou cette connexion. Le fond blanc est affiché.';
    status.hidden=false;invalidate();
  }
  try {
    const [lib, response]=await Promise.all([loadMapLibre(),fetch('https://tiles.openfreemap.org/styles/positron')]);
    if (!response.ok) throw new Error('Style Positron indisponible');
    const mapStyle=await response.json();
    for (const layer of mapStyle.layers) {
      const layout=layer.layout;
      if (layout && JSON.stringify(layout['text-field'] || '').includes('name_en')) {
        layout['text-field']=['coalesce',['get','name:fr'],['get','name_fr'],['get','name'],['get','name_en']];
      }
      if (layer.id==='waterway_line_label') layout.visibility='none';
    }
    if (run!==vectorRun) return;
    const container=$('#vectorMap');
    container.hidden=false;
    vectorMap=new lib.Map({container,style:mapStyle,
      center:unproject(world(w/2,h/2)),zoom:Math.log2(scale*zoom*72*360/512),
      minZoom:0,maxZoom:20,interactive:false,attributionControl:false,renderWorldCopies:false,
      trackResize:false,fadeDuration:0,pixelRatio:Math.min(devicePixelRatio||1,1.5),canvasContextAttributes:{powerPreference:'low-power'}});
    vectorMap.once('load',()=>{
      if (run!==vectorRun) return;
      vectorReady=true;status.hidden=true;invalidate();
    });
    vectorMap.on('error',event=>{
      if (event.error?.status===401 || event.error?.status===403) fallback();
    });
    setTimeout(fallback,14000);
    syncPositron();
  } catch { fallback(); }
}

function initExplorer() {
  basinButtons();renderDetail();
  const search=$('#search');
  search.addEventListener('input',()=>{
    renderSearch();
    if (!geography && normalize(search.value).length>=2) {
      const query=search.value;
      getGeography().then(()=>{if(search.value===query)renderSearch();}).catch(()=>{});
    }
  });
  search.addEventListener('keydown',searchKey);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeChoices();});
  document.addEventListener('pointerdown',event=>{
    if (!event.target.closest('.search-panel')) {searchGeneration++;$('#results').hidden=true;}
    if (!event.target.closest('#mapbox')) closeChoices();
  });
  search.addEventListener('focus',()=>{if(search.value.length>=2)renderSearch();});
  for (const id of ['areas','basinBoundaries','departments','cities','prefectures','flowFilter','flowScope','protectedFilter']) {
    $('#'+id).addEventListener('change',invalidate);
  }
  $('#regions').addEventListener('change',()=>{
    if ($('#regions').checked) getGeography().catch(()=>{
      $('#regions').checked=false;
      const holder=$('#basemapStatus');holder.textContent='Les contours régionaux n’ont pas pu être chargés.';holder.hidden=false;
    });
    invalidate();
  });
  $('#basemap').addEventListener('change',setBasemap);
  setBasemap();
  for (const id of ['hydroDams','nuclearPlants','flowsLayer','protectedLayer','aquiferLayer']) {
    const input=$('#'+id);
    input.addEventListener('change',()=>{
      if (id==='flowsLayer') $('#flowControls').hidden=!input.checked;
      if (id==='protectedLayer') $('#protectedControls').hidden=!input.checked;
      if (!input.checked && areaLayers[highlightedArea?.type]===id) highlightedArea=null;
      if (!input.checked && EX && ['protectedLayer','aquiferLayer'].includes(id)) {
        const group=id==='protectedLayer'?EX.protected:EX.aquifers;
        for (const item of group) {delete item.path;delete item.rings;}
      }
      if(input.checked) getLayers(datasetFor[id]).catch(()=>{
        input.checked=false;
        if (id==='flowsLayer') $('#flowControls').hidden=true;
        if (id==='protectedLayer') $('#protectedControls').hidden=true;
        const holder=$('#featureDetail');
        holder.replaceChildren(node('p','La couche n’a pas pu être chargée. Activez-la de nouveau pour réessayer.','note'));
        holder.hidden=false;invalidate();
      });
      invalidate();
    });
  }
  $('#density').addEventListener('input',()=>{
    $('#densityLabel').value=['Principal','Progressif','Détaillé','Très fin'][+$('#density').value];
    invalidate();
  });
  function playbackLabel() {
    $('#play').textContent=playing?'Pause':'Animer l’eau';
    $('#play').setAttribute('aria-pressed',String(playing));
  }
  playbackLabel();
  $('#play').onclick=()=>{playing=!playing;lastFrame=0;playbackLabel();invalidate();};
  wantsMotion.addEventListener('change',event=>{if(event.matches&&playing){playing=false;playbackLabel();invalidate();}});
  $('#speed').onchange=()=>{speed=+$('#speed').value;};
  $('#plus').onclick=()=>zoomAt(1.4);
  $('#minus').onclick=()=>zoomAt(1/1.4);
  $('#reset').onclick=resetMap;
  const panToggle=$('#panToggle'), panTools=$('#mapPanTools');
  panToggle.addEventListener('click',()=>{
    const expanded=panToggle.getAttribute('aria-expanded')==='true';
    panToggle.setAttribute('aria-expanded',String(!expanded));
    panTools.hidden=expanded;
    panToggle.setAttribute('aria-label',expanded?'Afficher les commandes de déplacement':'Masquer les commandes de déplacement');
  });
  const panControls=[['panNorth',0,1],['panEast',-1,0],['panSouth',0,-1],['panWest',1,0]];
  for (const [id,dx,dy] of panControls) $('#'+id).addEventListener('click',()=>{
    const step=Math.max(45,Math.round(Math.min(220,(dx?w:h)*.28)));
    panMap(dx*step,dy*step);
    closeChoices();invalidate();
  });
  $('#clear').onclick=clearSelection;
  $('#about').onclick=()=>$('#sources').showModal();
  $('#closeDialog').onclick=()=>$('#sources').close();
}
