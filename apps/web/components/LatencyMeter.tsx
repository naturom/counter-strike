import {useEffect,useState} from 'react';
import type {Room} from '@colyseus/sdk';

export function LatencyMeter({room}:{room:Room|null}){
  const [latency,setLatency]=useState<number|null>(null);
  useEffect(()=>{
    setLatency(null);if(!room)return;
    let active=true,waiting=false,sentAt=0;
    const probe=()=>{
      if(!room.connection?.isOpen){setLatency(null);return;}
      // Keep one probe in flight. A stalled connection must not retain a green
      // reading or accumulate ping callbacks while the network is unavailable.
      if(waiting){if(performance.now()-sentAt>=5000)setLatency(null);return;}
      waiting=true;sentAt=performance.now();
      room.ping(ms=>{
        waiting=false;if(!active)return;
        setLatency(Number.isFinite(ms)&&ms>=0&&ms<5000?Math.round(ms):null);
      });
    };
    probe();const timer=setInterval(probe,2000);
    return()=>{active=false;clearInterval(timer);};
  },[room]);
  const quality=latency===null?'pending':latency<80?'good':latency<160?'fair':'poor';
  return <div className={`latency-meter ${quality}`} title="Round-trip latency to the game server" aria-label={latency===null?'Server latency unavailable':`Server latency ${latency} milliseconds`}>
    <i aria-hidden="true"/><span>PING</span><b>{latency===null?'—':latency}</b><span>ms</span>
  </div>;
}
