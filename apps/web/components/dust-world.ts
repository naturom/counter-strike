import * as THREE from 'three';
import {DUST2,dustPoint,DUST_SCALE} from '@sirocco/shared';
import {solidTop,type Solid} from '@sirocco/shared';
import type {WorldArt} from './world';
import {solidGeometry,visibleFloorGeometry} from './map-geometry';

export function buildDust(art:WorldArt){
  const root=new THREE.Group();root.name='Dust II';
  const plaster=art.material('#e2d7c3',{map:art.stone.map,normalMap:art.stone.normalMap,normalScale:new THREE.Vector2(.12,.12)});
  const chalk=art.material('#e9e3d1',{map:art.stone.map,normalMap:art.stone.normalMap,normalScale:new THREE.Vector2(.1,.1)});
  const clay=art.material('#b89b6e',{map:art.stone.map,normalMap:art.stone.normalMap,normalScale:new THREE.Vector2(.35,.35)});
  const ochre=art.material('#cdb18a',{map:art.stone.map,normalMap:art.stone.normalMap,normalScale:new THREE.Vector2(.22,.22)});
  const road=art.material('#85847c',{map:art.sand.map,normalMap:art.sand.normalMap,normalScale:new THREE.Vector2(.18,.18)});
  const paving=art.material('#a8a79a',{map:art.stone.map,normalMap:art.stone.normalMap,normalScale:new THREE.Vector2(.2,.2)});
  const blue=art.material('#40677a',{roughness:.76,metalness:.32}),teal=art.material('#497c76'),red=art.material('#ae5847'),iron=art.material('#555c57',{metalness:.45,roughness:.65});
  const glass=art.material('#344b51',{roughness:.3,metalness:.25}),rubber=art.material('#282d2b'),tarp=art.material('#858c6b');
  const box=(w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number)=>art.box(root,w,h,d,m,x,y,z);
  const material=(b:Solid)=>b.style==='door'?art.wood:b.style==='road'?road:b.style==='tile'?paving:b.style==='metal'?blue:b.kind==='crate'?art.wood:b.style==='kasbah'?(b.x<-20?clay:ochre):b.style==='plaster'?(b.z>5?chalk:plaster):art.stone;
  art.box(root,230,.25,230,art.sand,0,-.43,0,true);
  const floors=DUST2.solids.filter(b=>b.kind==='floor');
  for(const b of DUST2.solids){
    // Vehicles have individually modelled bodies matching these collision bounds.
    if(b.vehicle)continue;
    const mesh=new THREE.Mesh(b.kind==='floor'?visibleFloorGeometry(b,floors):solidGeometry(b),material(b));mesh.castShadow=b.kind!=='floor';mesh.receiveShadow=true;root.add(mesh);
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
    if(b.style==='door'){
      const points=b.polygon!;const a=points[0],c=points[1],length=Math.hypot(a[0]-c[0],a[1]-c[1]);
      const group=new THREE.Group();group.position.set(b.x,b.y,b.z);group.rotation.y=-Math.atan2(c[1]-a[1],c[0]-a[0]);root.add(group);
      for(const y of [-b.h*.36,0,b.h*.36]){art.box(group,length,.10,.37,iron,0,y,0);for(let x=-length/2+.2;x<length/2;x+=.35){const stud=new THREE.Mesh(new THREE.SphereGeometry(.035,5,4),iron);stud.position.set(x,y,.2);group.add(stud);}}
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.13,.025,6,16),iron);ring.position.set(.2,-.2,.22);group.add(ring);
    }
    // Façades follow actual polygon edges; details stay above players and don't
    // introduce visual obstacles that are absent from authoritative collision.
    if(b.kind!=='wall'||b.style==='door'||b.h<6||b.label?.includes('Perimeter'))continue;
    const pts=b.polygon??[[b.x-b.w/2,b.z-b.d/2],[b.x+b.w/2,b.z-b.d/2],[b.x+b.w/2,b.z+b.d/2],[b.x-b.w/2,b.z+b.d/2]];
    const area=pts.reduce((sum,p,i)=>sum+p[0]*pts[(i+1)%pts.length][1]-pts[(i+1)%pts.length][0]*p[1],0);
    for(let i=0;i<pts.length;i++){
      const p=pts[i],q=pts[(i+1)%pts.length],dx=q[0]-p[0],dz=q[1]-p[1],length=Math.hypot(dx,dz);if(length<2.4)continue;
      const outward=area>0?1:-1,nx=dz/length*outward,nz=-dx/length*outward;
      const group=new THREE.Group();group.position.set((p[0]+q[0])/2+nx*.045,0,(p[1]+q[1])/2+nz*.045);group.rotation.y=Math.atan2(nx,nz);root.add(group);
      const roof=b.y+b.h/2;
      art.box(group,length+.08,.22,.22,art.trim,0,roof-.12,0);
      art.box(group,length,.38,.09,ochre,0,.2,0);
      for(let x=-length/2+1.25;x<length/2-1;x+=3.1){
        const y=roof-2.1;art.box(group,.92,1.45,.12,art.trim,x,y,.02);art.box(group,.76,1.27,.14,glass,x,y,.1);
        for(let j=0;j<8;j++)art.box(group,.73,.055,.06,teal,x,y-.55+j*.15,.2);
        art.box(group,1.1,.1,.32,art.trim,x,y-.77,.10);
        if((i+Math.round(x))%3===0){art.box(group,.7,.55,.4,chalk,x+1,y+.45,.3);for(let j=0;j<5;j++)art.box(group,.58,.025,.02,iron,x+1,y+.25+j*.08,.51);}
      }
      if(length>7&&i%2===0){
        const roof=b.y+b.h/2;
        art.box(group,1.2,.8,1.1,ochre,0,roof+.4,-1.3);
        const antenna=art.cylinder(group,.025,.025,2.1,iron,0,roof+1.85,-1.3);
        art.box(group,1.1,.035,.035,iron,0,roof+2.6,-1.3);
        const dish=new THREE.Mesh(new THREE.SphereGeometry(.45,12,8,0,Math.PI*2,0,Math.PI*.42),chalk);dish.position.set(1.8,roof+.6,-1.2);dish.rotation.x=.7;group.add(dish);
      }
      if(length>5){
        const x=-length/2+.65;art.box(group,.09,roof-.6,.12,iron,x,roof/2,0);
        art.box(group,.6,.08,.6,iron,x,3.7,.28);
        const lamp=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6,0,Math.PI*2,0,Math.PI/2),art.trim);lamp.position.set(x,3.6,.48);group.add(lamp);
      }
    }
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
  art.sign(root,'A',hotel.x-6.1,10.8,hotel.z-.62,0,'#a85945',1.25);
  // Kasbah skyline, buttresses and crenellations outside the playing space.
  for(const [u,v] of [[75,10],[255,75],[158,60],[45,180]]){
    const p=dustPoint(u,v);box(3.8,12,3.8,clay,p.x,6,p.z);box(4,.25,4,ochre,p.x,11.8,p.z);
    for(let k=0;k<4;k++)box(.45,.6,.65,ochre,p.x-1.4+k*.95,12.25,p.z+1.65);
  }
  for(const [u,v,y,w,rot] of [[118,327,3.2,4.3,0],[160,414,3.2,5,0],[300,410,.3,3.8,Math.PI/2],[466,359,0,8.1,0],[710,553,2.1,5.8,0],[710,670,2.1,5.8,0]] as number[][]){const p=dustPoint(u,v);arch(root,p.x,y,p.z,w,3.3,ochre,rot);}
  // Tunnel roof joists and a sunlit broken opening rather than pitch-black rooms.
  for(let u=75;u<280;u+=19){const p=dustPoint(u,458);box(.14,.18,8.8,art.wood,p.x,6.65,p.z);}
  for(let v=343;v<414;v+=20){const p=dustPoint(118,v);box(4.5,.18,.14,art.wood,p.x,6.55,p.z);}
  // Street-front shutters, awnings and signs around Long and Top Mid.
  for(const [u,v,text,color] of [[758,583,'SALON DE COIFFURE','#517a76'],[789,690,'TÉLÉBOUTIQUE','#4a7181'],[553,626,'MARCHÉ DU SOLEIL','#a7664b'],[365,878,'CAFÉ DU SUD','#7a7760']] as const){
    const p=dustPoint(u,v);const y=v>800?3.2:v>580?2.1:0;
    box(2.8,2.7,.08,iron,p.x,y+1.35,p.z+.07);
    for(let k=0;k<18;k++)box(2.75,.035,.04,art.trim,p.x,y+.12+k*.145,p.z+.13);
    art.sign(root,text,p.x,y+3.15,p.z+.16,0,color,3.6);
    const canopy=box(3.7,.12,1.25,color==='#a7664b'?red:teal,p.x,y+2.85,p.z+.6);canopy.rotation.x=.08;
  }
  for(const b of DUST2.solids.filter(b=>b.vehicle?.part==='body'))vehicle(b,!!b.vehicle?.truck);
  // B floor and A platform markings; planes have no physical obstruction.
  for(const site of DUST2.bombSites??[]){
    const p=site.marker;groundMark(p.x,p.y,p.z,site.id,p.size);
  }
  for(const [u,v,y,label,rot] of [[422,685,4,'← B',0],[565,835,4.7,'A →',0],[426,320,2.3,'B ←',Math.PI/2],[841,318,4.3,'A ↑',Math.PI/2],[78,238,4.3,'B',Math.PI/2]] as const){const p=dustPoint(u,v);art.sign(root,label,p.x,y,p.z,rot,'#aa604b',1.8);}
  // Curbs and painted lane boundaries track the Long slope.
  for(let v=155;v<500;v+=12){const p=dustPoint(920,v),y=v<215?3.8-(v-150)/65*1.7:2.1;box(.22,.11,1.25,(v/12|0)%2?chalk:red,p.x,y+.05,p.z);}
  // Palms are outside routes, with compact trunks kept outside shared bounds.
  for(const [u,v,y] of [[800,-20,14.05],[850,-20,14.05],[51,260,0],[42,715,0],[977,365,0],[956,85,0]])palm(u,v,y);
  // Skyline behind the courtyard walls; deterministic variation avoids regeneration flicker.
  for(let i=0;i<19;i++){const x=-80+i*9,h=8+(i*7%11),z=-67-(i%3)*5;box(7.6,h,9,i%3?plaster:ochre,x,h/2,z);box(7.9,.25,9.3,art.trim,x,h,z);for(let k=0;k<3;k++)box(.8,1.4,.08,glass,x-2.4+k*2.4,h-2,z+4.55);}
  const minaret=dustPoint(355,-70);art.cylinder(root,1.7,2.1,24,chalk,minaret.x,12,minaret.z);art.cylinder(root,2.7,2.7,.6,art.trim,minaret.x,21,minaret.z);const dome=new THREE.Mesh(new THREE.SphereGeometry(1.8,18,10,0,Math.PI*2,0,Math.PI/2),teal);dome.position.set(minaret.x,24,minaret.z);root.add(dome);
  for(const [u1,v1,u2,v2,y] of [[680,710,739,710,10],[845,300,968,300,10],[435,610,530,610,9],[78,183,263,183,11]]){
    const a=dustPoint(u1,v1),b=dustPoint(u2,v2),points=[];for(let i=0;i<=24;i++){const t=i/24;points.push(new THREE.Vector3(a.x+(b.x-a.x)*t,y-Math.sin(t*Math.PI)*1.1,a.z+(b.z-a.z)*t));}const mat=new THREE.LineBasicMaterial({color:'#373b35'});art.materials.push(mat);root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),mat));
  }
  for(const pickup of DUST2.pickups){box(1.2,.18,.7,art.dark,pickup.x,pickup.y+.09,pickup.z);box(1.25,.04,.75,iron,pickup.x,pickup.y+.2,pickup.z);}
  return root;

  function arch(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,mat:THREE.Material,rotation:number){
    // Decorative arch occupies only the space above the traversable aperture.
    const shape=new THREE.Shape();shape.moveTo(-w/2,h+.65);shape.lineTo(w/2,h+.65);shape.lineTo(w/2,h-.6);shape.absellipse(0,h-.6,w/2,.6,0,Math.PI,false,0);shape.closePath();
    const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.24,bevelEnabled:false}),mat);mesh.position.set(x,y,z);mesh.rotation.y=rotation;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
  }
  function groundMark(x:number,y:number,z:number,label:string,size:number){
    const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d')!;ctx.strokeStyle='#b85b37';ctx.lineWidth=8;ctx.strokeRect(12,12,232,232);ctx.fillStyle='#b85b37';ctx.font='bold 170px sans-serif';ctx.textAlign='center';ctx.fillText(label,128,187);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;art.textures.push(texture);const material=art.material('#fff',{map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(size,size),material);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y+.02,z);root.add(mesh);
  }
  function vehicle(b:Solid,truck:boolean){
    const g=new THREE.Group();g.position.set(b.x,b.y-b.h/2,b.z);g.scale.y=(b.vehicle?.height??b.h)/1.5;if(b.w>b.d)g.rotation.y=Math.PI/2;root.add(g);
    const length=Math.max(b.w,b.d),width=Math.min(b.w,b.d),body=truck?blue:chalk;
    art.box(g,width,.55,length,body,0,.65,0);art.box(g,width*.85,.6,length*.47,body,0,1.18,-.15);
    art.box(g,width*.78,.44,.04,glass,0,1.18,-length*.26);art.box(g,width*.78,.4,.04,glass,0,1.18,length*.2);
    for(const side of [-1,1]){art.box(g,.025,.43,length*.35,glass,side*width*.435,1.2,-.1);for(const z of [-length*.33,length*.33]){const wheel=art.cylinder(g,.36,.36,.19,rubber,side*width*.48,.36,z);wheel.rotation.z=Math.PI/2;}}
    art.box(g,width,.12,.12,iron,0,.4,-length/2);art.box(g,width,.12,.12,iron,0,.4,length/2);
    for(const x of [-width*.32,width*.32])art.box(g,.25,.15,.035,art.trim,x,.7,-length/2-.02);
    if(truck){art.box(g,width*.9,.7,length*.45,art.wood,0,1.1,length*.25);for(let i=0;i<4;i++)art.box(g,width,.07,length*.45,iron,0,.83+i*.18,length*.25);}
  }
  function palm(u:number,v:number,y:number){const p=dustPoint(u,v);art.cylinder(root,.13,.27,6.5,art.wood,p.x,y+3.25,p.z);const green=teal;for(let i=0;i<10;i++){const group=new THREE.Group();group.position.set(p.x,y+6.3,p.z);group.rotation.y=i*Math.PI/5;root.add(group);for(let j=0;j<7;j++){const leaf=new THREE.Mesh(new THREE.ConeGeometry(.38-j*.035,1.05,3),green);leaf.position.set(0,-j*j*.025,-j*.38);leaf.rotation.x=-Math.PI/2-j*.10;group.add(leaf);}}}
}
