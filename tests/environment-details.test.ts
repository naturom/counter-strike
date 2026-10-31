import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DUST2,groundAt,dustPoint,wallDistance} from '@sirocco/shared';
import {doorFrame,buildDoor,wallSignMount,DUST_ROUTE_SIGNS,roadPaintGeometry,facadeCable,DUST_CABLES} from '../apps/web/components/environment-details';
import {WorldArt} from '../apps/web/components/world';
test('rendered gate axes and plank silhouettes match each authoritative collision leaf',()=>{
 const art=Object.create(WorldArt.prototype) as WorldArt,wood=new THREE.MeshStandardMaterial(),iron=new THREE.MeshStandardMaterial();
 for(const door of DUST2.solids.filter(s=>s.style==='door')){
  const f=doorFrame(door),group=buildDoor(art,door,wood,iron);group.updateMatrixWorld(true);
  const corners=[[-f.width/2,-f.depth/2],[f.width/2,-f.depth/2],[f.width/2,f.depth/2],[-f.width/2,f.depth/2]].map(([x,z])=>new THREE.Vector3(x,0,z).applyMatrix4(group.matrixWorld));
  for(const [x,z] of door.polygon!)assert.ok(corners.some(c=>Math.hypot(c.x-x,c.z-z)<1e-6),door.label);
  const ray=new THREE.Raycaster();for(const side of [-1,1])for(const y of [-door.h*.42,0,door.h*.42]){
   const origin=group.localToWorld(new THREE.Vector3(f.width*.17,y,side*(f.depth/2+.3))),direction=new THREE.Vector3(0,0,-side).transformDirection(group.matrixWorld);ray.set(origin,direction);assert.ok(ray.intersectObject(group,true).length,`${door.label}: missing timber face`);
  }
  group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
 }
 wood.dispose();iron.dispose();
});
test('all gate leaf bottoms reach the supporting ground, including the falling B threshold',()=>{
 const floors=DUST2.solids.filter(s=>s.kind==='floor');
 for(const door of DUST2.solids.filter(s=>s.style==='door'))for(const [x,z] of door.polygon!){assert.ok(door.y-door.h/2<=groundAt({x,z},floors)+.025,`${door.label} floats above its approach`);}
 const lintel=DUST2.solids.find(s=>s.label==='B gate lintel')!;assert.ok(lintel.y-lintel.h/2>=5.4-1e-6);
});

test('every route plaque is supported across its width and stands clear of its wall',()=>{
 for(const sign of DUST_ROUTE_SIGNS){
  const mount=wallSignMount(DUST2.solids.filter(b=>b.label===sign.wall),dustPoint(sign.u,sign.v),1.8);
  const nx=Math.sin(mount.rotation),nz=Math.cos(mount.rotation);
  for(const offset of [-.9,0,.9])for(const dy of [-.45,.45]){
   const p={x:mount.x+nz*offset,y:sign.y+dy,z:mount.z-nx*offset};
   const distance=wallDistance(p,{x:-nx,y:0,z:-nz},[mount.wall]);
   assert.ok(Math.abs(distance-.045)<1e-5,`${sign.text} unsupported or embedded: ${distance}`);
  }
 }
});

test('Long lane paint follows the road at both ends of every stripe without raised blocks',()=>{
 const floors=DUST2.solids.filter(b=>b.kind==='floor');
 for(let v=155;v<500;v+=12){const p=dustPoint(920,v),geo=roadPaintGeometry(floors,p.x,p.z,.22,1.25),vertices=geo.attributes.position;
  for(let i=0;i<vertices.count;i++)assert.ok(Math.abs(vertices.getY(i)-groundAt({x:vertices.getX(i),z:vertices.getZ(i)},floors)-.008)<1e-5,`paint floats at ${v}`);
  const normal=geo.attributes.normal;for(let i=0;i<normal.count;i++)assert.ok(normal.getY(i)>.9,'paint must face up');geo.dispose();
 }
});

test('Dust III utility cables terminate at façade brackets below the roofline',()=>{
 const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.trim=new THREE.MeshStandardMaterial();const metal=new THREE.MeshStandardMaterial(),root=new THREE.Group();
 const spans=DUST_CABLES.map(c=>({a:DUST2.solids.filter(b=>b.label===c.a),b:DUST2.solids.filter(b=>b.label===c.b),from:dustPoint(c.from[0],c.from[1]),to:dustPoint(c.to[0],c.to[1])}));
 for(const span of spans){const {cable,mounts,height}=facadeCable(art,root,span.a,span.b,span.from,span.to,metal),p=cable.geometry.attributes.position;
  mounts.forEach((m,i)=>{const index=i?p.count-1:0,origin={x:p.getX(index),y:p.getY(index),z:p.getZ(index)},normal={x:Math.sin(m.rotation),y:0,z:Math.cos(m.rotation)};
   assert.ok(Math.abs(wallDistance(origin,{x:-normal.x,y:0,z:-normal.z},[m.wall])-.17)<1e-4,'cable must terminate at its wall bracket');
   assert.ok(height<m.wall.y+m.wall.h/2-.5,'cable cannot attach above its roof');
  });
 }
 root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line)o.geometry.dispose();});art.materials.forEach(m=>m.dispose());art.trim.dispose();metal.dispose();
});
