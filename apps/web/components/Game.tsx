'use client';
import {useEffect,useRef,useState} from 'react';
import {Client, type Room} from '@colyseus/sdk';
import {AVATARS,DEFAULT_TEAM_AVATARS,validTeamAvatars,type TeamAvatars,type AvatarId,type Team,WEAPONS,MAPS,TEAMS,BOMB_RESULT_DELAY_MS,BOMB_TARGET,DEFAULT_MAP,validMap,weaponLabel,isGun,SurfaceCache,type SurfaceUpdate,type SnapshotUpdate,type GameMode,type MapId,type Snapshot,type CombatEvent} from '@sirocco/shared';
import {AvatarPicker,AvatarPreview} from './AvatarPreview';
import {Arena} from './arena';
import {MAP_TOUR} from './map-tour';
import {Minimap} from './Minimap';
import {BombHud} from './BombHud';
import {NextGameCountdown} from './NextGameCountdown';
import {CombatAim} from './CombatAim';
import {SpectatorHud} from './SpectatorHud';
import type {ScopeLevel} from './sniper-scope';
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const characterName=(avatar:AvatarId)=>AVATARS.find(a=>a.id===avatar)?.name??'Operator';
export default function Game(){
  const canvas=useRef<HTMLCanvasElement>(null);const arena=useRef<Arena|null>(null);const room=useRef<Room|null>(null);const intentional=useRef(false);const client=useRef<Client|null>(null);const inviteRef=useRef('');const nameRef=useRef('');const reconnecting=useRef(false);
  const hitTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [headshot,setHeadshot]=useState(false);
  const [scopeLevel,setScopeLevel]=useState<ScopeLevel>(0);
  const [spectatingId,setSpectatingId]=useState<string|null>(null);
  const [teamAvatars,setTeamAvatars]=useState<TeamAvatars>(DEFAULT_TEAM_AVATARS);
  function chooseTeamCharacter(team:Team,avatar:AvatarId){setTeamAvatars(current=>{const other=team==='red'?'blue':'red';return {...current,[team]:avatar,[other]:current[other]===avatar?current[team]:current[other]};});}
  const [selectedMode,setSelectedMode]=useState<GameMode>('defusal');
  const [resultReady,setResultReady]=useState(true);const resultTimer=useRef<ReturnType<typeof setTimeout>|null>(null);const lastResult=useRef('');
  const [preview,setPreview]=useState<number|null>(null);
  const [screen,setScreen]=useState<'room'|'profile'>('room');
  const [createdHere,setCreatedHere]=useState(false);
  function scout(index:number|null){setPreview(index);arena.current?.preview(index);}
  const [ready,setReady]=useState(false),[name,setName]=useState(''),[invite,setInvite]=useState(''),[status,setStatus]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[playing,setPlaying]=useState(false),[locked,setLocked]=useState(false),[board,setBoard]=useState(false),[snap,setSnap]=useState<Snapshot|null>(null),[feed,setFeed]=useState<(CombatEvent&{at:number})[]>([]),[copied,setCopied]=useState(false),[hit,setHit]=useState(false),[sound,setSound]=useState(true),[notice,setNotice]=useState('');
  const [selectedMap,setSelectedMap]=useState<MapId>(DEFAULT_MAP),[pickup,setPickup]=useState(''),[hurt,setHurt]=useState(false),[damageAngle,setDamageAngle]=useState(0);const hurtTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{
    setName(localStorage.getItem('sirocco-name')??'');const token=new URLSearchParams(location.hash.slice(1)).get('invite')??'';setInvite(token);inviteRef.current=token;if(token)setScreen('profile');
    client.current=new Client(`${location.protocol==='https:'?'wss':'ws'}://${location.host}`);
    try{arena.current=new Arena(canvas.current!,{input:i=>room.current?.send('input',i),lock:setLocked,board:setBoard,pickup:setPickup,scope:setScopeLevel,spectate:id=>{setSpectatingId(id);setHit(false);setHeadshot(false);setHurt(false);},damage:angle=>{setDamageAngle(angle);setHurt(true);if(hurtTimer.current)clearTimeout(hurtTimer.current);hurtTimer.current=setTimeout(()=>setHurt(false),350);}});if(token){try{const payload=JSON.parse(atob(token.split('.')[0].replace(/-/g,'+').replace(/_/g,'/')));if(validTeamAvatars(payload.teamAvatars))setTeamAvatars(payload.teamAvatars);const mapId=validMap(payload.mapId)?payload.mapId:'relay';setSelectedMap(mapId);setSelectedMode(payload.mode==='defusal'?'defusal':'deathmatch');arena.current.setMap(mapId);}catch{}}setReady(true);}catch{setError('WebGL is unavailable. Use a desktop browser with hardware acceleration enabled.');}
    return()=>{if(hitTimer.current)clearTimeout(hitTimer.current);if(resultTimer.current)clearTimeout(resultTimer.current);if(hurtTimer.current)clearTimeout(hurtTimer.current);intentional.current=true;void room.current?.leave();arena.current?.destroy();};
  },[]);
  function attach(next:Room){
    const surfaces=new SurfaceCache();next.onMessage('surfaceUpdates',(update:SurfaceUpdate)=>surfaces.apply(update));
    if(hitTimer.current)clearTimeout(hitTimer.current);setHit(false);setHeadshot(false);
    next.reconnection.enabled=false;room.current=next;arena.current?.start(next.sessionId);setPlaying(true);setBusy(false);setStatus('Connected');
    sessionStorage.setItem('sirocco-reconnect',JSON.stringify({invite:inviteRef.current,token:next.reconnectionToken}));
    next.onMessage('snapshot',(update:SnapshotUpdate)=>{const s=surfaces.merge(update),resultKey=`${s.matchId}:${s.round}:${s.phase}`;if(lastResult.current!==resultKey){lastResult.current=resultKey;if(resultTimer.current)clearTimeout(resultTimer.current);if(s.phase==='finished'&&s.bombs.some(b=>b.status==='exploded')){setResultReady(false);resultTimer.current=setTimeout(()=>setResultReady(true),BOMB_RESULT_DELAY_MS);}else setResultReady(true);}setSnap(s);if(s.teamAvatars)setTeamAvatars(s.teamAvatars);setSelectedMode(s.mode);setSelectedMap(s.mapId);arena.current?.update(s);});
    next.onMessage('combat',(e:CombatEvent)=>{arena.current?.combat(e);if(e.type==='kill'||e.type==='trexDeath')setFeed(old=>[...old.slice(-3),{...e,at:Date.now()}]);if(e.type==='damage'&&e.shooter===next.sessionId&&e.target!==next.sessionId){setHit(true);setHeadshot(e.hitZone==='head');if(hitTimer.current)clearTimeout(hitTimer.current);hitTimer.current=setTimeout(()=>{setHit(false);setHeadshot(false);},e.hitZone==='head'?650:130);}});
    next.send('surfaceUpdates',1);
    next.onError((_code,message)=>setError(message||'Connection error'));
    next.onLeave(code=>{if(intentional.current||room.current!==next)return;room.current=null;
      if(code===4000){setStatus('Disconnected after two minutes without activity.');setPlaying(false);arena.current?.stop();sessionStorage.removeItem('sirocco-reconnect');return;}
      void reconnect(next.reconnectionToken);
    });
  }
  async function createRoom(){
    if(busy)return;setBusy(true);setError('');setStatus('Creating room · a cold start may take a moment…');
    try{
      const response=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',mapId:selectedMap,mode:selectedMode,teamAvatars}),signal:AbortSignal.timeout(45000)});
      const data=await response.json();if(!response.ok)throw new Error(data.error??'Could not create room');
      if(validTeamAvatars(data.teamAvatars))setTeamAvatars(data.teamAvatars);
      inviteRef.current=data.invite;setInvite(data.invite);history.replaceState(null,'',`/#invite=${data.invite}`);
      setCreatedHere(true);setScreen('profile');setStatus('');window.scrollTo(0,0);
    }catch(e){setError((e as Error).message);setStatus('');}finally{setBusy(false);}
  }
  async function reserve(token:string){
    const response=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:nameRef.current,invite:token||undefined,mapId:selectedMap,mode:selectedMode,teamAvatars}),signal:AbortSignal.timeout(45000)});
    const data=await response.json();if(!response.ok)throw new Error(data.error??'Could not join room');
    if(data.mode)setSelectedMode(data.mode);if(validMap(data.mapId)){setSelectedMap(data.mapId);arena.current?.setMap(data.mapId);}
    if(validTeamAvatars(data.teamAvatars))setTeamAvatars(data.teamAvatars);
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
    setCreatedHere(false);setScreen('room');setPlaying(false);setSnap(null);setBoard(false);setPickup('');setHurt(false);setStatus('');setError('');setNotice('');setFeed([]);setCopied(false);
  }
  const armed=snap?.bombs.filter(b=>b.status==='planted')??[];const fuse=armed.length?Math.min(...armed.map(b=>b.explodeAt)):null;
  const me=snap?.players.find(p=>p.id===room.current?.sessionId);const remaining=snap?Math.max(0,Math.ceil(((fuse??snap.endsAt)-snap.time)/1000)):600;const time=(snap?.mode??selectedMode)==='defusal'&&fuse===null?'∞':`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
  const watching=snap?.mode==='defusal'&&snap.phase==='playing'&&me?.hp===0?snap.players.find(p=>p.id===spectatingId&&p.hp>0&&p.connected):undefined,hudPlayer=watching??me;
  const map=MAPS[snap?.mapId??selectedMap];const defusal=(snap?.mode??selectedMode)==='defusal';
  return <main className={playing?'app in-game':screen==='profile'?'app profile-flow':'app room-flow'}>
    <canvas ref={canvas} className="arena" aria-label={`${map.name} desert arena`} />
    {!playing?preview!==null?<div className="map-tour"><div className="tour-heading"><span>DUST III / FIELD RECON</span><button onClick={()=>scout(null)}>BACK TO LOBBY</button></div><div className="tour-caption"><span>{String(preview+1).padStart(2,'0')} / {MAP_TOUR.length}</span><h2>{MAP_TOUR[preview].name}</h2><p>{MAP_TOUR[preview].description}</p><nav aria-label="Map viewpoints">{MAP_TOUR.map((view,i)=><button key={view.name} aria-pressed={preview===i} onClick={()=>scout(i)}>{view.name.split(' · ')[0]}</button>)}</nav></div></div>:<>
      <div className="lobby-shade"/>
      <header className="topbar"><a className="brand" href="/" aria-label="Super Strike home"><span className="brand-mark">╱╱</span> SUPER STRIKE<span className="brand-sub">MULTIPLAYER FPS</span></a><div className="top-meta"><span className="dot"/> ASIA / SINGAPORE <span className="build">BUILD 03</span></div></header>
      <section className="lobby">
        <div className="intro"><div className="eyebrow"><span className="tiny-line"/> {screen==='profile'?'OPERATOR PROFILE / 02':'DESERT OPERATIONS / 01'}</div><h1>{screen==='profile'?<>Make your <em>name count.</em></>:<>Hold your ground.<br/><em>Own the dust.</em></>}</h1><div className="mode-tags"><span>4 VS 4</span><span>{defusal?'BOMB DEFUSAL':'TEAM DEATHMATCH'}</span><span>NO DOWNLOAD</span></div>
          {screen==='room'?<form className="join-card" onSubmit={e=>{e.preventDefault();void createRoom();}}>
            <div className="card-heading"><span>CREATE YOUR ROOM</span></div>
            <fieldset className="map-select" disabled={busy}><legend>CHOOSE YOUR MAP</legend><div>{Object.values(MAPS).map(m=><button type="button" key={m.id} aria-pressed={selectedMap===m.id} onClick={()=>{setSelectedMap(m.id);if(m.id==='relay')setSelectedMode('deathmatch');arena.current?.setMap(m.id);}}><strong>{m.name}</strong><small>{m.subtitle}</small></button>)}</div></fieldset>
            {selectedMap==='dunes'&&<fieldset className="mode-select" disabled={busy}><legend>GAME MODE</legend><button type="button" aria-pressed={selectedMode==='defusal'} onClick={()=>setSelectedMode('defusal')}>BOMB DEFUSAL</button><button type="button" aria-pressed={selectedMode==='deathmatch'} onClick={()=>setSelectedMode('deathmatch')}>DEATHMATCH</button></fieldset>}
            <div className="team-character-picker">{(['red','blue'] as const).map(team=><AvatarPicker key={team} label={`${TEAMS[team].name.toUpperCase()} CHARACTER`} value={teamAvatars[team]} onChange={avatar=>chooseTeamCharacter(team,avatar)} disabled={busy}/>)}</div>
            <button className="primary" type="submit" disabled={!ready||busy}>{busy?'CREATING…':'CREATE A ROOM'} <span>↗</span></button>
          </form>:<form className="join-card profile-card" onSubmit={e=>{e.preventDefault();void join();}}>
            <div className="card-heading"><span>{createdHere?'ROOM CREATED':'INVITATION RECEIVED'}</span></div>
            <h2>Choose your callsign.</h2><p className="profile-description">Join a balanced team. Your character is assigned automatically.</p>
            <div className="profile-room"><span>{map.name}</span><span>{defusal?'BOMB DEFUSAL':'TEAM DEATHMATCH'}</span></div>
            <label htmlFor="callsign">YOUR CALLSIGN</label><div className="entry"><span className="input-icon">⌁</span><input key="profile-callsign" id="callsign" maxLength={20} placeholder="Enter a guest nickname" value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname" autoFocus required disabled={busy}/></div>
            <button className="primary" type="submit" disabled={!ready||busy||!name.trim()}>{busy?'CONNECTING…':createdHere?'ENTER THE ROOM':'JOIN THE ROOM'}<span>↗</span></button>
            <div className="card-foot"><span className="dot"/> Team A · {characterName(teamAvatars.red)} / Team B · {characterName(teamAvatars.blue)}</div>
            <button type="button" className="secondary" onClick={share}>{copied?'COPIED ✓':'COPY INVITATION LINK'}</button>
            {notice&&<p className="profile-description" role="status">{notice}</p>}
            {createdHere&&<button type="button" className="text-button" disabled={busy} onClick={()=>{setInvite('');inviteRef.current='';history.replaceState(null,'','/');setCreatedHere(false);setScreen('room');setCopied(false);setNotice('');setError('');setStatus('');window.scrollTo(0,0);}}>← BACK TO ROOM SETTINGS</button>}
          </form>}
          {(error||status)&&<p className={error?'message error':'message'} role="status">{error||status}</p>}
        </div>
        {screen==='profile'?<aside className="appearance-stage team-appearance-stage" aria-label="Team appearances"><div className="eyebrow">KNOW YOUR TEAM</div><div className="team-appearances">{(['red','blue'] as const).map(team=><figure className={`team-appearance team-${team}`} key={team}><AvatarPreview avatar={teamAvatars[team]}/><figcaption><span>{TEAMS[team].name.toUpperCase()}</span><h2>{characterName(teamAvatars[team])}</h2></figcaption></figure>)}</div><p className="team-assignment-note">Players on your team share the same appearance.</p></aside>:        <aside className="map-label"><span className="map-kicker">{map.subtitle.toUpperCase()}</span><h2>{map.name.toUpperCase()}</h2><p>{map.description}</p><div className="map-stats"><div><b>{defusal?'C4':'30'}</b><span>{defusal?'PLANT / DEFUSE':'KILLS TO WIN'}</span></div><div><b>{defusal?'∞':<>10<span>:00</span></>}</b><span>ROUND TIME</span></div></div>{selectedMap==='dunes'&&<button className="scout-map" onClick={()=>scout(0)}>SCOUT THE MAP</button>}</aside>}
      </section>
      <footer className="lobby-footer"><span>BUILT FOR THE BROWSER. MADE FOR THE SQUAD.</span><span><a href="/audio/CREDITS.txt" target="_blank" rel="noreferrer">AUDIO CREDITS</a> · DESKTOP + MOUSE</span></footer>
    </>:<>
      <div className={`damage-vignette ${hurt?'impact':''} ${me&&me.hp>0&&me.hp<=30?'critical':''}`} aria-hidden="true"/>
      {hurt&&<div className="damage-direction" style={{transform:`translate(-50%,-50%) rotate(${damageAngle}rad)`}} aria-hidden="true"><span/></div>}
      <div className="match-top"><div className="match-brand">╱╱ SUPER STRIKE <span>{map.name.toUpperCase()} / {defusal?'BOMB DEFUSAL':'TDM'}</span></div><div className="score-strip"><div className="team-red">TEAM A <b>{snap?.scores.red??0}</b></div><div className="clock"><b>{time}</b><span>{defusal?(armed.length>0?'C4 FUSE':'NO TIME LIMIT'):'FIRST TO 30'}</span></div><div className="team-blue"><b>{snap?.scores.blue??0}</b> TEAM B</div></div><button className="share" onClick={share}>{copied?'LINK COPIED ✓':'INVITE A FRIEND ↗'}</button></div>
      {snap&&hudPlayer&&<><Minimap snapshot={snap} me={hudPlayer} room={busy?null:room.current}/>{defusal&&<BombHud snapshot={snap} me={hudPlayer}/>}</>}
      <div className="killfeed">{feed.filter(e=>Date.now()-e.at<6000).map(e=><div key={e.id}>{e.cause==='trex'?<><b>T-REX</b><span>MAULED</span>{e.victim}</>:e.cause==='fall'?<><b className={`team-${e.team}`}>{e.victim}</b><span>FELL</span></>:<><b className={`team-${e.team}`}>{e.name}</b><span>{weaponLabel(e.weapon)} {e.hitZone==='head'?<strong className="headshot-badge">HEADSHOT</strong>:'⌁'}</span>{e.victim}</>}</div>)}</div>
      {locked&&(!!me?.hp||!!watching)&&<CombatAim scopeLevel={scopeLevel} hit={watching?false:hit} headshot={watching?false:headshot}/>}
      {watching&&<SpectatorHud player={watching}/>}
      {playing&&hudPlayer&&<div className="hud-bottom"><div className={`health ${hudPlayer.hp<=30?'critical':''}`}><span className={`team-tag team-${hudPlayer.team}`}>{TEAMS[hudPlayer.team].name.toUpperCase()} · {characterName(hudPlayer.avatar).toUpperCase()}</span><span className="player-callsign">{hudPlayer.name}</span><div><span className="health-icon">+</span><strong>{hudPlayer.hp}</strong><small>HEALTH</small></div><div className="health-bar"><i style={{width:`${hudPlayer.hp}%`}}/></div></div><div className="hud-center">{locked&&!watching&&pickup&&<div className="pickup-prompt">{pickup}{pickup.includes('PICK UP')&&<small>Replaces your {pickup.includes('SIDEARM')?'sidearm':'primary weapon'}</small>}</div>}<div className="inventory"><span className={hudPlayer.weapon==='knife'?'selected':''}>1 · KNIFE</span><span className={hudPlayer.weapon===(hudPlayer.secondary??'pistol')?'selected':''}>2 · {weaponLabel(hudPlayer.secondary??'pistol')}</span><span className={hudPlayer.weapon===hudPlayer.primary?'selected':''}>3 · {WEAPONS[hudPlayer.primary].label}</span><span className={`grenade-count ${hudPlayer.weapon==='grenade'?'selected':''}`}>4 · FRAG × {hudPlayer.grenades}</span>{snap?.bombs.some(b=>b.carrierId===hudPlayer.id)&&<span className={hudPlayer.weapon==='bomb'?'selected':''}>5 · C4</span>}</div><div className="hud-hint" hidden={!!watching}>C / CTRL <span>{hudPlayer.crouched?'CROUCHED':'CROUCH'}</span> · E <span>PICK UP</span> · TAB <span>SCORES</span></div></div><div className="ammo"><span>{hudPlayer.reloadUntil?'RELOADING…':weaponLabel(hudPlayer.weapon)}</span><div><strong>{isGun(hudPlayer.weapon)?hudPlayer.ammo[hudPlayer.weapon]:hudPlayer.weapon==='grenade'?hudPlayer.grenades:'∞'}</strong>{isGun(hudPlayer.weapon)&&<small>/ {WEAPONS[hudPlayer.weapon].magazine}</small>}</div><small>{watching?'VIEW ONLY':isGun(hudPlayer.weapon)?'R RELOAD':hudPlayer.weapon==='bomb'?'HOLD LEFT CLICK TO PLANT':hudPlayer.weapon==='knife'?'LEFT CLICK SLASH':hudPlayer.grenades?'LEFT CLICK THROW':'NO GRENADES'} <span> · </span> {watching?'SPACE NEXT PLAYER':hudPlayer.weapon==='marksman'?'RIGHT CLICK · SCOPE':'1–5 SWITCH'}</small></div></div>}
      {me?.hp===0&&!watching&&snap?.phase==='playing'&&<div className="death"><span>{me.death?'YOU DIED':'WAITING TO JOIN'}</span><h2>{defusal?(me.death?'One life this game.':'Game in progress.'):`Respawning in ${Math.max(1,Math.ceil((me.respawnAt-snap.time)/1000))}s`}</h2><p>{defusal?'You return when the next game starts.':'Find another angle.'}</p></div>}
      {(!locked||busy)&&snap?.phase!=='finished'&&<div className="pause-wrap"><section className="pause-panel"><div className="eyebrow">{map.name.toUpperCase()} / ROUND {snap?.round??1}</div><h2>{busy?'Reconnecting…':watching?'Spectating.':snap?.players.length===1?'You’re first in.':'Ready when you are.'}</h2><p>{busy?status:watching?`Watching ${watching.name}. Press Space to switch players.`:snap?.players.length===1?'Share the room link to bring in your opponents.':'Click below to capture your mouse and enter the arena.'}{defusal&&me&&!watching&&<><br/><strong>Plant at {BOMB_TARGET[me.team]} · Defend {me.team==='red'?'B':'A'} · First detonation wins.</strong></>}</p>{notice&&<div className="notice">{notice}</div>}{error&&<div className="error">{error}</div>}<button className="primary" onClick={()=>arena.current?.lock()} disabled={busy||!snap}>{watching?'WATCH PLAYER':snap?.players.length===1?'EXPLORE THE ARENA':'ENTER THE ARENA'}<span>↗</span></button><button className="secondary" onClick={share}>{copied?'COPIED ✓':'COPY INVITATION LINK'}</button><div className="controls">{watching?<><span><kbd>SPACE</kbd> Next living player</span><span>View only · gameplay controls disabled</span><span>You return when the next game starts.</span><span><kbd>TAB</kbd> Scoreboard</span><span><kbd>ESC</kbd> Release mouse</span></>:<><span><kbd>W A S D</kbd> Move</span><span><kbd>MOUSE</kbd> Aim / attack</span><span><kbd>RIGHT CLICK</kbd> Sniper scope · 3× / 8×</span><span><kbd>SPACE</kbd> Jump</span><span><kbd>SHIFT</kbd> Sprint</span><span><kbd>R</kbd> Reload</span><span><kbd>1</kbd> Knife</span><span><kbd>E</kbd> {defusal?'Pick up / hold defuse':'Pick up gun'}</span><span><kbd>2</kbd> Pistol</span><span><kbd>3</kbd> Primary gun</span><span><kbd>4 + CLICK</kbd> Grenade</span>{defusal&&<span><kbd>5 + HOLD CLICK</kbd> Plant C4 at {me?BOMB_TARGET[me.team]:'your target'}</span>}<span><kbd>C / CTRL</kbd> Crouch (hold)</span><span><kbd>T</kbd> Spray · wall, floor, box or car</span><span><kbd>TAB</kbd> Scoreboard</span><span><kbd>ESC</kbd> Release mouse</span></>}</div><div className="pause-footer"><button onClick={()=>{setSound(!sound);arena.current?.setEffects(!sound);}}>SOUND {sound?'ON':'OFF'}</button><button onClick={leave}>LEAVE ROOM</button></div></section></div>}
      {(board||snap?.phase==='finished'&&resultReady)&&snap&&<div className="scoreboard-wrap"><section className="scoreboard"><div className="eyebrow">{map.name.toUpperCase()} / ROUND {snap.round}</div><h2>{snap.phase==='finished'?(snap.winner==='draw'?(defusal&&!snap.roundLive?'Game over.':'Even in the dust.'):`${snap.winner?TEAMS[snap.winner].name:'Team'} takes the outpost.`):'Field report.'}</h2>{snap.outcome&&<p className="fine-print">{snap.outcome}</p>}<div className="table"><div className="table-row table-head"><span>OPERATOR</span><span>K</span><span>D</span><span>STATUS</span></div>{[...snap.players].sort((a,b)=>a.team.localeCompare(b.team)||b.kills-a.kills).map(p=><div className={`table-row ${p.id===me?.id?'self':''}`} key={p.id}><span className={`team-${p.team}`}>{TEAMS[p.team].name.replace('Team ','')} · {p.name}{p.id===me?.id?' (YOU)':''}</span><b>{p.kills}</b><span>{p.deaths}</span><small>{!p.connected?'RECONNECTING':p.hp?'ACTIVE':defusal?(p.death?'DEAD':'WAITING'):'RESPAWNING'}</small></div>)}</div>{snap.phase==='finished'?<><NextGameCountdown nextRoundAt={snap.nextRoundAt} time={snap.time}/><button className="text-button" onClick={leave}>Leave room</button></>:<p className="fine-print">Release TAB to return to the arena.</p>}</section></div>}
      {busy&&locked&&<div className="connection-banner" role="status">{status}</div>}
    </>}
  </main>;
}
