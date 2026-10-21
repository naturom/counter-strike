'use client';
import {useEffect,useRef,useState} from 'react';
import {Client, type Room} from '@colyseus/sdk';
import {WEAPONS, type Snapshot, type CombatEvent} from '@sirocco/shared';
import {Arena} from './arena';
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export default function Game(){
  const canvas=useRef<HTMLCanvasElement>(null);const arena=useRef<Arena|null>(null);const room=useRef<Room|null>(null);const intentional=useRef(false);const client=useRef<Client|null>(null);const inviteRef=useRef('');const nameRef=useRef('');const reconnecting=useRef(false);
  const [ready,setReady]=useState(false),[name,setName]=useState(''),[invite,setInvite]=useState(''),[status,setStatus]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[playing,setPlaying]=useState(false),[locked,setLocked]=useState(false),[board,setBoard]=useState(false),[snap,setSnap]=useState<Snapshot|null>(null),[feed,setFeed]=useState<(CombatEvent&{at:number})[]>([]),[copied,setCopied]=useState(false),[hit,setHit]=useState(false),[sound,setSound]=useState(true),[votes,setVotes]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{
    setName(localStorage.getItem('sirocco-name')??'');const token=new URLSearchParams(location.hash.slice(1)).get('invite')??'';setInvite(token);inviteRef.current=token;
    client.current=new Client(`${location.protocol==='https:'?'wss':'ws'}://${location.host}`);
    try{arena.current=new Arena(canvas.current!,{input:i=>room.current?.send('input',i),lock:setLocked,board:setBoard});setReady(true);}catch{setError('WebGL is unavailable. Use a desktop browser with hardware acceleration enabled.');}
    return()=>{intentional.current=true;void room.current?.leave();arena.current?.destroy();};
  },[]);
  function attach(next:Room){
    next.reconnection.enabled=false;room.current=next;arena.current?.start(next.sessionId);setPlaying(true);setBusy(false);setStatus('Connected');
    sessionStorage.setItem('sirocco-reconnect',JSON.stringify({invite:inviteRef.current,token:next.reconnectionToken}));
    next.onMessage('snapshot',(s:Snapshot)=>{setSnap(s);arena.current?.update(s);});
    next.onMessage('votes',(v:{count:number;needed:number})=>setVotes(`${v.count} / ${v.needed} votes`));
    next.onMessage('combat',(e:CombatEvent)=>{arena.current?.combat(e);if(e.type==='kill')setFeed(old=>[...old.slice(-3),{...e,at:Date.now()}]);if(e.type==='shot'&&e.shooter===next.sessionId&&e.target){setHit(true);setTimeout(()=>setHit(false),130);}});
    next.onError((_code,message)=>setError(message||'Connection error'));
    next.onLeave(code=>{if(intentional.current||room.current!==next)return;room.current=null;
      if(code===4000){setStatus('Disconnected after two minutes without activity.');setPlaying(false);arena.current?.stop();sessionStorage.removeItem('sirocco-reconnect');return;}
      void reconnect(next.reconnectionToken);
    });
  }
  async function reserve(token:string){
    const response=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:nameRef.current,invite:token||undefined}),signal:AbortSignal.timeout(45000)});
    const data=await response.json();if(!response.ok)throw new Error(data.error??'Could not join room');
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
  function leave(){intentional.current=true;void room.current?.leave();room.current=null;arena.current?.stop();setPlaying(false);setSnap(null);setBoard(false);setStatus('');sessionStorage.removeItem('sirocco-reconnect');}
  const me=snap?.players.find(p=>p.id===room.current?.sessionId);const remaining=snap?Math.max(0,Math.ceil((snap.endsAt-snap.time)/1000)):600;const time=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
  return <main className={playing?'app in-game':'app'}>
    <canvas ref={canvas} className="arena" aria-label="Relay desert arena" />
    {!playing?<>
      <div className="lobby-shade"/>
      <header className="topbar"><a className="brand" href="/" aria-label="Sirocco home"><span className="brand-mark">╱╱</span> SIROCCO<span className="brand-sub">MULTIPLAYER FPS</span></a><div className="top-meta"><span className="dot"/> ASIA / SINGAPORE <span className="build">BUILD 01</span></div></header>
      <section className="lobby">
        <div className="intro"><div className="eyebrow"><span className="tiny-line"/> DESERT OPERATIONS / 01</div><h1>Hold your ground.<br/><em>Own the dust.</em></h1><p>Eight players. Two sides. One sun-scorched arena.<br/>Bring your squad. Leave your mark.</p><div className="mode-tags"><span>4 VS 4</span><span>TEAM DEATHMATCH</span><span>NO DOWNLOAD</span></div>
          <form className="join-card" onSubmit={e=>{e.preventDefault();void join();}}><div className="card-heading"><span>{invite?'INVITATION RECEIVED':'READY TO DEPLOY?'}</span><span className="card-number">01 — 08</span></div><label htmlFor="callsign">YOUR CALLSIGN</label><div className="entry"><span className="input-icon">⌁</span><input id="callsign" maxLength={20} placeholder="Enter a guest nickname" value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname" disabled={busy}/></div><button className="primary" type="submit" disabled={!ready||busy}>{busy?'CONNECTING…':invite?'JOIN THE ROOM':'CREATE A ROOM'}<span>↗</span></button><div className="card-foot"><span className="dot"/> {invite?'Your team is assigned automatically.':'Private by invitation. No account needed.'}</div>{invite&&<button type="button" className="text-button" onClick={()=>{setInvite('');inviteRef.current='';history.replaceState(null,'','/');}}>Create a separate room instead</button>}</form>
          {(error||status)&&<p className={error?'message error':'message'} role="status">{error||status}</p>}
        </div>
        <aside className="map-label"><span className="map-kicker">PLAYABLE MAP / 01</span><h2>RELAY<span>↗</span></h2><p>A forgotten outpost.<br/>Three routes through the heat.</p><div className="map-stats"><div><b>30</b><span>KILLS TO WIN</span></div><div><b>10<span>:00</span></b><span>ROUND TIME</span></div></div></aside>
      </section>
      <footer className="lobby-footer"><span>BUILT FOR THE BROWSER. MADE FOR THE SQUAD.</span><span>DESKTOP + MOUSE <b>↗</b></span></footer>
    </>:<>
      <div className="match-top"><div className="match-brand">╱╱ SIROCCO <span>RELAY / TDM</span></div><div className="score-strip"><div className="team-red">RED <b>{snap?.scores.red??0}</b></div><div className="clock"><b>{time}</b><span>FIRST TO 30</span></div><div className="team-blue"><b>{snap?.scores.blue??0}</b> BLUE</div></div><button className="share" onClick={share}>{copied?'LINK COPIED ✓':'INVITE A FRIEND ↗'}</button></div>
      <div className="killfeed">{feed.filter(e=>Date.now()-e.at<6000).map(e=><div key={e.id}><b className={`team-${e.team}`}>{e.name}</b><span>{WEAPONS[e.weapon].label} ⌁</span>{e.victim}</div>)}</div>
      {locked&&me?.hp!==0&&<div className={hit?'crosshair hit':'crosshair'}><i/><i/><i/><i/></div>}
      {playing&&me&&<div className="hud-bottom"><div className="health"><span className={`team-tag team-${me.team}`}>{me.team.toUpperCase()} TEAM</span><div><span className="health-icon">+</span><strong>{me.hp}</strong><small>HP</small></div><div className="health-bar"><i style={{width:`${me.hp}%`}}/></div></div><div className="hud-hint">W A S D <span>MOVE</span> · SHIFT <span>SPRINT</span> · TAB <span>SCORES</span></div><div className="ammo"><span>{me.reloadUntil?'RELOADING…':WEAPONS[me.weapon].label}</span><div><strong>{me.ammo[me.weapon]}</strong><small>/ {WEAPONS[me.weapon].magazine}</small></div><small>R RELOAD <span> · </span> 1 / 2 SWITCH</small></div></div>}
      {me?.hp===0&&snap?.phase==='playing'&&<div className="death"><span>DOWN, NOT OUT</span><h2>Back in {Math.max(1,Math.ceil((me.respawnAt-snap.time)/1000))}</h2><p>Find another angle.</p></div>}
      {(!locked||busy)&&snap?.phase!=='finished'&&<div className="pause-wrap"><section className="pause-panel"><div className="eyebrow">RELAY / ROUND {snap?.round??1}</div><h2>{busy?'Reconnecting…':snap?.players.length===1?'You’re first in.':'Ready when you are.'}</h2><p>{busy?status:snap?.players.length===1?'Share the room link to bring in your opponents.':'Click below to capture your mouse and enter the arena.'}</p>{notice&&<div className="notice">{notice}</div>}{error&&<div className="error">{error}</div>}<button className="primary" onClick={()=>arena.current?.lock()} disabled={busy||!snap}>{snap?.players.length===1?'EXPLORE THE ARENA':'ENTER THE ARENA'}<span>↗</span></button><button className="secondary" onClick={share}>{copied?'COPIED ✓':'COPY INVITATION LINK'}</button><div className="controls"><span><kbd>W A S D</kbd> Move</span><span><kbd>MOUSE</kbd> Aim / fire</span><span><kbd>SPACE</kbd> Jump</span><span><kbd>SHIFT</kbd> Sprint</span><span><kbd>R</kbd> Reload</span><span><kbd>1 / 2</kbd> Weapons</span><span><kbd>TAB</kbd> Scoreboard</span><span><kbd>ESC</kbd> Release mouse</span></div><div className="pause-footer"><button onClick={()=>{setSound(!sound);arena.current?.setEffects(!sound);}}>SOUND {sound?'ON':'OFF'}</button><button onClick={leave}>LEAVE ROOM</button></div></section></div>}
      {(board||snap?.phase==='finished')&&snap&&<div className="scoreboard-wrap"><section className="scoreboard"><div className="eyebrow">RELAY / ROUND {snap.round}</div><h2>{snap.phase==='finished'?(snap.winner==='draw'?'Even in the dust.':`${snap.winner?.toUpperCase()} takes the outpost.`):'Field report.'}</h2><div className="table"><div className="table-row table-head"><span>OPERATOR</span><span>K</span><span>D</span><span>STATUS</span></div>{[...snap.players].sort((a,b)=>a.team.localeCompare(b.team)||b.kills-a.kills).map(p=><div className={`table-row ${p.id===me?.id?'self':''}`} key={p.id}><span className={`team-${p.team}`}>{p.name}{p.id===me?.id?' (YOU)':''}</span><b>{p.kills}</b><span>{p.deaths}</span><small>{!p.connected?'RECONNECTING':p.hp?'ACTIVE':'RESPAWNING'}</small></div>)}</div>{snap.phase==='finished'?<><button className="primary" onClick={()=>{document.exitPointerLock();room.current?.send('rematch');}}>VOTE FOR REMATCH <span>↻</span></button><p className="fine-print">{votes||'Half of connected players must vote.'}</p><button className="text-button" onClick={leave}>Leave room</button></>:<p className="fine-print">Release TAB to return to the arena.</p>}</section></div>}
      {busy&&locked&&<div className="connection-banner" role="status">{status}</div>}
    </>}
  </main>;
}
