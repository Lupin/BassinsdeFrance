p='outputs/au-fil-de-leau/dist/app.js';s=open(p).read()
needle="function transform(c){c.setTransform(dpr,0,0,dpr,0,0);c.translate(ox+tx,oy+ty);c.scale(scale*zoom,scale*zoom)}"
insert=needle+'''\nconst osmTileCache=new Map();function osmY(lat,z){let rad=Math.max(-85.05112878,Math.min(85.05112878,lat))*Math.PI/180,n=2**z;return Math.floor((1-Math.asinh(Math.tan(rad))/Math.PI)/2*n)}function osmLat(y,z){return Math.atan(Math.sinh(Math.PI*(1-2*y/2**z)))*180/Math.PI}function drawOsm(c){const a=world(0,0),b=world(w,h),lon0=Math.max(-180,a[0]/72-5.4),lon1=Math.min(180,b[0]/72-5.4),lat0=Math.min(85,51.2-b[1]/104),lat1=Math.max(-85,51.2-a[1]/104),z=Math.max(2,Math.min(17,Math.round(Math.log2(Math.max(.01,scale*zoom)*72*360/256)))),n=2**z,x0=Math.max(0,Math.floor((lon0+180)/360*n)),x1=Math.min(n-1,Math.floor((lon1+180)/360*n)),y0=Math.max(0,osmY(lat0,z)),y1=Math.min(n-1,osmY(lat1,z));c.save();c.globalAlpha=.82;for(let ty=y0;ty<=y1;ty++)for(let txi=x0;txi<=x1;txi++){const key=z+'/'+txi+'/'+ty;let img=osmTileCache.get(key);if(!img){img=new Image();img.referrerPolicy='strict-origin-when-cross-origin';img.onload=()=>{dirty=true};img.onerror=()=>{osmTileCache.set(key,null)};osmTileCache.set(key,img);img.src='https://tile.openstreetmap.org/'+key+'.png'}if(!img||!img.complete||!img.naturalWidth)continue;const west=txi/n*360-180,east=(txi+1)/n*360-180,p0=project(west,0),p1=project(east,0),destX=p0[0],destWidth=p1[0]-p0[0];for(let band=0;band<32;band++){const sy=band*8,latN=osmLat(ty+sy/256,z),latS=osmLat(ty+(sy+8)/256,z),top=project(0,latN)[1],bottom=project(0,latS)[1];c.drawImage(img,0,sy,256,8,destX,top,destWidth,bottom-top)}}c.restore()}'''
assert needle in s;s=s.replace(needle,insert,1)
old="bc.fillStyle='#fff';bc.fill(landPath);bc.strokeStyle='#c3c7ce';bc.lineWidth=.8/s;bc.stroke(landPath);"
new="if($('#basemap').value==='osm'){drawOsm(bc);bc.strokeStyle='#aab1b8';bc.lineWidth=.8/s;bc.stroke(landPath)}else{bc.fillStyle='#fff';bc.fill(landPath);bc.strokeStyle='#c3c7ce';bc.lineWidth=.8/s;bc.stroke(landPath)}"
assert old in s;s=s.replace(old,new,1)
s=s.replace("bc.globalAlpha=.075;bc.fillStyle='#528c68'","bc.globalAlpha=.20;bc.fillStyle='#287348'").replace("bc.strokeStyle='#4e8061'","bc.strokeStyle='#205e3b'").replace("bc.globalAlpha=.16;bc.fillStyle='#7661a6';bc.strokeStyle='#69548f'","bc.globalAlpha=.2;bc.fillStyle='#2e79a6';bc.strokeStyle='#23678a'")
# Range-based discharge filters.
needle='function drawExtraMarkers(c,s){'
insert="function flowInFilter(q){const value=$('#flowFilter').value;if(value==='all')return true;const [min,max]=value.split(':').slice(1).map(Number);return q>=min&&q<max}function drawExtraMarkers(c,s){"
assert needle in s;s=s.replace(needle,insert,1)
s=s.replace("const min=Number($('#flowFilter').value);for(const x of EX.flows){if(x.q<min)continue;","for(const x of EX.flows){if(!flowInFilter(x.q))continue;")
s=s.replace("const min=Number($('#flowFilter').value);if(h=closest(EX.flows.filter(x=>x.q>=min),'flow'))return h;","if(h=closest(EX.flows.filter(x=>flowInFilter(x.q)),'flow'))return h;")
s=s.replace("let q=Number($('#flowFilter').value),n=EX.flows.filter(x=>x.q>=q).length;","let n=EX.flows.filter(x=>flowInFilter(x.q)).length;")
needle="$('#areas').onchange=$('#cities').onchange=$('#departments').onchange=$('#prefectures').onchange=()=>dirty=true;"
replacement=needle+"$('#basemap').onchange=()=>{$('#mapAttribution').hidden=$('#basemap').value!=='osm';dirty=true};"
assert needle in s;s=s.replace(needle,replacement,1)
open(p,'w').write(s)
