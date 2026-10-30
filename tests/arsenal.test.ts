import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WEAPONS,MAPS,GUNS,freshAmmo,isSidearm,neutralInput,validInput,intersects,groundAt,type Weapon,type Player,type Input} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';
import {Client,type Room} from '@colyseus/sdk';
import type {Snapshot} from '@sirocco/shared';
const added:Weapon[]=['ak47','m4a1s','p90','scar','m249','deagle'];
function control(s:Simulation,p:Player,over:Partial<Input>={}){s.input(p.id,{...neutralInput(),seq:p.ack+1,weapon:p.weapon,...over});s.step();}
test('every new gun is obtainable on both maps with grounded, unobstructed and separated racks',()=>{
 for(const map of Object.values(MAPS)){
  for(const weapon of added)assert.ok(map.pickups.some(p=>p.weapon===weapon),`${map.id}: missing ${weapon}`);
  for(const rack of map.pickups){assert.equal(map.solids.some(b=>intersects(rack,b)),false,`${map.id} ${rack.id}: rack blocked by map geometry`);assert.ok(Math.abs(groundAt(rack,map.solids,rack.y+.1)-rack.y)<.02,`${map.id} ${rack.id}: rack is not on the floor`);}
  for(const rack of map.pickups)for(const other of map.pickups)if(rack!==other)assert.ok(Math.hypot(rack.x-other.x,rack.z-other.z)>2.1,`${map.id}: overlapping ${rack.id} / ${other.id}`);
 }
});
test('pickups preserve the other gun slot and reset sidearms, ammo and ownership on a new life',()=>{
 const s=new Simulation([]),p=s.add('a','A');
 for(const weapon of added){
  const originalPrimary=p.primary,originalSecondary=p.secondary;
  s.pickups=[{id:weapon,x:p.x,y:p.y,z:p.z,weapon,availableAt:0}];s.pickup(p);
  assert.equal(p.weapon,weapon);assert.equal(p.ammo[weapon],WEAPONS[weapon].magazine);
  assert.equal(isSidearm(weapon)?p.primary:p.secondary,isSidearm(weapon)?originalPrimary:originalSecondary);
  assert.equal(isSidearm(weapon)?p.secondary:p.primary,weapon);
 }
 control(s,p,{weapon:p.primary});assert.equal(p.weapon,'m249');control(s,p,{weapon:'deagle'});assert.equal(p.weapon,'deagle');
 control(s,p,{weapon:'pistol'});assert.equal(p.weapon,'deagle','a replaced pistol is not secretly a third gun');
 s.spawn(p);assert.equal(p.primary,'rifle');assert.equal(p.secondary,'pistol');assert.deepEqual(p.ammo,freshAmmo());
 for(const weapon of added){control(s,p,{weapon});assert.equal(p.weapon,'rifle','unowned weapons cannot be selected');}
});
test('new gun fire consumes a round, reloads to the right magazine and keeps the one-hit headshot rule',()=>{
 for(const weapon of added){
  const s=new Simulation([]),a=s.add('a','A'),b=s.add('b','B');Object.assign(a,{x:0,y:0,z:0,yaw:0,pitch:0,weapon,primary:isSidearm(weapon)?'rifle':weapon,secondary:isSidearm(weapon)?weapon:'pistol',protectedUntil:0});Object.assign(b,{x:0,y:0,z:-8,protectedUntil:0});a.ammo[weapon]=WEAPONS[weapon].magazine;
  s.fire(a);assert.equal(a.ammo[weapon],WEAPONS[weapon].magazine-1);assert.equal(b.hp,0);assert.equal(a.kills,1);
  assert.ok(s.events.some(event=>event.type==='shot'&&event.weapon===weapon));assert.ok(s.events.some(event=>event.type==='kill'&&event.hitZone==='head'));
  control(s,a,{reload:true});assert.ok(a.reloadUntil>s.time);const done=a.reloadUntil;s.time=done;s.step();assert.equal(a.ammo[weapon],WEAPONS[weapon].magazine);assert.equal(a.reloadUntil,0);
 }
 assert.ok(GUNS.every(weapon=>validInput({...neutralInput(),weapon})));
});
test('automatic guns repeat while held, while the Desert Eagle requires another press',()=>{
 for(const weapon of added){
  const s=new Simulation([]),p=s.add('a','A');p.weapon=weapon;p.primary=isSidearm(weapon)?'rifle':weapon;p.secondary=isSidearm(weapon)?weapon:'pistol';p.ammo[weapon]=WEAPONS[weapon].magazine;s.time=500;
  for(let i=0;i<30;i++)control(s,p,{fire:true});
  assert.equal(p.ammo[weapon]<WEAPONS[weapon].magazine-1,WEAPONS[weapon].automatic,weapon);
  if(weapon==='deagle'){control(s,p);control(s,p,{fire:true});assert.equal(p.ammo.deagle,5);}
 }
});
test('real clients share every new pickup and the updated primary/sidearm inventory',{timeout:15000},async()=>{
 const server=await createGameServer({secret:'new-arsenal-network-secret-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,clients:Room[]=[];let invite='',view:Snapshot|undefined;
 async function until(fn:()=>boolean){const at=Date.now();while(!fn()){assert.ok(Date.now()-at<3000,'Timed out waiting for inventory snapshot');await new Promise(resolve=>setTimeout(resolve,25));}}
 try{
  for(let i=0;i<2;i++){
   const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:`Arsenal ${i}`,mapId:'relay',invite:invite||undefined})});assert.equal(response.status,200);const data=await response.json();invite=data.invite;
   const room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);room.reconnection.enabled=false;room.onMessage('combat',()=>{});room.onMessage('snapshot',(state:Snapshot)=>{if(i===1)view=state;});clients.push(room);
  }
  const sim=activeRooms.get(clients[0].roomId)!.sim,p=sim.players.get(clients[0].sessionId)!;let seq=0;
  for(const weapon of added){
   const rack=sim.pickups.find(rack=>rack.weapon===weapon)!;Object.assign(p,{x:rack.x,y:rack.y,z:rack.z});
   clients[0].send('input',{...neutralInput(),seq:++seq,weapon:p.weapon,interact:true});
   await until(()=>view?.players.find(player=>player.id===p.id)?.weapon===weapon);
   clients[0].send('input',{...neutralInput(),seq:++seq,weapon});await until(()=>p.ack===seq);
   const remote=view!.players.find(player=>player.id===p.id)!;assert.equal(remote.ammo[weapon],WEAPONS[weapon].magazine);assert.equal(isSidearm(weapon)?remote.secondary:remote.primary,weapon);
  }
  assert.equal(p.primary,'m249');assert.equal(p.secondary,'deagle');
  clients[0].send('input',{...neutralInput(),seq:++seq,weapon:'m249'});await until(()=>view?.players.find(player=>player.id===p.id)?.weapon==='m249');
  clients[0].send('input',{...neutralInput(),seq:++seq,weapon:'deagle'});await until(()=>view?.players.find(player=>player.id===p.id)?.weapon==='deagle');
 }finally{for(const room of clients)if(room.connection.isOpen)await room.leave();await server.close();}
});
