import {MAPS,type Snapshot,type Player} from '@sirocco/shared';
export function Minimap({snapshot,me}:{snapshot:Snapshot;me:Player}){
  const map=MAPS[snapshot.mapId];if(!map.bounds)return null;
  const {minX,maxX,minZ,maxZ}=map.bounds;
  const point=(x:number,z:number)=>`${x},${z}`;
  const location=map.landmarks?.reduce((a,b)=>Math.hypot(b.x-me.x,b.z-me.z)<Math.hypot(a.x-me.x,a.z-me.z)?b:a);
  return <aside className="radar" aria-label={`Map radar. Near ${location?.name??'spawn'}`}>
    <svg viewBox={`${minX} ${minZ} ${maxX-minX} ${maxZ-minZ}`} role="img" aria-label="Dust II layout with your position and teammates">
      <rect x={minX} y={minZ} width={maxX-minX} height={maxZ-minZ} fill="#23302e"/>
      {map.solids.filter(b=>b.kind==='floor').map((b,i)=><rect key={`f${i}`} x={b.x-b.w/2} y={b.z-b.d/2} width={b.w} height={b.d} fill="#9caa91" opacity={.28+Math.min(.25,b.y*.09)}/>)}
      {map.solids.filter(b=>b.kind==='wall'||b.kind==='crate').map((b,i)=>b.polygon?<polygon key={i} points={b.polygon.map(([x,z])=>point(x,z)).join(' ')} fill="#151e1c" stroke="#bcc1a2" strokeWidth=".2"/>:<rect key={i} x={b.x-b.w/2} y={b.z-b.d/2} width={b.w} height={b.d} fill="#151e1c" stroke="#bcc1a2" strokeWidth=".2"/>)}
      {map.landmarks?.filter(l=>l.name==='A'||l.name==='B').map(l=><text key={l.name} x={l.x} y={l.z} fill="#f5c17b" textAnchor="middle" fontSize="6" fontWeight="700">{l.name}</text>)}
      {snapshot.players.filter(p=>p.hp>0&&p.team===me.team&&p.id!==me.id).map(p=><circle key={p.id} cx={p.x} cy={p.z} r="1.5" fill="#8dc9e5"/>)}
      <g transform={`translate(${me.x} ${me.z}) rotate(${-me.yaw*180/Math.PI})`}><path d="M 0 -4 L -2.2 2 L 0 1 L 2.2 2 Z" fill="#fff4cb" stroke="#15221b" strokeWidth=".5"/></g>
    </svg><span>{location?.name??'DUST II'}</span>
  </aside>;
}
