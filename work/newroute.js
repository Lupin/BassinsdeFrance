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
