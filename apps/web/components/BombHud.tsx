import {BOMB_RULES,plantSite,type Snapshot,type Player} from '@sirocco/shared';
export function BombHud({snapshot:s,me}:{snapshot:Snapshot;me:Player}){
  const b=s.bomb;if(!b||s.phase==='finished')return null;
  const carrier=s.players.find(p=>p.id===b.carrierId),action=b.action;
  const progress=action?Math.max(0,Math.min(100,(s.time-action.startedAt)/(action.completeAt-action.startedAt)*100)):0;
  const seconds=b.status==='planted'?Math.max(0,Math.ceil((b.explodeAt-s.time)/1000)):0;
  let message=me.team==='red'?'Escort the carrier to A or B.':'Defend A and B. Stop the plant.';
  if(b.carrierId===me.id)message=plantSite(me,s.mapId)?'At a bombsite · 5 selects C4 · hold LEFT CLICK to plant.':'You carry C4 · reach A or B · 5 selects C4.';
  if(b.status==='dropped')message=me.team==='red'?'C4 dropped · find it and press E to recover.':'C4 dropped · guard it and protect the sites.';
  if(b.status==='planted')message=me.team==='red'?'Protect C4 until detonation.':`Retake site ${b.siteId} · hold E near C4 for ${BOMB_RULES.defuseMs/1000}s.`;
  if(me.hp<=0)message='One life this round · watch the result, then vote for a rematch.';
  return <section className={`bomb-hud ${b.status==='planted'?'armed':''}`} aria-label="Bomb objective" role="status">
    <strong>{b.status==='planted'?`C4 PLANTED AT ${b.siteId} · ${seconds}s`:me.team==='red'?'ATTACK · PLANT AT A OR B':'DEFEND · PROTECT A AND B'}</strong>
    <span>{message}</span>
    {b.status==='carried'&&carrier&&<small>CARRIER · {carrier.id===me.id?'YOU':carrier.name}{!s.roundLive?' · WAITING FOR OPPONENT':''}</small>}
    {action&&<div className="bomb-progress"><label>{action.kind==='plant'?'PLANTING':'DEFUSING'} · {s.players.find(p=>p.id===action.playerId)?.name}</label><progress value={progress} max="100" aria-label={action.kind==='plant'?'Plant progress':'Defuse progress'}/></div>}
  </section>;
}
