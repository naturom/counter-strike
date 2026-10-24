import {surfaceAt} from '../apps/web/components/combat-audio';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DUST2,footprint,solidTop,intersects,groundAt,dustPoint,move,neutralInput,type Solid,type Motion} from '@sirocco/shared';
import {visibleFloorGeometry} from '../apps/web/components/map-geometry';

const slab=(x:number,top:number,bottom=-.3):Solid=>({x,y:(top+bottom)/2,z:0,w:4,d:4,h:top-bottom,kind:'floor'});
function horizontalArea(geometry:THREE.BufferGeometry,y:number,up=true){
  const p=geometry.attributes.position,n=geometry.attributes.normal;let area=0;
  for(let i=0;i<p.count;i+=3)if((up?n.getY(i)>.999:n.getY(i)<-.999)&&[0,1,2].every(k=>Math.abs(p.getY(i+k)-y)<1e-4)){
    area+=Math.abs((p.getX(i+1)-p.getX(i))*(p.getZ(i+2)-p.getZ(i))-(p.getZ(i+1)-p.getZ(i))*(p.getX(i+2)-p.getX(i)))/2;
  }
  return area;
}
test('overlapping floors render their shared top exactly once',()=>{
  const floors=[slab(0,2),slab(2,2)],geometries=floors.map(b=>visibleFloorGeometry(b,floors));
  assert.ok(Math.abs(geometries.reduce((sum,g)=>sum+horizontalArea(g,2),0)-24)<1e-4);
  geometries.forEach(g=>g.dispose());
});
test('floor union hides buried surfaces while retaining bridge ceiling and lower route',()=>{
  const floors=[slab(0,0),slab(0,3.8,3.35)],geometries=floors.map(b=>visibleFloorGeometry(b,floors));
  assert.equal(horizontalArea(geometries[0],0),16);
  assert.ok(Math.abs(horizontalArea(geometries[1],3.35,false)-16)<1e-4);
  assert.ok(Math.abs(horizontalArea(geometries[1],3.8)-16)<1e-4);
  geometries.forEach(g=>g.dispose());
  const terrain=[slab(0,0),{...slab(0,2),ramp:{axis:'z' as const,from:0,to:2}}];
  const base=visibleFloorGeometry(terrain[0],terrain);assert.equal(horizontalArea(base,0),0);base.dispose();
});
test('Dust II rendered floors match collision heights without holes or coincident faces',()=>{
  const floors=DUST2.solids.filter(b=>b.kind==='floor'),material=new THREE.MeshBasicMaterial();
  const meshes=floors.map(b=>new THREE.Mesh(visibleFloorGeometry(b,floors),material));
  const ray=new THREE.Raycaster();let seed=87123;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
  for(let i=0;i<2000;i++){
    const x=(random()-.5)*110,z=(random()-.5)*110;
    ray.set(new THREE.Vector3(x,25,z),new THREE.Vector3(0,-1,0));
    const hits=ray.intersectObjects(meshes,false);
    assert.ok(hits.length>0,`missing visible floor at ${x}, ${z}`);
    // groundAt includes a 1mm seam margin; a ray has no radius at stair risers.
    const exactFloors=floors.filter(b=>footprint({x,z},b,0));
    assert.ok(Math.abs(hits[0].point.y-groundAt({x,z},exactFloors))<1e-4,`render/collision height mismatch at ${x}, ${z}`);
    for(let k=1;k<hits.length;k++)assert.ok(Math.abs(hits[k].point.y-hits[k-1].point.y)>1e-4,`duplicate floor at ${x}, ${z}, ${hits[k].point.y}`);
  }
  meshes.forEach(m=>m.geometry.dispose());material.dispose();
});
test('walking across ramp/landing seams never snaps feet into a higher edge',()=>{
  const ramp:Solid={x:0,y:.85,z:0,w:4,d:8,h:2.3,kind:'floor',ramp:{axis:'z',from:0,to:2}};
  const landing:Solid={x:0,y:.85,z:5,w:4,d:2,h:2.3,kind:'floor'};
  let p:Motion={x:0,y:0,z:-4,grounded:true,vy:0};
  for(const forward of [-1,1])for(let i=0;i<53;i++){
    p=move(p,{...neutralInput(),forward},[ramp,landing]);
    assert.ok(![ramp,landing].some(b=>intersects(p,b)),`feet embedded at ${JSON.stringify(p)}`);
  }
});

// A directed grid includes drops and climbable jumps on every exposed level,
// including the old implicit Y=0 ground. Reverse reachability finds pockets
// that can be entered from a spawn but cannot return to either spawn network.
// Actual movement along the repaired routes is covered in dust2.test.ts.
test('Dust II sampled reachable surfaces all have a way back to the spawn network',()=>{
  type Node={x:number;y:number;z:number;u:number;v:number;id:number;edges:number[];reverse:number[]};
  const solids=DUST2.solids,step=5,nodes:Node[]=[],grid=new Map<string,Node[]>();
  for(let v=2.5;v<1024;v+=step)for(let u=2.5;u<1024;u+=step){
    const p=dustPoint(u,v),near=solids.filter(b=>footprint(p,b));
    for(const y of new Set([0,...near.filter(b=>footprint(p,b,0)).map(b=>solidTop(b,p))])){
      const pos={...p,y};if(near.some(b=>intersects(pos,b)))continue;
      const node:Node={...pos,u,v,id:nodes.length,edges:[],reverse:[]};nodes.push(node);
      const key=`${u},${v}`,list=grid.get(key)??[];list.push(node);grid.set(key,list);
    }
  }
  for(const a of nodes)for(const [du,dv] of [[step,0],[-step,0],[0,step],[0,-step]])for(const b of grid.get(`${a.u+du},${a.v+dv}`)??[]){
    if(b.y>a.y+1.3)continue;
    const mid={x:(a.x+b.x)/2,z:(a.z+b.z)/2,y:Math.max(a.y,b.y)+.36};
    if(solids.some(s=>intersects(mid,s)))continue;
    a.edges.push(b.id);b.reverse.push(a.id);
  }
  const roots=[...DUST2.spawns.red,...DUST2.spawns.blue].map(p=>nodes.reduce((best,a)=>Math.hypot(a.x-p.x,a.y-p.y,a.z-p.z)<Math.hypot(best.x-p.x,best.y-p.y,best.z-p.z)?a:best));
  const flood=(reverse:boolean)=>{
    const seen=new Set(roots.map(p=>p.id)),queue=[...seen];
    for(let i=0;i<queue.length;i++)for(const id of nodes[queue[i]][reverse?'reverse':'edges'])if(!seen.has(id)){seen.add(id);queue.push(id);}
    return seen;
  };
  const reachable=flood(false),returnable=flood(true),traps=nodes.filter(n=>reachable.has(n.id)&&!returnable.has(n.id));
  assert.ok(reachable.size>10000,'audit must cover the playable network');
  assert.deepEqual(traps.map(({u,v,y})=>({u,v,y})),[]);
});

test('B doors and exterior render one continuous surface across both ramp edges',()=>{
  const floors=DUST2.solids.filter(b=>b.kind==='floor'),material=new THREE.MeshBasicMaterial();
  const meshes=floors.map(b=>new THREE.Mesh(visibleFloorGeometry(b,floors),material)),ray=new THREE.Raycaster();
  for(let u=244.37;u<324;u+=2)for(let v=215.19;v<284;v+=2){
    const p=dustPoint(u,v);ray.set(new THREE.Vector3(p.x,12,p.z),new THREE.Vector3(0,-1,0));
    const hits=ray.intersectObjects(meshes,false);assert.ok(hits.length,`B floor hole at ${u},${v}`);
    assert.ok(Math.abs(hits[0].point.y-groundAt(p,floors))<1e-4,`B ramp render/collision mismatch at ${u},${v}`);
    for(let i=1;i<hits.length;i++)assert.ok(Math.abs(hits[i].point.y-hits[i-1].point.y)>1e-4,`B coplanar floor faces at ${u},${v}`);
  }
  meshes.forEach(m=>m.geometry.dispose());material.dispose();
});

test('stairwell floor sides do not duplicate the adjoining wall faces',()=>{
 const floor=DUST2.solids.find(b=>b.label==='Upper tunnels')!,walls=DUST2.solids.filter(b=>['Tunnel stairwell west','Lower tunnels block','Western central block'].includes(b.label??''));
 const geometry=visibleFloorGeometry(floor,DUST2.solids.filter(b=>b.kind==='floor'),walls),mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),ray=new THREE.Raycaster();
 for(const v of [420,436,438,455,480]){
  const p=dustPoint(288,v,1.5);ray.set(new THREE.Vector3(p.x,p.y,p.z),new THREE.Vector3(-1,0,0));ray.far=.4;
  assert.equal(ray.intersectObject(mesh).length,0,`duplicate floor face against stair wall at ${v}`);
 }
 geometry.dispose();mesh.material.dispose();
});

test('A cobblestone/road boundary footsteps match the floor that is actually rendered',()=>{
 const floors=DUST2.solids.filter(b=>b.kind==='floor'),material=new THREE.MeshBasicMaterial(),meshes=floors.map(b=>new THREE.Mesh(visibleFloorGeometry(b,floors),material)),ray=new THREE.Raycaster();
 for(const u of [880,900,920,930])for(const v of [140,149.9,150.1,160]){
  const p=dustPoint(u,v);p.y=groundAt(p,DUST2.solids);ray.set(new THREE.Vector3(p.x,20,p.z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObjects(meshes)[0];assert.ok(hit);
  const floor=floors[meshes.findIndex(mesh=>mesh===hit.object)];assert.equal(surfaceAt(p,DUST2.solids),floor.style==='road'?'asphalt':'stone',`audio differs from visible ${floor.label} at ${u},${v}`);
 }
 meshes.forEach(m=>m.geometry.dispose());material.dispose();
});
