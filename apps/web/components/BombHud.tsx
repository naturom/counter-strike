import {BOMB_RULES,BOMB_TARGET,TEAMS,plantSite,type Snapshot,type Player} from '@sirocco/shared';
export function BombHud({snapshot:s,me}:{snapshot:Snapshot;me:Player}){
  const own=s.bombs.find(b=>b.team===me.team),enemy=s.bombs.find(b=>b.team!==me.team);if(!own||!enemy||s.phase==='finished')return null;
  const target=BOMB_TARGET[me.team],defend=BOMB_TARGET[enemy.team],carrier=s.players.find(p=>p.id===own.carrierId);
  let message=`Escort your carrier to ${target}. Protect site ${defend}.`;
  if(own.carrierId===me.id)message=plantSite(me,s.mapId,me.team)?`At site ${target} · 5 selects C4 · hold LEFT CLICK to plant.`:`You carry C4 · plant only at ${target} · 5 selects C4.`;
  if(own.status==='dropped')message='Your C4 dropped · press E nearby to recover it.';
  if(own.status==='defused')message=`Your C4 was defused. Eliminate the enemy and defend ${defend}.`;
  if(own.status==='planted')message=`Protect your C4 at ${target} until detonation.`;
  if(enemy.status==='planted')message=`ENEMY C4 AT ${defend} · hold E near it for ${BOMB_RULES.defuseMs/1000}s to defuse.`;
  if(me.hp<=0)message=s.roundLive?'You died · return when the next game starts.':`Solo practice · Respawning in ${Math.max(1,Math.ceil((me.respawnAt-s.time)/1000))}s.`;
  const armed=s.bombs.some(b=>b.status==='planted');
  return <section className={`bomb-hud ${armed?'armed':''}`} aria-label="Bomb objective" role="status">
    <strong>ATTACK {target} · DEFEND {defend}</strong><span>{message}</span>
    {carrier&&own.status==='carried'&&<small>YOUR CARRIER · {carrier.id===me.id?'YOU':carrier.name}{!s.roundLive?' · WAITING FOR OPPONENT':''}</small>}
    {s.bombs.filter(b=>b.status==='planted').map(b=><small key={b.team}>{b.team===me.team?'YOUR':'ENEMY'} C4 · SITE {b.siteId} · {Math.max(0,Math.ceil((b.explodeAt-s.time)/1000))}s</small>)}
    {s.bombs.filter(b=>b.action).map(b=>{const action=b.action!,progress=Math.max(0,Math.min(100,(s.time-action.startedAt)/(action.completeAt-action.startedAt)*100));return <div key={b.team} className="bomb-progress"><label>{action.kind==='plant'?'PLANTING':'DEFUSING'} {TEAMS[b.team].name.toUpperCase()} C4 · {s.players.find(p=>p.id===action.playerId)?.name}</label><progress value={progress} max="100" aria-label={`${TEAMS[b.team].name} ${action.kind} progress`}/></div>;})}
  </section>;
}
