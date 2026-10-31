import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {Client,type Room} from '@colyseus/sdk';
import {neutralInput,validInput,eyeOf,type Snapshot,type Input} from '@sirocco/shared';
import {Spectator,spectatorPose} from '../apps/web/components/spectator';
import {SpectatorHud} from '../apps/web/components/SpectatorHud';
import {Simulation} from '../apps/server/src/simulation';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';
function fixture(){const sim=new Simulation('dunes','defusal'),viewer=sim.add('viewer','Viewer'),a=sim.add('a','First'),b=sim.add('b','Second');sim.step();viewer.protectedUntil=0;sim.damage(viewer,100,viewer,'grenade',viewer);return {sim,viewer,a,b,spectator:new Spectator()};}
test('only a dead bomb-defusal player can spectate living connected players, including either team',()=>{
 const {sim,viewer,a,b,spectator}=fixture();assert.equal(spectator.sync(sim.snapshot(),viewer.id)?.id,a.id);assert.equal(spectator.next(sim.snapshot(),viewer.id)?.id,b.id);assert.equal(spectator.next(sim.snapshot(),viewer.id)?.id,a.id);
 const state=sim.snapshot();for(const invalid of [{...state,mode:'deathmatch' as const},{...state,phase:'finished' as const},{...state,players:state.players.map(p=>p.id===viewer.id?{...p,hp:100}:p)},{...state,players:state.players.map(p=>p.id===viewer.id?{...p,death:undefined}:p)}])assert.equal(spectator.sync(invalid,viewer.id),undefined);
});
test('selection stays stable and automatically skips players who die, disconnect or leave',()=>{
 const {sim,viewer,a,b,spectator}=fixture();spectator.sync(sim.snapshot(),viewer.id);a.connected=false;assert.equal(spectator.sync(sim.snapshot(),viewer.id)?.id,b.id);
 a.connected=true;assert.equal(spectator.sync(sim.snapshot(),viewer.id)?.id,b.id,'rejoining players must not steal the camera');b.hp=0;assert.equal(spectator.sync(sim.snapshot(),viewer.id)?.id,a.id);
 sim.players.delete(a.id);assert.equal(spectator.sync(sim.snapshot(),viewer.id),undefined);assert.equal(spectator.targetId,null);assert.equal(spectator.next(sim.snapshot(),viewer.id),undefined);
 b.hp=100;assert.equal(spectator.sync(sim.snapshot(),viewer.id)?.id,b.id);sim.spawn(viewer);assert.equal(spectator.sync(sim.snapshot(),viewer.id),undefined);assert.equal(spectator.targetId,null);
});
test('spectator camera follows interpolated first-person eye height, aim and shortest wrapped turn',()=>{
 const {a}=fixture(),previous={...a,x:1,y:3.2,z:2,yaw:Math.PI-.05,pitch:-.2,crouched:false},next={...a,x:5,y:4.2,z:6,yaw:-Math.PI+.05,pitch:.4,crouched:true};
 const pose=spectatorPose(previous,next,.5);assert.equal(pose.x,3);assert.equal(pose.z,4);assert.equal(pose.y,((previous.y+eyeOf(previous))+(next.y+eyeOf(next)))/2);assert.ok(Math.abs(pose.yaw-Math.PI)<1e-9);assert.ok(Math.abs(pose.pitch-.1)<1e-9);
 assert.equal(spectatorPose(previous,next,-10).x,previous.x);assert.equal(spectatorPose(previous,next,10).x,next.x);
});
test('sniper zoom is validated, synchronized and cleared by firing, reload, sprint, switching and death',()=>{
 const {sim,a}=fixture();a.weapon=a.primary='marksman';a.ammo.marksman=8;let seq=0;
 const input=(over:Partial<Input>={})=>{sim.input(a.id,{...neutralInput(),weapon:a.weapon,seq:++seq,...over});sim.step();};
 for(const scope of [0,1,2] as const)assert.equal(validInput({...neutralInput(),scope}),true);for(const scope of [-1,3,NaN,'2'])assert.equal(validInput({...neutralInput(),scope}),false);
 input({scope:2});assert.equal(a.scope,2);assert.equal(sim.snapshot().players.find(p=>p.id===a.id)!.scope,2);
 input({scope:2,sprint:true});assert.equal(a.scope,undefined);input({scope:1});assert.equal(a.scope,1);
 sim.time+=1000;input({scope:1,fire:true});assert.equal(a.scope,undefined);input({scope:1,reload:true});assert.equal(a.scope,undefined);
 input({weapon:'pistol',scope:2});assert.equal(a.scope,undefined);a.scope=2;a.protectedUntil=0;sim.damage(a,100,a,'grenade',a);assert.equal(a.scope,undefined);
});
test('spectator HUD names the player and explicitly marks Space switching as view only',()=>{
 const {a}=fixture(),html=renderToStaticMarkup(createElement(SpectatorHud,{player:a}));assert.match(html,/VIEW ONLY/);assert.match(html,/SPACE/);assert.match(html,/First/);assert.match(html,/NEXT PLAYER/);
});
test('a dead network client sees living aim and scope updates but cannot control either player',{timeout:15000},async()=>{
 const server=await createGameServer({secret:'spectator-network-secret-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[];let invite='',state:Snapshot|undefined;
 const until=async(fn:()=>boolean)=>{const start=Date.now();while(!fn()){assert.ok(Date.now()-start<4000,'Spectator snapshot arrived');await new Promise(resolve=>setTimeout(resolve,20));}};
 try{
  for(let i=0;i<3;i++){
   const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:`Spectator ${i}`,mapId:'dunes',mode:'defusal',invite:invite||undefined})}),data=await response.json();assert.equal(response.status,200);invite=data.invite;
   const room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);room.reconnection.enabled=false;room.onMessage('combat',()=>{});room.onMessage('snapshot',(snapshot:Snapshot)=>{if(i===0)state=snapshot;});rooms.push(room);
  }
  const sim=activeRooms.get(rooms[0].roomId)!.sim,viewer=sim.players.get(rooms[0].sessionId)!,target=sim.players.get(rooms[1].sessionId)!;await until(()=>sim.roundLive);
  viewer.protectedUntil=0;sim.damage(viewer,100,viewer,'grenade',viewer);await until(()=>state?.players.find(p=>p.id===viewer.id)?.hp===0);
  const spectator=new Spectator();assert.equal(spectator.sync(state!,viewer.id)?.id,target.id);target.weapon=target.primary='marksman';target.ammo.marksman=8;
  rooms[1].send('input',{...neutralInput(),seq:1,weapon:'marksman',yaw:1.2,pitch:.3,crouch:true,scope:2});await until(()=>state?.players.find(p=>p.id===target.id)?.scope===2);
  const remote=spectator.sync(state!,viewer.id)!;assert.equal(remote.yaw,1.2);assert.equal(remote.pitch,.3);assert.equal(remote.crouched,true);assert.equal(remote.weapon,'marksman');
  const position={x:viewer.x,y:viewer.y,z:viewer.z},ammo={...viewer.ammo},targetPosition={x:target.x,y:target.y,z:target.z};
  rooms[0].send('input',{...neutralInput(),seq:1,spawnId:viewer.spawnId,scope:2,weapon:'grenade',fire:true,forward:1,strafe:1,jump:true,interact:true,spray:true,summon:true});await until(()=>viewer.ack===1);
  assert.deepEqual({x:viewer.x,y:viewer.y,z:viewer.z},position);assert.deepEqual(viewer.ammo,ammo);assert.equal(sim.grenades.length,0);assert.equal(sim.sprays.length,0);assert.equal(sim.trexes.length,0);
  assert.deepEqual({x:target.x,y:target.y,z:target.z},targetPosition);assert.equal(target.yaw,1.2);assert.equal(target.scope,2);assert.equal(sim.phase,'playing');
 }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.close();}
});
