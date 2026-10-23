import subprocess,pathlib,wave,array,math
import argparse
parser=argparse.ArgumentParser(description='Convert licensed source recordings into bundled game Foley; see public/audio/CREDITS.txt.')
parser.add_argument('--footsteps',type=pathlib.Path,required=True,help='Extracted footsteps pack directory containing boots/, gravel/, metal/, wood/')
parser.add_argument('--pistol',type=pathlib.Path,required=True)
parser.add_argument('--rifle',type=pathlib.Path,required=True)
parser.add_argument('--output',type=pathlib.Path,default=pathlib.Path(__file__).resolve().parents[1]/'apps/web/public/audio')
args=parser.parse_args();root=args.output
(root/'footsteps').mkdir(parents=True,exist_ok=True);(root/'reloads').mkdir(parents=True,exist_ok=True)
for surface,source in [('stone','boots'),('grit','gravel'),('metal','metal'),('wood','wood')]:
 for i in range(4):
  subprocess.run(['ffmpeg','-v','error','-y','-i',str(args.footsteps/source/f'{i}.ogg'),'-ac','1','-ar','22050','-c:a','pcm_s16le',str(root/'footsteps'/f'{surface}-{i}.wav')],check=True)
# Consistent peak and short click-free edges retain each recorded impact.
for target in (root/'footsteps').glob('*.wav'):
 with wave.open(str(target),'rb') as f:rate=f.getframerate();samples=array.array('h',f.readframes(f.getnframes()))
 gain=.82*32767/max(1,max(abs(v) for v in samples));edge=round(rate*.002)
 samples=array.array('h',(round(v*gain*min(1,i/edge,(len(samples)-1-i)/edge)) for i,v in enumerate(samples)))
 with wave.open(str(target),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(samples.tobytes())
# Assemble unpitched mechanical takes. Only the gaps between movements change;
# the eject/seat/bolt transients retain their original recording speed.
rate=22050
sources={}
for key in ['pistol','rifle']:
 raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(getattr(args,key)),'-ac','1','-ar',str(rate),'-f','f32le','-'])
 sources[key]=array.array('f',raw)
for weapon,duration in [('pistol',1.2),('rifle',1.8),('smg',1.5),('marksman',2.4)]:
 out=[0.0]*round(duration*rate)
 if weapon in ['pistol','smg']:
  parts=[('pistol',.045,.33,.015),('pistol',.65,1.12,duration*.33),('pistol',1.24,1.54,duration-.315)]
 else:parts=[('rifle',.125,.39,.015),('rifle',1.015,1.22,duration*.56),('rifle',1.22,1.525,duration-.335)]
 for source,start,end,position in parts:
  clip=sources[source][round(start*rate):round(end*rate)];offset=round(position*rate)
  for j,value in enumerate(clip):
   if offset+j<len(out):out[offset+j]+=value*min(1,j/(rate*.002),(len(clip)-1-j)/(rate*.004))
 peak=max(abs(v) for v in out);gain=.82/max(peak,.01)
 samples=array.array('h',(round(max(-1,min(1,v*gain))*32767) for v in out))
 with wave.open(str(root/'reloads'/f'{weapon}.wav'),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(samples.tobytes())
