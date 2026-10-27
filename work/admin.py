import json,gzip,math
from shapely.geometry import shape,mapping
meta={d['code']:d for d in json.load(open('work/data/deps-metadata.json')) if len(d['code'])==2}
communes={c['code']:c for c in json.load(open('work/data/communes-positions.json'))}
raw=json.load(gzip.open('work/data/departements-2026.geojson.gz','rt'))
def project(p):return [round((p[0]+5.4)*72,2),round((51.2-p[1])*104,2)]
res=[]
for f in raw['features']:
 p=f['properties'];code=p['code']
 if code not in meta:continue
 geom=f['geometry'];polys=[geom['coordinates']] if geom['type']=='Polygon' else geom['coordinates']
 polys=[[[project(pt) for pt in ring] for ring in poly] for poly in polys]
 info=meta[code];chief=communes.get(info['chefLieu']);assert chief,(code,info)
 pos=chief.get('mairie',chief.get('centre'))['coordinates']
 res.append({'code':code,'name':info['nom'],'chief':chief['nom'],'point':project(pos),'polys':polys})
assert len(res)==96,len(res)
assert len({d['code'] for d in res})==96
open('outputs/au-fil-de-leau/dist/admin.js','w').write('window.ADMIN='+json.dumps({'departments':res,'year':2026,'source':'Etalab · contours administratifs 2026 ; API Découpage administratif, chef-lieu et mairie'},ensure_ascii=False,separators=(',',':'))+';')
print(len(res),'départements et chefs-lieux ; Paris',next(d for d in res if d['code']=='75')['chief'])
