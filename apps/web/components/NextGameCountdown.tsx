export function NextGameCountdown({nextRoundAt,time}:{nextRoundAt:number;time:number}){
 const seconds=Math.max(1,Math.ceil((nextRoundAt-time)/1000));
 return <div className="next-game-countdown" role="status" aria-live="polite">Next game starts in <strong>{seconds}s</strong></div>;
}
