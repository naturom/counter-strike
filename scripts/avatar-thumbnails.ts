import * as THREE from 'three';
import {Sky} from 'three/examples/jsm/objects/Sky.js';
import {AVATARS} from '@sirocco/shared';
import {WorldArt,disposeGroup} from '../apps/web/components/world';
import {buildAvatar} from '../apps/web/components/avatar-models';
import {equipAvatarModel} from '../apps/web/components/avatar-equipment';
const status=document.querySelector('p')!;
document.querySelector('button')!.addEventListener('click',async()=>{
 status.textContent='Rendering current in-game characters…';
 const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas')!,alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(512,512,false);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 let loaded!:()=>void;const textures=new Promise<void>(r=>loaded=r);THREE.DefaultLoadingManager.onLoad=()=>loaded();
 const art=new WorldArt(renderer),sky=new Sky(),u=sky.material.uniforms;sky.scale.setScalar(350);u.turbidity.value=5;u.rayleigh.value=1.4;u.mieCoefficient.value=.005;u.mieDirectionalG.value=.8;u.sunPosition.value.set(-35,42,28);
 const envScene=new THREE.Scene();envScene.add(sky);const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(envScene,.04);pmrem.dispose();disposeGroup(envScene);
 const camera=new THREE.PerspectiveCamera(33,1,.04,20);camera.position.set(0,1.12,-3.5);camera.lookAt(0,.94,0);
 const scenes=AVATARS.map(a=>{const scene=new THREE.Scene();scene.environment=environment.texture;scene.environmentIntensity=.12;scene.add(new THREE.HemisphereLight('#d4e3ed','#96846b',.85));const sun=new THREE.DirectionalLight('#fff0d8',3.1);sun.position.set(-60,95,45);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-2,right:2,top:2,bottom:-2,near:1,far:150});sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;sun.shadow.camera.updateProjectionMatrix();scene.add(sun);const model=buildAvatar(art,a.id);equipAvatarModel(art,model,'rifle',a.id);model.rotation.y=-.18;scene.add(model);return scene;});
 await textures;
 for(let i=0;i<scenes.length;i++){renderer.render(scenes[i],camera);const blob=await new Promise<Blob>(r=>renderer.domElement.toBlob(b=>r(b!),'image/webp',.94));const response=await fetch('/thumbnail/'+AVATARS[i].id+'.webp',{method:'POST',headers:{'Content-Type':'image/webp'},body:blob});if(!response.ok)throw new Error('Thumbnail save failed');const img=document.createElement('img');img.src=URL.createObjectURL(blob);img.alt=AVATARS[i].name;document.querySelector('#results')!.append(img);}
 status.textContent='Saved three character thumbnails from the actual models.';scenes.forEach(disposeGroup);art.destroy();environment.dispose();renderer.dispose();
});
