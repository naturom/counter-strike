import type {MapDefinition, Solid, Vec3} from './index';

// Hand-built reconstruction from the 1024px modern Dust II radar and Valve's
// comparison photographs. 4.4 Hammer units/px at .0254m/unit. Heights are authored
// approximations, not an extraction of Valve's collision mesh. North is -Z.
export const DUST_SCALE = 4.4 * .0254;
export const dustPoint = (u:number,v:number,y=0):Vec3 => ({x:(u-512)*DUST_SCALE,y,z:(v-512)*DUST_SCALE});
const solids:Solid[]=[];
function rect(name:string,u:number,v:number,w:number,d:number,h:number,base=0,kind:Solid['kind']='wall',style:Solid['style']='plaster'){
  const p=dustPoint(u+w/2,v+d/2,base+h/2);
  const b:Solid={...p,w:w*DUST_SCALE,d:d*DUST_SCALE,h,kind,style,label:name};solids.push(b);return b;
}
function poly(name:string,pts:[number,number][],h:number,base=0,style:Solid['style']='plaster'){
  const xs=pts.map(p=>p[0]),zs=pts.map(p=>p[1]);
  const b=rect(name,Math.min(...xs),Math.min(...zs),Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs),h,base,'wall',style);
  b.polygon=pts.map(([u,v])=>{const p=dustPoint(u,v);return [p.x,p.z];});return b;
}
function wall(name:string,a:[number,number],b:[number,number],h=7,base=0,style:Solid['style']='kasbah',thickness=5){
  const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),nx=-dz/len*thickness/2,nz=dx/len*thickness/2;
  return poly(name,[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]],h,base,style);
}
function floor(name:string,u:number,v:number,w:number,d:number,top:number,style:Solid['style']='stone',bottom=-.3){return rect(name,u,v,w,d,top-bottom,bottom,'floor',style);}
function ramp(name:string,u:number,v:number,w:number,d:number,axis:'x'|'z',from:number,to:number,style:Solid['style']='stone'){
  const b=floor(name,u,v,w,d,Math.max(from,to),style);b.ramp={axis,from,to};return b;
}
function crate(name:string,u:number,v:number,w:number,d:number,h:number,base:number){return rect(name,u,v,w,d,h,base,'crate','stone');}

// Vehicles expose a lower hood and a higher cabin instead of an invisible
// full-height box over the whole footprint. Rendering uses the same dimensions.
function vehicle(name:string,u:number,v:number,w:number,d:number,height:number,base:number,truck=false){
  const body=rect(name,u,v,w,d,height*.925/1.5,base,'crate','metal');
  body.vehicle={part:'body',height,truck};
  const sideways=body.w>body.d,length=Math.max(body.w,body.d),width=Math.min(body.w,body.d),scale=height/1.5;
  const part=(kind:'cabin'|'cargo',localZ:number,partWidth:number,partLength:number,top:number)=>{
    const bottom=base+body.h;
    solids.push({...body,label:`${name} ${kind}`,x:body.x+(sideways?localZ:0),z:body.z+(sideways?0:localZ),w:sideways?partLength:partWidth,d:sideways?partWidth:partLength,y:(bottom+base+top*scale)/2,h:base+top*scale-bottom,vehicle:{part:kind,height,truck}});
  };
  part('cabin',-.15,width*.85,length*.47,1.48);
  if(truck)part('cargo',length*.25,width*.9,length*.45,1.45);
}

// Perimeter follows the radar silhouette rather than enclosing a generic rectangle.
const boundary:[number,number][]=[[78,16],[136,16],[136,80],[790,80],[790,34],[925,34],[925,104],[932,104],[932,215],[970,215],[970,318],[947,318],[925,355],[925,496],[965,496],[965,668],[925,668],[925,790],[738,790],[738,822],[666,822],[666,964],[606,964],[606,1000],[488,1000],[488,977],[54,977],[54,880],[90,842],[90,616],[66,616],[66,180],[78,180]];
boundary.forEach((p,i)=>wall('Perimeter',p,boundary[(i+1)%boundary.length],8+(i%4)*.65,0,p[0]<560?'kasbah':'plaster',7));

// Large building footprints establish every route and the characteristic bends.
poly('Northern kasbah',[[263,80],[790,80],[790,104],[618,104],[618,155],[574,155],[574,213],[488,213],[488,150],[320,150],[320,118],[263,118]],9,0,'kasbah');
// Retaining walls reach the lower CT ground; only the window aperture is open.
// Starting these at the raised B floor left a crawlable void beneath the site.
poly('B northern parapet',[[136,80],[263,80],[263,118],[136,118]],9,0,'kasbah');
rect('B east wall north',254,118,9,71,8,0,'wall','kasbah');
rect('B window sill',254,189,9,25,3.25,0,'wall','kasbah');
rect('B window lintel',254,189,9,25,2.6,5.1,'wall','kasbah');
rect('B east pier',254,214,9,18,8,0,'wall','kasbah');
rect('B east wall south',254,268,9,57,8,0,'wall','kasbah');
wall('B exit angled wall',[254,325],[210,370],6,0);
rect('B tunnel east',138,327,32,90,7.8,0,'wall','kasbah');
rect('B tunnel west',66,327,32,87,7.8,0,'wall','kasbah');
poly('Lower tunnels block',[[267,266],[428,266],[428,386],[286,386],[286,437],[256,437],[256,326]],8.2,0,'kasbah');
poly('Tunnel south block',[[66,502],[170,502],[170,576],[139,576],[139,610],[90,610],[90,616],[66,616]],8,0,'kasbah');
poly('Western central block',[[330,437],[439,437],[439,536],[418,536],[418,618],[394,618],[406,691],[446,691],[446,878],[344,878],[344,773],[300,773],[300,500],[330,500]],9.2,0,'kasbah');
rect('Tunnel courtyard east',244,575,56,198,7.5,0,'wall','kasbah');
poly('T spawn island',[[490,670],[570,670],[590,690],[590,810],[570,835],[500,835],[480,815],[480,688]],8.8,0,'plaster');
poly('Mid bazaar',[[548,436],[675,436],[675,464],[690,464],[690,553],[673,553],[673,626],[548,626],[532,610],[532,454]],9.6,0,'plaster');
poly('Catwalk building',[[532,285],[616,285],[616,372],[576,372],[576,386],[532,386]],9.2,0,'plaster');
rect('Catwalk east block',678,273,164,183,11.3,0,'wall','plaster');
poly('Long door shop',[[738,580],[756,559],[778,580],[778,690],[846,690],[846,790],[738,790]],10.6,0,'plaster');
rect('Long vestibule west',674,569,8,107,7.6,0,'wall','plaster');
rect('T spawn mid screen',344,875,218,6,5.8,0,'wall','kasbah');
rect('T spawn west retaining',153,766,8,115,4.1,0,'wall','kasbah');

// Authored elevations: A and Short over CT, the depressed pit, two tunnel levels,
// T ramp and sloping mid. These volumes are shared by rendering and authority.
// A visible, collidable base replaces the old invisible Y=0 fallback in gaps.
floor('Foundation',0,0,1024,1024,0);
floor('T spawn terrace',54,882,434,95,3.2,'stone');
floor('T terrace west',161,773,183,109,3.2,'stone');
ramp('T west stairs',54,770,99,112,'z',1.6,3.2);
floor('Outside tunnels',90,610,154,160,1.6);
floor('Tunnel west apron',90,576,80,34,1.6);
ramp('Tunnel approach',170,500,130,110,'z',3.2,1.6);
floor('Upper tunnels',66,414,220,88,3.2);
floor('B tunnel',98,327,40,87,3.2);
ramp('B tunnel exit',98,285,40,42,'z',2,3.2);
floor('B site courtyard',66,180,188,147,2);
floor('B site north',78,16,58,164,2);
floor('B plant platform',136,118,118,62,2.65);
ramp('B platform ramp',136,180,45,32,'z',2.65,2);
floor('B exit apron',170,327,116,43,2);
ramp('B exit return',170,370,116,44,'z',2,3.2);
// Cover both angled door leaves, including their outer edges, with one ramp.
// The old narrow threshold left trenches alongside the approach.
ramp('B doors threshold',254,220,65,58,'x',2,0);
// The narrow lower tunnel flight drops toward Mid; the corridor stays under roof.
ramp('Tunnel stairs',286,438,44,56,'z',.3,3.2);
floor('Tunnel stair landing',286,494,44,8,3.2);
floor('Lower tunnels',286,386,160,52,.3);
ramp('Lower tunnel exit',420,386,26,52,'x',.3,0);
floor('CT Mid',263,118,355,167,0);
floor('CT spawn',618,155,60,120,0);
floor('CT underpass',678,214,120,59,0);
floor('Mid bottom',428,285,104,153,0);
ramp('Mid slope',394,438,118,182,'z',0,2.1);
floor('Top Mid',394,620,280,50,2.1);
floor('Top Mid east apron',532,610,16,10,2.1);
ramp('T east ramp',394,670,280,212,'z',2.1,3.2);
floor('T east passage',488,882,178,118,3.2);
floor('Outside Long',674,670,64,152,2.1,'road');
floor('Long vestibule',674,553,64,123,2.1,'tile');
floor('Long corner',674,456,251,64,2.1,'road');
floor('Long corner apron',690,520,160,33,2.1,'road');
floor('Long west pavement',738,553,112,137,2.1,'road');
floor('Long east pavement',925,496,40,63,2.1,'road');
floor('Long lane',842,318,83,138,2.1,'road');
floor('Long cross',842,215,128,103,2.1,'road');
floor('Long bevel pavement',925,318,22,37,2.1,'road');
floor('Long side pit',925,559,40,109,2.1);
floor('Pit',850,559,75,231,.45,'tile');
floor('Pit rear apron',846,690,4,100,.45,'tile');
ramp('Pit stairs',850,520,75,39,'z',2.1,.45);
ramp('A ramp',842,150,90,65,'z',3.8,2.1,'road');
floor('A site',678,80,164,134,3.8,'tile');
floor('Goose',790,34,135,116,3.8,'tile');
floor('A long platform',842,104,90,46,3.8,'road');
ramp('CT exit ramp',798,214,44,59,'x',0,2.1);
// Short is a real bridge above the CT approach; no solid column through the passage.
floor('Catwalk approach',512,436,20,154,1.7,'tile');
ramp('Catwalk entry',512,590,20,30,'z',1.7,2.1,'tile');
floor('Catwalk',515,386,163,50,1.7,'tile');
floor('Catwalk recess',576,372,42,14,1.7,'tile');
rect('Mid catwalk retaining',503,395,9,164,2.7,0,'wall','plaster');
ramp('Short stairs',618,334,60,52,'z',3.8,1.7,'tile');
floor('Short bend',618,273,60,61,3.8,'tile');
floor('Short bridge',618,104,60,169,3.8,'tile',3.35);
rect('Short parapet west',615,273,4,61,1,3.8,'wall','plaster');
rect('Short parapet west bridge',615,155,4,118,1,3.8,'wall','plaster');
// The A floor volume supplies its retaining face; an overlapping wall here
// previously duplicated the top surface and caused depth flicker.
// Modern solo climb from CT to A, built as broad steps rather than a sealed wall.
crate('CT boost low',686,221,21,18,.9,0);crate('CT boost middle',707,221,21,18,1.8,0);crate('CT boost high',728,221,21,18,2.7,0);

// Door leaves, lintels, tunnels and gameplay cover. Openings are deliberately kept.
wall('Mid doors left',[431,359],[456,375],3.25,0,'door',3);
wall('Mid doors right',[477,355],[501,365],3.25,0,'door',3);
rect('Mid gate lintel',428,354,76,9,1.5,3.25,'roof','kasbah');
wall('Long doors outer',[688,664],[708,652],3.7,2.1,'door',3);
wall('Long doors inner',[709,568],[730,555],3.7,2.1,'door',3);
rect('Long gate lintel south',682,665,56,7,1.5,5.8,'roof','plaster');
rect('Long gate lintel north',682,550,56,7,1.5,5.8,'roof','plaster');
rect('Long chamber roof',682,557,56,110,.35,6.8,'roof','plaster');
wall('B doors north',[260,235],[281,224],3.6,1.8,'door',3);
wall('B doors south',[260,264],[281,274],3.6,1.8,'door',3);
rect('Upper tunnel roof',66,414,220,30,.5,6.6,'roof','kasbah');
rect('Upper tunnel roof south',66,478,220,24,.5,6.6,'roof','kasbah');
rect('B tunnel roof',98,327,40,87,.45,6.6,'roof','kasbah');
rect('Lower tunnel roof',286,386,142,52,.45,3.4,'roof','kasbah');
crate('Xbox',451,401,28,26,1.55,0);
crate('B default',180,145,21,22,1.45,2.65);
crate('B double stack',220,119,25,28,2.55,2.65);
crate('B big box',158,246,27,28,2.5,2);
crate('B back cover',111,34,23,22,1.55,2);
crate('B window boost',271,185,26,24,2.1,0);
crate('B window step',296,189,16,19,1.05,0);
crate('A default',788,148,25,26,1.45,3.8);
crate('A double stack',758,107,26,30,2.6,3.8);
crate('A short cover',695,190,23,20,1.25,3.8);
crate('T spawn cover',111,910,32,14,1.1,3.2);
crate('Blue container step',704,482,19,21,1.2,2.1);
rect('Blue container',723,462,54,25,2.5,2.1,'crate','metal');
vehicle('Long car',923,263,20,45,1.5,2.1);
vehicle('B car',174,296,39,18,1.5,2);
vehicle('CT truck',429,148,57,23,2.1,0,true);

const landmark = (name:string,u:number,v:number)=>({name,...dustPoint(u,v)});
export const DUST2:MapDefinition={
  id:'dunes',name:'Dust II',subtitle:'Long · Mid · Tunnels',description:'Fight from the hotel at A to the kasbah at B. Long sightlines, raised catwalks and a covered tunnel flank.',solids,
  bounds:{minX:-54,maxX:54,minZ:-57,maxZ:57},
  spawns:{red:[dustPoint(380,930,3.2),dustPoint(330,930,3.2),dustPoint(430,930,3.2),dustPoint(280,930,3.2)],blue:[dustPoint(590,225),dustPoint(590,190),dustPoint(563,225),dustPoint(590,260)]},
  pickups:[{id:'west-smg',...dustPoint(380,908,3.2),weapon:'smg',availableAt:0},{id:'east-smg',...dustPoint(590,247),weapon:'smg',availableAt:0},{id:'mid-dmr',...dustPoint(461,607,2.1*(607-438)/182),weapon:'marksman',availableAt:0},{id:'court-dmr',...dustPoint(115,453,3.2),weapon:'marksman',availableAt:0}],
  // Marker placement and authoritative plant areas share this definition. B
  // includes the entire raised platform as well as its courtyard approach.
  bombSites:[
    {id:'A',...dustPoint(786,170),w:103*DUST_SCALE,d:68*DUST_SCALE,minY:3.7,maxY:3.9,marker:{...dustPoint(813,174,3.8),size:3.6}},
    {id:'B',...dustPoint(195,192),w:118*DUST_SCALE,d:148*DUST_SCALE,minY:1.9,maxY:2.75,marker:{...dustPoint(217,164,2.65),size:2.8}},
  ],
  landmarks:[landmark('A',815,130),landmark('B',186,199),landmark('T SPAWN',377,939),landmark('CT SPAWN',590,222),landmark('LONG',879,423),landmark('PIT',885,626),landmark('MID',470,510),landmark('SHORT',646,310),landmark('TUNNELS',160,460)],
};
