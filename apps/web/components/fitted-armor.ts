import * as THREE from 'three';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type Vertex=number[];
function clip(polygon:Vertex[],distance:(v:Vertex)=>number){
 const out:Vertex[]=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],da=distance(a),db=distance(b);if(da>=-1e-9)out.push(a);if(da*db<0){const t=da/(da-db);out.push(a.map((v,j)=>v+(b[j]-v)*t));}}return out;
}
/** A thin closed shell taken from the actual body surface, with no flat floating backing. */
export function fittedArmorGeometry(surface:THREE.BufferGeometry,outline:number[][],offset=.006,thickness=.003,back=false){
 const p=surface.attributes.position,n=surface.attributes.normal,uv=surface.attributes.uv,index=surface.index!,points=outline.map(v=>new THREE.Vector2(v[0],v[1]));if(THREE.ShapeUtils.isClockWise(points))points.reverse();
 const front:number[]=[],normals:number[]=[],uvs:number[]=[],vertex=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i),uv.getX(i),uv.getY(i)];
 for(let i=0;i<index.count;i+=3){
  const triangle=[vertex(index.getX(i)),vertex(index.getX(i+1)),vertex(index.getX(i+2))];if(triangle.reduce((sum,v)=>sum+v[5],0)*(back?1:-1)<.12)continue;
  let poly=triangle;for(let j=0;j<points.length&&poly.length>=3;j++){const a=points[j],b=points[(j+1)%points.length];poly=clip(poly,v=>(b.x-a.x)*(v[1]-a.y)-(b.y-a.y)*(v[0]-a.x));}
  for(let j=1;j<poly.length-1;j++)for(const v of [poly[0],poly[j],poly[j+1]]){front.push(...v.slice(0,3));normals.push(...v.slice(3,6));uvs.push(...v.slice(6,8));}
 }
 const raw=new THREE.BufferGeometry();raw.setAttribute('position',new THREE.Float32BufferAttribute(front,3));raw.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));raw.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));const welded=mergeVertices(raw,1e-5);raw.dispose();
 const wp=welded.attributes.position,wn=welded.attributes.normal,wu=welded.attributes.uv,wi=welded.index!,positions:number[]=[],outNormals:number[]=[],outUV:number[]=[],indices:number[]=[],count=wp.count,canonical=new Map<string,number>(),remap:number[]=[],edges=new Map<string,{a:number;b:number;count:number}>();
 for(let side=0;side<2;side++)for(let i=0;i<count;i++){
  const normal=new THREE.Vector3().fromBufferAttribute(wn,i).normalize(),at=new THREE.Vector3().fromBufferAttribute(wp,i).addScaledVector(normal,offset-side*thickness);positions.push(at.x,at.y,at.z);outNormals.push(normal.x*(side?-1:1),normal.y*(side?-1:1),normal.z*(side?-1:1));outUV.push(wu.getX(i),wu.getY(i));
 }
 for(let i=0;i<count;i++){const key=[wp.getX(i),wp.getY(i),wp.getZ(i)].map(v=>Math.round(v*1e5)).join(',');if(!canonical.has(key))canonical.set(key,i);remap.push(canonical.get(key)!);}
 for(let i=0;i<wi.count;i+=3){const a=wi.getX(i),b=wi.getX(i+1),c=wi.getX(i+2);indices.push(a,b,c,c+count,b+count,a+count);for(const [v,w] of [[a,b],[b,c],[c,a]]){const x=remap[v],y=remap[w],key=x<y?`${x},${y}`:`${y},${x}`,e=edges.get(key);if(e)e.count++;else edges.set(key,{a:v,b:w,count:1});}}
 for(const edge of edges.values())if(edge.count===1){
  const {a,b}=edge,at=positions.length/3,pa=new THREE.Vector3().fromArray(positions,a*3),pb=new THREE.Vector3().fromArray(positions,b*3),inside=new THREE.Vector3().fromArray(positions,(a+count)*3),normal=inside.clone().sub(pa).cross(pb.clone().sub(pa)).normalize();
  for(const j of [a,a+count,b,b+count]){positions.push(...positions.slice(j*3,j*3+3));outNormals.push(normal.x,normal.y,normal.z);outUV.push(...outUV.slice(j*2,j*2+2));}indices.push(at,at+1,at+2,at+2,at+1,at+3);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(outNormals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(outUV,2));g.setIndex(indices);g.userData.fittedArmor={offset,thickness,surfaceVertices:count};welded.dispose();return g;
}

export function frontSurfaceZ(surface:THREE.BufferGeometry,x:number,y:number){
 const p=surface.attributes.position,index=surface.index!;let front=Infinity;
 for(let i=0;i<index.count;i+=3){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2),ax=p.getX(a),ay=p.getY(a),bx=p.getX(b),by=p.getY(b),cx=p.getX(c),cy=p.getY(c),den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<1e-12)continue;const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/den,v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/den,w=1-u-v;if(u>=-1e-6&&v>=-1e-6&&w>=-1e-6)front=Math.min(front,p.getZ(a)*u+p.getZ(b)*v+p.getZ(c)*w);}
 return Number.isFinite(front)?front:-.15;
}
