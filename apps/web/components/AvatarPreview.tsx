'use client';
import {useEffect,useRef} from 'react';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {AVATARS,type AvatarId} from '@sirocco/shared';
import {WorldArt,disposeGroup} from './world';
import {buildAvatar} from './avatar-models';
export function AvatarPreview({avatar}:{avatar:AvatarId}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=ref.current!;let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});}catch{return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const art=new WorldArt(renderer),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(33,1,.04,20);camera.position.set(0,1.12,-3.5);camera.lookAt(0,.94,0);
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(new RoomEnvironment(),.04);scene.environment=environment.texture;scene.environmentIntensity=.55;pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#dfeaf3','#2a302b',1.3));const key=new THREE.DirectionalLight('#fff0d3',3.5);key.position.set(-2,3,-4);scene.add(key);const rim=new THREE.DirectionalLight('#81c9df',2);rim.position.set(2,3,2);scene.add(rim);
  const model=buildAvatar(art,avatar);model.rotation.y=-.18;scene.add(model);const base=new THREE.Mesh(new THREE.CylinderGeometry(.55,.58,.05,64),art.material('#24382e',{metalness:.35,roughness:.65}));base.position.y=-.045;scene.add(base);
  let frame=0,last=0,drag=false,x=0;const down=(e:PointerEvent)=>{drag=true;x=e.clientX;canvas.setPointerCapture(e.pointerId);},move=(e:PointerEvent)=>{if(drag){model.rotation.y-=(e.clientX-x)*.012;x=e.clientX;}},up=()=>drag=false;
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
  const resize=()=>{const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  const draw=(now:number)=>{const dt=Math.min(.05,(now-last)/1000);last=now;if(!drag&&!matchMedia('(prefers-reduced-motion: reduce)').matches)model.rotation.y+=dt*.13;renderer.render(scene,camera);frame=requestAnimationFrame(draw);};frame=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);disposeGroup(scene);art.destroy();environment.dispose();renderer.dispose();};
 },[avatar]);
 return <canvas ref={ref} className="avatar-preview-canvas" aria-label={`${AVATARS.find(a=>a.id===avatar)?.name??'Operator'} 3D appearance preview. Drag to rotate.`}/>;
}
export function AvatarPicker({value,onChange,disabled}:{value:AvatarId;onChange:(id:AvatarId)=>void;disabled:boolean}){
 const host=useRef<HTMLFieldSetElement>(null),canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({canvas:canvas.current!,alpha:true,antialias:true});}catch{return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.setScissorTest(true);
  const art=new WorldArt(renderer),camera=new THREE.PerspectiveCamera(29,1,.05,20);camera.position.set(0,1.54,-1.65);camera.lookAt(0,1.46,0);
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(new RoomEnvironment(),.04);pmrem.dispose();const scenes=AVATARS.map(a=>{const scene=new THREE.Scene();scene.environment=environment.texture;scene.environmentIntensity=.7;scene.add(new THREE.HemisphereLight('#e8f0f2','#344039',2));const key=new THREE.DirectionalLight('#ffedd3',3);key.position.set(-2,3,-4);scene.add(key);scene.add(buildAvatar(art,a.id));return scene;});
  const draw=()=>{const r=host.current!.getBoundingClientRect(),c=canvas.current!;renderer.setSize(r.width,r.height,false);renderer.setScissor(0,0,r.width,r.height);renderer.setViewport(0,0,r.width,r.height);renderer.clear();renderer.autoClear=false;host.current!.querySelectorAll<HTMLElement>('.avatar-thumb').forEach((el,i)=>{const b=el.getBoundingClientRect(),x=b.left-r.left,y=r.height-(b.bottom-r.top);renderer.setViewport(x,y,b.width,b.height);renderer.setScissor(x,y,b.width,b.height);camera.aspect=b.width/b.height;camera.updateProjectionMatrix();renderer.clearDepth();renderer.render(scenes[i],camera);});renderer.autoClear=true;};
  const observer=new ResizeObserver(draw);observer.observe(host.current!);draw();return()=>{observer.disconnect();scenes.forEach(disposeGroup);art.destroy();environment.dispose();renderer.dispose();};
 },[]);
 return <fieldset ref={host} className="avatar-picker" disabled={disabled}><legend>CHOOSE YOUR APPEARANCE</legend><canvas ref={canvas} aria-hidden="true"/>{AVATARS.map(a=><button type="button" key={a.id} aria-pressed={value===a.id} aria-label={a.name} onClick={()=>onChange(a.id)} style={{'--avatar-color':a.color} as React.CSSProperties}><span className="avatar-thumb"/><span className="avatar-choice-name">{a.name}</span>{value===a.id&&<span className="avatar-selected" aria-hidden="true">✓</span>}</button>)}</fieldset>;
}
