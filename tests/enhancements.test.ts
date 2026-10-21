import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {Simulation} from '../apps/server/src/simulation';
import {signer} from '../apps/server/src/invites';
import {MAPS,DEFAULT_MAP,WEAPONS,move,neutralInput,intersects,nearestPickup,type Input,type Motion} from '@sirocco/shared';
function tick(s:Simulation,id:string,n:number,patch:Partial<Input>={}){for(let j=0;j<n;j++){s.input(id,{...neutralInput(),seq:(s.players.get(id)?.ack??0)+1,...patch});s.step();}}
test('default Dunes and Relay maps keep spawns and supplies clear; teams can traverse every map',()=>{
  assert.equal(DEFAULT_MAP,'dunes');
  for(const map of Object.values(MAPS)){
    for(const p of [...map.spawns.red,...map.spawns.blue,...map.pickups])assert.equal(map.solids.some(b=>intersects(p,b)),false,`${map.id}: ${JSON.stringify(p)}`);
    const queue=[[-25,19]],seen=new Set(['-25,19']);for(let n=0;n<queue.length;n++){const [x,z]=queue[n];for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,zz=z+dz,k=`${xx},${zz}`;if(Math.abs(xx)>28||Math.abs(zz)>22||seen.has(k)||map.solids.some(b=>intersects({x:xx,y:0,z:zz},b)))continue;seen.add(k);queue.push([xx,zz]);}}
    assert.ok(seen.has('25,-19'),map.id+' spawn route');for(const p of map.pickups)assert.ok(seen.has(`${p.x},${p.z}`),map.id+' supply route');
  }
});
test('map choice is signed; legacy invitation recreates Relay and map tampering fails',()=>{
  const secret='map-test-secret-with-more-than-32-bytes',s=signer(secret),token=s.create(100,'relay');assert.equal(s.verify(token,101).mapId,'relay');
  const [body,sig]=token.split('.');const p=JSON.parse(Buffer.from(body,'base64url').toString());p.mapId='dunes';assert.throws(()=>s.verify(Buffer.from(JSON.stringify(p)).toString('base64url')+'.'+sig,101));
  delete p.mapId;const legacy=Buffer.from(JSON.stringify(p)).toString('base64url');assert.equal(s.verify(legacy+'.'+createHmac('sha256',secret).update(legacy).digest('base64url'),101).mapId,'relay');
});
test('crouch changes height and speed, blocks standing beneath cover, restores standing on exit',()=>{
  let p:Motion={x:0,y:0,z:0,vy:0,grounded:true,crouched:false};const standing=move(p,{...neutralInput(),forward:1},[]);const crouched=move(p,{...neutralInput(),forward:1,crouch:true,sprint:true},[]);assert.ok(Math.abs(crouched.z)<Math.abs(standing.z));assert.equal(crouched.crouched,true);
  const roof={x:0,y:1.5,z:0,w:4,h:.4,d:4,kind:'roof' as const};p={...p,crouched:true};assert.equal(move(p,neutralInput(),[roof]).crouched,true);p.x=5;assert.equal(move(p,neutralInput(),[roof]).crouched,false);
});
test('crouched hitbox can be missed above the head and damaged by correctly aimed shots',()=>{
  const s=new Simulation([]),a=s.add('a','A'),b=s.add('b','B');Object.assign(a,{x:0,z:2,protectedUntil:0});Object.assign(b,{x:0,z:-4,crouched:true,protectedUntil:0});tick(s,'a',6,{fire:true});assert.equal(b.hp,100);tick(s,'a',6,{fire:true,pitch:-.14});assert.ok(b.hp<100);assert.ok(s.events.some(e=>e.type==='damage')||b.hp<=50);
});
test('pickup requires range and line of sight, fills primary, keeps pistol, cannot equip unowned guns',()=>{
  const s=new Simulation([]),p=s.add('a','A');tick(s,'a',1,{weapon:'marksman'});assert.equal(p.weapon,'rifle');const item=s.pickups[0];Object.assign(p,{x:item.x,z:item.z});tick(s,'a',1,{interact:true});assert.equal(p.primary,'smg');assert.equal(p.weapon,'smg');assert.equal(p.ammo.smg,40);assert.equal(p.ammo.pistol,12);assert.ok(item.availableAt>s.time);
  tick(s,'a',1,{weapon:'pistol'});assert.equal(p.weapon,'pistol');tick(s,'a',1,{weapon:'smg'});assert.equal(p.weapon,'smg');
  p.x+=3;assert.equal(nearestPickup(p,[{...item,availableAt:0}],s.time,[]),undefined);p.x=item.x+1;assert.equal(nearestPickup(p,[{...item,availableAt:0}],s.time,[{x:item.x+.5,y:1,z:item.z,w:.2,h:2,d:3,kind:'wall'}]),undefined);
});
test('supplies are exclusive and return after 20 seconds; DMR reload uses its own magazine',()=>{
  const s=new Simulation([]),a=s.add('a','A'),b=s.add('b','B'),supply=s.pickups[2];Object.assign(a,{x:supply.x,z:supply.z});Object.assign(b,{x:supply.x,z:supply.z});s.pickup(a);s.pickup(b);assert.equal(a.primary,'marksman');assert.equal(b.primary,'rifle');a.ammo.marksman=1;tick(s,'a',1,{weapon:'marksman',reload:true});tick(s,'a',73,{weapon:'marksman'});assert.equal(a.ammo.marksman,WEAPONS.marksman.magazine);s.time=supply.availableAt;s.pickup(b);assert.equal(b.primary,'marksman');
});
test('grenades consume inventory, use a fuse and cannot be spammed by held input',()=>{
  const s=new Simulation([]),p=s.add('a','A');Object.assign(p,{x:0,z:0});tick(s,'a',10,{grenade:true});assert.equal(p.grenades,1);assert.equal(s.grenades.length,1);assert.ok(s.grenades[0].z<0);for(let j=0;j<80;j++)s.step();assert.equal(s.grenades.length,0);tick(s,'a',1);tick(s,'a',1,{grenade:true});assert.equal(p.grenades,0);tick(s,'a',20);tick(s,'a',1,{grenade:true});assert.equal(p.grenades,0);assert.equal(s.grenades.length,1);
});
test('grenades bounce off walls and explode with damage falloff, cover and friendly-fire protection',()=>{
  const s=new Simulation([]),a=s.add('a','A'),b=s.add('b','B'),c=s.add('c','C');Object.assign(a,{x:20,z:20,protectedUntil:0});Object.assign(b,{x:1,z:0,protectedUntil:0});Object.assign(c,{x:1,z:1,protectedUntil:0});
  s.grenades=[{id:1,owner:a.id,team:a.team,x:0,y:.3,z:0,vx:0,vy:0,vz:0,explodeAt:0}];s.step();assert.equal(b.hp,0);assert.equal(c.hp,100);assert.equal(s.scores.red,1);assert.ok(s.events.some(e=>e.type==='explosion'));
  s.spawn(b);Object.assign(b,{x:3,z:0,protectedUntil:0});s.solids=[{x:1.5,y:2,z:0,w:.5,h:4,d:8,kind:'wall'}];s.grenades=[{id:2,owner:a.id,team:a.team,x:0,y:.4,z:0,vx:0,vy:0,vz:0,explodeAt:0}];s.step();assert.equal(b.hp,100);
  s.grenades=[{id:3,owner:a.id,team:a.team,x:0,y:1,z:0,vx:17,vy:0,vz:0,explodeAt:s.time+2000}];for(let i=0;i<4;i++)s.step();assert.ok(s.grenades[0].vx<0);assert.ok(s.grenades[0].x<1.25);
});
test('rematch and respawn reset grenade supply and equipped primary; damage carries remaining HP',()=>{
  const s=new Simulation([]),a=s.add('a','A'),b=s.add('b','B');b.protectedUntil=0;s.damage(b,25,a,'rifle',a);assert.equal(s.events.at(-1)?.hp,75);assert.equal(s.events.at(-1)?.damage,25);a.grenades=0;a.primary='smg';s.finish();s.rematch();assert.equal(a.grenades,2);assert.equal(a.primary,'rifle');assert.equal(s.grenades.length,0);
});
