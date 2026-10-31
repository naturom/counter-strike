import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Client,type Room} from '@colyseus/sdk';
import {DEPOT,DEPOT_CATWALK,MAPS,BOMB_TARGET,BOMB_RULES,HEIGHT,DT,groundAt,intersects,wallDistance,move,neutralInput,plantSite,type Motion,type Input,type Player,type Snapshot} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {surfaceAt} from '../apps/web/components/combat-audio';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';
import {WorldArt,disposeGroup} from '../apps/web/components/world';
import {buildDepot} from '../apps/web/components/depot-world';

test('Depot is compact, spawns are sheltered and all ground routes, sites and racks connect',()=>{
 assert.equal(MAPS.relay,DEPOT);assert.equal(DEPOT.name,'Depot');const b=DEPOT.bounds!;assert.equal(b.maxX-b.minX,40);assert.equal(b.maxZ-b.minZ,35);
 const start=DEPOT.spawns.red[0],queue=[[start.x,start.z]],seen=new Set([`${start.x},${start.z}`]);
 for(let i=0;i<queue.length;i++){
  const [x,z]=queue[i];
  for(const [dx,dz] of [[.5,0],[-.5,0],[0,.5],[0,-.5]]){
   const p={x:x+dx,z:z+dz,y:0},key=`${p.x},${p.z}`;
   if(seen.has(key)||p.x<b.minX+.4||p.x>b.maxX-.4||p.z<b.minZ+.4||p.z>b.maxZ-.4)continue;
   p.y=groundAt(p,DEPOT.solids,.36);if(DEPOT.solids.some(s=>intersects(p,s)))continue;
   seen.add(key);queue.push([p.x,p.z]);
  }
 }
 for(const p of [...DEPOT.spawns.red,...DEPOT.spawns.blue,...DEPOT.pickups,...DEPOT.bombSites!,{x:0,z:-14.5},{x:0,z:14.5},{x:0,z:4}])assert.ok(seen.has(`${p.x},${p.z}`),`disconnected point ${JSON.stringify(p)}`);
 for(const a of DEPOT.spawns.red)for(const c of DEPOT.spawns.blue){
  const length=Math.hypot(c.x-a.x,c.z-a.z),origin={...a,y:a.y+1.6};
  assert.ok(wallDistance(origin,{x:(c.x-a.x)/length,y:0,z:(c.z-a.z)/length},DEPOT.solids)<length-1,'opposite spawns must never see each other');
 }
 for(const team of ['red','blue'] as const){const own=DEPOT.bombSites!.find(s=>s.id!==BOMB_TARGET[team])!;for(const p of DEPOT.spawns[team])assert.ok(Math.hypot(p.x-own.x,p.z-own.z)<9,'defenders start near their own site');}
});

test('both real stair flights, the bridge and its underside are traversable without jumps or hidden blockers',()=>{
 for(const side of [-1,1]){
  let p:Motion={x:side*18,y:0,z:0,vy:0,grounded:true};let highest=0;
  for(let i=0;i<230;i++){p=move(p,{...neutralInput(),yaw:side*Math.PI/2,forward:1},DEPOT.solids);highest=Math.max(highest,p.y);assert.equal(DEPOT.solids.some(b=>intersects(p,b)),false,'stairs leave full body clearance');}
  assert.ok(highest>=DEPOT_CATWALK.height-.001);assert.ok(side*p.x<-17,'cross the bridge and descend the opposite stair');assert.equal(p.y,0);assert.equal(p.grounded,true);
 }
 let below:Motion={x:0,y:0,z:-4,vy:0,grounded:true};for(let i=0;i<50;i++)below=move(below,{...neutralInput(),yaw:Math.PI,forward:1},DEPOT.solids);
 assert.ok(below.z>3,'cross underneath the bridge at ground level');assert.equal(below.y,0);
 let edge:Motion={x:0,y:DEPOT_CATWALK.height,z:0,vy:0,grounded:true};for(let i=0;i<40;i++)edge=move(edge,{...neutralInput(),forward:1},DEPOT.solids);
 assert.ok(edge.z>=-.88,'the visible guard stops a walking fall');assert.ok(Math.abs(edge.y-DEPOT_CATWALK.height)<1e-8);
 assert.ok(DEPOT.solids.find(b=>b.label==='West warehouse roof')!.y- .1-DEPOT_CATWALK.height>HEIGHT);
});

test('every painted site point is clear and plantable, and surface sounds agree with the visible floor',()=>{
 for(const site of DEPOT.bombSites!){
  for(let x=site.x-site.w/2;x<=site.x+site.w/2;x+=.25)for(let z=site.z-site.d/2;z<=site.z+site.d/2;z+=.25){
   const p={x,y:groundAt({x,z},DEPOT.solids,.5),z};assert.equal(p.y,0);assert.equal(DEPOT.solids.some(b=>intersects(p,b)),false);assert.equal(plantSite(p,'relay',site.id==='A'?'red':'blue')?.id,site.id);assert.equal(plantSite(p,'relay',site.id==='A'?'blue':'red'),undefined);
  }
 }
 assert.equal(surfaceAt({x:0,y:0,z:10},DEPOT.solids),'asphalt');assert.equal(surfaceAt({x:-18,y:0,z:14},DEPOT.solids),'asphalt');
 assert.equal(surfaceAt({x:-14,y:0,z:7},DEPOT.solids),'stone');assert.equal(surfaceAt({x:14,y:0,z:-7},DEPOT.solids),'stone');
 assert.equal(surfaceAt({x:0,y:2.8,z:0},DEPOT.solids),'metal');
 for(const side of [-1,1])for(let i=0;i<16;i++){
  const p={x:side*(17.2-(i+.5)*.45),y:(i+1)*2.8/16,z:0};assert.equal(surfaceAt(p,DEPOT.solids),'metal');
 }
});

test('Depot supports both bomb targets, defusing, unlimited time and full game resets',()=>{
 for(const team of ['red','blue'] as const){
  const sim=new Simulation('relay','defusal'),red=sim.add('red','A'),blue=sim.add('blue','B');sim.step();const actor=team==='red'?red:blue,defender=team==='red'?blue:red,site=DEPOT.bombSites!.find(s=>s.id===BOMB_TARGET[team])!;
  const send=(p:Player,extra:Partial<Input>)=>sim.input(p.id,{...neutralInput(),seq:p.ack+1,weapon:p.weapon,...extra});
  Object.assign(actor,{x:site.x,y:0,z:site.z});for(let i=0;i<99;i++){send(actor,{weapon:'bomb',fire:true});sim.step();}
  const bomb=sim.bombs.find(b=>b.team===team)!;assert.equal(bomb.status,'planted');assert.equal(bomb.siteId,site.id);assert.equal(sim.endsAt,0);
  Object.assign(defender,{x:site.x+.8,y:0,z:site.z});for(let i=0;i<302;i++){send(defender,{interact:true});sim.step();}
  assert.equal(bomb.status,'defused');assert.equal(sim.phase,'playing');
  sim.finish();sim.rematch();assert.ok(sim.bombs.every(b=>b.status==='carried'));assert.ok([...sim.players.values()].every(p=>p.weapon==='rifle'&&p.hp===100));assert.equal(sim.endsAt,0);
 }
 assert.equal(new Simulation('relay','deathmatch').bombs.length,0);
});

test('the industrial scenery is batched, stays within the arena and has bounded rendering cost',()=>{
 const before=globalThis.document,load=THREE.TextureLoader.prototype.load,ctx=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}});
 globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};
 let art:WorldArt|undefined,root:THREE.Group|undefined;
 try{
  art=new WorldArt({capabilities:{getMaxAnisotropy:()=>4}} as unknown as THREE.WebGLRenderer);root=art.build('relay');root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(root);assert.ok(bounds.min.x>=-20.5&&bounds.max.x<=20.5&&bounds.min.z>=-18&&bounds.max.z<=18,'no buildings or trees outside the map');
  let meshes=0,triangles=0,lights=0;root.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}if(o instanceof THREE.Light)lights++;});
  assert.ok(meshes<60,`static draw calls ${meshes}`);assert.ok(triangles<60000,`static triangles ${triangles}`);assert.equal(lights,0,'warehouse fixtures do not create expensive dynamic point lights');
 }finally{if(root)disposeGroup(root);art?.destroy();globalThis.document=before;THREE.TextureLoader.prototype.load=load;}
});

test('Depot has one visible face at container lids, straps, warehouse corners and bridge joins, with complete walkable floors',()=>{
 const before=globalThis.document,load=THREE.TextureLoader.prototype.load,ctx=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}});
 globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};
 let art:WorldArt|undefined,root:THREE.Group|undefined;
 try{
  art=new WorldArt({capabilities:{getMaxAnisotropy:()=>4}} as unknown as THREE.WebGLRenderer);root=buildDepot(art);root.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  const single=(origin:THREE.Vector3,dir:THREE.Vector3,label:string,range=50)=>{
   ray.set(origin,dir);ray.far=range;const hits=ray.intersectObject(root!,true);assert.ok(hits.length,`${label}: missing visible surface`);
   const nearest=hits[0].distance,owners=new Set(hits.filter(h=>Math.abs(h.distance-nearest)<.0002).map(h=>h.object.uuid));assert.equal(owners.size,1,`${label}: overlapping faces at the same depth`);return nearest;
  };
  for(const b of DEPOT.solids.filter(b=>b.kind==='crate'||b.label?.includes('cargo container'))){
   for(const dx of [0,-b.w/2+.12,b.w/2-.12])single(new THREE.Vector3(b.x+dx,b.y+b.h/2+.3,b.z+.17),new THREE.Vector3(0,-1,0),b.label!);
  }
  for(const side of [-1,1]){
   single(new THREE.Vector3(side*21,2,17.73),new THREE.Vector3(-side,0,0),'perimeter corner');
   single(new THREE.Vector3(side*20.1,5.9,.17),new THREE.Vector3(0,-1,0),'warehouse eave');
   single(new THREE.Vector3(side*10.1,3.15,2),new THREE.Vector3(0,0,-1),'stair/bridge guard join');
   single(new THREE.Vector3(side*8,2.65,2),new THREE.Vector3(0,0,-1),'bridge fascia/beam join');
   for(let i=0;i<16;i++){
    const p={x:side*(17.2-(i+.5)*.45),y:(i+1)*2.8/16,z:.17};assert.ok(Math.abs(single(new THREE.Vector3(p.x,p.y+.08,p.z),new THREE.Vector3(0,-1,0),'stair tread',.12)-.08)<1e-5);
   }
  }
  let floors=0;
  for(let x=-19;x<=19;x++)for(let z=-16;z<=16;z++){
   const p={x:x+.13,z:z+.19,y:0};p.y=groundAt(p,DEPOT.solids,.36);if(DEPOT.solids.some(s=>intersects(p,s)))continue;
   const distance=single(new THREE.Vector3(p.x,p.y+.08,p.z),new THREE.Vector3(0,-1,0),'walkable floor',.12);
   assert.ok(distance>=.06&&distance<=.0801,`floor or flush paint at ${JSON.stringify(p)}: ${distance}`);floors++;
  }
  assert.ok(floors>900,'check the full ground-level footprint');
 }finally{if(root)disposeGroup(root);art?.destroy();globalThis.document=before;THREE.TextureLoader.prototype.load=load;}
});

test('invited network players share Depot and can plant C4 in its signed room',{timeout:12000},async()=>{
 const server=await createGameServer({secret:'depot-network-test-secret-with-at-least-32-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[];let invite='';const states=new Map<string,Snapshot>();
 const until=async(fn:()=>boolean)=>{const start=Date.now();while(!fn()){assert.ok(Date.now()-start<4000,'Depot snapshot arrived');await new Promise(r=>setTimeout(r,25));}};
 try{
  for(let i=0;i<2;i++){
   const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:`Depot ${i}`,mapId:i?'dunes':'relay',mode:i?'deathmatch':'defusal',invite:invite||undefined})}),data=await response.json();assert.equal(response.status,200);assert.equal(data.mapId,'relay');assert.equal(data.mode,'defusal');invite=data.invite;
   const room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);room.reconnection.enabled=false;room.onMessage('combat',()=>{});room.onMessage('snapshot',(s:Snapshot)=>states.set(room.sessionId,s));rooms.push(room);
  }
  await until(()=>rooms.every(r=>states.get(r.sessionId)?.players.length===2));assert.equal(rooms[0].roomId,rooms[1].roomId);
  const sim=activeRooms.get(rooms[0].roomId)!.sim,p=sim.players.get(rooms[0].sessionId)!,site=DEPOT.bombSites![0];Object.assign(p,{x:site.x,y:0,z:site.z});rooms[0].send('input',{...neutralInput(),seq:1,weapon:'bomb',fire:true});await until(()=>!!sim.bombs[0].action);
  assert.equal(sim.bombs[0].action!.completeAt-sim.bombs[0].action!.startedAt,BOMB_RULES.plantMs);sim.time=sim.bombs[0].action!.completeAt-DT*1000;rooms[0].send('input',{...neutralInput(),seq:2,weapon:'bomb',fire:true});
  await until(()=>states.get(rooms[1].sessionId)?.bombs[0].status==='planted');assert.equal(states.get(rooms[1].sessionId)!.bombs[0].siteId,'A');
 }finally{for(const r of rooms)if(r.connection.isOpen)await r.leave();await server.close();}
});
