import {buildVehicle} from './vehicle-model';
import * as THREE from 'three';
import {DUST2,dustPoint,DUST_SCALE} from '@sirocco/shared';
import {solidTop,groundAt,type Solid} from '@sirocco/shared';
import type {WorldArt} from './world';
import {solidGeometry,visibleFloorGeometry} from './map-geometry';
import {buildDoor,weatherWall,portalTrim,streetLamp,roundedBox,palmFrond,wallWear,rooftopDetails,groundContact,wallSignMount,DUST_ROUTE_SIGNS,roadPaintGeometry,tunnelRoofFrame,facadeCable,DUST_CABLES} from './environment-details';

export function buildDust(art:WorldArt){
  const root=new THREE.Group();root.name='Dust II';
  const finish=(color:string,normal=.5)=>art.material(color,{map:art.plaster.map,normalMap:art.plaster.normalMap,roughnessMap:art.plaster.roughnessMap,normalScale:new THREE.Vector2(normal,normal),vertexColors:true});
  const plaster=finish('#e8deca'),chalk=finish('#faf6e9'),clay=finish('#c8ad86',.65),ochre=finish('#ddc39b',.6);
  const road=art.asphalt,paving=art.paving;
  const gateWood=art.timber,crateWood=art.material('#baaa8c',{map:art.timber.map,normalMap:art.timber.normalMap,roughnessMap:art.timber.roughnessMap,normalScale:new THREE.Vector2(.3,.3)});
  const blue=art.material('#40677a',{roughness:.76,metalness:.32}),teal=art.material('#497c76'),red=art.material('#ae5847'),iron=art.material('#39413f',{metalness:.55,roughness:.56});
  const glass=art.material('#344b51',{roughness:.3,metalness:.25}),rubber=art.material('#282d2b'),tarp=art.material('#858c6b');
  const box=(w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number)=>art.box(root,w,h,d,m,x,y,z);
  const material=(b:Solid)=>b.style==='door'?gateWood:b.kind==='floor'&&(b.label?.startsWith('Tunnel stair')||b.label?.startsWith('Lower tunnel'))?art.stone:b.style==='road'?road:b.style==='tile'||b.label==='B plant platform'?paving:b.style==='metal'?blue:b.kind==='crate'?crateWood:b.kind==='floor'?art.sand:b.style==='kasbah'?(b.x<-20?clay:ochre):b.style==='plaster'?(b.z>5?chalk:plaster):art.stone;
  art.box(root,230,.25,230,art.sand,0,-.43,0,true);
  // Reserve unobstructed masonry at cable brackets; no window may sit behind one.
  const cableAnchors=DUST_CABLES.flatMap(c=>{
    const a=wallSignMount(DUST2.solids.filter(b=>b.label===c.a),dustPoint(c.from[0],c.from[1]),.20),b=wallSignMount(DUST2.solids.filter(b=>b.label===c.b),dustPoint(c.to[0],c.to[1]),.20),y=Math.min(a.wall.y+a.wall.h/2,b.wall.y+b.wall.h/2)-.55;
    return [{...a,y},{...b,y}];
  });
  const floors=DUST2.solids.filter(b=>b.kind==='floor');
  const stairWalls=DUST2.solids.filter(b=>['Tunnel stairwell west','Lower tunnels block','Western central block'].includes(b.label??''));
  for(const b of DUST2.solids){
    // Vehicles have individually modelled bodies matching these collision bounds.
    if(b.vehicle)continue;
    if(b.style==='door'){root.add(buildDoor(art,b,gateWood,iron));continue;}
    const geometry=b.kind==='floor'?visibleFloorGeometry(b,floors,stairWalls):solidGeometry(b);
    if(b.style==='road'){const uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*.5,uv.getY(i)*.5);}
    if(b.kind==='wall')weatherWall(geometry,b,groundAt({x:b.x,z:b.z},floors));
    const mesh=new THREE.Mesh(geometry,material(b));mesh.castShadow=b.kind!=='floor';mesh.receiveShadow=true;root.add(mesh);
    if(b.label?.startsWith('Tunnel stair tread'))box(b.w-.04,.025,.055,art.trim,b.x,b.y+b.h/2+.012,b.z-b.d/2+.028);
    if(b.kind==='crate')groundContact(art,root,b.x,b.y-b.h/2,b.z,b.w,b.d);
    if(b.kind==='crate'&&b.style!=='metal'){
      for(const y of [b.y-b.h/2+.12,b.y+b.h/2-.12])box(b.w+.035,.11,b.d+.035,iron,b.x,y,b.z);
      for(const x of [-b.w/2+.13,b.w/2-.13])box(.1,b.h,b.d+.045,iron,b.x+x,b.y,b.z);
      if(b.h>2)box(b.w+.06,.09,b.d+.06,iron,b.x,b.y,b.z);
      if(b.label?.includes('default'))box(b.w+.07,.035,b.d+.07,tarp,b.x,b.y+b.h/2+.015,b.z);
    }
    if(b.label==='Blue container'){
      for(let x=-b.w/2+.2;x<b.w/2;x+=.36)box(.065,b.h-.12,b.d+.06,blue,b.x+x,b.y,b.z);
      box(b.w+.15,.12,b.d+.15,iron,b.x,b.y+b.h/2,b.z);
      for(const x of [-b.w/2+.3,b.w/2-.3])box(.2,.25,b.d*.75,rubber,b.x+x,b.y-b.h/2,b.z);
    }
    if(b.kind==='roof'&&b.label?.includes('gate lintel'))portalTrim(art,root,b,ochre,groundAt({x:b.x,z:b.z},floors));
    // Façades follow actual polygon edges; details stay above players and don't
    // introduce visual obstacles that are absent from authoritative collision.
    if(b.kind!=='wall'||b.h<6||(b.label?.includes('Perimeter')||b.label?.includes('stairwell')))continue;
    const pts=b.polygon??[[b.x-b.w/2,b.z-b.d/2],[b.x+b.w/2,b.z-b.d/2],[b.x+b.w/2,b.z+b.d/2],[b.x-b.w/2,b.z+b.d/2]];
    const area=pts.reduce((sum,p,i)=>sum+p[0]*pts[(i+1)%pts.length][1]-pts[(i+1)%pts.length][0]*p[1],0);
    for(let i=0;i<pts.length;i++){
      const p=pts[i],q=pts[(i+1)%pts.length],dx=q[0]-p[0],dz=q[1]-p[1],length=Math.hypot(dx,dz);if(length<2.4)continue;
      const outward=area>0?1:-1,nx=dz/length*outward,nz=-dx/length*outward;
      const group=new THREE.Group();group.position.set((p[0]+q[0])/2+nx*.045,0,(p[1]+q[1])/2+nz*.045);group.rotation.y=Math.atan2(nx,nz);root.add(group);
      const roof=b.y+b.h/2,base=Math.max(b.y-b.h/2,groundAt({x:(p[0]+q[0])/2+nx*.25,z:(p[1]+q[1])/2+nz*.25},floors));
      art.box(group,length+.08,.22,.22,art.trim,0,roof-.12,0);
      wallWear(art,group,length,base,i+Math.round(Math.abs(b.x*7+b.z*11)));
      // A few occupied façades among plain walls; keep deliberate, regular bays
      // within each building instead of repeating shutters on every exposed edge.
      const facadeSeed=[...(b.label??'wall')].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,17)+i*13;
      const windowCount=length<4||facadeSeed%5<2?0:Math.min(3,Math.max(1,Math.floor(length/(6.5+facadeSeed%3))));
      const windowSpan=Math.min(length-3,(windowCount-1)*4.8);
      for(let bay=0;bay<windowCount;bay++){
        const x=windowCount===1?((facadeSeed%3)-1)*Math.min(.6,length*.08):-windowSpan/2+bay*windowSpan/(windowCount-1);
        const y=Math.max(base+2.3,roof-2.1),wx=group.position.x+Math.cos(group.rotation.y)*x,wz=group.position.z-Math.sin(group.rotation.y)*x;
        if(cableAnchors.some(a=>Math.hypot(a.x-wx,a.z-wz)<1.05&&Math.abs(a.y-y)<1.05))continue;
        art.box(group,.98,1.49,.08,art.trim,x,y,.015);art.box(group,.80,1.30,.045,glass,x,y,.067);
        for(const side of [-1,1]){art.box(group,.035,1.28,.045,teal,x+side*.36,y,.105);for(let j=0;j<10;j++){const slat=art.box(group,.335,.084,.038,teal,x+side*.18,y-.55+j*.12,.11);slat.rotation.x=.16;}}
        art.box(group,.035,1.30,.05,teal,x,y,.11);
        art.box(group,1.10,.09,.28,art.trim,x,y-.77,.08);
        if((i+Math.round(x))%3===0){art.box(group,.7,.55,.4,chalk,x+1,y+.45,.3);for(let j=0;j<5;j++)art.box(group,.58,.025,.02,iron,x+1,y+.25+j*.08,.51);}
      }
      if(b.style==='plaster'&&length>7&&i%2===0){const x=-length*.2;roundedBox(group,1.12,2.4,.065,art.trim,x,base+1.2,.035,.015);roundedBox(group,.94,2.24,.05,teal,x,base+1.14,.08,.02);for(let j=0;j<8;j++)art.box(group,.84,.035,.012,iron,x,base+.30+j*.24,.113);art.box(group,.035,.13,.035,iron,x+.29,base+1.02,.145);}
      if(length>8&&i===0)rooftopDetails(art,group,roof,chalk,iron);
      if(length>5)streetLamp(art,group,-length/2+.65,base,roof,iron);
    }
  }
  for(const [u,v,y] of [[306,480,5.9],[306,444,5.9],[367,411,3.12]]){
    const p=dustPoint(u,v),lamp=art.material('#e8d5a7',{emissive:'#f5cf89',emissiveIntensity:.9});
    box(.42,.07,.20,iron,p.x,y+.04,p.z);box(.32,.025,.13,lamp,p.x,y,p.z);
    const light=new THREE.PointLight('#ffe1ad',7,8,2);light.position.set(p.x,y-.1,p.z);root.add(light);
  }
  // Tall hotel façade and balcony at A: the primary visual landmark.
  const hotel=dustPoint(815,10);const hotelGroup=new THREE.Group();hotelGroup.position.set(hotel.x,0,hotel.z);root.add(hotelGroup);
  art.box(hotelGroup,12,10,6,chalk,0,8.8,-4);
  art.box(hotelGroup,12.4,.3,6.4,art.trim,0,13.9,-4);
  for(let x=-4.8;x<=4.8;x+=2.4){
    art.box(hotelGroup,1.6,4.8,.1,glass,x,9.2,-.94);
    arch(hotelGroup,x,6.6,-.82,1.9,4.6,art.trim,0);
    art.box(hotelGroup,.16,6,.25,art.trim,x-1,9.4,-.7);
  }
  art.box(hotelGroup,12.8,.22,1.2,art.trim,0,6.6,-.65);
  for(let x=-6;x<=6;x+=.28)art.box(hotelGroup,.035,.9,.035,teal,x,7.12,-.05);
  art.box(hotelGroup,12.4,.06,.06,teal,0,7.56,-.05);
  art.sign(root,'HÔTEL AURORE',hotel.x,12.9,hotel.z-.65,0,'#477e7b',8);
  art.sign(root,'A',hotel.x-4.5,5.4,hotel.z-.95,0,'#a85945',1.25);
  // Kasbah skyline, buttresses and crenellations outside the playing space.
  for(const [u,v] of [[75,10],[255,75],[158,60],[45,180]]){
    const p=dustPoint(u,v);box(3.8,12,3.8,clay,p.x,6,p.z);box(4,.25,4,ochre,p.x,11.8,p.z);
    for(let k=0;k<4;k++)box(.45,.6,.65,ochre,p.x-1.4+k*.95,12.25,p.z+1.65);
  }
  for(const [u,v,y,w,rot] of [[118,327,3.2,4.3,0],[160,414,3.2,5,0],[466,359,0,8.1,0],[710,553,2.1,5.8,0],[710,670,2.1,5.8,0]] as number[][]){const p=dustPoint(u,v);arch(root,p.x,y,p.z,w,3.3,ochre,rot);}
  // A framed roof light: short joists seat on headers at the actual slab edges.
  tunnelRoofFrame(art,root,DUST2.solids,gateWood,art.stone);
  for(let v=343;v<414;v+=20){const p=dustPoint(118,v);box(4.5,.18,.14,art.wood,p.x,6.55,p.z);}
  // Street-front shutters, awnings and signs around Long and Top Mid.
  for(const [u,v,text,color] of [[758,583,'SALON DE COIFFURE','#517a76'],[789,690,'TÉLÉBOUTIQUE','#4a7181'],[553,626,'MARCHÉ DU SOLEIL','#a7664b']] as const){
    const p=dustPoint(u,v);const y=v>800?3.2:v>580?2.1:0;
    box(2.8,2.7,.08,iron,p.x,y+1.35,p.z+.07);
    for(let k=0;k<18;k++)box(2.75,.035,.04,art.trim,p.x,y+.12+k*.145,p.z+.13);
    art.sign(root,text,p.x,y+3.15,p.z+.16,0,color,3.6);
    const canopy=box(3.7,.035,1.25,color==='#a7664b'?red:teal,p.x,y+2.85,p.z+.6);canopy.rotation.x=.12;box(3.7,.16,.035,color==='#a7664b'?red:teal,p.x,y+2.78,p.z+1.22);for(const side of [-1,1]){const support=box(.028,.028,1.18,iron,p.x+side*1.65,y+2.71,p.z+.56);support.rotation.x=-.19;}
  }
  for(const b of DUST2.solids.filter(b=>b.vehicle?.part==='body'))vehicle(b);
  // B floor and A platform markings; planes have no physical obstruction.
  for(const site of DUST2.bombSites??[]){
    const p=site.marker;groundMark(p.x,p.y,p.z,site.id,p.size);
  }
  for(const sign of DUST_ROUTE_SIGNS){
    const mount=wallSignMount(DUST2.solids.filter(b=>b.label===sign.wall),dustPoint(sign.u,sign.v),1.8);
    art.sign(root,sign.text,mount.x,sign.y,mount.z,mount.rotation,'#aa604b',1.8);
  }
  // Painted lane edge conforms to the road, including the ramp/landing join.
  const laneWhite=art.material('#d8d3c5',{roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),laneRed=art.material('#aa5847',{roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  for(let v=155;v<500;v+=12){const p=dustPoint(920,v),paint=new THREE.Mesh(roadPaintGeometry(floors,p.x,p.z,.22,1.25),(v/12|0)%2?laneWhite:laneRed);paint.receiveShadow=true;root.add(paint);}
  // Palms are outside routes, with compact trunks kept outside shared bounds.
  for(const [u,v,y] of [[800,-20,14.05],[850,-20,14.05],[51,260,0],[42,715,0],[977,365,0],[956,85,0]])palm(u,v,y);
  // Skyline behind the courtyard walls; deterministic variation avoids regeneration flicker.
  for(let i=0;i<19;i++){const x=-80+i*9,h=8+(i*7%11),z=-67-(i%3)*5;box(7.6,h,9,i%3?plaster:ochre,x,h/2,z);box(7.9,.25,9.3,art.trim,x,h,z);for(let k=0;k<3;k++)box(.8,1.4,.08,glass,x-2.4+k*2.4,h-2,z+4.55);}
  const minaret=dustPoint(355,-70);art.cylinder(root,1.7,2.1,24,chalk,minaret.x,12,minaret.z);art.cylinder(root,2.7,2.7,.6,art.trim,minaret.x,21,minaret.z);const dome=new THREE.Mesh(new THREE.SphereGeometry(1.8,18,10,0,Math.PI*2,0,Math.PI/2),teal);dome.position.set(minaret.x,24,minaret.z);root.add(dome);
  for(const cable of DUST_CABLES)facadeCable(art,root,DUST2.solids.filter(b=>b.label===cable.a),DUST2.solids.filter(b=>b.label===cable.b),dustPoint(cable.from[0],cable.from[1]),dustPoint(cable.to[0],cable.to[1]),iron);
  for(const pickup of DUST2.pickups){box(1.2,.18,.7,art.dark,pickup.x,pickup.y+.09,pickup.z);box(1.25,.04,.75,iron,pickup.x,pickup.y+.2,pickup.z);}
  return root;

  function arch(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,mat:THREE.Material,rotation:number){
    // Decorative arch occupies only the space above the traversable aperture.
    const shape=new THREE.Shape();shape.moveTo(-w/2,h+.65);shape.lineTo(w/2,h+.65);shape.lineTo(w/2,h-.6);shape.absellipse(0,h-.6,w/2,.6,0,Math.PI,false,0);shape.closePath();
    const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.24,bevelEnabled:false}),mat);mesh.position.set(x,y,z);mesh.rotation.y=rotation;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
  }
  function groundMark(x:number,y:number,z:number,label:string,size:number){
    const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d')!;ctx.strokeStyle='#b85b37';ctx.lineWidth=8;ctx.strokeRect(12,12,232,232);ctx.fillStyle='#b85b37';ctx.font='bold 170px sans-serif';ctx.textAlign='center';ctx.fillText(label,128,187);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;art.textures.push(texture);const material=art.material('#fff',{map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(size,size),material);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y+.02,z);root.add(mesh);
  }
  function vehicle(b:Solid){
    groundContact(art,root,b.x,b.y-b.h/2,b.z,b.w,b.d);
    root.add(buildVehicle(art,b));
  }
  function palm(u:number,v:number,y:number){const p=dustPoint(u,v),bark=art.timber;art.cylinder(root,.13,.25,6.5,bark,p.x,y+3.25,p.z);const green=art.material('#68704b',{roughness:1,side:THREE.DoubleSide});for(let i=0;i<11;i++){const group=new THREE.Group();group.position.set(p.x,y+6.3,p.z);group.rotation.y=i*Math.PI*2/11;group.rotation.x=(i%3)*.06;group.add(palmFrond(green,2.8+(i%3)*.28));root.add(group);}}
}
