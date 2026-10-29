// Request frames only while scene state changes. Reading a stationary section
// does not keep posing the avatar, uploading tree matrices, or rendering shadows.
export function createRenderLoop(step,{
  requestFrame=callback=>globalThis.requestAnimationFrame(callback),
  cancelFrame=id=>globalThis.cancelAnimationFrame(id),
  isVisible=()=>!globalThis.document?.hidden
}={}) {
  let pending=null,lastTime=null,enabled=true;
  function request() {
    if(enabled&&isVisible()&&pending===null) pending=requestFrame(tick);
  }
  function tick(time) {
    pending=null;
    if(!enabled||!isVisible()) { lastTime=null; return; }
    const seconds=lastTime===null?1/60:Math.max(0,Math.min(.05,(time-lastTime)/1000));
    lastTime=time;
    if(step(seconds)===true) request();
    if(pending===null) lastTime=null;
  }
  return {
    request,
    pause() {
      enabled=false;
      if(pending!==null) cancelFrame(pending);
      pending=null; lastTime=null;
    },
    resume() { enabled=true; lastTime=null; }
  };
}
