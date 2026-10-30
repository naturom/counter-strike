import * as THREE from 'three';
import {cutGeometryY} from './costume-geometry';

/** Tailor an anatomical hand's irregular forearm stub to the arm's wrist seam.
 * Fingers and palm stay intact; only the final 35 mm blend into the cuff. */
export function fitHandCuff(original:THREE.BufferGeometry,width:number,depth:number){
 if(!original.attributes.uv)original.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(original.attributes.position.count*2),2));
 const geometry=cutGeometryY(original.rotateX(Math.PI/2),-.12).rotateX(-Math.PI/2),p=geometry.attributes.position,n=geometry.attributes.normal,index=geometry.index!,keep:number[]=[];
 for(let i=0;i<index.count;i+=3){const tri=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(tri.every(j=>p.getZ(j)<=.120001))keep.push(...tri);}
 geometry.setIndex(keep);const compact=geometry.toNonIndexed();geometry.dispose();
 const position=compact.attributes.position,normal=compact.attributes.normal;
 // The source hand already has an open wrist. Parts of that boundary end
 // before the cutting plane, so clipping alone leaves a crescent-shaped gap.
 // Find the real welded boundary, including UV/normal splits, and seat the
 // whole contour on the bracer seam rather than just the newly cut vertices.
 const canonical=new Map<string,number>(),ids:number[]=[],edges=new Map<string,{a:number;b:number;count:number}>();
 for(let i=0;i<position.count;i++){const key=[position.getX(i),position.getY(i),position.getZ(i)].map(n=>n.toFixed(6)).join(',');if(!canonical.has(key))canonical.set(key,i);ids.push(canonical.get(key)!);}
 for(let i=0;i<position.count;i+=3)for(let j=0;j<3;j++){const a=ids[i+j],b=ids[i+(j+1)%3],key=a<b?`${a},${b}`:`${b},${a}`,edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{a,b,count:1});}
 const boundary=new Set([...edges.values()].filter(edge=>edge.count===1).flatMap(edge=>[edge.a,edge.b]));
 for(let i=0;i<position.count;i++){
  const z=position.getZ(i),seam=boundary.has(ids[i])&&z>.08,weight=seam?1:THREE.MathUtils.smoothstep(z,.085,.12);if(!weight)continue;
  const x=position.getX(i),y=position.getY(i),angle=Math.atan2(y/depth,x/width),nx=Math.cos(angle)/width,ny=Math.sin(angle)/depth;
  position.setXYZ(i,THREE.MathUtils.lerp(x,Math.cos(angle)*width,weight),THREE.MathUtils.lerp(y,Math.sin(angle)*depth,weight),seam?.12:Math.min(z,.12));
  const target=new THREE.Vector3(nx,ny,0).normalize().lerp(new THREE.Vector3().fromBufferAttribute(normal,i),1-weight).normalize();normal.setXYZ(i,target.x,target.y,target.z);
 }
 for(let i=0;i<position.count;i++)for(const axis of ['X','Y','Z'] as const)if(Math.abs(position[`get${axis}`](i))<1e-7)position[`set${axis}`](i,0);
 return compact;
}
