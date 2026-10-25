import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client, type Room} from '@colyseus/sdk';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';
import {neutralInput,RESPAWN_MS,dustPoint,type CombatEvent,type Snapshot} from '@sirocco/shared';
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(fn:()=>boolean,timeout=4000){const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw new Error('Timed out waiting for network state');await delay(25);}}
test('real WebSocket clients: rooms, combat, reconnect, capacity, 8-player load and fresh invite room',{timeout:30000},async()=>{
  const server=await createGameServer({secret:'test-secret-that-is-at-least-thirty-two-bytes'});const port=await server.listen();const base=`http://127.0.0.1:${port}`,ws=`ws://127.0.0.1:${port}`;const clients:Room[]=[];let token='';
  async function reserve(name:string,invite=token){const r=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:name,invite:invite||undefined})});const data=await r.json() as any;return {r,data};}
  async function join(name:string){const {r,data}=await reserve(name);assert.equal(r.status,200);token=data.invite;const room=await new Client(ws).consumeSeatReservation(data.reservation);room.reconnection.enabled=false;clients.push(room);room.onMessage('combat',()=>{});room.onMessage('votes',()=>{});return room;}
  try{
    assert.equal((await fetch(base+'/health')).status,200);
    assert.equal((await fetch(base+'/matchmake/joinOrCreate/arena',{method:'POST'})).status,403);
    assert.equal((await reserve('Bad','tampered')).r.status,400);
    const alternate=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:'Map-test',mapId:'relay'})});const alt=await alternate.json() as any;assert.equal(alt.mapId,'relay');
    const altRoom=await new Client(ws).consumeSeatReservation(alt.reservation);altRoom.onMessage('snapshot',()=>{});clients.push(altRoom);assert.equal(activeRooms.get(altRoom.roomId)!.sim.mapId,'relay');
    const other=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:'Map-guest',invite:alt.invite,mapId:'dunes'})});const otherData=await other.json() as any;assert.equal(otherData.mapId,'relay');
    const guest=await new Client(ws).consumeSeatReservation(otherData.reservation);guest.onMessage('snapshot',()=>{});assert.equal(guest.roomId,altRoom.roomId);clients.push(guest);await guest.leave();await altRoom.leave();
    clients.length=0;
    const a=await join('Alpha'),b=await join('Bravo');assert.equal(a.roomId,b.roomId);
    let state:Snapshot|undefined;let snapshots=0;a.onMessage('snapshot',(s:Snapshot)=>{state=s;snapshots++;});b.onMessage('snapshot',()=>{});
    await until(()=>!!state&&state.players.length===2);
    const sim=activeRooms.get(a.roomId)!.sim;
    const pa=sim.players.get(a.sessionId)!,pb=sim.players.get(b.sessionId)!;
    // Deterministic fixture positions injected only inside this in-process test. No network test hooks exist.
    Object.assign(pa,{...dustPoint(380,930,3.2),yaw:0,protectedUntil:0});Object.assign(pb,{...dustPoint(380,900,3.2),protectedUntil:0});
    const combat:CombatEvent[]=[];a.onMessage('combat',(e:CombatEvent)=>combat.push(e));
    let seq=0;await delay(150);a.send('input',{...neutralInput(),seq:++seq,fire:true,pitch:-1.2});
    await until(()=>!!state?.impacts.length);assert.ok(combat.some(e=>e.type==='shot'&&e.impact));assert.equal(state!.impacts[0].weapon,'rifle');
    const firing=setInterval(()=>a.send('input',{...neutralInput(),seq:++seq,fire:true}),1000/30);
    await until(()=>state?.players.find(p=>p.id===b.sessionId)?.hp===0);clearInterval(firing);const dead=state!.players.find(p=>p.id===b.sessionId)!;assert.ok(dead.death);assert.equal(dead.respawnAt-dead.death.at,RESPAWN_MS);assert.equal(state!.scores.red,1);await until(()=>combat.some(e=>e.type==='kill'));assert.equal(combat.find(e=>e.type==='kill')?.hitZone,'head');assert.equal(combat.filter(e=>e.type==='damage').length,1);assert.equal(combat.find(e=>e.type==='damage')?.damage,100);
    await until(()=>state?.players.find(p=>p.id===b.sessionId)?.hp===100,RESPAWN_MS+1500);
    const reconnectToken=b.reconnectionToken,session=b.sessionId;
    (b.connection as any).close();await until(()=>sim.players.get(session)?.connected===false);
    const restored=await new Client(ws).reconnect(reconnectToken);restored.reconnection.enabled=false;clients.push(restored);restored.onMessage('snapshot',()=>{});restored.onMessage('combat',()=>{});restored.onMessage('votes',()=>{});assert.equal(restored.sessionId,session);assert.equal(sim.players.get(session)?.deaths,1);
    for(let i=2;i<8;i++){const r=await join(`Load-${i}`);r.onMessage('snapshot',()=>{});}
    await until(()=>sim.players.size===8);assert.equal([...sim.players.values()].filter(p=>p.team==='red').length,4);
    const ninth=await reserve('Ninth');assert.equal(ninth.r.status,409);assert.match(ninth.data.error,/full/i);
    const start=performance.now();const counters=new Map<string,number>();
    const inputs=setInterval(()=>{for(const r of clients){if(r===b)continue;const seq=(counters.get(r.sessionId)??(r===a?100:0))+1;counters.set(r.sessionId,seq);r.send('input',{...neutralInput(),seq,strafe:Math.sin(seq/10),yaw:0});}},1000/30);
    const before=snapshots;await delay(3000);clearInterval(inputs);const hz=(snapshots-before)/((performance.now()-start)/1000);assert.ok(hz>=15&&hz<=24,`snapshot rate ${hz}`);assert.ok([...sim.players.values()].every(p=>Number.isFinite(p.x)));
    console.log(JSON.stringify({test:'eight_client_load',snapshotHz:Number(hz.toFixed(1)),players:sim.players.size,durationMs:3000}));
    const oldMatch=sim.matchId;for(const r of clients){if(r!==b)await r.leave();}await until(()=>!activeRooms.has(a.roomId));
    const fresh=await join('Fresh');fresh.onMessage('snapshot',()=>{});assert.notEqual(activeRooms.get(fresh.roomId)!.sim.matchId,oldMatch);assert.deepEqual(activeRooms.get(fresh.roomId)!.sim.scores,{red:0,blue:0});
  }finally{for(const r of clients)try{if(r.connection.isOpen)await r.leave();}catch{}await server.close();}
});
