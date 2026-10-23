"""Prepare recorded knife Foley. Sources and licenses: public/audio/CREDITS.txt.
Requires ffmpeg; preserves recording speed/pitch and adds short click-free edges.
"""
import argparse,array,pathlib,subprocess,wave
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--swishes',type=pathlib.Path,required=True)
parser.add_argument('--thwacks',type=pathlib.Path,required=True,help='PCM directory from Thwack Sounds')
parser.add_argument('--rpg',type=pathlib.Path,required=True,help='Audio directory from Kenney RPG Audio')
parser.add_argument('--output',type=pathlib.Path,default=pathlib.Path(__file__).resolve().parents[1]/'apps/web/public/audio/knife')
args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True);rate=22050
sources=[*(('swing',i,args.swishes/f'swosh-{i+1:02}.flac') for i in range(4)),('hit',0,args.thwacks/'thwack-02.wav'),('hit',1,args.thwacks/'thwack-03.wav'),('wall',0,args.rpg/'metalClick.ogg'),('wall',1,args.rpg/'metalLatch.ogg')]
for kind,variant,source in sources:
 raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(source),'-ac','1','-ar',str(rate),'-f','f32le','-'])
 samples=array.array('f',raw);peak=max(abs(v) for v in samples);threshold=peak*.012
 audible=[i for i,v in enumerate(samples) if abs(v)>threshold]
 start=max(0,audible[0]-round(rate*.003));end=min(len(samples),audible[-1]+round(rate*.015),start+round(rate*.42));samples=samples[start:end]
 gain=.82/max(abs(v) for v in samples);edge=round(rate*.002)
 pcm=array.array('h',(round(v*gain*min(1,i/edge,(len(samples)-1-i)/edge)*32767) for i,v in enumerate(samples)))
 with wave.open(str(args.output/f'{kind}-{variant}.wav'),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(pcm.tobytes())
