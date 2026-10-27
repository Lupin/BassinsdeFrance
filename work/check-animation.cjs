const vm=require('vm'),fs=require('fs');const nodes=new Map();function elem(){return {value:'2',checked:false,width:900,height:800,style:{setProperty(){}},classList:{},append(){},replaceChildren(){},setAttribute(){},addEventListener(){},getBoundingClientRect(){return {width:900,height:800}},getContext(){return new Proxy({},{get:(t,k)=>t[k]||(()=>{})})}}}const context={window:{},document:{querySelector(s){if(!nodes.has(s))nodes.set(s,elem());return nodes.get(s)},createElement:elem,createTextNode:x=>x},Path2D:class{moveTo(){}lineTo(){}closePath(){}},ResizeObserver:class{observe(){}},matchMedia:()=>({matches:false}),requestAnimationFrame(){},performance:{now:()=>0},devicePixelRatio:1,console};vm.createContext(context);vm.runInContext(fs.readFileSync('outputs/au-fil-de-leau/dist/data.js','utf8'),context);vm.runInContext(fs.readFileSync('outputs/au-fil-de-leau/dist/admin.js','utf8'),context);vm.runInContext(fs.readFileSync('outputs/au-fil-de-leau/dist/app.js','utf8'),context);vm.runInContext(`
const animationChecks=[];
for(const level of [1,3,6,12]){
 zoomAt(level/zoom);const frames=[];let currentDots=[];
 ctx.arc=(x,y,r)=>{let sx=ox+tx+x*scale*zoom,sy=oy+ty+y*scale*zoom;if(sx>=0&&sx<=w&&sy>=0&&sy<=h)currentDots.push([sx,sy,r*scale*zoom])};
 frame(1000);frames.push(currentDots);currentDots=[];frame(1500);frames.push(currentDots);
 let motion=frames[0].some((p,i)=>frames[1][i]&&Math.hypot(p[0]-frames[1][i][0],p[1]-frames[1][i][1])>.1);
 if(!frames[0].length||!motion)throw new Error('Animation absente au zoom '+level);
 animationChecks.push({zoom:level,visibleParticles:frames[0].length,motion,screenRadius:frames[0][0][2]});
}
console.log(JSON.stringify(animationChecks,null,2));`,context);
