import json, math
from pathlib import Path
from collections import defaultdict
from shapely.geometry import shape, mapping
from shapely.ops import transform

ROOT=Path('work/data'); OUT=Path('outputs/au-fil-de-leau/dist/layers-data.js')
def project(lon,lat): return ((lon+5.4)*72,(51.2-lat)*104)
def geom_polys(g, tol=.14):
    if not g or not g.get('coordinates'): return []
    try:
        geom=transform(lambda x,y,z=None: project(x,y),shape(g)).simplify(tol,preserve_topology=True)
    except Exception:return []
    if geom.is_empty:return []
    geoms=list(geom.geoms) if geom.geom_type=='MultiPolygon' else [geom]
    out=[]
    for poly in geoms:
        if poly.area<.08: continue
        rings=[]
        for ring in [poly.exterior,*poly.interiors]:
            pts=[[round(x,2),round(y,2)] for x,y in ring.coords]
            if len(pts)>=4:rings.append(pts)
        if rings:out.append(rings)
    return out

# Nuclear generation sites from EDF's plant register, grouped by site.
nuc=json.load(open(ROOT/'nuclear.json')); groups=defaultdict(list)
for x in nuc:
    try: lat,lon=map(float,x['point_gps_wsg84'].split(','))
    except: continue
    groups[x['centrale']].append((x,lat,lon))
nuclear=[]
for name,items in groups.items():
    x,lat,lon=items[0]; nuclear.append({'n':name.title(), 'p':list(project(lon,lat)), 'commune':x.get('commune',''), 'dep':x.get('departement',''), 'mw':round(sum(float(a[0].get('puissance_installee') or 0) for a in items)), 'reactors':len(items), 'startup':min((a[0].get('date_de_mise_en_service_industrielle') or '') for a in items)})

# ROE points whose validated use includes Sandre code 5 (energy/hydroelectricity), existing only.
roe=json.load(open(ROOT/'roe-hydro.json'))['features']; dams=[]
for f in roe:
    p=f['properties']; c=f.get('geometry',{}).get('coordinates',[])
    if p.get('LbEtOuvrage')!='Existant' or not c or len(c)<2: continue
    lon,lat=c[:2]
    if not (-5.6<=lon<=9.8 and 41.2<=lat<=51.3): continue
    dams.append({'n':p.get('NomPrincipalObstEcoul') or 'Ouvrage hydroélectrique','p':list(project(lon,lat)),'id':p.get('CdObstEcoul'), 'river':p.get('NomEntiteHydrographique') or '', 'commune':p.get('LbCommune') or '', 'dep':p.get('LbDepartement') or '', 'type':p.get('CdTypeOuvrage') or '', 'height':p.get('HautChutEtObstEcoul') or '', 'updated':p.get('DateMAJObstEcoul') or ''})

# Hydrometry: latest Q observation per site from a narrow, explicitly dated snapshot.
stations=json.load(open(ROOT/'hydrometry-stations.json'))['data']; bysite={}
for s in stations:
    if not s.get('longitude_station') or not s.get('latitude_station'): continue
    lon,lat=s['longitude_station'],s['latitude_station']
    if -5.6<=lon<=9.8 and 41.2<=lat<=51.3:
        old=bysite.get(s['code_site'])
        if old is None or s.get('en_service'): bysite[s['code_site']]=s
obs=json.load(open(ROOT/'flows-recent.json'))['data']; flows={}
for o in obs:
    c=o.get('longitude'),o.get('latitude')
    if c[0] is None or c[1] is None or not (-5.6<=c[0]<=9.8 and 41.2<=c[1]<=51.3):continue
    site=o.get('code_site');prev=flows.get(site)
    if prev is None or o.get('date_obs','')>prev.get('date_obs',''):flows[site]=o
flowlist=[]
for site,o in flows.items():
    s=bysite.get(site,{}); lon=o['longitude'];lat=o['latitude']; val=o.get('resultat_obs')
    if val is None: continue
    flowlist.append({'n':s.get('libelle_station') or s.get('libelle_site') or s.get('libelle_cours_eau') or site,'river':s.get('libelle_cours_eau') or '', 'p':list(project(lon,lat)), 'q':round(float(val)/1000,4), 'unit':'m³/s','date':o['date_obs'], 'qualification':o.get('libelle_qualification_obs',''), 'status':o.get('libelle_statut',''), 'site':site,'dep':s.get('libelle_departement','')})

# protected areas, grouped by legal/registry family; preserve official records and useful dates.
protected=[]
for fn,kind,label in [
 ('parks-national.json','pn','Parcs nationaux'),('parks-regional.json','pnr','Parcs naturels régionaux'),
 ('reserves-national.json','rnn','Réserves nationales'),('reserves-regional.json','rnr','Réserves régionales'),('reserves-corse.json','rnc','Réserves de Corse'),
 ('biotope.json','apb','Arrêtés de protection de biotope'),('natura-habitats.json','natura-hab','Natura 2000 · habitats'),('natura-birds.json','natura-ois','Natura 2000 · oiseaux')]:
    features=json.load(open(ROOT/fn)).get('features',[])
    for f in features:
        p=f.get('properties',{}); polys=geom_polys(f.get('geometry'))
        if not polys:continue
        protected.append({'n':p.get('nom_site') or label,'kind':kind,'label':label,'id':p.get('id_mnhn') or p.get('id_local') or '', 'url':p.get('url_fiche') or '', 'created':p.get('date_crea') or '', 'modified':p.get('modif_geo') or p.get('modif_adm') or '', 'zone':p.get('zone') or '', 'polys':polys})

# BD LISA aquifer entities classified exclusively as confined by the Sandre EtatEH code.
aquifers=[]
for f in json.load(open(ROOT/'confined-aquifers.json')).get('features',[]):
    p=f.get('properties',{}); polys=geom_polys(f.get('geometry'),.12)
    if not polys:continue
    aquifers.append({'n':p.get('LibelleEH') or p.get('CodeEH') or 'Entité hydrogéologique','id':p.get('CodeEH',''),'level':p.get('NiveauEH',''),'polys':polys})

out={'asof':'2026-10-26T16:00:00Z','nuclear':nuclear,'dams':dams,'flows':flowlist,'protected':protected,'aquifers':aquifers}
OUT.write_text('window.EXTRA_DATA='+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';')
print('nuclear sites',len(nuclear),'reactors',sum(x['reactors'] for x in nuclear),'ROE hydro sites',len(dams),'flows',len(flowlist),'protected',len(protected),'aquifers',len(aquifers),'JS MB',round(OUT.stat().st_size/1e6,2))
print('protected by family', {k:sum(x['kind']==k for x in protected) for k in sorted({x['kind'] for x in protected})})
