import json,math,collections,os,itertools
OUT='outputs/au-fil-de-leau/dist/'
def project(p):return [(p[0]+5.4)*72,(51.2-p[1])*104]
def simplify(pts,eps=.3):
 if len(pts)<3:return pts
 a,b=pts[0],pts[-1];dx=b[0]-a[0];dy=b[1]-a[1];den=dx*dx+dy*dy;maxd=0;idx=0
 for i,p in enumerate(pts[1:-1],1):
  t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)) if den else 0
  d=(p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2
  if d>maxd:maxd=d;idx=i
 if maxd<=eps*eps:return [a,b]
 return simplify(pts[:idx+1],eps)[:-1]+simplify(pts[idx:],eps)
def rounded(p):return [[round(x,2),round(y,2)] for x,y in p]
def polys(g):
 if g['type']=='Polygon':return [[rounded(simplify(list(map(project,ring)),.22)) for ring in g['coordinates']]]
 return [[rounded(simplify(list(map(project,ring)),.22)) for ring in poly] for poly in g['coordinates']]
basins=[]
for f in json.load(open('work/data/basins.json'))['features']:
 p=f['properties'];basins.append({'id':p['CdBH'],'name':p['LbBH'],'polys':polys(f['geometry'])})
f=json.load(open('work/data/france.json'));features=f.get('features',[f]);land=[]
for f in features:land+=polys(f['geometry'])
rivers=[];counts=collections.Counter();seen=set()
for line in itertools.chain(open('work/data/rivers.ndjson'),open('work/data/rest.ndjson')):
 f=json.loads(line)
 if f['properties']['CdOH'] in seen:continue
 seen.add(f['properties']['CdOH'])
 p=f['properties'];g=f['geometry'];bid=p['CdOH'][:2]
 if bid not in ['01','02','03','04','05','06','12'] or not g:continue
 lines=[g['coordinates']] if g['type']=='LineString' else g['coordinates']
 lines=[list(map(project,line)) for line in lines]
 length=sum(sum(math.dist(a,b) for a,b in zip(l,l[1:])) for l in lines)*1.06
 if length<1.8:continue
 lines=[rounded(simplify(l,.22)) for l in lines]
 rivers.append({'id':p['CdOH'],'b':bid,'n':p['TopoOH'] or 'Cours d’eau sans nom','l':round(length,1),'p':lines})
 counts[bid]+=1
rivers.sort(key=lambda r:-r['l'])
# Retain all named courses longer than 1.8 km, simplified only below display resolution.
D={'basins':basins,'land':land,'rivers':rivers,'source':'Sandre · BD TOPAGE® · IGN / OFB','date':'26 octobre 2026'}
open(OUT+'data.js','w').write('window.HYDRO='+json.dumps(D,ensure_ascii=False,separators=(',',':'))+';')
print('rivers',len(rivers),'basins',counts,'size',os.path.getsize(OUT+'data.js'))
for name in ['la Loire','la Seine','le Rhône','la Garonne','l’Allier']:
 found=[r for r in rivers if r['n'].lower()==name.lower()]
 for r in found[:1]:print(r['n'],r['id'],r['p'][0][0],r['p'][-1][-1])
