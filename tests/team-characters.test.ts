import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {Client,type Room} from '@colyseus/sdk';
import {AVATARS,DEFAULT_TEAM_AVATARS,validTeamAvatars,type Snapshot,type TeamAvatars} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {signer} from '../apps/server/src/invites';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';

test('every distinct team character pairing survives balancing, respawn and a new game',()=>{
 for(const red of AVATARS)for(const blue of AVATARS){
  if(red.id===blue.id)continue;
  const pair={red:red.id,blue:blue.id},sim=new Simulation('dunes','defusal',pair);
  for(let i=0;i<6;i++)sim.add(String(i),'Player '+i);
  const check=()=>{assert.deepEqual(sim.snapshot().teamAvatars,pair);for(const p of sim.players.values())assert.equal(p.avatar,pair[p.team]);};
  check();assert.equal([...sim.players.values()].filter(p=>p.team==='red').length,3);
  for(const p of sim.players.values()){p.avatar='operator';sim.spawn(p);}check();
  sim.phase='finished';sim.rematch();check();
  sim.remove('0');const replacement=sim.add('replacement','New');assert.equal(replacement.team,'red');check();
 }
 const pair:Record<'red'|'blue',string>={red:'wonder-woman',blue:'ironman'},sim=new Simulation('relay','deathmatch',pair as TeamAvatars);
 pair.red='ultraman';assert.equal(sim.add('one','One').avatar,'wonder-woman','room settings are copied');
 for(const invalid of [null,{},[],{red:'ironman'}, {red:'ironman',blue:'ironman'},{red:'hulk',blue:'ultraman'},{red:'invalid',blue:'ironman'}]){
  assert.equal(validTeamAvatars(invalid),false);assert.throws(()=>new Simulation('relay','deathmatch',invalid as TeamAvatars));
 }
});

test('signed invitations preserve team characters, reject tampering and accept old links',()=>{
 const secret='team-character-invitation-secret-at-least-32-bytes',signs=signer(secret),pair={red:'wonder-woman',blue:'ironman'} as const;
 const token=signs.create(100,'dunes','defusal',pair);assert.deepEqual(signer(secret).verify(token,101).teamAvatars,pair);
 const [body,signature]=token.split('.'),payload=JSON.parse(Buffer.from(body,'base64url').toString());
 payload.teamAvatars.red='ultraman';assert.throws(()=>signs.verify(Buffer.from(JSON.stringify(payload)).toString('base64url')+'.'+signature,101));
 const signed=(data:unknown)=>{const b=Buffer.from(JSON.stringify(data)).toString('base64url');return b+'.'+createHmac('sha256',secret).update(b).digest('base64url');};
 const {teamAvatars,...legacy}=payload;assert.deepEqual(signs.verify(signed(legacy),101).teamAvatars,DEFAULT_TEAM_AVATARS);
 assert.throws(()=>signs.verify(signed({...payload,teamAvatars:{red:'ironman',blue:'ironman'}}),101),/team characters/);
 assert.throws(()=>signs.create(100,'relay','deathmatch',{red:'ironman',blue:'ironman'}),/different character/);
});

test('room creator chooses team appearances; guests cannot override them across reconnects and games',{timeout:20000},async()=>{
 const server=await createGameServer({secret:'team-character-network-secret-at-least-32-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[],states=new Map<string,Snapshot>();
 const pair={red:'wonder-woman',blue:'ironman'} as const;
 const post=(body:unknown)=>fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const until=async(check:()=>boolean)=>{const start=Date.now();while(!check()){assert.ok(Date.now()-start<6000,'configured team snapshot arrived');await new Promise(r=>setTimeout(r,25));}};
 const attach=(room:Room)=>{room.reconnection.enabled=false;room.onMessage('combat',()=>{});room.onMessage('snapshot',(s:Snapshot)=>states.set(room.sessionId,s));rooms.push(room);};
 const check=(s:Snapshot)=>{assert.deepEqual(s.teamAvatars,pair);for(const p of s.players)assert.equal(p.avatar,pair[p.team]);};
 try{
  for(const invalid of [{red:'ironman',blue:'ironman'},{red:'hulk',blue:'ultraman'},{}])assert.equal((await post({action:'create',teamAvatars:invalid})).status,400);
  const response=await post({action:'create',mapId:'dunes',mode:'defusal',teamAvatars:pair});assert.equal(response.status,200);const created=await response.json();
  assert.deepEqual(created.teamAvatars,pair);assert.equal(activeRooms.get(created.roomId)!.sim.players.size,0);
  for(const nickname of ['Guest','Creator']){
   const response=await post({invite:created.invite,nickname,avatar:'ultraman',teamAvatars:DEFAULT_TEAM_AVATARS}),data=await response.json();
   assert.equal(response.status,200);assert.deepEqual(data.teamAvatars,pair);
   const room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);attach(room);assert.equal(room.roomId,created.roomId);
  }
  await until(()=>rooms.every(r=>states.get(r.sessionId)?.players.length===2));for(const r of rooms)check(states.get(r.sessionId)!);
  const sim=activeRooms.get(created.roomId)!.sim,original=rooms[0],id=original.sessionId,token=original.reconnectionToken;
  for(const r of rooms)r.send('appearance',{avatar:'ultraman'});
  const before=sim.time;await until(()=>sim.time>before+100);check(sim.snapshot());
  original.connection.close();await until(()=>sim.players.get(id)?.connected===false);
  attach(await new Client(base.replace('http:','ws:')).reconnect(token));await until(()=>sim.players.get(id)?.connected===true);assert.equal(sim.players.get(id)!.avatar,'wonder-woman');
  sim.finish();sim.time=sim.nextRoundAt;await until(()=>sim.round===2);check(sim.snapshot());
  for(const r of rooms.filter(r=>r!==original))await until(()=>states.get(r.sessionId)?.round===2);
 }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.close();}
});
