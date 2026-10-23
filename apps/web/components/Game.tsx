'use client';
import {useEffect,useRef,useState} from 'react';
import {Client, type Room} from '@colyseus/sdk';
import {WEAPONS,MAPS,BOMB_TARGET,DEFAULT_MAP,validMap,weaponLabel,isGun,type GameMode,type MapId,type Snapshot,type CombatEvent} from '@sirocco/shared';
import {Arena} from './arena';
import {MAP_TOUR} from './map-tour';
import {Minimap} from './Minimap';
import {BombHud} from './BombHud';
import {ScopeOverlay} from './ScopeOverlay';
import type {ScopeLevel} from './sniper-scope';
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export default function Game(){
  const canvas=useRef<HTMLCanvasElement>(null);const arena=useRef<Arena|null>(null);const room=useRef<Room|null>(null);const intentional=useRef(false);const client=useRef<Client|null>(null);const inviteRef=useRef('');const nameRef=useRef('');const reconnecting=useRef(false);
  const [scopeLevel,setScopeLevel]=useState<ScopeLevel>(0);
  const [selectedMode,setSelectedMode]=useState<GameMode>('defusal');
  const [resultReady,setResultReady]=useState(true);const resultTimer=useRef<ReturnType<typeof setTimeout>|null>(null);const lastResult=useRef('');
  const [preview,setPreview]=useState<number|null>(null);
  const [screen,setScreen]=useState<'room'|'profile'>('room');
  const [createdHere,setCreatedHere]=useState(false);
  function scout(index:number|null){setPreview(index);arena.current?.preview(index);}
  const [ready,setReady]=useState(false),[name,setName]=useState(''),[invite,setInvite]=useState(''),[status,setStatus]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[playing,setPlaying]=useState(false),[locked,setLocked]=useState(false),[board,setBoard]=useState(false),[snap,setSnap]=useState<Snapshot|null>(null),[feed,setFeed]=useState<(CombatEvent&{at:number})[]>([]),[copied,setCopied]=useState(false),[hit,setHit]=useState(false),[sound,setSound]=useState(true),[votes,setVotes]=useState(''),[notice,setNotice]=useState('');
  const [selectedMap,setSelectedMap]=useState<MapId>(DEFAULT_MAP),[pickup,setPickup]=useState(''),[hurt,setHurt]=useState(false),[damageAngle,setDamageAngle]=useState(0);const hurtTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{
    setName(localStorage.getItem('sirocco-name')??'');const token=new URLSearchParams(location.hash.slice(1)).get('invite')??'';setInvite(token);inviteRef.current=token;if(token)setScreen('profile');
    client.current=new Client(`${location.protocol==='https:'?'wss':'ws'}://${location.host}`);
    try{arena.current=new Arena(canvas.current!,{input:i=>room.current?.send('input',i),lock:setLocked,board:setBoard,pickup:setPickup,scope:setScopeLevel,damage:angle=>{setDamageAngle(angle);setHurt(true);if(hurtTimer.current)clearTimeout(hurtTimer.current);hurtTimer.current=setTimeout(()=>setHurt(false),350);}});if(token){try{const payload=JSON.parse(atob(token.split('.')[0].replace(/-/g,'+').replace(/_/g,'/')));const mapId=validMap(payload.mapId)?payload.mapId:'relay';setSelectedMap(mapId);setSelectedMode(payload.mode==='defusal'?'defusal':'deathmatch');arena.current.setMap(mapId);}catch{}}setReady(true);}catch{setError('WebGL is unavailable. Use a desktop browser with hardware acceleration enabled.');}
    return()=>{if(resultTimer.current)clearTimeout(resultTimer.current);if(hurtTimer.current)clearTimeout(hurtTimer.current);intentional.current=true;void room.current?.leave();arena.current?.destroy();};
  },[]);
  function attach(next:Room){
    next.reconnection.enabled=false;room.current=next;arena.current?.start(next.sessionId);setPlaying(true);setBusy(false);setStatus('Connected');
    sessionStorage.setItem('sirocco-reconnect',JSON.stringify({invite:inviteRef.current,token:next.reconnectionToken}));
    next.onMessage('snapshot',(s:Snapshot)=>{const resultKey=`${s.matchId}:${s.round}:${s.phase}`;if(lastResult.current!==resultKey){lastResult.current=resultKey;if(resultTimer.current)clearTimeout(resultTimer.current);if(s.phase==='finished'&&s.bombs.some(b=>b.status==='exploded')){setResultReady(false);resultTimer.current=setTimeout(()=>setResultReady(true),3200);}else setResultReady(true);}setSnap(s);setSelectedMode(s.mode);setSelectedMap(s.mapId);arena.current?.update(s);});
    next.onMessage('votes',(v:{count:number;needed:number})=>setVotes(`${v.count} / ${v.needed} votes`));
    next.onMessage('combat',(e:CombatEvent)=>{arena.current?.combat(e);if(e.type==='kill')setFeed(old=>[...old.slice(-3),{...e,at:Date.now()}]);if(e.type==='damage'&&e.shooter===next.sessionId&&e.target!==next.sessionId){setHit(true);setTimeout(()=>setHit(false),130);}});
    next.onError((_code,message)=>setError(message||'Connection error'));
    next.onLeave(code=>{if(intentional.current||room.current!==next)return;room.current=null;
      if(code===4000){setStatus('Disconnected after two minutes without activity.');setPlaying(false);arena.current?.stop();sessionStorage.removeItem('sirocco-reconnect');return;}
      void reconnect(next.reconnectionToken);
    });
  }
  async function createRoom(){
    if(busy)return;setBusy(true);setError('');setStatus('Creating room · a cold start may take a moment…');
    try{
      const response=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',mapId:selectedMap,mode:selectedMode}),signal:AbortSignal.timeout(45000)});
      const data=await response.json();if(!response.ok)throw new Error(data.error??'Could not create room');
      inviteRef.current=data.invite;setInvite(data.invite);history.replaceState(null,'',`/#invite=${data.invite}`);
      setCreatedHere(true);setScreen('profile');setStatus('');
    }catch(e){setError((e as Error).message);setStatus('');}finally{setBusy(false);}
  }
  async function reserve(token:string){
    const response=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:nameRef.current,invite:token||undefined,mapId:selectedMap,mode:selectedMode}),signal:AbortSignal.timeout(45000)});
    const data=await response.json();if(!response.ok)throw new Error(data.error??'Could not join room');
    if(data.mode)setSelectedMode(data.mode);if(validMap(data.mapId)){setSelectedMap(data.mapId);arena.current?.setMap(data.mapId);}
    inviteRef.current=data.invite;setInvite(data.invite);history.replaceState(null,'',`/#invite=${data.invite}`);
    const next=await client.current!.consumeSeatReservation(data.reservation);attach(next);return data;
  }
  async function reconnect(token:string){
    if(reconnecting.current)return;reconnecting.current=true;setStatus('Connection lost · reconnecting…');setBusy(true);document.exitPointerLock();
    for(const delay of [300,700,1400,2200,3000,4000]){
      await wait(delay);if(intentional.current){reconnecting.current=false;return;}
      try{attach(await client.current!.reconnect(token));setNotice('Connection restored.');reconnecting.current=false;return;}catch{}
    }
    try{const data=await reserve(inviteRef.current);setNotice(data.fresh?'The previous match ended or the server restarted. A fresh match has begun.':'Rejoined the room with a new player slot.');}
    catch(e){setError((e as Error).message);setPlaying(false);arena.current?.stop();setStatus('Unable to reconnect. Your invitation is still available.');}
    setBusy(false);reconnecting.current=false;
  }
  async function join(){
    if(!name.trim()){setError('Enter a callsign to join.');return;}intentional.current=false;setError('');setNotice('');setBusy(true);setStatus('Opening room · a cold start may take a moment…');nameRef.current=name.trim();localStorage.setItem('sirocco-name',nameRef.current);
    try{
      const saved=JSON.parse(sessionStorage.getItem('sirocco-reconnect')??'null');
      if(saved?.invite===inviteRef.current&&saved.token){try{attach(await client.current!.reconnect(saved.token));return;}catch{sessionStorage.removeItem('sirocco-reconnect');}}
      const data=await reserve(inviteRef.current);if(data.fresh&&inviteRef.current)setNotice('Fresh match ready. Invite a friend to the opposite team.');
    }catch(e){setError((e as Error).message);setStatus('');}finally{setBusy(false);}
  }
  async function share(){try{await navigator.clipboard.writeText(location.href);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{setNotice(`Copy this address from your browser to invite a friend.`);}}
  function leave(){
    intentional.current=true;const previous=room.current;room.current=null;void previous?.leave();arena.current?.stop();
    inviteRef.current='';setInvite('');history.replaceState(null,'','/');sessionStorage.removeItem('sirocco-reconnect');
    if(resultTimer.current)clearTimeout(resultTimer.current);lastResult.current='';setResultReady(true);
    setCreatedHere(false);setScreen('room');setPlaying(false);setSnap(null);setBoard(false);setPickup('');setHurt(false);setStatus('');setError('');setNotice('');setFeed([]);setVotes('');setCopied(false);
  }
  const armed=snap?.bombs.filter(b=>b.status==='planted')??[];const fuse=armed.length?Math.min(...armed.map(b=>b.explodeAt)):null;
  const me=snap?.players.find(p=>p.id===room.current?.sessionId);const remaining=snap?Math.max(0,Math.ceil(((fuse??snap.endsAt)-snap.time)/1000)):600;const time=(snap?.mode??selectedMode)==='defusal'&&fuse===null?'∞':`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
  const map=MAPS[snap?.mapId??selectedMap];const defusal=(snap?.mode??selectedMode)==='defusal';
  return <main className={playing?'app in-game':'app'}>
    <canvas ref={canvas} className="arena" aria-label={`${map.name} desert arena`} />
    {!playing?preview!==null?<div className="map-tour"><div className="tour-heading"><span>DUST II / FIELD RECON</span><button onClick={()=>scout(null)}>BACK TO LOBBY</button></div><div className="tour-caption"><span>{String(preview+1).padStart(2,'0')} / {MAP_TOUR.length}</span><h2>{MAP_TOUR[preview].name}</h2><p>{MAP_TOUR[preview].description}</p><nav aria-label="Map viewpoints">{MAP_TOUR.map((view,i)=><button key={view.name} aria-pressed={preview===i} onClick={()=>scout(i)}>{view.name.split(' · ')[0]}</button>)}</nav></div></div>:<>
      <div className="lobby-shade"/>
      <header className="topbar"><a className="brand" href="/" aria-label="Counter Strike home"><span className="brand-mark">╱╱</span> COUNTER STRIKE<span className="brand-sub">MULTIPLAYER FPS</span></a><div className="top-meta"><span className="dot"/> ASIA / SINGAPORE <span className="build">BUILD 03</span></div></header>
      <section className="lobby">
        <div className="intro"><div className="eyebrow"><span className="tiny-line"/> {screen==='profile'?'OPERATOR PROFILE / 02':'DESERT OPERATIONS / 01'}</div><h1>{screen==='profile'?<>Make your<br/><em>name count.</em></>:<>Hold your ground.<br/><em>Own the dust.</em></>}</h1><div className="mode-tags"><span>4 VS 4</span><span>{defusal?'BOMB DEFUSAL':'TEAM DEATHMATCH'}</span><span>NO DOWNLOAD</span></div>
          {screen==='room'?<form className="join-card" onSubmit={e=>{e.preventDefault();void createRoom();}}>
            <div className="card-heading"><span>CREATE YOUR ROOM</span></div>
            <fieldset className="map-select" disabled={busy}><legend>CHOOSE YOUR MAP</legend><div>{Object.values(MAPS).map(m=><button type="button" key={m.id} aria-pressed={selectedMap===m.id} onClick={()=>{setSelectedMap(m.id);if(m.id==='relay')setSelectedMode('deathmatch');arena.current?.setMap(m.id);}}><strong>{m.name}</strong><small>{m.subtitle}</small></button>)}</div></fieldset>
            {selectedMap==='dunes'&&<fieldset className="mode-select" disabled={busy}><legend>GAME MODE</legend><button type="button" aria-pressed={selectedMode==='defusal'} onClick={()=>setSelectedMode('defusal')}>BOMB DEFUSAL</button><button type="button" aria-pressed={selectedMode==='deathmatch'} onClick={()=>setSelectedMode('deathmatch')}>DEATHMATCH</button></fieldset>}
            <button className="primary" type="submit" disabled={!ready||busy}>{busy?'CREATING…':'CREATE A ROOM'} <span>↗</span></button>
          </form>:<form className="join-card profile-card" onSubmit={e=>{e.preventDefault();void join();}}>
            <div className="card-heading"><span>{createdHere?'ROOM CREATED':'INVITATION RECEIVED'}</span></div>
            <h2>Customize your profile.</h2><p className="profile-description">Choose the callsign your squad will see in the arena.</p>
            <div className="profile-room"><span>{map.name}</span><span>{defusal?'BOMB DEFUSAL':'TEAM DEATHMATCH'}</span></div>
            <label htmlFor="callsign">YOUR CALLSIGN</label><div className="entry"><span className="input-icon">⌁</span><input key="profile-callsign" id="callsign" maxLength={20} placeholder="Enter a guest nickname" value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname" autoFocus required disabled={busy}/></div>
            <button className="primary" type="submit" disabled={!ready||busy||!name.trim()}>{busy?'CONNECTING…':createdHere?'ENTER THE ROOM':'JOIN THE ROOM'}<span>↗</span></button>
            <div className="card-foot"><span className="dot"/> Your team is assigned automatically.</div>
            <button type="button" className="secondary" onClick={share}>{copied?'COPIED ✓':'COPY INVITATION LINK'}</button>
            {notice&&<p className="profile-description" role="status">{notice}</p>}
            {createdHere&&<button type="button" className="text-button" disabled={busy} onClick={()=>{setInvite('');inviteRef.current='';history.replaceState(null,'','/');setCreatedHere(false);setScreen('room');setCopied(false);setNotice('');setError('');setStatus('');}}>← BACK TO ROOM SETTINGS</button>}
          </form>}
          {(error||status)&&<p className={error?'message error':'message'} role="status">{error||status}</p>}
        </div>
        <aside className="map-label"><span className="map-kicker">{map.subtitle.toUpperCase()}</span><h2>{map.name.toUpperCase()}</h2><p>{map.description}</p><div className="map-stats"><div><b>{defusal?'C4':'30'}</b><span>{defusal?'PLANT / DEFUSE':'KILLS TO WIN'}</span></div><div><b>{defusal?'∞':<>10<span>:00</span></>}</b><span>ROUND TIME</span></div></div>{selectedMap==='dunes'&&<button className="scout-map" onClick={()=>scout(0)}>SCOUT THE MAP</button>}</aside>
      </section>
      <footer className="lobby-footer"><span>BUILT FOR THE BROWSER. MADE FOR THE SQUAD.</span><span><a href="/audio/CREDITS.txt" target="_blank" rel="noreferrer">AUDIO CREDITS</a> · DESKTOP + MOUSE</span></footer>
    </>:<>
      <div className={`damage-vignette ${hurt?'impact':''} ${me&&me.hp>0&&me.hp<=30?'critical':''}`} aria-hidden="true"/>
      {hurt&&<div className="damage-direction" style={{transform:`translate(-50%,-50%) rotate(${damageAngle}rad)`}} aria-hidden="true"><span/></div>}
      <div className="match-top"><div className="match-brand">╱╱ COUNTER STRIKE <span>{map.name.toUpperCase()} / {defusal?'BOMB DEFUSAL':'TDM'}</span></div><div className="score-strip"><div className="team-red">RED <b>{snap?.scores.red??0}</b></div><div className="clock"><b>{time}</b><span>{defusal?(armed.length>0?'C4 FUSE':'NO TIME LIMIT'):'FIRST TO 30'}</span></div><div className="team-blue"><b>{snap?.scores.blue??0}</b> BLUE</div></div><button className="share" onClick={share}>{copied?'LINK COPIED ✓':'INVITE A FRIEND ↗'}</button></div>
      {snap&&me&&<><Minimap snapshot={snap} me={me} room={busy?null:room.current}/>{defusal&&<BombHud snapshot={snap} me={me}/>}</>}
      <div className="killfeed">{feed.filter(e=>Date.now()-e.at<6000).map(e=><div key={e.id}><b className={`team-${e.team}`}>{e.name}</b><span>{weaponLabel(e.weapon)} ⌁</span>{e.victim}</div>)}</div>
      {locked&&me?.hp!==0&&<ScopeOverlay level={scopeLevel} hit={hit}/>}
      {locked&&!scopeLevel&&me?.hp!==0&&<div className={hit?'crosshair hit':'crosshair'}><i/><i/><i/><i/></div>}
      {playing&&me&&<div className="hud-bottom"><div className={`health ${me.hp<=30?'critical':''}`}><span className={`team-tag team-${me.team}`}>{me.team.toUpperCase()} TEAM</span><div><span className="health-icon">+</span><strong>{me.hp}</strong><small>HEALTH</small></div><div className="health-bar"><i style={{width:`${me.hp}%`}}/></div></div><div className="hud-center">{locked&&pickup&&<div className="pickup-prompt">{pickup}{pickup.includes('PICK UP')&&<small>Replaces your primary weapon</small>}</div>}<div className="inventory"><span className={me.weapon==='knife'?'selected':''}>1 · KNIFE</span><span className={me.weapon===me.primary?'selected':''}>2 · {WEAPONS[me.primary].label}</span><span className={me.weapon==='pistol'?'selected':''}>3 · P-12</span><span className={`grenade-count ${me.weapon==='grenade'?'selected':''}`}>4 · FRAG × {me.grenades}</span>{snap?.bombs.some(b=>b.carrierId===me.id)&&<span className={me.weapon==='bomb'?'selected':''}>5 · C4</span>}</div><div className="hud-hint">C / CTRL <span>{me.crouched?'CROUCHED':'CROUCH'}</span> · E <span>PICK UP</span> · TAB <span>SCORES</span></div></div><div className="ammo"><span>{me.reloadUntil?'RELOADING…':weaponLabel(me.weapon)}</span><div><strong>{isGun(me.weapon)?me.ammo[me.weapon]:me.weapon==='grenade'?me.grenades:'∞'}</strong>{isGun(me.weapon)&&<small>/ {WEAPONS[me.weapon].magazine}</small>}</div><small>{isGun(me.weapon)?'R RELOAD':me.weapon==='bomb'?'HOLD LEFT CLICK TO PLANT':me.weapon==='knife'?'LEFT CLICK SLASH':me.grenades?'LEFT CLICK THROW':'NO GRENADES'} <span> · </span> {me.weapon==='marksman'?'RIGHT CLICK · SCOPE':'1–5 SWITCH'}</small></div></div>}
      {me?.hp===0&&snap?.phase==='playing'&&<div className="death"><span>{defusal&&snap.roundLive?'ELIMINATED':'DOWN, NOT OUT'}</span><h2>{defusal&&snap.roundLive?'One life this round.':`Back in ${Math.max(1,Math.ceil((me.respawnAt-snap.time)/1000))}`}</h2><p>{defusal&&snap.roundLive?'Wait for the round result.':'Find another angle.'}</p></div>}
      {(!locked||busy)&&snap?.phase!=='finished'&&<div className="pause-wrap"><section className="pause-panel"><div className="eyebrow">{map.name.toUpperCase()} / ROUND {snap?.round??1}</div><h2>{busy?'Reconnecting…':snap?.players.length===1?'You’re first in.':'Ready when you are.'}</h2><p>{busy?status:snap?.players.length===1?'Share the room link to bring in your opponents.':'Click below to capture your mouse and enter the arena.'}{defusal&&me&&<><br/><strong>Plant at {BOMB_TARGET[me.team]} · Defend {me.team==='red'?'B':'A'} · First detonation wins.</strong></>}</p>{notice&&<div className="notice">{notice}</div>}{error&&<div className="error">{error}</div>}<button className="primary" onClick={()=>arena.current?.lock()} disabled={busy||!snap}>{snap?.players.length===1?'EXPLORE THE ARENA':'ENTER THE ARENA'}<span>↗</span></button><button className="secondary" onClick={share}>{copied?'COPIED ✓':'COPY INVITATION LINK'}</button><div className="controls"><span><kbd>W A S D</kbd> Move</span><span><kbd>MOUSE</kbd> Aim / attack</span><span><kbd>RIGHT CLICK</kbd> Sniper scope · 3× / 8×</span><span><kbd>SPACE</kbd> Jump</span><span><kbd>SHIFT</kbd> Sprint</span><span><kbd>R</kbd> Reload</span><span><kbd>1</kbd> Knife</span><span><kbd>E</kbd> {defusal?'Pick up / hold defuse':'Pick up gun'}</span><span><kbd>2 / 3</kbd> Guns</span><span><kbd>4 + CLICK</kbd> Grenade</span>{defusal&&<span><kbd>5 + HOLD CLICK</kbd> Plant C4 at {me?BOMB_TARGET[me.team]:'your target'}</span>}<span><kbd>C / CTRL</kbd> Crouch (hold)</span><span><kbd>TAB</kbd> Scoreboard</span><span><kbd>ESC</kbd> Release mouse</span></div><div className="pause-footer"><button onClick={()=>{setSound(!sound);arena.current?.setEffects(!sound);}}>SOUND {sound?'ON':'OFF'}</button><button onClick={leave}>LEAVE ROOM</button></div></section></div>}
      {(board||snap?.phase==='finished'&&resultReady)&&snap&&<div className="scoreboard-wrap"><section className="scoreboard"><div className="eyebrow">{map.name.toUpperCase()} / ROUND {snap.round}</div><h2>{snap.phase==='finished'?(snap.winner==='draw'?'Even in the dust.':`${snap.winner?.toUpperCase()} takes the outpost.`):'Field report.'}</h2>{snap.outcome&&<p className="fine-print">{snap.outcome}</p>}<div className="table"><div className="table-row table-head"><span>OPERATOR</span><span>K</span><span>D</span><span>STATUS</span></div>{[...snap.players].sort((a,b)=>a.team.localeCompare(b.team)||b.kills-a.kills).map(p=><div className={`table-row ${p.id===me?.id?'self':''}`} key={p.id}><span className={`team-${p.team}`}>{p.name}{p.id===me?.id?' (YOU)':''}</span><b>{p.kills}</b><span>{p.deaths}</span><small>{!p.connected?'RECONNECTING':p.hp?'ACTIVE':defusal?'ELIMINATED':'RESPAWNING'}</small></div>)}</div>{snap.phase==='finished'?<><button className="primary" onClick={()=>{document.exitPointerLock();room.current?.send('rematch');}}>VOTE FOR REMATCH <span>↻</span></button><p className="fine-print">{votes||'Half of connected players must vote.'}</p><button className="text-button" onClick={leave}>Leave room</button></>:<p className="fine-print">Release TAB to return to the arena.</p>}</section></div>}
      {busy&&locked&&<div className="connection-banner" role="status">{status}</div>}
    </>}
  </main>;
}
