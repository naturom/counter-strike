import type {Solid,Vec3} from './index';
/** Radar-space coordinates keep the tower aligned with the carved Mid bazaar. */
export const SCOUT_TOWER={base:1.7,deck:15.14,levels:4,floors:8,rise:3.36,entry:[530,550] as const,center:[567,525] as const};
export function scoutTowerSolids(point:(u:number,v:number,y?:number)=>Vec3,scale:number):Solid[]{
 const solids:Solid[]=[];
 const box=(label:string,u:number,v:number,w:number,d:number,bottom:number,top:number,kind:Solid['kind']='wall',style:Solid['style']='plaster')=>{
  const b:Solid={...point(u+w/2,v+d/2,(bottom+top)/2),w:w*scale,d:d*scale,h:top-bottom,kind,style,label:`Scout tower ${label}`};solids.push(b);return b;
 };
 const slab=(name:string,u:number,v:number,w:number,d:number,top:number)=>box(name,u,v,w,d,top-.22,top,'floor','tile');
 box('foundation',532,480,70,90,-.3,SCOUT_TOWER.base,'floor','tile');
 box('west wall north',532,480,4,60,1.7,SCOUT_TOWER.deck-.22);box('west wall south',532,558,4,12,1.7,SCOUT_TOWER.deck-.22);
 box('entry lintel',532,540,4,18,4.5,SCOUT_TOWER.deck-.22);
 box('north wall',536,480,62,4,1.7,SCOUT_TOWER.deck-.22);box('east wall',598,480,4,90,1.7,SCOUT_TOWER.deck-.22);box('south wall',536,566,62,4,1.7,SCOUT_TOWER.deck-.22);
 for(let level=0;level<SCOUT_TOWER.levels;level++){
  const low=1.7+level*3.36,mid=low+1.68,high=low+3.36;
  for(let step=0;step<10;step++){
   slab(`west stair ${level+1}-${step+1}`,536,542-step*4,22,4,low+(step+1)*.168);
   slab(`east stair ${level+1}-${step+1}`,576,506+step*4,22,4,mid+(step+1)*.168);
  }
  slab(`north landing ${level+1}`,536,484,62,22,mid);
  if(level<SCOUT_TOWER.levels-1)slab(`south landing ${level+1}`,536,546,62,20,high);
  // Sloping solid guard walls follow the flights and leave the centre well open.
  for(const [u,from,to] of [[558,mid+1.05,low+1.05],[574,mid+1.05,high+1.05]]){
   const b=box(`stair guard ${level+1}-${u}`,u,506,2,40,Math.min(from,to)-1.05,Math.max(from,to));b.ramp={axis:'z',from,to};
  }
  // Close the centre-well edges at both turns, meeting the flight guards exactly.
  box(`north landing guard ${level+1}`,558,504,18,2,mid-.22,mid+1.05);
  if(level<SCOUT_TOWER.levels-1)box(`south landing guard ${level+1}`,558,546,18,2,high-.22,high+1.05);
 }
 // Two-metre clear circulation lanes on every side of the stair opening.
 slab('lookout south',514,546,106,42,SCOUT_TOWER.deck);slab('lookout west',514,462,22,84,SCOUT_TOWER.deck);
 slab('lookout north',536,462,62,22,SCOUT_TOWER.deck);slab('lookout east',598,462,22,84,SCOUT_TOWER.deck);
 for(const [name,u,v,w,d] of [['south',514,586,106,2],['north',514,462,106,2],['west',514,464,2,122],['east',618,464,2,122]] as const)box(`lookout parapet ${name}`,u,v,w,d,SCOUT_TOWER.deck,SCOUT_TOWER.deck+.78);
 // Guard the stair cutout continuously; only the final flight remains open.
 box('well guard south',536,546,40,1.4,SCOUT_TOWER.deck-.22,SCOUT_TOWER.deck+.9);box('well guard west',536,484,1.4,62,SCOUT_TOWER.deck-.22,SCOUT_TOWER.deck+.9);
 box('well guard east',596.6,484,1.4,62,SCOUT_TOWER.deck-.22,SCOUT_TOWER.deck+.9);box('well guard north',536,484,62,1.4,SCOUT_TOWER.deck-.22,SCOUT_TOWER.deck+.9);
 for(const u of [516,616])for(const v of [464,584])box('canopy pier',u,v,2,2,SCOUT_TOWER.deck+.78,SCOUT_TOWER.deck+3.15);
 box('canopy',513,461,108,128,SCOUT_TOWER.deck+3.15,SCOUT_TOWER.deck+3.4,'roof');
 return solids;
}
/** A walking route through every flight and landing, also used by local navigation checks. */
export function scoutTowerRoute(){
 const route:{u:number;v:number;y:number}[]=[{u:520,v:550,y:1.7},{u:547,v:550,y:1.7}];
 for(let level=0;level<SCOUT_TOWER.levels;level++){
  const y=1.7+level*3.36;
  route.push({u:547,v:494,y:y+1.68},{u:587,v:494,y:y+1.68},{u:587,v:556,y:y+3.36});
  if(level<SCOUT_TOWER.levels-1)route.push({u:547,v:556,y:y+3.36});
 }
 route.push({u:567,v:560,y:SCOUT_TOWER.deck});return route;
}
