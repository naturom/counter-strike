'use client';
import {useEffect,useRef,useState} from 'react';
import {Client, type Room} from '@colyseus/sdk';
import {WEAPONS,MAPS,DEFAULT_MAP,validMap,weaponLabel,isGun,type MapId,type Snapshot,type CombatEvent} from '@sirocco/shared';
import {Arena} from './arena';
import {MAP_TOUR} from './map-tour';
import {Minimap} from './Minimap';
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export default function Game(){
  const canvas=useRef<HTMLCanvasElement>(null);const arena=useRef<Arena|null>(null);const room=useRef<Room|null>(null);const intentional=useRef(false);const client=useRef<Client|null>(null);const inviteRef=useRef('');const nameRef=useRef('');const reconnecting=useRef(false);
  const [preview,setPreview]=useState<number|null>(null);
  function scout(index:number|null){setPreview(index);arena.current?.preview(index);}
  const [ready,setReady]=useState(false),[name,setName]=useState(''),[invite,setInvite]=useState(''),[status,setStatus]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[playing,setPlaying]=useState(false),[locked,setLocked]=useState(false),[board,setBoard]=useState(false),[snap,setSnap]=useState<Snapshot|null>(null),[feed,setFeed]=useState<(CombatEvent&{at:number})[]>([]),[copied,setCopied]=useState(false),[hit,setHit]=useState(false),[sound,setSound]=useState(true),[votes,setVotes]=useState(''),[notice,setNotice]=useState('');
  const [selectedMap,setSelectedMap]=useState<MapId>(DEFAULT_MAP),[pickup,setPickup]=useState(''),[hurt,setHurt]=useState(false),[damageAngle,setDamageAngle]=useState(0);const hurtTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{
    setName(localStorage.getItem('sirocco-name')??'');const token=new URLSearchParams(location.hash.slice(1)).get('invite')??'';setInvite(token);inviteRef.current=token;
    client.current=new Client(`${location.protocol==='https:'?'wss':'ws'}://${location.host}`);
    try{arena.current=new Arena(canvas.current!,{input:i=>room.current?.send('input',i),lock:setLocked,board:setBoard,pickup:setPickup,damage:angle=>{setDamageAngle(angle);setHurt(true);if(hurtTimer.current)clearTimeout(hurtTimer.current);hurtTimer.current=setTimeout(()=>setHurt(false),350);}});if(token){try{const payload=JSON.parse(atob(token.split('.')[0].replace(/-/g,'+').replace(/_/g,'/')));const mapId=validMap(payload.mapId)?payload.mapId:'relay';setSelectedMap(mapId);arena.current.setMap(mapId);}catch{}}setReady(true);}catch{setError('WebGL is unavailable. Use a desktop browser with hardware acceleration enabled.');}
    return()=>{if(hurtTimer.current)clearTimeout(hurtTimer.current);intentional.current=true;void room.current?.leave();arena.current?.destroy();};
  },[]);
  function attach(next:Room){
    next.reconnection.enabled=false;room.current=next;arena.current?.start(next.sessionId);setPlaying(true);setBusy(false);setStatus('Connected');
    sessionStorage.setItem('sirocco-reconnect',JSON.stringify({invite:inviteRef.current,token:next.reconnectionToken}));
    next.onMessage('snapshot',(s:Snapshot)=>{setSnap(s);setSelectedMap(s.mapId);arena.current?.update(s);});
    next.onMessage('votes',(v:{count:number;needed:number})=>setVotes(`${v.count} / ${v.needed} votes`));
    next.onMessage('combat',(e:CombatEvent)=>{arena.current?.combat(e);if(e.type==='kill')setFeed(old=>[...old.slice(-3),{...e,at:Date.now()}]);if(e.type==='damage'&&e.shooter===next.sessionId&&e.target!==next.sessionId){setHit(true);setTimeout(()=>setHit(false),130);}});
    next.onError((_code,message)=>setError(message||'Connection error'));
    next.onLeave(code=>{if(intentional.current||room.current!==next)return;room.current=null;
      if(code===4000){setStatus('Disconnected after two minutes without activity.');setPlaying(false);arena.current?.stop();sessionStorage.removeItem('sirocco-reconnect');return;}
      void reconnect(next.reconnectionToken);
    });
  }
  async function reserve(token:string){
    const response=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:nameRef.current,invite:token||undefined,mapId:selectedMap}),signal:AbortSignal.timeout(45000)});
    const data=await response.json();if(!response.ok)throw new Error(data.error??'Could not join room');
    if(validMap(data.mapId)){setSelectedMap(data.mapId);arena.current?.setMap(data.mapId);}
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
    setPlaying(false);setSnap(null);setBoard(false);setPickup('');setHurt(false);setStatus('');setError('');setNotice('');setFeed([]);setVotes('');setCopied(false);
  }
  const me=snap?.players.find(p=>p.id===room.current?.sessionId);const remaining=snap?Math.max(0,Math.ceil((snap.endsAt-snap.time)/1000)):600;const time=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
  const map=MAPS[snap?.mapId??selectedMap];
  return <main className={playing?'app in-game':'app'}>
    <canvas ref={canvas} className="arena" aria-label={`${map.name} desert arena`} />
    {!playing?preview!==null?<div className="map-tour"><div className="tour-heading"><span>DUST II / FIELD RECON</span><button onClick={()=>scout(null)}>BACK TO LOBBY</button></div><div className="tour-caption"><span>{String(preview+1).padStart(2,'0')} / {MAP_TOUR.length}</span><h2>{MAP_TOUR[preview].name}</h2><p>{MAP_TOUR[preview].description}</p><nav aria-label="Map viewpoints">{MAP_TOUR.map((view,i)=><button key={view.name} aria-pressed={preview===i} onClick={()=>scout(i)}>{view.name.split(' · ')[0]}</button>)}</nav></div></div>:<>
      <div className="lobby-shade"/>
      <header className="topbar"><a className="brand" href="/" aria-label="Counter Strike home"><span className="brand-mark">╱╱</span> COUNTER STRIKE<span className="brand-sub">MULTIPLAYER FPS</span></a><div className="top-meta"><span className="dot"/> ASIA / SINGAPORE <span className="build">BUILD 03</span></div></header>
      <section className="lobby">
        <div className="intro"><div className="eyebrow"><span className="tiny-line"/> DESERT OPERATIONS / 01</div><h1>Hold your ground.<br/><em>Own the dust.</em></h1><div className="mode-tags"><span>4 VS 4</span><span>TEAM DEATHMATCH</span><span>NO DOWNLOAD</span></div>
          <form className="join-card" onSubmit={e=>{e.preventDefault();void join();}}><div className="card-heading"><span>{invite?'INVITATION RECEIVED':'READY TO DEPLOY?'}</span><span className="card-number">01 — 08</span></div><fieldset className="map-select" disabled={!!invite||busy}><legend>CHOOSE YOUR MAP</legend><div>{Object.values(MAPS).map(m=><button type="button" key={m.id} aria-pressed={selectedMap===m.id} onClick={()=>{setSelectedMap(m.id);arena.current?.setMap(m.id);}}><strong>{m.name}</strong><small>{m.subtitle}</small></button>)}</div></fieldset><label htmlFor="callsign">YOUR CALLSIGN</label><div className="entry"><span className="input-icon">⌁</span><input id="callsign" maxLength={20} placeholder="Enter a guest nickname" value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname" disabled={busy}/></div><button className="primary" type="submit" disabled={!ready||busy}>{busy?'CONNECTING…':invite?'JOIN THE ROOM':'CREATE A ROOM'}</button><div className="card-foot"><span className="dot"/> {invite?'Your team is assigned automatically.':'Private by invitation. No account needed.'}</div>{invite&&<button type="button" className="text-button" onClick={()=>{setInvite('');inviteRef.current='';setSelectedMap(DEFAULT_MAP);arena.current?.setMap(DEFAULT_MAP);history.replaceState(null,'','/');}}>Create a separate room instead</button>}</form>
          {(error||status)&&<p className={error?'message error':'message'} role="status">{error||status}</p>}
        </div>
        <aside className="map-label"><span className="map-kicker">{map.subtitle.toUpperCase()}</span><h2>{map.name.toUpperCase()}</h2><p>{map.description}</p><div className="map-stats"><div><b>30</b><span>KILLS TO WIN</span></div><div><b>10<span>:00</span></b><span>ROUND TIME</span></div></div>{selectedMap==='dunes'&&<button className="scout-map" onClick={()=>scout(0)}>SCOUT THE MAP</button>}</aside>
      </section>
      <footer className="lobby-footer"><span>BUILT FOR THE BROWSER. MADE FOR THE SQUAD.</span><span>DESKTOP + MOUSE</span></footer>
    </>:<>
      <div className={`damage-vignette ${hurt?'impact':''} ${me&&me.hp>0&&me.hp<=30?'critical':''}`} aria-hidden="true"/>
      {hurt&&<div className="damage-direction" style={{transform:`translate(-50%,-50%) rotate(${damageAngle}rad)`}} aria-hidden="true"><span/></div>}
      <div className="match-top"><div className="match-brand">╱╱ COUNTER STRIKE <span>{map.name.toUpperCase()} / TDM</span></div><div className="score-strip"><div className="team-red">RED <b>{snap?.scores.red??0}</b></div><div className="clock"><b>{time}</b><span>FIRST TO 30</span></div><div className="team-blue"><b>{snap?.scores.blue??0}</b> BLUE</div></div><button className="share" onClick={share}>{copied?'LINK COPIED ✓':'INVITE A FRIEND ↗'}</button></div>
      {snap&&me&&<Minimap snapshot={snap} me={me}/>}
      <div className="killfeed">{feed.filter(e=>Date.now()-e.at<6000).map(e=><div key={e.id}><b className={`team-${e.team}`}>{e.name}</b><span>{weaponLabel(e.weapon)} ⌁</span>{e.victim}</div>)}</div>
      {locked&&me?.hp!==0&&<div className={hit?'crosshair hit':'crosshair'}><i/><i/><i/><i/></div>}
      {playing&&me&&<div className="hud-bottom"><div className={`health ${me.hp<=30?'critical':''}`}><span className={`team-tag team-${me.team}`}>{me.team.toUpperCase()} TEAM</span><div><span className="health-icon">+</span><strong>{me.hp}</strong><small>HEALTH</small></div><div className="health-bar"><i style={{width:`${me.hp}%`}}/></div></div><div className="hud-center">{locked&&pickup&&<div className="pickup-prompt">{pickup}<small>Replaces your primary weapon</small></div>}<div className="inventory"><span className={me.weapon==='knife'?'selected':''}>1 · KNIFE</span><span className={me.weapon===me.primary?'selected':''}>2 · {WEAPONS[me.primary].label}</span><span className={me.weapon==='pistol'?'selected':''}>3 · P-12</span><span className={`grenade-count ${me.weapon==='grenade'?'selected':''}`}>4 · FRAG × {me.grenades}</span></div><div className="hud-hint">C / CTRL <span>{me.crouched?'CROUCHED':'CROUCH'}</span> · E <span>PICK UP</span> · TAB <span>SCORES</span></div></div><div className="ammo"><span>{me.reloadUntil?'RELOADING…':weaponLabel(me.weapon)}</span><div><strong>{isGun(me.weapon)?me.ammo[me.weapon]:me.weapon==='grenade'?me.grenades:'∞'}</strong>{isGun(me.weapon)&&<small>/ {WEAPONS[me.weapon].magazine}</small>}</div><small>{isGun(me.weapon)?'R RELOAD':me.weapon==='knife'?'LEFT CLICK SLASH':me.grenades?'LEFT CLICK THROW':'NO GRENADES'} <span> · </span> 1–4 SWITCH</small></div></div>}
      {me?.hp===0&&snap?.phase==='playing'&&<div className="death"><span>DOWN, NOT OUT</span><h2>Back in {Math.max(1,Math.ceil((me.respawnAt-snap.time)/1000))}</h2><p>Find another angle.</p></div>}
      {(!locked||busy)&&snap?.phase!=='finished'&&<div className="pause-wrap"><section className="pause-panel"><div className="eyebrow">{map.name.toUpperCase()} / ROUND {snap?.round??1}</div><h2>{busy?'Reconnecting…':snap?.players.length===1?'You’re first in.':'Ready when you are.'}</h2><p>{busy?status:snap?.players.length===1?'Share the room link to bring in your opponents.':'Click below to capture your mouse and enter the arena.'}</p>{notice&&<div className="notice">{notice}</div>}{error&&<div className="error">{error}</div>}<button className="primary" onClick={()=>arena.current?.lock()} disabled={busy||!snap}>{snap?.players.length===1?'EXPLORE THE ARENA':'ENTER THE ARENA'}<span>↗</span></button><button className="secondary" onClick={share}>{copied?'COPIED ✓':'COPY INVITATION LINK'}</button><div className="controls"><span><kbd>W A S D</kbd> Move</span><span><kbd>MOUSE</kbd> Aim / attack</span><span><kbd>SPACE</kbd> Jump</span><span><kbd>SHIFT</kbd> Sprint</span><span><kbd>R</kbd> Reload</span><span><kbd>1</kbd> Knife</span><span><kbd>E</kbd> Pick up gun</span><span><kbd>2 / 3</kbd> Guns</span><span><kbd>4 + CLICK</kbd> Grenade</span><span><kbd>C / CTRL</kbd> Crouch (hold)</span><span><kbd>TAB</kbd> Scoreboard</span><span><kbd>ESC</kbd> Release mouse</span></div><div className="pause-footer"><button onClick={()=>{setSound(!sound);arena.current?.setEffects(!sound);}}>SOUND {sound?'ON':'OFF'}</button><button onClick={leave}>LEAVE ROOM</button></div></section></div>}
      {(board||snap?.phase==='finished')&&snap&&<div className="scoreboard-wrap"><section className="scoreboard"><div className="eyebrow">{map.name.toUpperCase()} / ROUND {snap.round}</div><h2>{snap.phase==='finished'?(snap.winner==='draw'?'Even in the dust.':`${snap.winner?.toUpperCase()} takes the outpost.`):'Field report.'}</h2><div className="table"><div className="table-row table-head"><span>OPERATOR</span><span>K</span><span>D</span><span>STATUS</span></div>{[...snap.players].sort((a,b)=>a.team.localeCompare(b.team)||b.kills-a.kills).map(p=><div className={`table-row ${p.id===me?.id?'self':''}`} key={p.id}><span className={`team-${p.team}`}>{p.name}{p.id===me?.id?' (YOU)':''}</span><b>{p.kills}</b><span>{p.deaths}</span><small>{!p.connected?'RECONNECTING':p.hp?'ACTIVE':'RESPAWNING'}</small></div>)}</div>{snap.phase==='finished'?<><button className="primary" onClick={()=>{document.exitPointerLock();room.current?.send('rematch');}}>VOTE FOR REMATCH <span>↻</span></button><p className="fine-print">{votes||'Half of connected players must vote.'}</p><button className="text-button" onClick={leave}>Leave room</button></>:<p className="fine-print">Release TAB to return to the arena.</p>}</section></div>}
      {busy&&locked&&<div className="connection-banner" role="status">{status}</div>}
    </>}
  </main>;
}
