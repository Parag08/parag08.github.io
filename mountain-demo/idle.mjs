const smooth=(value,start,end)=> {
  const t=Math.max(0,Math.min(1,(value-start)/(end-start)));
  return t*t*(3-2*t);
};
const glance=(time,start,hold,end)=>smooth(time,start,start+2)*(1-smooth(time,hold,end));

// A relaxed, repeating summit pause. IK keeps the feet and pole grips anchored
// while the chest rises, the body settles, and the hiker occasionally looks out.
export function summitIdlePose(seconds,{reducedMotion=false}={}) {
  if(reducedMotion) return {chestPitch:0,chestLift:0,lookYaw:0,lookPitch:0,weightShift:0,lean:0};
  const time=Math.max(0,Number.isFinite(seconds)?seconds:0);
  const breath=Math.sin(time*Math.PI*2/4.8);
  const settle=Math.sin(time*Math.PI*2/12);
  const phase=time%22;
  const left=glance(phase,2,6,9),right=glance(phase,12,16,19);
  return {
    chestPitch:breath*.014,
    chestLift:breath*.005,
    lookYaw:left*.22-right*.15,
    lookPitch:-left*.025+right*.012,
    weightShift:settle*.012,
    lean:settle*.008
  };
}
