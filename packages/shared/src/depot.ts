import type {MapDefinition,Pickup,Solid} from './index';

// Relay's signed identifier is retained so existing invitations open its replacement.
// All dimensions are metres. The playable rectangle is 40 x 35, with no off-map scenery.
export const DEPOT_CATWALK={height:2.8,halfLength:10,halfWidth:1.2,stairLength:7.2,steps:16} as const;
const solids:Solid[]=[];
function box(label:string,x:number,z:number,w:number,d:number,h:number,kind:Solid['kind']='wall',base=0,style:Solid['style']='metal'){
 const b:Solid={label,x,z,w,d,h,y:base+h/2,kind,style};solids.push(b);return b;
}
box('Yard asphalt',0,0,12,24,.04,'floor',-.04,'road');
for(const z of [-14.75,14.75])box('Service lane asphalt',0,z,40,5.5,.04,'floor',-.04,'road');
box('Depot foundation',0,0,40.8,35.8,.3,'floor',-.3,'stone');
for(const side of [-1,1]){
 const name=side<0?'West':'East',cx=side*13;
 box(`${name} perimeter`,side*20.2,0,.4,35.8,5.4);
 box(`${name} warehouse roof`,cx,0,14.4,24.4,.2,'roof',5.2);
 for(const z of [-11.8,-6,0,6,11.8]){box(`${name} roof rafter`,cx,z,13.5,.12,.18,'roof',5.02);box(`${name} ceiling fixture`,cx,z,5.5,.22,.15,'roof',4.87);}
 // The yard-facing wall has two full-height loading doors and an upper bridge door.
 for(const z of [-10.5,10.5])box(`${name} yard wall end`,side*6,z,.4,3,5.2);
 for(const z of [-3.2,3.2])box(`${name} yard wall centre`,side*6,z,.4,3.6,5.2);
 box(`${name} bridge sill`,side*6,0,.4,2.8,2.8);
 for(const z of [-7,7])box(`${name} loading door lintel`,side*6,z,.4,4,2,'wall',3.2);
 // The ends of each warehouse open onto the two flanking service lanes.
 for(const z of [-12,12]){
  box(`${name} end outer wall`,side*18,z,4,.4,5.2);
  box(`${name} end inner wall`,side*9,z,6,.4,5.2);
  box(`${name} service door lintel`,side*14,z,4,.4,2,'wall',3.2);
 }
 const {height,steps,stairLength,halfLength,halfWidth}=DEPOT_CATWALK,tread=stairLength/steps;
 for(let i=0;i<steps;i++){
  const x=side*(halfLength+stairLength-(i+.5)*tread),top=height*(i+1)/steps;
  box(`${name} stair ${i+1}`,x,0,tread,halfWidth*2,top,'floor');
  for(const z of [-1.27,1.27])box(`${name} stair guard ${i+1}`,x,z,tread,.12,.88,'wall',top);
 }
}
for(const z of [-17.7,17.7])box('Service yard perimeter',0,z,40.8,.4,3.8,'wall',0,'stone');
box('Catwalk deck',0,0,20.4,2.4,.18,'floor',DEPOT_CATWALK.height-.18);
for(const z of [-1.27,1.27])box('Catwalk guard',0,z,20,.12,.88,'wall',DEPOT_CATWALK.height);
// Long containers break the central sight line; neighbouring pallets give access to their tops.
box('Teal cargo container',-2.4,-5.5,2.4,6,2.55);
box('Rust cargo container',2.4,5.5,2.4,6,2.55);
box('North pallet stack',-4.4,-5.5,1.5,1.6,1.05,'crate',0,'plaster');
box('South pallet stack',4.4,5.5,1.5,1.6,1.05,'crate',0,'plaster');
box('Yard crate',-2.7,7.5,1.7,1.7,1.2,'crate',0,'plaster');
box('Yard crate',2.7,-7.5,1.7,1.7,1.2,'crate',0,'plaster');
// Actual forklift collision follows its chassis, mast and overhead safety cage.
box('West forklift chassis',-11,-5,1.2,2.2,.92);
box('West forklift mast',-11,-6.15,1.2,.18,2.2);
box('West forklift cage',-11,-4.75,1.2,1.15,.12,'roof',2.1);
box('East cargo crate',11,5,1.5,2,1.2,'crate',0,'plaster');

const pickups:Pickup[]=[
 {id:'west-smg',x:-17,y:0,z:13,weapon:'smg',availableAt:0},
 {id:'east-smg',x:17,y:0,z:-13,weapon:'smg',availableAt:0},
 {id:'mid-dmr',x:-3,y:0,z:-14,weapon:'marksman',availableAt:0},
 {id:'court-dmr',x:3,y:0,z:14,weapon:'marksman',availableAt:0},
 {id:'west-ak47',x:-17,y:0,z:8,weapon:'ak47',availableAt:0},
 {id:'east-m4a1s',x:17,y:0,z:-8,weapon:'m4a1s',availableAt:0},
 {id:'west-p90',x:-17,y:0,z:4,weapon:'p90',availableAt:0},
 {id:'east-scar',x:17,y:0,z:-4,weapon:'scar',availableAt:0},
 {id:'mid-m249',x:0,y:0,z:8,weapon:'m249',availableAt:0},
 {id:'west-deagle',x:-12,y:0,z:14,weapon:'deagle',availableAt:0},
 {id:'east-deagle',x:12,y:0,z:-14,weapon:'deagle',availableAt:0},
];
for(const p of pickups){p.y=.16;box('Weapon rack stand',p.x,p.z,1,.6,.16,'floor');}
export const DEPOT:MapDefinition={
 id:'relay',name:'Depot',subtitle:'Warehouse · Yard · Catwalk',
 description:'A compact industrial loading yard. Fight through two warehouses, flank along the service lanes, or take the central catwalk.',
 spawnYaw:{red:-Math.PI/2,blue:Math.PI/2},
 bounds:{minX:-20,maxX:20,minZ:-17.5,maxZ:17.5},solids,pickups,
 spawns:{red:[{x:-17,y:0,z:10},{x:-14,y:0,z:8},{x:-17,y:0,z:6},{x:-14,y:0,z:11}],blue:[{x:17,y:0,z:-10},{x:14,y:0,z:-8},{x:17,y:0,z:-6},{x:14,y:0,z:-11}]},
 landmarks:[{name:'WEST WAREHOUSE',x:-14,z:0},{name:'EAST WAREHOUSE',x:14,z:0},{name:'CONTAINER YARD',x:0,z:5},{name:'NORTH LANE',x:0,z:-14.5},{name:'SOUTH LANE',x:0,z:14.5},{name:'A',x:11,z:-8},{name:'B',x:-11,z:8}],
 bombSites:[{id:'A',x:11,z:-8,w:4,d:4,minY:0,maxY:.15,marker:{x:11,y:0,z:-8,size:4}},{id:'B',x:-11,z:8,w:4,d:4,minY:0,maxY:.15,marker:{x:-11,y:0,z:8,size:4}}],
};
