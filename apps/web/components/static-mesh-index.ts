import * as THREE from 'three';

type Node={box:THREE.Box3;start:number;end:number;left?:Node;right?:Node};
const indices=new WeakMap<THREE.BufferGeometry,StaticMeshIndex>();
/** Static scenery is batched by material, so a single mesh can contain tens of
 * thousands of distant triangles. Keep a spatial tree beside its shared buffer. */
class StaticMeshIndex{
 private order:Uint32Array;private bounds:Float32Array;private root:Node;
 private inverse=new THREE.Matrix4();private ray=new THREE.Ray();
 private proxyGeometry=new THREE.BufferGeometry();private proxy=new THREE.Mesh(this.proxyGeometry);
 constructor(private geometry:THREE.BufferGeometry){
  const p=geometry.attributes.position,index=geometry.index,count=Math.floor((index?.count??p.count)/3);
  this.order=Uint32Array.from({length:count},(_,i)=>i);this.bounds=new Float32Array(count*6);
  for(let i=0;i<count;i++){
   const a=index?index.getX(i*3):i*3,b=index?index.getX(i*3+1):i*3+1,c=index?index.getX(i*3+2):i*3+2,k=i*6;
   for(let axis=0;axis<3;axis++){const x=p.getComponent(a,axis),y=p.getComponent(b,axis),z=p.getComponent(c,axis);this.bounds[k+axis]=Math.min(x,y,z);this.bounds[k+axis+3]=Math.max(x,y,z);}
  }
  this.root=this.build(0,count);
  for(const [name,attribute] of Object.entries(geometry.attributes))this.proxyGeometry.setAttribute(name,attribute);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();this.proxyGeometry.boundingBox=geometry.boundingBox;this.proxyGeometry.boundingSphere=geometry.boundingSphere;
  // The proxy is never rendered: only its small candidate index changes.
  geometry.addEventListener('dispose',()=>{indices.delete(geometry);this.proxyGeometry.dispose();});
 }
 private centre(id:number,axis:number){return this.bounds[id*6+axis]+this.bounds[id*6+axis+3];}
 private partition(start:number,end:number,middle:number,axis:number){
  let low=start,high=end-1;
  while(low<high){const pivot=this.centre(this.order[(low+high)>>>1],axis);let i=low,j=high;
   while(i<=j){while(this.centre(this.order[i],axis)<pivot)i++;while(this.centre(this.order[j],axis)>pivot)j--;if(i<=j){const value=this.order[i];this.order[i++]=this.order[j];this.order[j--]=value;}}
   if(middle<=j)high=j;else if(middle>=i)low=i;else break;
  }
 }
 private build(start:number,end:number):Node{
  const box=new THREE.Box3();for(let i=start;i<end;i++){const k=this.order[i]*6;box.min.x=Math.min(box.min.x,this.bounds[k]);box.min.y=Math.min(box.min.y,this.bounds[k+1]);box.min.z=Math.min(box.min.z,this.bounds[k+2]);box.max.x=Math.max(box.max.x,this.bounds[k+3]);box.max.y=Math.max(box.max.y,this.bounds[k+4]);box.max.z=Math.max(box.max.z,this.bounds[k+5]);}
  const node:Node={box,start,end};if(end-start<=24)return node;
  const size=box.getSize(new THREE.Vector3()),axis=size.x>size.y&&size.x>size.z?0:size.y>size.z?1:2,middle=(start+end)>>>1;
  this.partition(start,end,middle,axis);node.left=this.build(start,middle);node.right=this.build(middle,end);return node;
 }
 private collect(node:Node,accept:(box:THREE.Box3)=>boolean,result:number[]){
  if(!accept(node.box))return;if(node.left){this.collect(node.left,accept,result);this.collect(node.right!,accept,result);}else for(let i=node.start;i<node.end;i++)result.push(this.order[i]);
 }
 nearby(box:THREE.Box3){const result:number[]=[];this.collect(this.root,b=>b.intersectsBox(box),result);return result;}
 raycast(mesh:THREE.Mesh,raycaster:THREE.Raycaster,hits:THREE.Intersection[]){
  this.inverse.copy(mesh.matrixWorld).invert();this.ray.copy(raycaster.ray).applyMatrix4(this.inverse);
  const triangles:number[]=[];this.collect(this.root,box=>this.ray.intersectsBox(box),triangles);if(!triangles.length)return;
  const source=this.geometry.index,selected:number[]=[];for(const triangle of triangles)for(let k=0;k<3;k++)selected.push(source?source.getX(triangle*3+k):triangle*3+k);
  this.proxyGeometry.setIndex(selected);this.proxy.material=mesh.material;this.proxy.matrixWorld.copy(mesh.matrixWorld);
  const first=hits.length;THREE.Mesh.prototype.raycast.call(this.proxy,raycaster,hits);
  for(let i=first;i<hits.length;i++){const hit=hits[i];hit.object=mesh;if(hit.faceIndex!==undefined&&hit.faceIndex!==null)hit.faceIndex=triangles[hit.faceIndex];}
 }
}
function indexOf(geometry:THREE.BufferGeometry){let index=indices.get(geometry);if(!index){index=new StaticMeshIndex(geometry);indices.set(geometry,index);}return index;}
export function indexStaticMesh(mesh:THREE.Mesh){
 if(Array.isArray(mesh.material)||(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)<192)return;
 const index=indexOf(mesh.geometry);mesh.raycast=(raycaster,hits)=>index.raycast(mesh,raycaster,hits);
}
/** Triangle IDs near a local-space decal volume, rather than the whole batch. */
export function nearbyTriangles(mesh:THREE.Mesh,centre:THREE.Vector3,radius:number){
 const offset=new THREE.Vector3(radius,radius,radius),box=new THREE.Box3(centre.clone().sub(offset),centre.clone().add(offset));return indexOf(mesh.geometry).nearby(box);
}
