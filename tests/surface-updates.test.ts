import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client,type Room} from '@colyseus/sdk';
import {SurfaceCursor,SurfaceCache,impactTarget,type ImpactMark,type Snapshot,type SnapshotUpdate,type SurfaceUpdate} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';

const mark=(id:number,at=0):ImpactMark=>({...impactTarget({x:0,y:2,z:0},{x:0,y:-1,z:0},[])!,id,at,weapon:'rifle',expiresAt:120000+at});
const compact=(s:Snapshot)=>{const {impacts,sprays,...motion}=s;return motion;};
test('surface deltas preserve marks through additions, eviction, expiry, rematch, duplicate delivery and reconnect reset',()=>{
 const cursor=new SurfaceCursor(),cache=new SurfaceCache(),sim=new Simulation([]);sim.impacts=Array.from({length:160},(_,i)=>mark(i));let s=sim.snapshot();cache.apply(cursor.next(s,true)!);assert.deepEqual(cache.merge(compact(s)),s);assert.equal(cursor.next(s),undefined);
 for(let i=160;i<190;i++){sim.impacts.push(mark(i));sim.impacts.shift();s=sim.snapshot();const delta=cursor.next(s)!;assert.equal(delta.impacts.length,1);assert.equal(delta.removedImpacts.length,1);cache.apply(delta);cache.apply(delta);assert.deepEqual(cache.merge(compact(s)),s);}
 sim.sprays=[{id:200,owner:'p',position:{x:0,y:0,z:0},normal:{x:0,y:1,z:0},expiresAt:120000}];s=sim.snapshot();cache.apply(cursor.next(s)!);assert.deepEqual(cache.merge(compact(s)),s);
 sim.impacts=[];sim.sprays=[];sim.round++;s=sim.snapshot();cache.apply(cursor.next(s)!);assert.deepEqual(cache.merge(compact(s)),s);
 sim.impacts=[mark(300)];s=sim.snapshot();cache.apply(new SurfaceCursor().next(s,true)!);assert.deepEqual(cache.merge(compact(s)),s);assert.deepEqual(new SurfaceCache().merge(s),s,'legacy full snapshots remain valid');
});
test('sustained fire sends additions rather than resending 160 unchanged impact records',()=>{
 const sim=new Simulation([]),cursor=new SurfaceCursor();for(let i=0;i<6;i++)sim.add(String(i),'Player '+i);sim.impacts=Array.from({length:160},(_,i)=>mark(i));cursor.next(sim.snapshot(),true);let fullBytes=0,deltaBytes=0;
 for(let i=0;i<100;i++){for(let n=0;n<3;n++){sim.impacts.push(mark(160+i*3+n,i*50));sim.impacts.shift();}const state=sim.snapshot(),delta=cursor.next(state)!;fullBytes+=JSON.stringify(state).length;deltaBytes+=JSON.stringify(compact(state)).length+JSON.stringify(delta).length;assert.equal(delta.impacts.length,3);}
 assert.ok(deltaBytes<fullBytes*.12,`expected at least 88% less JSON data during sustained firing: ${deltaBytes}/${fullBytes}`);
});
test('negotiated clients receive ordered surface deltas, legacy clients retain full state, and reconnect restores marks',{timeout:15000},async()=>{
 const server=await createGameServer({secret:'surface-test-secret-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[],wire:SnapshotUpdate[]=[],deltas:SurfaceUpdate[]=[];let invite='',current:Snapshot|undefined,legacy:Snapshot|undefined;
 const until=async(check:()=>boolean)=>{const start=Date.now();while(!check()){assert.ok(Date.now()-start<5000,'surface state arrived');await new Promise(r=>setTimeout(r,20));}};
 const join=async()=>{const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:'Player',invite:invite||undefined})}),data=await response.json();invite=data.invite;const room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);room.reconnection.enabled=false;room.onMessage('combat',()=>{});room.onMessage('votes',()=>{});rooms.push(room);return room;};
 const negotiate=(room:Room)=>{const cache=new SurfaceCache();room.onMessage('surfaceUpdates',(d:SurfaceUpdate)=>{deltas.push(d);cache.apply(d);});room.onMessage('snapshot',(s:SnapshotUpdate)=>{wire.push(s);current=cache.merge(s);});room.send('surfaceUpdates',1);};
 try{
  const modern=await join();negotiate(modern);const old=await join();old.onMessage('snapshot',(s:Snapshot)=>legacy=s);
  const sim=activeRooms.get(modern.roomId)!.sim;sim.impacts=Array.from({length:160},(_,i)=>mark(i,sim.time));await until(()=>current?.impacts.length===160&&legacy?.impacts.length===160&&wire.at(-1)?.impacts===undefined);
  assert.deepEqual(current!.impacts,legacy!.impacts);const count=deltas.length,before=current!.time;await until(()=>current!.time>before+150);assert.equal(deltas.length,count,'movement-only snapshots must not repeat marks');
  sim.impacts.push(mark(200,sim.time));sim.impacts.shift();await until(()=>current?.impacts.at(-1)?.id===200&&legacy?.impacts.at(-1)?.id===200);assert.equal(deltas.at(-1)!.impacts.length,1);assert.deepEqual(deltas.at(-1)!.removedImpacts,[0]);
  const token=modern.reconnectionToken,id=modern.sessionId;modern.connection.close();await until(()=>sim.players.get(id)?.connected===false);const restored=await new Client(base.replace('http:','ws:')).reconnect(token);rooms.push(restored);restored.reconnection.enabled=false;restored.onMessage('combat',()=>{});restored.onMessage('votes',()=>{});current=undefined;negotiate(restored);await until(()=>current?.impacts.length===160);assert.equal(current!.impacts.at(-1)!.id,200);
  sim.phase='finished';sim.rematch();await until(()=>current?.round===2&&legacy?.round===2);assert.equal(current!.impacts.length,0);assert.equal(legacy!.impacts.length,0);
 }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.close();}
});
