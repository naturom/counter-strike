import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client,type Room} from '@colyseus/sdk';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';
import {neutralInput,type Snapshot,type CombatEvent} from '@sirocco/shared';
test('summons, shared creature HP, deaths and the room limit reach real and late-joining clients',{timeout:20000},async()=>{
 const server=await createGameServer({secret:'test-secret-that-is-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[],states=new Map<string,Snapshot>(),seq=new Map<string,number>(),events:CombatEvent[]=[];let invite='';
 const until=async(fn:()=>boolean,timeout=6000)=>{const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw new Error('Creature network check timed out');await new Promise(r=>setTimeout(r,25));}};
 async function join(name:string){const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:name,invite:invite||undefined})}),data=await response.json();assert.equal(response.status,200);invite=data.invite;const room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);room.reconnection.enabled=false;rooms.push(room);room.onMessage('snapshot',(state:Snapshot)=>states.set(room.sessionId,state));room.onMessage('combat',(event:CombatEvent)=>events.push(event));room.onMessage('votes',()=>{});await until(()=>states.has(room.sessionId));return room;}
 function send(room:Room,patch:Record<string,unknown>={}){const next=(seq.get(room.sessionId)??0)+1;seq.set(room.sessionId,next);room.send('input',{...neutralInput(),seq:next,...patch});}
 try{
  const a=await join('Summoner'),b=await join('Hunter'),sim=activeRooms.get(a.roomId)!.sim;sim.solids=[];for(const [i,room] of [a,b].entries())Object.assign(sim.players.get(room.sessionId)!,{x:i*3,y:0,z:10,grounded:true,yaw:0,protectedUntil:1e9});
  send(a,{summon:true});await until(()=>states.get(b.sessionId)!.trexes.length===1);const id=states.get(b.sessionId)!.trexes[0].id;assert.equal(states.get(b.sessionId)!.trexes[0].hp,1000);
  const c=await join('Late viewer');assert.equal(states.get(c.sessionId)!.trexes[0].id,id);
  for(let i=0;i<6;i++)send(i%2?a:b,{summon:true});await until(()=>states.get(c.sessionId)!.trexes.length===3);await new Promise(r=>setTimeout(r,100));assert.equal(sim.trexes.length,3);
  // Deterministic fixture keeps the targeted animal clear of the other two.
  const target=sim.trexes.find(t=>t.id===id)!;target.x=0;target.z=2;for(const t of sim.trexes)if(t!==target){t.x=25;t.z=-20;}
  const start=Date.now();while(target.hp>0){assert.ok(Date.now()-start<6500);for(const room of [a,b]){const p=sim.players.get(room.sessionId)!;p.protectedUntil=1e9;const dx=target.x-p.x,dz=target.z-p.z;send(room,{fire:true,yaw:Math.atan2(-dx,-dz),pitch:Math.atan2(target.y+2.1-(p.y+1.6),Math.hypot(dx,dz))});}await new Promise(r=>setTimeout(r,34));}
  send(a);send(b);await until(()=>states.get(c.sessionId)!.trexes.some(t=>t.id===id&&t.hp===0&&t.state==='dead'));assert.ok(events.some(e=>e.type==='damage'&&e.target===id&&e.hp!<1000));assert.ok(events.some(e=>e.type==='trexDeath'&&e.target===id));assert.ok(sim.trexes.length<=3);assert.deepEqual(sim.scores,{red:0,blue:0});
 }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.close();}
});
