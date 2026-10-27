import json,math,heapq,collections,time
import numpy as np
import shapely
from shapely import LineString,Point,STRtree,box
start=time.time();p='outputs/au-fil-de-leau/dist/data.js';d=json.loads(open(p).read()[13:-1]);nodes=[];keys={};adj=[]
def node(p):
 k=(round(p[0],2),round(p[1],2))
 if k not in keys:keys[k]=len(nodes);nodes.append(k);adj.append([])
 return keys[k]
def edge(a,b,c):
 if a!=b:adj[a].append((b,c));adj[b].append((a,c))
segments=[];segmeta=[];lines=[];endpoints=set()
for ri,r in enumerate(d['rivers']):
 for li,line in enumerate(r['p']):
  ids=[node(p) for p in line];lines.append((ri,li,ids));endpoints.add(ids[0]);endpoints.add(ids[-1])
  for i,(a,b) in enumerate(zip(ids,ids[1:])):
   if a==b:continue
   length=math.dist(nodes[a],nodes[b]);edge(a,b,length);segments.append(LineString([nodes[a],nodes[b]]));segmeta.append((a,b,ri,li))
print('graph',len(nodes),len(segments),flush=True);tree=STRtree(segments);point_geoms=[Point(p) for p in nodes];joined=0
for v in list(endpoints):
 # Only dangling extremities need a projection onto an existing downstream segment.
 if len(adj[v])!=1:continue
 x,y=nodes[v];candidates=tree.query(box(x-.28,y-.28,x+.28,y+.28));best=.28;idx=None
 for k in candidates:
  a,b,ri,li=segmeta[k]
  if a==v or b==v:continue
  dist=segments[k].distance(point_geoms[v])
  if dist<best:best=dist;idx=k
 if idx is not None:
  a,b,ri,li=segmeta[idx];q=segments[idx].interpolate(segments[idx].project(point_geoms[v]));mid=node((q.x,q.y));edge(v,mid,best);edge(a,mid,math.dist(nodes[a],nodes[mid]));edge(b,mid,math.dist(nodes[b],nodes[mid]));joined+=1
print('connections',joined,flush=True)
# Seed actual source-to-sea routes at every vertex, with remaining downstream path distance.
dist=[math.inf]*len(nodes);heap=[];anchored=set()
for r in json.load(open('work/data/anchors.json')):
 full=r['full'];remain=0
 for i in range(len(full)-1,-1,-1):
  if i+1<len(full):remain+=math.dist(full[i],full[i+1])
  k=(round(full[i][0],2),round(full[i][1],2));v=keys.get(k)
  if v is not None and remain<dist[v]:dist[v]=remain;heapq.heappush(heap,(remain,v));anchored.add(v)
def flood():
 while heap:
  dd,v=heapq.heappop(heap)
  if dd!=dist[v]:continue
  for to,weight in adj[v]:
   nd=dd+weight
   if nd<dist[to]:dist[to]=nd;heapq.heappush(heap,(nd,to))
flood();anchor_covered=sum(x<math.inf for x in dist);print('anchored nodes',anchor_covered,flush=True)
# Disconnected components: estimate their outlet as the end nearest to the national perimeter.
land=[]
for poly in d['land']:
 for ring in poly:land.append(LineString(ring))
boundary=shapely.union_all(land);visited=set();components=0
for v in range(len(nodes)):
 if dist[v]<math.inf or v in visited:continue
 stack=[v];comp=[];visited.add(v)
 while stack:
  a=stack.pop();comp.append(a)
  for b,c in adj[a]:
   if b not in visited and dist[b]==math.inf:visited.add(b);stack.append(b)
 ends=[a for a in comp if len(adj[a])==1] or comp
 root=min(ends,key=lambda a:boundary.distance(Point(nodes[a])))
 dist[root]=0;heapq.heappush(heap,(0,root));flood();components+=1
for ri,r in enumerate(d['rivers']):r['o']=[]
for ri,li,ids in lines:
 signs=''.join('+' if dist[a]>=dist[b] else '-' for a,b in zip(ids,ids[1:]));d['rivers'][ri]['o'].append(signs)
d['flowMethod']={'method':'Connexion des géométries ; distance aval aux parcours de référence. Exutoire estimé sur les composantes isolées.','anchoredNodes':anchor_covered,'nodes':len(nodes),'isolatedComponents':components,'snapMetersApprox':280}
open(p,'w').write('window.HYDRO='+json.dumps(d,ensure_ascii=False,separators=(',',':'))+';')
print('done',round(time.time()-start,1),'s',d['flowMethod'],flush=True)
