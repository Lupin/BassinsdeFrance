'use strict';

const exportXML = value => String(value).replace(/[&<>"']/g, character =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[character]);
const exportNumber = value => String(Math.round(value * 1000) / 1000);

class MapSVGContext {
  constructor(measureContext) {
    this.measureContext = measureContext;
    this.elements = [];
    this.definitions = [];
    this.characters = 0;
    this.stack = [];
    this.state = {matrix:[1,0,0,1,0,0], globalAlpha:1, lineWidth:1, lineJoin:'miter', lineCap:'butt',
      fillStyle:'#000', strokeStyle:'#000', dash:[], font:'10px sans-serif', textAlign:'start',
      textBaseline:'alphabetic', clips:[]};
    this.beginPath();
  }

  save() { this.stack.push({...this.state}); }
  restore() { this.state = this.stack.pop(); }
  setTransform(...matrix) { this.state.matrix = matrix; }
  setLineDash(dash) { this.state.dash = dash; }
  beginPath() { this.commands = []; }
  moveTo(x,y) { this.commands.push('M'+this.point(x,y)); }
  lineTo(x,y) { this.commands.push('L'+this.point(x,y)); }
  closePath() { this.commands.push('Z'); }
  point(x,y) { return exportNumber(x)+' '+exportNumber(y); }
  rectPath(x,y,width,height) {
    return 'M'+this.point(x,y)+'h'+exportNumber(width)+'v'+exportNumber(height)+'h'+exportNumber(-width)+'Z';
  }
  // The atlas uses complete circles for its point symbols.
  arc(x,y,radius) {
    const r = exportNumber(radius), size = r+' '+r+' 0 1 1 ';
    const start = this.point(x+radius,y);
    this.commands.push('M'+start+'A'+size+this.point(x-radius,y)+'A'+size+start+'Z');
  }
  combinePaths(paths) { return {paths}; }
  lineData(line, close=false) {
    if (!line.length) return '';
    const data = line.map(([x,y]) => this.point(x,y)).join(' ');
    return 'M'+data+(close?'Z':'');
  }
  pathData(path) {
    if (!path) return this.commands.join('');
    if (path.paths) return path.paths.map(part => this.pathData(part)).join('');
    const geometry = mapPathGeometry.get(path);
    if (geometry?.line) return this.lineData(geometry.line);
    if (geometry?.polys) return geometry.polys.map(poly => poly.map(ring => this.lineData(ring,true)).join('')).join('');
    throw new Error('Un tracé de cette vue ne peut pas être converti en SVG.');
  }
  transformAttribute() {
    return 'transform="matrix('+this.state.matrix.map(exportNumber).join(' ')+')"';
  }
  write(markup) {
    for (const clip of this.state.clips) markup = '<g clip-path="url(#'+clip+')">'+markup+'</g>';
    this.characters += markup.length;
    if (this.characters > 24_000_000) throw new Error('Ce SVG est trop volumineux. Réduisez le détail du réseau ou zoomez sur la zone à exporter.');
    this.elements.push(markup);
  }
  clip(path, rule='nonzero') {
    const id = 'map-clip-'+this.definitions.length;
    this.definitions.push('<clipPath id="'+id+'"><path '+this.transformAttribute()+
      ' clip-rule="'+rule+'" d="'+this.pathData(path)+'"/></clipPath>');
    this.state.clips = [...this.state.clips,id];
  }
  paint(kind, rule='nonzero') {
    const {globalAlpha,lineWidth,lineJoin,lineCap,dash} = this.state;
    const color = this.state[kind+'Style'];
    const hexWithAlpha = /^#[a-f\d]{8}$/i.test(color);
    const value = hexWithAlpha ? color.slice(0,7) : color;
    const opacity = globalAlpha * (hexWithAlpha ? parseInt(color.slice(7),16)/255 : 1);
    const fill = 'fill="'+exportXML(value)+'" fill-opacity="'+exportNumber(opacity)+'" fill-rule="'+rule+'"';
    const stroke = 'fill="none" stroke="'+exportXML(value)+'" stroke-opacity="'+exportNumber(opacity)+
      '" stroke-width="'+exportNumber(lineWidth)+'" stroke-linecap="'+lineCap+'" stroke-linejoin="'+lineJoin+'"';
    return kind==='fill' ? fill : stroke+(dash.length?' stroke-dasharray="'+dash.map(exportNumber).join(' ')+'"':'');
  }
  writePath(data, kind, rule) {
    if (data) this.write('<path '+this.transformAttribute()+' '+this.paint(kind,rule)+' d="'+data+'"/>');
  }
  fill(path,rule) { this.writePath(this.pathData(path),'fill',rule); }
  stroke(path) { this.writePath(this.pathData(path),'stroke'); }
  fillRect(...args) { this.writePath(this.rectPath(...args),'fill'); }
  strokeRect(...args) { this.writePath(this.rectPath(...args),'stroke'); }
  measureText(text) {
    this.measureContext.font = this.state.font;
    return this.measureContext.measureText(text);
  }
  writeText(kind,text,x,y) {
    const anchor = {center:'middle',right:'end',end:'end'}[this.state.textAlign] || 'start';
    const baseline = this.state.textBaseline==='middle'?'central':'alphabetic';
    this.write('<text '+this.transformAttribute()+' '+this.paint(kind)+' x="'+exportNumber(x)+'" y="'+exportNumber(y)+
      '" text-anchor="'+anchor+'" dominant-baseline="'+baseline+'" style="font:'+exportXML(this.state.font)+
      '">'+exportXML(text)+'</text>');
  }
  fillText(...args) { this.writeText('fill',...args); }
  strokeText(...args) { this.writeText('stroke',...args); }
}

for (const field of ['globalAlpha','lineWidth','lineJoin','lineCap','fillStyle','strokeStyle','font','textAlign','textBaseline']) {
  Object.defineProperty(MapSVGContext.prototype, field, {
    get() { return this.state[field]; },
    set(value) { this.state[field] = value; }
  });
}

function wrapExportText(context, text, width, font) {
  context.font = font;
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? line+' '+word : word;
    if (context.measureText(next).width <= width) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    for (const character of word) {
      if (line && context.measureText(line+character).width > width) {
        lines.push(line);
        line = '';
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function layoutExportPage(context, width, options, print=false) {
  const margin = print ? 28 : 16;
  const usable = width - 2*margin;
  const fonts = print ? {title:16,meta:9} : {title:19,meta:12};
  const font = (size,weight='400') => weight+' '+size+'px '+(print?'Arial, sans-serif':'Inter, sans-serif');
  const titleLines = wrapExportText(context,options.title,usable,font(fonts.title,'600'));
  const creditLines = wrapExportText(context,options.credits,usable,font(fonts.meta));
  const legendRows = [];
  let row = [], x = margin;
  for (const item of options.legend) {
    const lines = wrapExportText(context,item.label,usable-17,font(fonts.meta));
    const advance = Math.max(...lines.map(line => context.measureText(line).width))+30;
    if (row.length && x+advance-10 > width-margin) {
      legendRows.push(row);
      x = margin;
      row = [];
    }
    row.push({...item, x, lines});
    x += advance;
  }
  if (row.length) legendRows.push(row);
  const titleHeight = titleLines.length ? titleLines.length*(fonts.title+5)+8 : 0;
  const metaStep = fonts.meta+5;
  const rowHeight = row => Math.max(...row.map(item => item.lines.length))*metaStep+2;
  const metaHeight = (legendRows.length ? legendRows.reduce((sum,row)=>sum+rowHeight(row),0)+4 : 0)+creditLines.length*metaStep;
  return {margin, usable, fonts, font, titleLines, creditLines, legendRows, titleHeight, metaHeight, metaStep, rowHeight};
}

function paintExportSwatch(context, item, x, y) {
  context.fillStyle = item.color;
  context.strokeStyle = item.color;
  context.lineWidth = 2;
  if (item.shape==='point') {
    context.beginPath(); context.arc(x+5,y-3,3.5,0,Math.PI*2); context.fill();
  } else if (item.shape==='diamond') {
    context.beginPath();
    context.moveTo(x+5,y-8); context.lineTo(x+10,y-3); context.lineTo(x+5,y+2); context.lineTo(x,y-3);
    context.closePath(); context.fill();
  } else if (item.shape==='square') {
    context.strokeRect(x+2,y-7,7,7);
  } else if (item.shape==='dash') {
    context.beginPath(); context.setLineDash([3,2]); context.moveTo(x,y-3); context.lineTo(x+12,y-3); context.stroke(); context.setLineDash([]);
  } else {
    context.fillRect(x,y-(item.shape==='area'?7:4),12,item.shape==='area'?7:2);
  }
}

function paintExportText(context, page, mapBottom) {
  const {margin, fonts, font, titleLines, creditLines, legendRows, metaStep, rowHeight} = page;
  context.fillStyle = '#172734';
  context.textBaseline = 'alphabetic';
  context.font = font(fonts.title,'600');
  titleLines.forEach((line,index)=>context.fillText(line,margin,margin+fonts.title+(fonts.title+5)*index));
  context.font = font(fonts.meta);
  let y = mapBottom+margin+fonts.meta;
  for (const row of legendRows) {
    for (const item of row) {
      paintExportSwatch(context,item,item.x,y);
      context.fillStyle = '#172734';
      item.lines.forEach((line,index)=>context.fillText(line,item.x+17,y+index*metaStep));
    }
    y += rowHeight(row);
  }
  if (legendRows.length) y += 4;
  context.fillStyle = '#4c5d68';
  creditLines.forEach((line,index)=>context.fillText(line,margin,y+index*metaStep));
}

function makeExportCanvas(width,height) {
  const result = document.createElement('canvas');
  result.width = Math.max(1,Math.round(width));
  result.height = Math.max(1,Math.round(height));
  return result;
}

function exportCanvasBlob(canvas,type='image/png',quality) {
  return new Promise((resolve,reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('La carte n’a pas pu être encodée.')),type,quality);
  });
}

// Export a tagged, single-page PDF. The map has a Figure alternative; title,
// legend and credits are separately selectable text in the reading order.
async function makeMapPDF(map, options) {
  const landscape = map.width >= map.height;
  const width = landscape ? 841.89 : 595.28, height = landscape ? 595.28 : 841.89;
  const measure = makeExportCanvas(1,1).getContext('2d');
  const page = layoutExportPage(measure,width,options,true);
  const mapWidth = Math.min(page.usable,(height-3*page.margin-page.titleHeight-page.metaHeight)*map.width/map.height);
  const mapHeight = mapWidth*map.height/map.width;
  const mapTop = page.margin+page.titleHeight;
  const mapLeft = (width-mapWidth)/2;
  const mapBottom = mapTop+mapHeight;
  const jpeg = new Uint8Array(await (await exportCanvasBlob(map,'image/jpeg',.94)).arrayBuffer());
  const encoder = new TextEncoder();
  const bytes = value => typeof value==='string'?encoder.encode(value):value;
  const objects = [null];
  const add = (...parts) => { objects.push(parts); return objects.length-1; };
  const ref = n => n+' 0 R';
  const stream = (dictionary,data) => ['<< '+dictionary+' /Length '+bytes(data).length+' >>\nstream\n',data,'\nendstream'];
  const utf16 = text => '<FEFF'+text.split('').map(char=>char.charCodeAt(0).toString(16).padStart(4,'0')).join('')+'>';
  const ansiExtra = '€\0‚ƒ„…†‡ˆ‰Š‹Œ\0Ž\0\0‘’“”•–—˜™š›œ\0žŸ';
  const ansi = text => '<'+[...text].map(char=>{
    const code=char.codePointAt(0), extra=ansiExtra.indexOf(char);
    return (code>=32 && code<=126 || code>=160 && code<=255 ? code : extra>=0 ? 128+extra : 63)
      .toString(16).padStart(2,'0');
  }).join('')+'>';
  const fmt = exportNumber;
  const root = add();
  const pages = add();
  const pageId = add();
  const structure = add();
  const documentNode = add();
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const image = add(...stream('/Type /XObject /Subtype /Image /Width '+map.width+' /Height '+map.height+
    ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode',jpeg));
  const content = [];
  const parts = [];
  function section(type,commands,metadata='') {
    const index = parts.length;
    parts.push(add('<< /Type /StructElem /S /'+type+' /P '+ref(documentNode)+' /Pg '+ref(pageId)+' /K '+index+' '+metadata+' >>'));
    content.push('/'+type+' <</MCID '+index+'>> BDC\n'+commands+'\nEMC');
  }
  function text(line,x,y,size,bolder=false) {
    return '/Span <</ActualText '+utf16(line)+'>> BDC BT /'+(bolder?'F2':'F1')+' '+size+' Tf 0.09 0.15 0.2 rg 1 0 0 1 '+
      fmt(x)+' '+fmt(height-y)+' Tm '+ansi(line)+' Tj ET EMC';
  }
  if (page.titleLines.length) section('H1',page.titleLines.map((line,index)=>
    text(line,page.margin,page.margin+page.fonts.title+(page.fonts.title+5)*index,page.fonts.title,true)).join('\n'));
  section('Figure','q '+fmt(mapWidth)+' 0 0 '+fmt(mapHeight)+' '+fmt(mapLeft)+' '+fmt(height-mapBottom)+' cm /Map Do Q',
    '/Alt '+utf16(options.description));
  let y = mapBottom+page.margin+page.fonts.meta;
  for (const row of page.legendRows) {
    for (const item of row) {
      const color = item.color.slice(1,7).match(/../g).map(pair=>fmt(parseInt(pair,16)/255)).join(' ');
      const x = item.x, base = height-y;
      let symbol = fmt(x)+' '+fmt(base+2)+' 11 2 re f';
      if (item.shape==='dash') symbol = '[3 2] 0 d 1.5 w '+fmt(x)+' '+fmt(base+3)+' m '+fmt(x+11)+' '+fmt(base+3)+' l S';
      if (item.shape==='square') symbol = fmt(x+2)+' '+fmt(base)+' 7 7 re S';
      if (item.shape==='area') symbol = fmt(x)+' '+fmt(base)+' 11 6 re f';
      if (item.shape==='diamond') symbol = fmt(x+5)+' '+fmt(base+9)+' m '+fmt(x+10)+' '+fmt(base+4)+' l '+
        fmt(x+5)+' '+fmt(base-1)+' l '+fmt(x)+' '+fmt(base+4)+' l h f';
      if (item.shape==='point') {
        symbol = '1 0 0 1 '+fmt(x+5)+' '+fmt(base+4)+' cm 3 0 m 3 1.657 1.657 3 0 3 c '+
          '-1.657 3 -3 1.657 -3 0 c -3 -1.657 -1.657 -3 0 -3 c 1.657 -3 3 -1.657 3 0 c f';
      }
      content.push('/Artifact BMC q '+color+' rg '+color+' RG '+symbol+' Q EMC');
      section('P',item.lines.map((line,index)=>text(line,item.x+17,y+index*page.metaStep,page.fonts.meta)).join('\n'));
    }
    y += page.rowHeight(row);
  }
  if (page.legendRows.length) y += 4;
  section('P',page.creditLines.map((line,index)=>text(line,page.margin,y+index*page.metaStep,page.fonts.meta)).join('\n'));
  const contentId = add(...stream('',content.join('\n')));
  const parentTree = add('<< /Nums [0 ['+parts.map(ref).join(' ')+']] >>');
  const info = add('<< /Title '+utf16(options.title || 'Bassins de France')+' /Creator (Bassins de France) >>');
  objects[root] = ['<< /Type /Catalog /Pages '+ref(pages)+' /Lang (fr-FR) /StructTreeRoot '+ref(structure)+
    ' /MarkInfo << /Marked true >> /ViewerPreferences << /DisplayDocTitle true >> >>'];
  objects[pages] = ['<< /Type /Pages /Count 1 /Kids ['+ref(pageId)+'] >>'];
  objects[pageId] = ['<< /Type /Page /Parent '+ref(pages)+' /MediaBox [0 0 '+width+' '+height+'] /StructParents 0 /Tabs /S'+
    ' /Resources << /Font << /F1 '+ref(font)+' /F2 '+ref(bold)+' >> /XObject << /Map '+ref(image)+' >> >> /Contents '+ref(contentId)+' >>'];
  objects[structure] = ['<< /Type /StructTreeRoot /K '+ref(documentNode)+' /ParentTree '+ref(parentTree)+' /ParentTreeNextKey 1 >>'];
  objects[documentNode] = ['<< /Type /StructElem /S /Document /P '+ref(structure)+' /K ['+parts.map(ref).join(' ')+'] >>'];
  const chunks = [];
  let length = 0;
  function append(value) { const data = bytes(value); chunks.push(data); length += data.length; }
  append('%PDF-1.7\n'); append(Uint8Array.of(37,226,227,207,211,10));
  const offsets = ['0000000000 65535 f \n'];
  for (let i=1;i<objects.length;i++) {
    offsets.push(String(length).padStart(10,'0')+' 00000 n \n');
    append(i+' 0 obj\n'); objects[i].forEach(append); append('\nendobj\n');
  }
  const xref = length;
  append('xref\n0 '+objects.length+'\n'+offsets.join('')+'trailer\n<< /Size '+objects.length+' /Root '+ref(root)+
    ' /Info '+ref(info)+' >>\nstartxref\n'+xref+'\n%%EOF\n');
  return new Blob(chunks,{type:'application/pdf'});
}
