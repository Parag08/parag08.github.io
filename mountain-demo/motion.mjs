const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function createMotionState(position=0) {
  return {position:clamp(position,0,1),velocity:0};
}

// Speeds are in world metres, so the same limits hold for any page/route length.
export function advanceMotion(state,target,seconds,routeLength,{reducedMotion=false,maxSpeed=1.35,acceleration=4.5}={}) {
  target=clamp(target,0,1);
  if(reducedMotion) return {position:target,velocity:0};
  const dt=clamp(Number.isFinite(seconds)?seconds:0,0,.05);
  const length=Math.max(routeLength,.001);
  if(!dt) return {...state};
  const error=target-state.position;
  if(Math.abs(error)*length<.001&&Math.abs(state.velocity)*length<.015) return {position:target,velocity:0};
  const wanted=clamp(error*8,-maxSpeed/length,maxSpeed/length);
  let velocity=state.velocity+clamp(wanted-state.velocity,-acceleration/length*dt,acceleration/length*dt);
  let position=state.position+velocity*dt;
  if(error*velocity>=0&&error*(target-position)<=0) { position=target; velocity=0; }
  if(position<0||position>1) { position=clamp(position,0,1); velocity=0; }
  return {position,velocity};
}
