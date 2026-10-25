import * as THREE from 'three';
import {cutGeometryY} from './costume-geometry';
/** Continue the leg's actual ankle boundary into a closed, fitted boot last. */
export function suitFoot(source:THREE.BufferGeometry){
 const g=cutGeometryY(source,.20),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,index=g.index!,positions=Array.from(p.array),normals=Array.from(n.array),uvs=Array.from(uv.array),indices:number[]=[],boundary=new Map<string,number>();
 for(let i=0;i<index.count;i+=3){const tri=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(!tri.every(j=>p.getY(j)>=.20-1e-6))continue;indices.push(...tri);for(const j of tri)if(Math.abs(p.getY(j)-.20)<1e-6)boundary.set(`${p.getX(j).toFixed(5)},${p.getZ(j).toFixed(5)}`,j);}
 const ring=[...boundary.values()],cx=ring.reduce((s,i)=>s+p.getX(i),0)/ring.length,cz=ring.reduce((s,i)=>s+p.getZ(i),0)/ring.length;
 const angle=(i:number)=>Math.atan2(p.getZ(i)-cz,p.getX(i)-cx);ring.sort((a,b)=>angle(a)-angle(b));
 let previous=ring;
 for(const [y,rx,rz,forward] of [[.16,.047,.052,0],[.115,.057,.087,.018],[.075,.065,.13,.043],[.028,.065,.135,.043],[.009,.061,.127,.043]]){
  const next:number[]=[];for(let j=0;j<ring.length;j++){const a=angle(ring[j]),at=positions.length/3;next.push(at);positions.push(cx+rx*Math.cos(a),y,cz-forward+rz*Math.sin(a));normals.push(0,1,0);uvs.push(j/ring.length,y);}
  for(let j=0;j<ring.length;j++){const k=(j+1)%ring.length;indices.push(previous[j],previous[k],next[j],next[j],previous[k],next[k]);}previous=next;
 }
 const center=positions.length/3;positions.push(cx,.009,cz-.043);normals.push(0,-1,0);uvs.push(.5,0);for(let j=0;j<ring.length;j++)indices.push(center,previous[j],previous[(j+1)%ring.length]);
 const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));result.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));result.setIndex(indices);result.computeVertexNormals();const normal=result.attributes.normal;for(let i=0;i<p.count;i++)normal.setXYZ(i,n.getX(i),n.getY(i),n.getZ(i));g.dispose();return result;
}
