import {groundAt,intersects,footprint,solidTop,wallDistance,TREX_RULES,type Solid,type Vec3,type MapDefinition} from '@sirocco/shared';
type Node=Vec3&{key:string;ix:number;iz:number};
class Queue {
 private items:{node:Node;score:number}[]=[];
 push(node:Node,score:number){const entry={node,score};this.items.push(entry);let i=this.items.length-1;while(i){const parent=(i-1)>>1;if(this.items[parent].score<=score)break;this.items[i]=this.items[parent];i=parent;}this.items[i]=entry;}
 pop(){if(!this.items.length)return;const result=this.items[0],last=this.items.pop()!;if(this.items.length){let i=0;while(i*2+1<this.items.length){let child=i*2+1;if(child+1<this.items.length&&this.items[child+1].score<this.items[child].score)child++;if(this.items[child].score>=last.score)break;this.items[i]=this.items[child];i=child;}this.items[i]=last;}return result.node;}
}
/** Lazily cached outdoor navigation. No map-specific waypoints or player data
 * are baked into the graph, so creatures use the same cover and floor geometry. */
export class TrexNavigation {
 private cache=new Map<string,Node|null>();private edges=new Map<string,Node[]>();readonly cell=1.1;
 readonly bounds:{minX:number;maxX:number;minZ:number;maxZ:number};
 constructor(readonly solids:Solid[],map:MapDefinition){this.bounds=map.bounds??{minX:-29,maxX:29,minZ:-23,maxZ:23};}
 point(x:number,z:number):Vec3|undefined{
  const b=this.bounds;if(x<b.minX+TREX_RULES.radius||x>b.maxX-TREX_RULES.radius||z<b.minZ+TREX_RULES.radius||z>b.maxZ-TREX_RULES.radius)return;
  const p={x,y:groundAt({x,z},this.solids,5.5),z};if(this.solids.some(s=>intersects({...p,y:p.y+.012},s,TREX_RULES.height,TREX_RULES.radius)))return;return p;
 }
 outdoors(p:Vec3){return !this.solids.some(s=>footprint(p,s,.3)&&s.y-s.h/2>p.y+.05&&s.y-s.h/2<p.y+10&&solidTop(s,p)>p.y+.1);}
 private node(ix:number,iz:number){const key=`${ix},${iz}`;if(this.cache.has(key))return this.cache.get(key)!;const p=this.point(this.bounds.minX+ix*this.cell,this.bounds.minZ+iz*this.cell),node=p?{...p,key,ix,iz}:null;this.cache.set(key,node);return node;}
 nearest(p:Vec3,rings=6){const ix=Math.round((p.x-this.bounds.minX)/this.cell),iz=Math.round((p.z-this.bounds.minZ)/this.cell);let best:Node|undefined,score=Infinity;
  for(let r=0;r<=rings;r++){for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++){if(r&&Math.abs(x)!==r&&Math.abs(z)!==r)continue;const n=this.node(ix+x,iz+z);if(!n)continue;const d=Math.hypot(n.x-p.x,n.z-p.z)+Math.abs(n.y-p.y)*.3;if(d<score){best=n;score=d;}}if(best&&score<(r+.5)*this.cell)break;}return best;
 }
 clear(a:Vec3,b:Vec3){const distance=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.max(1,Math.ceil(distance/.28));let y=a.y;for(let i=1;i<=steps;i++){const t=i/steps,p=this.point(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t);if(!p||Math.abs(p.y-y)>.65)return false;y=p.y;}return true;}
 private neighbors(node:Node){let result=this.edges.get(node.key);if(result)return result;result=[];for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++){if(!x&&!z)continue;const next=this.node(node.ix+x,node.iz+z);if(next&&Math.abs(next.y-node.y)<=.65&&this.clear(node,next))result.push(next);}this.edges.set(node.key,result);return result;}
 path(from:Vec3,to:Vec3){const start=this.nearest(from,3),goal=this.nearest(to);if(!start||!goal)return [];const open=new Queue(),cost=new Map<string,number>([[start.key,0]]),came=new Map<string,Node>(),closed=new Set<string>();open.push(start,0);let node:Node|undefined;
  for(let i=0;i<2400&&(node=open.pop());i++){if(closed.has(node.key))continue;if(node.key===goal.key){const route:Vec3[]=[node];while(node.key!==start.key){node=came.get(node.key)!;route.push(node);}route.reverse();if(route.length&&this.clear(from,route[0]))return route;return [];}
   closed.add(node.key);for(const next of this.neighbors(node)){const score=cost.get(node.key)!+Math.hypot(next.x-node.x,next.z-node.z)+Math.abs(next.y-node.y)*.6;if(score>=(cost.get(next.key)??Infinity))continue;cost.set(next.key,score);came.set(next.key,node);open.push(next,score+Math.hypot(goal.x-next.x,goal.z-next.z));}}
  return [];
 }
 spawn(p:Vec3,yaw:number,occupied:Vec3[]){
  for(const distance of [8,10,12,6,14,4,3.5])for(const angle of [0,.18,-.18,.36,-.36,.52,-.52]){
   const aim=yaw+angle,point=this.point(p.x-Math.sin(aim)*distance,p.z-Math.cos(aim)*distance);if(!point||!this.outdoors(point)||point.y>p.y+.6||occupied.some(o=>Math.hypot(o.x-point.x,o.z-point.z)<2.1))continue;
   const origin={x:p.x,y:p.y+1.6,z:p.z},d={x:point.x-origin.x,y:point.y+.7-origin.y,z:point.z-origin.z},length=Math.hypot(d.x,d.y,d.z);if(wallDistance(origin,{x:d.x/length,y:d.y/length,z:d.z/length},this.solids)<length-.2)continue;
   const nearest=this.nearest(point,1);if(nearest&&Math.abs(nearest.y-point.y)<.4&&this.clear(point,nearest))return point;
  }
 }
}
