// Contact points match the alternating .60 m strides in descent.js.
export function createFootstepTracker() {
  let previous=null;
  return {
    reset() { previous=null; },
    update(distance,walking) {
      const last=previous;
      previous=Number.isFinite(distance)?distance:null;
      if(last===null||previous===null||!walking) return false;
      const delta=distance-last;
      // Restored links and reduced-motion jumps should never replay skipped steps.
      if(Math.abs(delta)<.000001||Math.abs(delta)>.18) return false;
      const offset=delta>0?0:.048;
      return Math.floor((distance-offset+.0000001)/.3)!==Math.floor((last-offset+.0000001)/.3);
    }
  };
}

// Local Web Audio textures: wind, a heel impact, and irregular surface crunch.
// Everything is created only after the visitor enables sound.
export function createMountainSound(button,{
  AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext,
  document=globalThis.document,
  lifecycle=globalThis.window
}={}) {
  const tracker=createFootstepTracker();
  const steps=new Set();
  let context=null,master=null,windGain=null,windFilter=null,stepBuffer=null;
  let enabled=false,paused=false,away=false,version=0;
  let latestClimate={snow:1,green:0},lastSnow=-1;
  const available=Boolean(button&&AudioContext);
  function updateButton() {
    if(!button) return;
    const label=enabled?'Mute mountain sounds':'Enable mountain sounds';
    button.setAttribute('aria-pressed',String(enabled));
    button.setAttribute('aria-label',label);
    button.title=label;
  }
  function noiseBuffer(seconds,wind=false) {
    const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*seconds),context.sampleRate);
    const data=buffer.getChannelData(0);
    let low=0,mid=0;
    for(let i=0;i<data.length;i++) {
      const white=Math.random()*2-1;
      low+=(white-low)*.015; mid+=(white-mid)*.1;
      const sample=wind?white*.07+mid*.7+low*2:white;
      const fade=Math.min(1,i/(context.sampleRate*.012),(data.length-1-i)/(context.sampleRate*.012));
      data[i]=sample*fade;
    }
    return buffer;
  }
  function initialize() {
    context=new AudioContext();
    master=context.createGain(); master.gain.value=0; master.connect(context.destination);
    stepBuffer=noiseBuffer(.34);
    const wind=context.createBufferSource(); wind.buffer=noiseBuffer(9,true); wind.loop=true;
    const highpass=context.createBiquadFilter(); highpass.type='highpass'; highpass.frequency.value=85;
    windFilter=context.createBiquadFilter(); windFilter.type='lowpass'; windFilter.frequency.value=650+latestClimate.snow*350; windFilter.Q.value=.4;
    windGain=context.createGain(); windGain.gain.value=.085+latestClimate.snow*.035;
    lastSnow=latestClimate.snow;
    wind.connect(highpass); highpass.connect(windFilter); windFilter.connect(windGain); windGain.connect(master);
    // Slow native audio modulation adds gentle gusts without a JavaScript loop.
    const gust=context.createOscillator(),gustDepth=context.createGain();
    gust.type='sine'; gust.frequency.value=.085; gustDepth.gain.value=.035;
    gust.connect(gustDepth); gustDepth.connect(windGain.gain);
    wind.start(); gust.start();
  }
  function stopSteps() {
    for(const source of steps) {
      try { source.stop(); } catch { /* already ended */ }
    }
    steps.clear();
    tracker.reset();
  }
  function sync() {
    if(!context) return;
    const active=enabled&&!paused&&!away&&!document?.hidden;
    if(active) {
      master.gain.setTargetAtTime(.55,context.currentTime,.08);
      context.resume().catch(()=> {});
    } else {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(0,context.currentTime);
      stopSteps();
      context.suspend().catch(()=> {});
    }
  }
  async function toggle() {
    const request=++version;
    enabled=!enabled; tracker.reset(); updateButton();
    if(!enabled) { sync(); return; }
    try {
      if(!context) initialize();
      // Called directly from the button gesture, satisfying autoplay restrictions.
      await context.resume();
      if(request!==version) { sync(); return; }
      sync();
    } catch(error) {
      if(request!==version) return;
      enabled=false; updateButton(); sync();
      button.title='Mountain sounds are unavailable in this browser';
      console.warn('Mountain sounds unavailable:',error);
    }
  }
  function footstep({snow=0,green=0}) {
    const now=context.currentTime;
    const source=context.createBufferSource(); source.buffer=stepBuffer;
    source.playbackRate.value=.91+Math.random()*.18;
    const crunch=context.createBiquadFilter(); crunch.type='lowpass';
    crunch.frequency.value=2100-snow*1100-green*650; crunch.Q.value=.55;
    const crunchGain=context.createGain();
    const weight=.85+Math.random()*.3;
    crunchGain.gain.setValueAtTime(.0001,now);
    crunchGain.gain.exponentialRampToValueAtTime(.27*weight,now+.006);
    crunchGain.gain.exponentialRampToValueAtTime(.07*weight,now+.035);
    crunchGain.gain.exponentialRampToValueAtTime(.15*weight,now+.065);
    crunchGain.gain.exponentialRampToValueAtTime(.035*weight,now+.14+snow*.035);
    crunchGain.gain.exponentialRampToValueAtTime(.0001,now+.27);
    const heel=context.createBiquadFilter(); heel.type='lowpass'; heel.frequency.value=145; heel.Q.value=.8;
    const heelGain=context.createGain();
    heelGain.gain.setValueAtTime(.0001,now);
    heelGain.gain.exponentialRampToValueAtTime(.65*weight,now+.009);
    heelGain.gain.exponentialRampToValueAtTime(.0001,now+.095);
    source.connect(crunch); crunch.connect(crunchGain); crunchGain.connect(master);
    source.connect(heel); heel.connect(heelGain); heelGain.connect(master);
    steps.add(source);
    source.onended=()=> {
      steps.delete(source);
      for(const node of [source,crunch,crunchGain,heel,heelGain]) node.disconnect();
    };
    source.start(now); source.stop(now+.32);
  }
  function onVisibility() { sync(); }
  function onHide() { away=true; sync(); }
  function onShow() { away=false; sync(); }
  if(available) {
    button.hidden=false; updateButton();
    button.addEventListener('click',toggle);
    document?.addEventListener('visibilitychange',onVisibility);
    lifecycle?.addEventListener('pagehide',onHide);
    lifecycle?.addEventListener('pageshow',onShow);
  }
  return {
    update(distance,climate,walking) {
      latestClimate=climate;
      const active=enabled&&!paused&&!away&&!document?.hidden&&context?.state==='running';
      const contact=tracker.update(distance,active&&walking);
      if(!active) return;
      // The exposed summit is breezier; the green foothills are more sheltered.
      if(Math.abs(climate.snow-lastSnow)>.02) {
        windGain.gain.setTargetAtTime(.085+climate.snow*.035,context.currentTime,.35);
        windFilter.frequency.setTargetAtTime(650+climate.snow*350,context.currentTime,.35);
        lastSnow=climate.snow;
      }
      if(contact) footstep(climate);
    },
    setPaused(value) { paused=value; sync(); },
    destroy() {
      enabled=false; version++; sync();
      button?.removeEventListener('click',toggle);
      document?.removeEventListener('visibilitychange',onVisibility);
      lifecycle?.removeEventListener('pagehide',onHide);
      lifecycle?.removeEventListener('pageshow',onShow);
      context?.close().catch(()=> {});
    }
  };
}
