import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client,type Room} from '@colyseus/sdk';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';
import {neutralInput,dustPoint,MAPS,type Snapshot} from '@sirocco/shared';
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(fn:()=>boolean,timeout=15000){const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw new Error('Bomb network state timed out');await delay(25);}}
test('signed defusal room supports both team plants, an enemy defuse, and the remaining bomb winning',{timeout:25000},async()=>{
 const server=await createGameServer({secret:'defusal-network-test-secret-over-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`;
 const rooms:Room[]=[],timers:ReturnType<typeof setInterval>[]=[];let state:Snapshot|undefined;
 try{
  const reserve=async(body:unknown)=>{const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,200);return response.json() as Promise<any>;};
  const a=await reserve({nickname:'Planter',mapId:'dunes',mode:'defusal'});assert.equal(a.mode,'defusal');
  const red=await new Client(base.replace('http:','ws:')).consumeSeatReservation(a.reservation);rooms.push(red);red.onMessage('snapshot',(s:Snapshot)=>state=s);red.onMessage('combat',()=>{});red.onMessage('votes',()=>{});
  const b=await reserve({nickname:'Defuser',invite:a.invite,mapId:'relay',mode:'deathmatch'});assert.equal(b.mode,'defusal');assert.equal(b.mapId,'dunes');
  const blue=await new Client(base.replace('http:','ws:')).consumeSeatReservation(b.reservation);rooms.push(blue);blue.onMessage('snapshot',()=>{});blue.onMessage('combat',()=>{});blue.onMessage('votes',()=>{});
  await until(()=>!!state?.roundLive);const sim=activeRooms.get(red.roomId)!.sim;
  Object.assign(sim.players.get(red.sessionId)!,MAPS.dunes.bombSites!.find(site=>site.id==='A')!.marker);let rseq=0,bseq=0;
  const planting=setInterval(()=>red.send('input',{...neutralInput(),seq:++rseq,weapon:'bomb',fire:true}),1000/30);timers.push(planting);
  await until(()=>state?.bomb?.status==='planted',7000);clearInterval(planting);assert.equal(state?.bomb?.siteId,'A');
  const marker=MAPS.dunes.bombSites!.find(site=>site.id==='B')!.marker;
  Object.assign(sim.players.get(blue.sessionId)!,{x:marker.x,y:marker.y,z:marker.z});
  const bluePlant=setInterval(()=>blue.send('input',{...neutralInput(),seq:++bseq,weapon:'bomb',fire:true}),1000/30);timers.push(bluePlant);
  await until(()=>state?.bombs[1].status==='planted',7000);clearInterval(bluePlant);assert.equal(state?.bombs[1].siteId,'B');
  Object.assign(sim.players.get(blue.sessionId)!,MAPS.dunes.bombSites!.find(site=>site.id==='A')!.marker);
  const defusing=setInterval(()=>blue.send('input',{...neutralInput(),seq:++bseq,interact:true}),1000/30);timers.push(defusing);
  await until(()=>state?.bomb?.action?.kind==='defuse');await until(()=>state?.bomb?.status==='defused',14000);assert.equal(state?.phase,'playing');
  sim.time=sim.bombs[1].explodeAt;await until(()=>state?.phase==='finished');
  assert.equal(state?.winner,'blue');assert.equal(state?.bomb?.status,'defused');assert.equal(state?.mode,'defusal');
 }finally{timers.forEach(clearInterval);for(const room of rooms)try{await room.leave();}catch{}await server.close();}
});
