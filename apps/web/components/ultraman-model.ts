import * as THREE from 'three';
import {addFittedShoulders} from './character-shoulders';
import type {WorldArt} from './world';
/** Classic 1966 suit: smooth silver mask, central crest, luminous eyes and blue timer. */
export function addClassicUltraman(root:THREE.Group,art:WorldArt,silver:THREE.Material,red:THREE.Material){
 const group=new THREE.Group();group.name='classicUltraman';root.add(group);addFittedShoulders(root,group,silver,'ultraman-shoulder-bridge');
 const dark=art.material('#3b4247',{metalness:.45,roughness:.4}),eyes=art.material('#fff5ce',{emissive:'#ffe7a6',emissiveIntensity:1.15,toneMapped:false}),blue=art.material('#6bdfff',{emissive:'#1687cf',emissiveIntensity:1.2,metalness:.25,roughness:.15});
 const oval=(name:string,at:number[],size:number[],material:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,40,28),material);mesh.name=name;mesh.position.fromArray(at);mesh.scale.fromArray(size);group.add(mesh);return mesh;};
 const mask=oval('ultraman-mask',[0,1.662,0],[.122,.179,.128],silver),vertices=mask.geometry.attributes.position;for(let i=0;i<vertices.count;i++)if(vertices.getY(i)<-.35){vertices.setX(i,vertices.getX(i)*.88);vertices.setZ(i,vertices.getZ(i)*.94);}mask.geometry.computeVertexNormals();
 // A narrow sculpted sagittal crest follows the forehead, crown and back of the mask.
 const shape=new THREE.Shape();shape.moveTo(-.126,1.61);shape.lineTo(-.145,1.75);shape.quadraticCurveTo(-.10,1.87,-.015,1.891);shape.lineTo(.015,1.891);shape.quadraticCurveTo(.11,1.83,.117,1.70);shape.lineTo(.105,1.61);shape.closePath();
 const crest=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.012,bevelEnabled:true,bevelSize:.003,bevelThickness:.002,bevelSegments:2}),silver);crest.name='ultraman-head-fin';crest.rotation.y=-Math.PI/2;crest.position.x=.006;group.add(crest);
 for(const side of [-1,1]){
  const socket=oval('ultraman-eye-socket',[side*.054,1.685,-.110],[.049,.032,.021],dark);socket.rotation.z=side*.38;socket.rotation.y=-side*.27;
  const eye=oval('ultraman-luminous-eye',[side*.054,1.686,-.124],[.044,.027,.013],eyes);eye.rotation.copy(socket.rotation);
  const ear=oval('ultraman-ear',[side*.119,1.663,.004],[.014,.052,.029],silver);ear.rotation.z=-side*.12;
 }
 const mouth=new THREE.Shape();mouth.moveTo(-.038,.005);mouth.quadraticCurveTo(0,.001,.038,.005);mouth.lineTo(.028,-.004);mouth.quadraticCurveTo(0,-.007,-.028,-.004);mouth.closePath();const lip=new THREE.Mesh(new THREE.ExtrudeGeometry(mouth,{depth:.005,bevelEnabled:true,bevelSize:.003,bevelThickness:.002,bevelSegments:2}),dark);lip.name='ultraman-mouth';lip.rotation.y=Math.PI;lip.position.set(0,1.568,-.117);group.add(lip);
 oval('ultraman-nose-ridge',[0,1.627,-.119],[.011,.046,.017],silver);
 oval('ultraman-lower-lip',[0,1.554,-.121],[.034,.006,.006],silver);
 const bezel=new THREE.Mesh(new THREE.TorusGeometry(.035,.007,10,40),silver);bezel.name='ultraman-timer-bezel';bezel.position.set(0,1.323,-.173);group.add(bezel);
 oval('ultraman-color-timer',[0,1.323,-.182],[.028,.030,.011],blue);
 const neck=art.cylinder(group,.067,.075,.075,red,0,1.48,0);neck.name='ultraman-red-collar';
}
