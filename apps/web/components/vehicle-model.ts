import * as THREE from 'three';
import type {Solid} from '@sirocco/shared';
import type {WorldArt} from './world';
import {roundedBox} from './environment-details';

/** Sedan and pickup bodies share the same hood/cabin envelope as map collision. */
export function buildVehicle(art:WorldArt,b:Solid){
 const truck=!!b.vehicle?.truck,length=Math.max(b.w,b.d),width=Math.min(b.w,b.d),g=new THREE.Group();
 g.name=b.label??'Vehicle';g.position.set(b.x,b.y-b.h/2,b.z);g.scale.y=(b.vehicle?.height??1.5)/1.5;if(b.w>b.d)g.rotation.y=Math.PI/2;
 const paint=art.material(truck?'#647e80':'#b6b0a0',{metalness:.48,roughness:.48,side:THREE.DoubleSide}),trim=art.material('#252b29',{roughness:.8}),chrome=art.material('#989b94',{metalness:.88,roughness:.31}),tire=art.material('#20221f',{roughness:1}),glass=art.material('#344d54',{metalness:.45,roughness:.17,side:THREE.DoubleSide}),lamps=art.material('#d1cdb7',{roughness:.27,metalness:.2}),red=art.material('#70281e',{roughness:.3}),dirt=art.material('#746d5a',{roughness:1});
 const box=(w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number,r=.02)=>roundedBox(g,w,h,d,m,x,y,z,r);
 const quad=(points:number[][],m:THREE.Material)=>{const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([0,1,2,0,2,3].flatMap(i=>points[i]),3));geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,0,1,1,0,1],2));geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,m);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);return mesh;};
 // Actual wheel-arch cutouts replace the slab that used to cover the tires.
 const shape=new THREE.Shape();shape.moveTo(-length/2+.04,.72);shape.lineTo(-length*.40,.84);shape.lineTo(-length*.25,.925);shape.lineTo(length*.25,.925);shape.lineTo(length*.46,.82);shape.lineTo(length/2-.04,.68);shape.lineTo(length/2-.04,.32);
 for(let i=0;i<=220;i++){const z=(length/2-.04)*(1-2*i/220),distance=Math.min(Math.abs(z-length*.32),Math.abs(z+length*.32));shape.lineTo(z,distance<.40?.35+Math.sqrt(.40**2-distance**2):.32);}shape.closePath();
 const body=new THREE.ExtrudeGeometry(shape,{depth:width-.10,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:2,steps:1,curveSegments:20});
 const p=body.attributes.position;for(let i=0;i<p.count;i++){const z=p.getX(i),y=p.getY(i),x=p.getZ(i)-(width-.10)/2;p.setXYZ(i,x,y,z);}body.computeVertexNormals();const shell=new THREE.Mesh(body,paint);shell.castShadow=shell.receiveShadow=true;g.add(shell);
 const front=-length*.26,rear=truck?length*.05:length*.20,roofFront=-length*.12,roofRear=truck?-length*.015:length*.09,low=width*.425,high=width*.345;
 quad([[-low,.925,front],[low,.925,front],[high,1.47,roofFront],[-high,1.47,roofFront]],paint);
 quad([[low,.925,rear],[-low,.925,rear],[-high,1.47,roofRear],[high,1.47,roofRear]],paint);
 box(high*2,.055,roofRear-roofFront+.08,paint,0,1.452,(roofFront+roofRear)/2,.025);
 // Inset sloping glass leaves visible A/B/C pillars around each window.
 quad([[-low*.91,.975,front+.015],[low*.91,.975,front+.015],[high*.92,1.412,roofFront-.007],[-high*.92,1.412,roofFront-.007]],glass);
 quad([[low*.89,.974,rear-.012],[-low*.89,.974,rear-.012],[-high*.91,1.411,roofRear+.008],[high*.91,1.411,roofRear+.008]],glass);
 for(const side of [-1,1]){
  const sideQuad=(points:number[][],m:THREE.Material)=>quad(side>0?points:points.slice().reverse(),m);
  sideQuad([[side*low,.925,front],[side*high,1.47,roofFront],[side*high,1.47,roofRear],[side*low,.925,rear]],paint);
  sideQuad([[side*(low+.005),.975,front+.10],[side*(high+.005),1.405,roofFront+.07],[side*(high+.005),1.405,roofRear-.07],[side*(low+.005),.975,rear-.10]],glass);
  const middle=(front+rear)/2;
  if(!truck){const pillar=quad([[side*(low+.013),.952,middle-.035],[side*(high+.013),1.43,middle-.035],[side*(high+.013),1.43,middle+.035],[side*(low+.013),.952,middle+.035]],trim);pillar.material.side=THREE.DoubleSide;}
  for(const z of truck?[middle]:[front*.4,rear*.65]){box(.018,.035,.16,chrome,side*(width/2-.017),.83,z);box(.008,.32,.009,trim,side*(width/2-.021),.63,z+.16,.002);}
  box(.045,.052,length*.80,trim,side*(width/2-.018),.52,0,.012);
  box(.14,.115,.22,paint,side*(low+.065),1.02,front+.12,.035);box(.012,.08,.15,chrome,side*(low+.14),1.02,front+.13);
  for(const z of [-length*.32,length*.32]){
   const wheel=new THREE.Group();wheel.position.set(side*(width/2-.075),.35,z);wheel.rotation.y=Math.PI/2;g.add(wheel);
   const rubber=new THREE.Mesh(new THREE.TorusGeometry(.265,.082,12,36),tire);rubber.scale.z=1.25;wheel.add(rubber);
   const rim=new THREE.Mesh(new THREE.TorusGeometry(.193,.025,8,32),chrome);rim.position.z=side*.075;wheel.add(rim);
   const brake=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.035,24),trim);brake.rotation.x=Math.PI/2;wheel.add(brake);
   for(let j=0;j<8;j++){const a=j*Math.PI/4,spoke=new THREE.Mesh(new THREE.BoxGeometry(.027,.17,.018),chrome);spoke.position.set(Math.sin(a)*.10,Math.cos(a)*.10,side*.083);spoke.rotation.z=-a;wheel.add(spoke);}
   const hub=new THREE.Mesh(new THREE.CylinderGeometry(.062,.062,.17,16),chrome);hub.rotation.x=Math.PI/2;wheel.add(hub);
  }
  // Fine accumulated dust and small chips along the rocker panels.
  for(let j=0;j<18;j++){const z=-length*.23+j*length*.46/18;box(.004,.008+(j%4)*.006,.04+(j%3)*.022,dirt,side*(width/2-.021),.38+(j%5)*.017,z,.001);}
 }
 for(const z of [-length/2+.025,length/2-.025])box(width-.12,.13,.12,chrome,0,.42,z,.035);
 box(width*.42,.20,.035,trim,0,.65,-length/2+.002);for(let j=0;j<5;j++)box(width*.39,.012,.015,chrome,0,.57+j*.035,-length/2-.018,.003);
 for(const side of [-1,1]){box(width*.23,.17,.055,lamps,side*width*.32,.70,-length/2+.02,.025);box(width*.20,.14,.045,red,side*width*.34,.69,length/2-.022,.025);}
 for(const z of [-length/2-.043,length/2+.043]){box(.38,.105,.012,lamps,0,.43,z,.008);for(let j=0;j<7;j++)box(.012,.048,.004,trim,-.13+j*.04,.43,z+Math.sign(z)*.009,.001);}
 // Bonnet seam, wipers and understated panel edges.
 box(width*.72,.008,.012,trim,0,.928,front-.015,.001);
 for(const side of [-1,1]){const wiper=box(.33,.012,.016,trim,side*.27,.985,front+.02,.003);wiper.rotation.z=side*.08;}
 if(truck){box(width*.88,.14,length*.43,trim,0,.96,length*.26);for(const side of [-1,1])box(.095,.43,length*.44,paint,side*width*.435,1.20,length*.25);box(width*.90,.43,.08,paint,0,1.20,length*.47);}
 return g;
}
