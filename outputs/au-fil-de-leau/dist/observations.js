'use strict';

const observationLayers = {
  withdrawals:{label:'Prélèvements',shape:'circle',color:'#235e9b'},
  quality:{label:'Qualité',shape:'square',color:'#72559c'},
  drought:{label:'Écoulements',shape:'triangle',color:'#b24c27'}
};
const withdrawalUsages = {
  AEP:'Eau potable', IRR:'Irrigation', IND:'Industrie et activités économiques',
  ENE:'Énergie', CAN:'Canaux', AUT:'Autres usages', EXO:'Usage exonéré', BAR:'Eau turbinée (barrage)', NR:'Usage non renseigné'
};
const droughtStates = {
  '1':{label:'Écoulement visible',color:'#267b6b'},
  '1a':{label:'Écoulement visible acceptable',color:'#267b6b'},
  '1f':{label:'Écoulement visible faible',color:'#a47c20'},
  '2':{label:'Écoulement non visible',color:'#cb6b23'},
  '3':{label:'Assec',color:'#9c3248'},
  '4':{label:'Observation impossible',color:'#637480'},
  'None':{label:'État non renseigné',color:'#637480'}
};
const qualityScales = {
  '1340':{limits:[10,25,50], colors:['#d3c3e5','#b292ca','#8856a7','#55266f'], unit:'mg(NO3)/L'},
  '1433':{limits:[.1,.5,1], colors:['#d3c3e5','#b292ca','#8856a7','#55266f'], unit:'mg(PO4)/L'},
  '1311':{limits:[4,6,8], colors:['#d3c3e5','#b292ca','#8856a7','#55266f'], unit:'mg(O2)/L'}
};
const observationFilters = {
  withdrawals:['withdrawalYear','withdrawalUsage','withdrawalMinimum'],
  quality:['qualityParameter','qualityMonth'],
  drought:['droughtMonth','droughtState']
};
let observationHitPoints = [];

function withdrawalInUsage(code,usage) {
  return usage==='all' ? code!=='BAR' : code===usage;
}

function observationSelection(key) {
  const layer = observationLayers[key];
  const filter = observationFilters[key].map(id=>$('#'+id).value);
  const cacheKey = JSON.stringify(filter);
  if (layer.selectionKey===cacheKey) return layer.selection;
  let items = [];
  if (key==='withdrawals') {
    const [year,usage,minimum] = filter;
    for (const source of layer.items) {
      const rows = source.rows.filter(row=>row[0]===Number(year) && withdrawalInUsage(row[1],usage));
      if (!rows.length) continue;
      const volume = rows.reduce((sum,row)=>sum+row[2],0);
      if (volume<Number(minimum)) continue;
      items.push({...source,volume,selectedRows:rows,color:layer.color});
    }
  } else {
    const month = key==='quality'?filter[1]:filter[0];
    const parameter = filter[0];
    const state = filter[1];
    for (const source of layer.items) {
      let latest = null;
      for (const row of source.rows) {
        if (!row[0].startsWith(month)) continue;
        if (key==='quality' && row[1]!==parameter) continue;
        if (!latest || row[0]>=latest[0]) latest = row;
      }
      if (!latest) continue;
      if (key==='drought') {
        if (state==='dry' && !['2','3'].includes(latest[1])) continue;
        if (state==='3' && latest[1]!=='3') continue;
      }
      let sameDayCount=1;
      if (key==='quality') {
        const sameDay=source.rows.filter(row=>row[0]===latest[0] && row[1]===parameter && row[4]===latest[4]);
        const comparable=sameDay.filter(row=>row[3]==='1' && !/incorrect/i.test(row[5]||''));
        sameDayCount=sameDay.length;
        if (comparable.length) {
          const values=comparable.map(row=>row[2]).sort((a,b)=>a-b),middle=Math.floor(values.length/2);
          const median=values.length%2 ? values[middle] : (values[middle-1]+values[middle])/2;
          latest=[...comparable[0]];latest[2]=median;
        }
      }
      items.push({...source,latest,sameDayCount,color:key==='drought' ? droughtStates[latest[1]]?.color || '#637480' : qualityColor(latest)});
    }
  }
  const grid = new Map();
  for (const item of items) cellsFor(item.box,cell=>{
    if (!grid.has(cell)) grid.set(cell,[]);
    grid.get(cell).push(item);
  });
  layer.selectionKey=cacheKey;
  layer.selection={items,grid};
  return layer.selection;
}

function qualityColor(row) {
  if (row[3]!=='1' || /incorrect/i.test(row[5]||'') || row[4]!==qualityScales[row[1]].unit) return '#637480';
  const scale = qualityScales[row[1]];
  const index = scale.limits.findIndex(limit=>row[2]<limit);
  return scale.colors[index<0?3:index];
}

function observationSwatch(color,shape) {
  const swatch=node('span',null,'observation-swatch');
  swatch.style.setProperty('--symbol-color',color);
  swatch.dataset.shape=shape;
  swatch.setAttribute('aria-hidden','true');
  return swatch;
}

function observationKeyItem(label,color,shape) {
  const item=node('span',null,'observation-key-item');
  item.append(observationSwatch(color,shape),document.createTextNode(label));
  return item;
}

function updateObservationKeys() {
  const quality = $('#qualityLegend');
  const parameter = $('#qualityParameter').value;
  const scale = qualityScales[parameter];
  const limits = [0,...scale.limits];
  quality.replaceChildren(...scale.colors.map((color,index)=>{
    const label = index===3 ? number.format(limits[index])+' et plus' :
      number.format(limits[index])+' à < '+number.format(limits[index+1]);
    return observationKeyItem(label+' '+scale.unit,color,'square');
  }),node('p','Classes de concentration, sans qualification de l’état écologique. Carré gris pour une limite analytique ou une valeur non comparable.','note'));
  $('#droughtLegend').replaceChildren(...Object.entries(droughtStates).filter(([key])=>key!=='1a')
    .map(([,state])=>observationKeyItem(state.label,state.color,'triangle')));
  const summary = $('#observationKey'), keys=[];
  for (const [key,layer] of Object.entries(observationLayers)) {
    if (!$('#water-'+key).checked) continue;
    if (key==='withdrawals') keys.push(observationKeyItem('Prélèvements · '+$('#withdrawalYear').value+' · m³/an',layer.color,'circle'));
    if (key==='quality') keys.push(observationKeyItem($('#qualityParameter').selectedOptions[0].text+' · '+$('#qualityMonth').value,layer.color,'square'));
    if (key==='drought') keys.push(observationKeyItem('Écoulements et assecs · '+$('#droughtMonth').value,layer.color,'triangle'));
  }
  summary.replaceChildren(...keys);
}

function initObservationOptions(key,data) {
  const selectOptions=(selector,values,current)=>{
    const select=$(selector);
    select.replaceChildren(...values.map(([value,label])=>{
      const option=node('option',label);option.value=value;return option;
    }));
    select.value=current;
  };
  if (key==='withdrawals') {
    const usageCodes=[...new Set(data.records.flatMap(row=>row[4].map(r=>r[1]||'NR')))].sort();
    selectOptions('#withdrawalYear',data.years.map(year=>[String(year),String(year)]),String(Math.max(...data.years)));
    const usageSelect=$('#withdrawalUsage');
    usageSelect.replaceChildren(node('option','Tous usages hors eau turbinée'));
    usageSelect.options[0].value='all';
    for (const code of usageCodes) {
      const option=node('option',withdrawalUsages[code]||code);option.value=code;usageSelect.append(option);
    }
  } else {
    const months=[...new Set(data.records.flatMap(record=>record[key==='quality'?3:5].map(row=>row[0].slice(0,7))))].sort().reverse();
    const options=months.map(month=>[month,new Date(month+'-01T12:00:00Z').toLocaleDateString('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'})]);
    if (key==='quality') {
      const years=[...data.years].sort().reverse();
      options.unshift(...years.map(year=>[String(year),'Année '+year]));
    }
    let initial=options[0][0];
    if (key==='drought') {
      const counts=new Map();
      for (const record of data.records) {
        for (const month of new Set(record[5].map(row=>row[0].slice(0,7)))) counts.set(month,(counts.get(month)||0)+1);
      }
      const representative=Math.max(...counts.values())*.5;
      initial=months.find(month=>counts.get(month)>=representative)||initial;
    }
    selectOptions(key==='quality'?'#qualityMonth':'#droughtMonth',options,initial);
  }
}

async function loadObservationLayer(key) {
  const layer=observationLayers[key];
  if (layer.data) return;
  if (layer.loading) return layer.loading;
  const status=$('#'+key+'Status');
  status.textContent='Chargement…';
  layer.loading=loadDataset(key,key+'-data.js','WATER_'+key.toUpperCase()).then(data=>{
    if (!data?.records?.length) throw new Error('Données absentes');
    if (data.encoding===1) {
      for (const record of data.records) {
        if (key==='withdrawals') for (const row of record[4]) {
          row[3]=data.qualifications[row[3]];
          row[4]=data.instructions[row[4]];
        }
        if (key==='quality') for (const row of record[3]) {
          row[4]=data.units[row[4]];
          row[5]=data.qualifications[row[5]];
        }
        if (key==='drought') for (const row of record[5]) row[2]=data.states[row[1]] || 'État non renseigné';
      }
      data.encoding=0;
    }
    if (key==='withdrawals') for (const record of data.records) {
      for (const row of record[4]) row[1]=row[1]||'NR';
    }
    if (key==='quality') for (const record of data.records) {
      for (const row of record[3]) if (row[4]==='mg/L') row[4]=qualityScales[row[1]].unit;
    }
    layer.data=data;
    layer.items=data.records.map(record=>{
      const [id,n,coordinate]=record,point=project(...coordinate);
      if (key==='withdrawals') return {id,n,point,box:[...point,...point],commune:record[3],rows:record[4]};
      if (key==='quality') return {id,n,point,box:[...point,...point],rows:record[3]};
      return {id,n,point,box:[...point,...point],commune:record[3],river:record[4],rows:record[5]};
    });
    initObservationOptions(key,data);
    for (const id of observationFilters[key]) {
      const input=$('#'+id), pending=input.dataset.pendingValue;
      if (pending!==undefined) {
        if ([...input.options].some(option=>option.value===pending)) input.value=pending;
        delete input.dataset.pendingValue;
      }
    }
    status.textContent=number.format(layer.items.length)+' sites';
    updateObservationKeys();
    invalidate();
  }).catch(()=>{
    $('#water-'+key).checked=false;
    $('#'+key+'Options').hidden=true;
    status.textContent='Indisponible · réactivez pour réessayer';
    layer.data=null;
    updateObservationKeys();
    invalidate();
  }).finally(()=>{layer.loading=null;});
  return layer.loading;
}

function syncRiverVisibility() {
  const value=$('#riverOpacity').value;
  $('#riverOpacityLabel').value=value==='0'?'Masqués':value+' %';
  for (const button of document.querySelectorAll('[data-river-opacity]')) {
    button.setAttribute('aria-pressed',String(button.dataset.riverOpacity===value));
  }
  invalidate();
}

function initObservations() {
  $('#riverOpacity').addEventListener('input',syncRiverVisibility);
  $('#riverOpacity').addEventListener('change',syncRiverVisibility);
  for (const button of document.querySelectorAll('[data-river-opacity]')) button.addEventListener('click',()=>{
    $('#riverOpacity').value=button.dataset.riverOpacity;
    syncRiverVisibility();
  });
  for (const key of Object.keys(observationLayers)) {
    $('#water-'+key).addEventListener('change',()=>{
      $('#'+key+'Options').hidden=!$('#water-'+key).checked;
      if ($('#water-'+key).checked) loadObservationLayer(key);
      invalidate();
    });
    for (const id of observationFilters[key]) $('#'+id).addEventListener('change',()=>{
      observationLayers[key].selectionKey=null;
      if ($('#featureDetail').dataset.kind===key) $('#featureDetail').hidden=true;
      updateObservationKeys();
      invalidate();
    });
  }
  updateObservationKeys();
}

function drawObservationSymbol(context,x,y,radius,shape) {
  context.beginPath();
  if (shape==='circle') context.arc(x,y,radius,0,Math.PI*2);
  if (shape==='square') {
    context.moveTo(x-radius,y-radius); context.lineTo(x+radius,y-radius);
    context.lineTo(x+radius,y+radius); context.lineTo(x-radius,y+radius);context.closePath();
  }
  if (shape==='triangle') {
    context.moveTo(x,y-radius-1);context.lineTo(x+radius,y+radius);
    context.lineTo(x-radius,y+radius);context.closePath();
  }
}

function drawObservations(context,box,s) {
  observationHitPoints=[];
  const descriptions=[],active=Object.entries(observationLayers).filter(([key])=>$('#water-'+key).checked);
  const selectedKeys=active.map(([key])=>key).join('/');
  const summary=$('#observationSummary');
  summary.hidden=!active.length;
  for (const [key,layer] of active) {
    if (!layer.items) continue;
    const selection=observationSelection(key);
    const candidates=new Set();
    cellsFor(box,cell=>{for (const item of selection.grid.get(cell)||[]) if (contains(box,item.point)) candidates.add(item);});
    const markers=new Map();
    for (const item of candidates) {
      const [x,y]=screenPoint(item.point),cell=Math.floor(x/22)+':'+Math.floor(y/22);
      const existing=markers.get(cell);
      const priority=key==='withdrawals'?item.volume:key==='drought'?({'3':4,'2':3,'1f':2,'1a':1,'1':1}[item.latest[1]]||0):0;
      if (!existing || priority>existing.priority) markers.set(cell,{item,priority});
    }
    for (const {item} of markers.values()) {
      // A small, fixed separation keeps symbols from different layers inspectable.
      const offset=active.length>1?{withdrawals:-5,quality:0,drought:5}[key]:0;
      const [sx,sy]=screenPoint(item.point),radius=key==='withdrawals'?Math.max(2.5,Math.min(9,Math.sqrt(item.volume/100000))):4.3;
      const x=item.point[0]+offset/s,y=item.point[1];
      context.save();
      context.globalAlpha=key==='withdrawals'?.14:1;
      drawObservationSymbol(context,x,y,radius/s,layer.shape);
      context.fillStyle=item.color;context.fill();
      context.globalAlpha=1;context.strokeStyle='#fff';context.lineWidth=1.25/s;context.stroke();
      if (key==='withdrawals') {context.strokeStyle=item.color;context.lineWidth=.8/s;context.stroke();}
      context.restore();
      observationHitPoints.push({type:key,item,p:[sx+offset,sy],radius:Math.max(8,radius+3)});
    }
    descriptions.push(layer.label+' · '+number.format(markers.size)+' symboles / '+number.format(candidates.size)+' sites dans la vue');
  }
  setText($('#observationCounts'),descriptions.join(' · '));
  if (summary.dataset.key!==selectedKeys) {
    summary.dataset.key=selectedKeys;
    updateObservationKeys();
  }
}

function observationHits(point) {
  return observationHitPoints.filter(hit=>dist2(hit.p,point)<=hit.radius**2)
    .sort((a,b)=>dist2(a.p,point)-dist2(b.p,point)).slice(0,5);
}

function observationTable(headings,rows) {
  const wrap=node('div',null,'observation-table-wrap'),table=node('table',null,'observation-table');
  wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Relevés de la période sélectionnée');
  const caption=node('caption','Relevés de la période sélectionnée');
  const head=node('thead'),tr=node('tr');
  for (const title of headings) {const th=node('th',title);th.scope='col';tr.append(th);}
  head.append(tr);const body=node('tbody');
  for (const row of rows) {const tr=node('tr');for(const value of row)tr.append(node('td',String(value)));body.append(tr);}
  table.append(caption,head,body);wrap.append(table);return wrap;
}

function observationHistory(values,label,unit) {
  const fragment=document.createDocumentFragment();
  if (!values.length) {fragment.append(node('p','Aucune valeur numérique comparable dans la période.','note'));return fragment;}
  const first=Math.min(...values.map(row=>new Date(row[0]).getTime()));
  const last=Math.max(...values.map(row=>new Date(row[0]).getTime()));
  const max=Math.max(...values.map(row=>row[1]),1),min=Math.min(0,...values.map(row=>row[1]));
  const chart=document.createElementNS('http://www.w3.org/2000/svg','svg');
  chart.setAttribute('viewBox','0 0 260 140');chart.setAttribute('role','img');
  chart.setAttribute('aria-label',label+'. '+values.length+' valeurs datées. Détail dans le tableau.');
  chart.classList.add('observation-chart');
  const path=document.createElementNS(chart.namespaceURI,'path');
  const pts=values.map(([date,value])=>[32+(new Date(date).getTime()-first)/Math.max(1,last-first)*216,12+(max-value)/(max-min)*94]);
  path.setAttribute('d',pts.map(([x,y],index)=>(index?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)).join(' '));
  path.setAttribute('fill','none');path.setAttribute('stroke','#72559c');path.setAttribute('stroke-width','1.5');
  chart.append(path);
  for (const [x,y] of pts) {
    const point=document.createElementNS(chart.namespaceURI,'circle');
    point.setAttribute('cx',x);point.setAttribute('cy',y);point.setAttribute('r','2.5');point.setAttribute('fill','#72559c');chart.append(point);
  }
  for (const [text,x,y] of [[number.format(max),0,16],[number.format(min),0,109],[values[0][0],32,130],[values[values.length-1][0],174,130]]) {
    const label=document.createElementNS(chart.namespaceURI,'text');label.textContent=text;label.setAttribute('x',x);label.setAttribute('y',y);label.setAttribute('font-size','10');label.setAttribute('fill','#354252');chart.append(label);
  }
  fragment.append(node('p',label+' · '+unit,'note'),chart);
  return fragment;
}

function showObservationFeature(type,item) {
  const holder=$('#featureDetail');
  holder.dataset.kind=type;featureHeader(holder,type,item.n);
  const date = value=>new Date(value+'T12:00:00Z').toLocaleDateString('fr-FR',{timeZone:'UTC'});
  let fields=[],note='',supplementary=[],summary='Historique et relevés';
  const data=observationLayers[type].data;
  if (type==='withdrawals') {
    const year=$('#withdrawalYear').value,usage=$('#withdrawalUsage').value;
    const usageLabel=usage==='all'?'Usages déclarés':$('#withdrawalUsage').selectedOptions[0]?.text || usage;
    fields=[['Volume annuel',number.format(item.volume)+' m³'],['Année',year],['Usage',usageLabel],
      ['Identifiant',item.id],['Commune',item.commune],['Source','BNPE / Hub’Eau'],['Extraction',data.extracted]];
    note='Volume déclaré à l’ouvrage. La surface des cercles est bornée pour préserver la lisibilité de la carte.';
    summary='Historique annuel et relevés';
    const yearly=data.years.map(y=>[String(y),item.rows.filter(row=>row[0]===y && (usage==='all'||usage===row[1])).reduce((sum,row)=>sum+row[2],0)]);
    // Missing years stay absent from the history instead of being shown as zero.
    const observed=yearly.filter(([y])=>item.rows.some(row=>row[0]===Number(y) && (usage==='all'||usage===row[1])));
    supplementary.push(observationHistory(observed,'Évolution du volume annuel','m³'),
      observationTable(['Année','Usage','Volume m³','Qualification'],item.rows.filter(row=>row[0]===Number(year) && (usage==='all'||usage===row[1])).map(row=>[row[0],withdrawalUsages[row[1]]||row[1],number.format(row[2]),row[3]||'Non renseignée'])));
  } else if(type==='quality') {
    const row=item.latest,parameter=$('#qualityParameter').value,period=$('#qualityMonth').value;
    const label=observationLayers.quality.data.parameters[parameter][0];
    fields=[['Paramètre',label],['Valeur représentée',number.format(row[2])+' '+row[4]],['Dernier jour analysé',date(row[0])],
      ['Commune',item.commune],['Identifiant',item.id],
      ['Analyses ce jour',item.sameDayCount],
      ['Remarque analytique',row[3]==='1'?'Valeur quantifiée':'Résultat assorti d’une limite · code '+row[3]],['Qualification',row[5]||'Non renseignée'],['Source','Naïades / Hub’Eau'],['Extraction',data.extracted]];
    note='La carte représente le dernier jour analysé dans la période. Si plusieurs résultats quantifiés sont disponibles ce jour, leur médiane est utilisée. Les dates varient selon les stations.';
    summary='Historique des analyses et relevés';
    const rows=item.rows.filter(r=>r[1]===parameter && r[0].startsWith(period));
    supplementary.push(observationHistory(rows.filter(row=>row[3]==='1' && !/incorrect/i.test(row[5]||'')).map(row=>[row[0],row[2]]),label,row[4]),
      observationTable(['Date','Résultat','Remarque'],rows.slice().reverse().map(r=>[date(r[0]),number.format(r[2])+' '+r[4],r[3]==='1'?'Quantifié':'Limite · code '+r[3]])));
  } else {
    const row=item.latest,month=$('#droughtMonth').value;
    fields=[['État observé',row[2]],['Date de l’observation',date(row[0])],['Cours d’eau',item.river],
      ['Commune',item.commune],['Identifiant',item.id],['Source','ONDE / OFB via Hub’Eau'],['Extraction',data.extracted]];
    note='Il s’agit de la dernière observation disponible pour cette station dans le mois choisi.';
    summary='Historique des observations';
    supplementary.push(observationTable(['Date','État observé'],item.rows.filter(r=>r[0].startsWith(month)).slice().reverse().map(r=>[date(r[0]),r[2]])));
  }
  appendFeatureFacts(holder,fields,supplementary,note,summary);
  const actions=node('div',null,'feature-actions');
  actions.append(makeButton('Localiser ce site','text-button',()=>focusPoint(item.point,8)),
    textLink('Consulter la source et sa méthode',type==='withdrawals'?'https://www.data.gouv.fr/dataservices/hubeau-prelevements-en-eau':
    type==='quality'?'https://www.data.gouv.fr/dataservices/hubeau-qualite-des-cours-deau':'https://www.data.gouv.fr/dataservices/hubeau-ecoulement-des-cours-deau'));
  holder.append(actions);holder.hidden=false;revealFeatureDetail();
}

function observationPeriodLabel(key) {
  if (key==='withdrawals') return 'Prélèvements · '+$('#withdrawalYear').value+' · '+($('#withdrawalUsage').selectedOptions[0]?.text || 'Chargement');
  if (key==='quality') return $('#qualityParameter').selectedOptions[0].text+' · '+($('#qualityMonth').selectedOptions[0]?.text || 'Chargement');
  return 'Écoulements ONDE · '+($('#droughtMonth').selectedOptions[0]?.text || 'Chargement');
}

function observationExportLegend() {
  const entries=[];
  if ($('#water-withdrawals').checked) entries.push({label:observationPeriodLabel('withdrawals')+' · m³/an',color:'#235e9b',shape:'point'});
  if ($('#water-quality').checked) {
    const scale=qualityScales[$('#qualityParameter').value];
    for (let index=0;index<4;index++) {
      const lower=index?scale.limits[index-1]:0;
      const range=index===3?number.format(lower)+' et plus':number.format(lower)+' à < '+number.format(scale.limits[index]);
      entries.push({label:observationPeriodLabel('quality')+' · '+range+' '+scale.unit,color:scale.colors[index],shape:'square'});
    }
    entries.push({label:'Limite analytique ou valeur non comparable',color:'#637480',shape:'square'});
  }
  if ($('#water-drought').checked) for (const [code,state] of Object.entries(droughtStates)) {
    if (code==='1a') continue;
    entries.push({label:observationPeriodLabel('drought')+' · '+state.label,color:state.color,shape:'triangle'});
  }
  return entries;
}

function observationSearch(query) {
  const hits=[];
  for (const [type,layer] of Object.entries(observationLayers)) {
    if (!layer.items || !$('#water-'+type).checked) continue;
    for (const item of observationSelection(type).items) {
      if (normalize(item.n+' '+item.id+' '+(item.commune||'')).includes(query)) {
        hits.push({type,item,name:item.n,meta:layer.label+' · '+item.id});
        if (hits.length>=8) return hits;
      }
    }
  }
  return hits;
}
