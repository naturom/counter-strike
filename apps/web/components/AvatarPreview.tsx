'use client';
import {useEffect,useRef} from 'react';
import * as THREE from 'three';
import {Sky} from 'three/examples/jsm/objects/Sky.js';
import {AVATARS,type AvatarId} from '@sirocco/shared';
import {WorldArt,disposeGroup} from './world';
import {onCharacterTextureReady} from './character-anatomy';
import {equipAvatarModel} from './avatar-equipment';
import {buildAvatar} from './avatar-models';
// Match the arena's sunlight and sky reflections so the armour keeps its in-game appearance.
function previewEnvironment(renderer:THREE.WebGLRenderer){
 const sky=new Sky(),u=sky.material.uniforms;sky.scale.setScalar(350);u.turbidity.value=5;u.rayleigh.value=1.4;u.mieCoefficient.value=.005;u.mieDirectionalG.value=.8;u.sunPosition.value.set(-35,42,28);
 const scene=new THREE.Scene();scene.add(sky);const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(scene,.04);pmrem.dispose();disposeGroup(scene);return environment;
}
function lightPreview(scene:THREE.Scene,environment:THREE.Texture){
 scene.environment=environment;scene.environmentIntensity=.12;scene.add(new THREE.HemisphereLight('#d4e3ed','#96846b',.85));const sun=new THREE.DirectionalLight('#fff0d8',3.1);sun.position.set(-60,95,45);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-2,right:2,top:2,bottom:-2,near:1,far:150});sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;sun.shadow.camera.updateProjectionMatrix();scene.add(sun);
}
export function AvatarPreview({avatar}:{avatar:AvatarId}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=ref.current!;let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});}catch{return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  const art=new WorldArt(renderer),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(33,1,.04,20);camera.position.set(0,1.12,-3.5);camera.lookAt(0,.94,0);
  const environment=previewEnvironment(renderer);lightPreview(scene,environment.texture);
  const model=buildAvatar(art,avatar);equipAvatarModel(art,model,'rifle',avatar);model.rotation.y=-.18;scene.add(model);const base=new THREE.Mesh(new THREE.CylinderGeometry(.55,.58,.05,64),art.material('#24382e',{metalness:.35,roughness:.65}));base.position.y=-.045;base.receiveShadow=true;scene.add(base);
  let frame=0,last=0,drag=false,turned=false,x=0;const down=(e:PointerEvent)=>{drag=true;turned=true;x=e.clientX;canvas.setPointerCapture(e.pointerId);},move=(e:PointerEvent)=>{if(drag){model.rotation.y-=(e.clientX-x)*.012;x=e.clientX;}},up=()=>drag=false;
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
  const resize=()=>{const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  const draw=(now:number)=>{const dt=Math.min(.05,(now-last)/1000);last=now;if(!drag&&!turned&&!matchMedia('(prefers-reduced-motion: reduce)').matches)model.rotation.y=-.18+Math.sin(now*.00016)*.22;renderer.render(scene,camera);frame=requestAnimationFrame(draw);};frame=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);disposeGroup(scene);art.destroy();environment.dispose();renderer.dispose();};
 },[avatar]);
 return <canvas ref={ref} className="avatar-preview-canvas" aria-label={`${AVATARS.find(a=>a.id===avatar)?.name??'Operator'} 3D appearance preview. Drag to rotate.`}/>;
}
export function AvatarPicker({value,onChange,disabled}:{value:AvatarId;onChange:(id:AvatarId)=>void;disabled:boolean}){
 const host=useRef<HTMLFieldSetElement>(null),canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({canvas:canvas.current!,alpha:true,antialias:true});}catch{return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.setScissorTest(true);
  const art=new WorldArt(renderer),camera=new THREE.PerspectiveCamera(29,1,.05,20);camera.position.set(0,1.12,-3.5);camera.lookAt(0,.94,0);
  const environment=previewEnvironment(renderer);const scenes=AVATARS.map(a=>{const scene=new THREE.Scene();lightPreview(scene,environment.texture);const model=buildAvatar(art,a.id);equipAvatarModel(art,model,'rifle',a.id);model.rotation.y=-.18;scene.add(model);return scene;});
  const draw=()=>{const r=host.current!.getBoundingClientRect(),c=canvas.current!;renderer.setSize(r.width,r.height,false);renderer.setScissor(0,0,r.width,r.height);renderer.setViewport(0,0,r.width,r.height);renderer.clear();renderer.autoClear=false;host.current!.querySelectorAll<HTMLElement>('.avatar-thumb').forEach((el,i)=>{const b=el.getBoundingClientRect(),x=b.left-r.left,y=r.height-(b.bottom-r.top);renderer.setViewport(x,y,b.width,b.height);renderer.setScissor(x,y,b.width,b.height);camera.aspect=b.width/b.height;camera.updateProjectionMatrix();renderer.clearDepth();renderer.render(scenes[i],camera);});renderer.autoClear=true;};
  const observer=new ResizeObserver(draw),unsubscribe=onCharacterTextureReady(draw);observer.observe(host.current!);draw();return()=>{unsubscribe();observer.disconnect();scenes.forEach(disposeGroup);art.destroy();environment.dispose();renderer.dispose();};
 },[]);
 return <fieldset ref={host} className="avatar-picker" disabled={disabled}><legend>CHOOSE YOUR APPEARANCE</legend><canvas ref={canvas} aria-hidden="true"/>{AVATARS.map(a=><button type="button" key={a.id} aria-pressed={value===a.id} aria-label={a.name} onClick={()=>onChange(a.id)} style={{'--avatar-color':a.color} as React.CSSProperties}><span className="avatar-thumb"/><span className="avatar-choice-name">{a.name}</span>{value===a.id&&<span className="avatar-selected" aria-hidden="true">✓</span>}</button>)}</fieldset>;
}
