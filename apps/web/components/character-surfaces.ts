import * as THREE from 'three';
import type {WorldArt} from './world';
import type {CharacterStyle} from './character-style';
export function characterSurface(art:WorldArt,style:CharacterStyle){
 const size=256,c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d')!,image=ctx.createImageData(size,size),roughImage=ctx.createImageData(size,size),normalImage=ctx.createImageData(size,size),height=new Float32Array(size*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*size+x,n=((x*374761393+y*668265263)^(x*y*127))>>>0,noise=(n%1000)/1000;let h=.5,shade=.8,r=.7;
  if(style.surface==='weave'){h=.36+(((x%6<3)===(y%6<3))?.22:0)+noise*.12;shade=.72+h*.20;r=.78+noise*.12;}
  else if(style.surface==='leather'){h=.34+noise*.35+Math.sin(x*.43+y*.71)*.04;shade=.75+noise*.12;r=.58+noise*.20;}
  else if(style.surface==='bark'){h=.45+Math.sin(x*.34+Math.sin(y*.055)*2)*.25+noise*.12;shade=.50+h*.48;r=.83+noise*.13;}
  else {h=.48+noise*.035+(y%83===0&&x%31<10?-.15:0);shade=.84+noise*.05;r=.32+noise*.11;}
  height[i]=h;for(let k=0;k<3;k++){image.data[i*4+k]=Math.round(shade*255);roughImage.data[i*4+k]=Math.round(r*255);}image.data[i*4+3]=roughImage.data[i*4+3]=255;
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*size+x,dx=height[y*size+(x+1)%size]-height[y*size+(x+size-1)%size],dy=height[((y+1)%size)*size+x]-height[((y+size-1)%size)*size+x],strength=style.surface==='bark'?2.2:style.surface==='armor'?.25:.8,n=new THREE.Vector3(-dx*strength,-dy*strength,1).normalize();normalImage.data.set([Math.round((n.x*.5+.5)*255),Math.round((n.y*.5+.5)*255),Math.round((n.z*.5+.5)*255),255],i*4);}
 const make=(data:ImageData,color=false)=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=size;canvas.getContext('2d')!.putImageData(data,0,0);const t=new THREE.CanvasTexture(canvas);if(color)t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(style.surface==='bark'?3:8,style.surface==='bark'?1:8);art.textures.push(t);return t;};
 return {map:make(image,true),normalMap:make(normalImage),roughnessMap:make(roughImage),normalScale:new THREE.Vector2(style.surface==='armor'?.20:.55,style.surface==='armor'?.20:.55)};
}
