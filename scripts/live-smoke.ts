import assert from 'node:assert/strict';
import {Client,type Room} from '@colyseus/sdk';
import {intersects,MAPS,neutralInput,type Snapshot,type Player} from '@sirocco/shared';
const base=(process.env.BASE_URL??'http://127.0.0.1:3000').replace(/\/$/,'');
const mapId=process.env.MAP_ID==='relay'?'relay':'dunes';const SOLIDS=MAPS[mapId].solids;
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(fn:()=>boolean,ms=10000){const start=Date.now();while(!fn()){if(Date.now()-start>ms)throw new Error('Network assertion timeout');await wait(30);}}
type Agent={room:Room;state?:Snapshot;seq:number;updates:number};
function path(start:Player,goal:{x:number;z:number}){
  const startKey=`${Math.round(start.x)},${Math.round(start.z)}`,end=`${goal.x},${goal.z}`;
  const queue=[startKey],came=new Map<string,string|null>([[startKey,null]]);
  for(let n=0;n<queue.length;n++){
    const key=queue[n];if(key===end)break;const [x,z]=key.split(',').map(Number);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const p={x:x+dx,y:0,z:z+dz},k=`${p.x},${p.z}`;if(Math.abs(p.x)>28||Math.abs(p.z)>22||came.has(k))continue;
      if(SOLIDS.some(b=>intersects(p,{...b,w:b.w+0.24,d:b.d+0.24})))continue;
      came.set(k,key);queue.push(k);
    }
  }
  assert.ok(came.has(end),'navigation path exists');const points=[];for(let k:string|null=end;k&&k!==startKey;k=came.get(k)!){const [x,z]=k.split(',').map(Number);points.push({x,z});}return points.reverse();
}
async function drive(a:Agent,goal:{x:number;z:number}){
  const me=()=>a.state!.players.find(p=>p.id===a.room.sessionId)!;
  const points=path(me(),goal);let index=0;const started=Date.now();
  while(index<points.length){assert.ok(Date.now()-started<45000,'navigation completed within budget');const p=me(),target=points[index];const dx=target.x-p.x,dz=target.z-p.z;if(Math.hypot(dx,dz)<0.28){index++;continue;}
    a.room.send('input',{...neutralInput(),seq:++a.seq,yaw:Math.atan2(-dx,-dz),forward:Math.hypot(dx,dz)<.7?.45:1});await wait(34);
  }
  a.room.send('input',{...neutralInput(),seq:++a.seq});await wait(150);
}
async function main(){
  const agents:Agent[]=[];let invite='';const started=Date.now();
  async function join(name:string){const r=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:name,invite:invite||undefined,mapId}),signal:AbortSignal.timeout(60000)});const data=await r.json() as any;assert.equal(r.status,200,JSON.stringify(data));invite=data.invite;
    const room=await new Client(base.replace(/^http/,'ws')).consumeSeatReservation(data.reservation);room.reconnection.enabled=false;const a:Agent={room,seq:0,updates:0};agents.push(a);room.onMessage('snapshot',(s:Snapshot)=>{a.state=s;a.updates++;});room.onMessage('combat',()=>{});room.onMessage('votes',()=>{});await until(()=>!!a.state);return a;
  }
  try{
    assert.equal((await fetch(base+'/health')).status,200);const html=await (await fetch(base)).text();assert.match(html,/COUNTER STRIKE/);
    const a=await join('Verify-Red'),b=await join('Verify-Blue');assert.equal(a.room.roomId,b.room.roomId);
    assert.equal(a.state!.mapId,mapId);
    await drive(a,{x:-25,z:16});a.room.send('input',{...neutralInput(),seq:++a.seq,interact:true});await until(()=>a.state!.players.find(p=>p.id===a.room.sessionId)?.primary==='smg');
    a.room.send('input',{...neutralInput(),seq:++a.seq,crouch:true});await until(()=>a.state!.players.find(p=>p.id===a.room.sessionId)?.crouched===true);
    a.room.send('input',{...neutralInput(),seq:++a.seq});await until(()=>a.state!.players.find(p=>p.id===a.room.sessionId)?.crouched===false);
    await Promise.all([drive(a,{x:0,z:-4}),drive(b,{x:0,z:-8})]);
    const own=()=>a.state!.players.find(p=>p.id===a.room.sessionId)!,enemy=()=>a.state!.players.find(p=>p.id===b.room.sessionId)!;
    const fireStart=Date.now();while(enemy().hp>0){assert.ok(Date.now()-fireStart<5000,'live hitscan kill');const p=own(),q=enemy();a.room.send('input',{...neutralInput(),seq:++a.seq,yaw:Math.atan2(-(q.x-p.x),-(q.z-p.z)),fire:true});await wait(34);}
    a.room.send('input',{...neutralInput(),seq:++a.seq,weapon:own().weapon});assert.equal(a.state!.scores.red,1);assert.equal(own().kills,1);assert.equal(enemy().deaths,1);await until(()=>enemy().hp===100,5000);
    await drive(b,{x:0,z:-8});let exploded=false;a.room.onMessage('combat',(e:any)=>{if(e.type==='explosion'&&e.shooter===a.room.sessionId)exploded=true;});
    a.room.send('input',{...neutralInput(),seq:++a.seq,yaw:0,pitch:-1.2,weapon:'grenade',fire:true});await until(()=>own().grenades===1);await until(()=>exploded,5000);await until(()=>enemy().hp<100,2000);
    const oldId=b.room.sessionId,token=b.room.reconnectionToken;b.room.connection.close();await wait(300);const rejoined=await new Client(base.replace(/^http/,'ws')).reconnect(token);rejoined.reconnection.enabled=false;rejoined.onMessage('combat',()=>{});rejoined.onMessage('votes',()=>{});rejoined.onMessage('snapshot',(s:Snapshot)=>b.state=s);b.room=rejoined;assert.equal(rejoined.sessionId,oldId);
    for(let i=2;i<8;i++)await join(`Verify-${i}`);
    const full=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:'Ninth',invite})});assert.equal(full.status,409);
    const before=a.updates;const timer=setInterval(()=>{for(const agent of agents)agent.room.send('input',{...neutralInput(),seq:++agent.seq,yaw:0});},1000/30);await wait(5000);clearInterval(timer);const hz=(a.updates-before)/5;assert.ok(hz>=15&&hz<=24,`snapshot Hz ${hz}`);
    console.log(JSON.stringify({result:'PASS',base,mapId,checks:['homepage','health','signed-create-join','map-selection','weapon-pickup','crouch','grenade-blast-damage','navigation-and-collision','hitscan-kill','score','respawn','reconnect','eight-clients','ninth-rejected'],snapshotHz:hz,elapsedSeconds:Math.round((Date.now()-started)/1000)},null,2));
  }finally{for(const a of agents)if(a.room.connection.isOpen)await a.room.leave();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
