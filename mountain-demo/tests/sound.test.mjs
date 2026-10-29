import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootstepTracker,createMountainSound} from '../sound.mjs';

class Events {
  constructor() { this.listeners=new Map(); this.attrs={}; this.hidden=false; }
  addEventListener(name,fn) { this.listeners.set(name,fn); }
  removeEventListener(name) { this.listeners.delete(name); }
  async emit(name) { await this.listeners.get(name)?.(); }
  setAttribute(name,value) { this.attrs[name]=value; }
}
const parameter=()=>({value:0,setTargetAtTime(){},setValueAtTime(){},cancelScheduledValues(){},exponentialRampToValueAtTime(){}});
function setup({resumeFails=false}={}) {
  const contexts=[];
  class AudioContext {
    constructor() { this.sampleRate=8000; this.currentTime=0; this.state='suspended'; this.sources=[]; contexts.push(this); }
    node() { return {gain:parameter(),frequency:parameter(),Q:parameter(),playbackRate:parameter(),connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;}}; }
    createGain() { return this.node(); }
    createBiquadFilter() { return this.node(); }
    createOscillator() { return this.node(); }
    createBufferSource() { const source=this.node(); this.sources.push(source); return source; }
    createBuffer(channels,length) { return {getChannelData:()=>new Float32Array(length)}; }
    async resume() { if(resumeFails) throw new Error('Audio blocked'); this.state='running'; }
    async suspend() { this.state='suspended'; }
    async close() { this.state='closed'; }
  }
  const button=new Events(),document=new Events(),lifecycle=new Events();
  button.hidden=true;
  const sound=createMountainSound(button,{AudioContext,document,lifecycle});
  return {button,document,lifecycle,sound,contexts};
}

test('footfalls follow walking distance at 30/60/120 FPS, including uphill travel',()=> {
  for(const fps of [30,60,120]) {
    const tracker=createFootstepTracker();
    let down=0,up=0;
    for(let i=0;i<=fps*3;i++) down+=Number(tracker.update(i/fps,true));
    tracker.reset();
    for(let i=fps*3;i>=0;i--) up+=Number(tracker.update(i/fps,true));
    assert.equal(down,10); assert.equal(up,10);
  }
});

test('standing still, restored links, and reduced-motion jumps are silent',()=> {
  const tracker=createFootstepTracker();
  assert.equal(tracker.update(0,true),false);
  assert.equal(tracker.update(15,true),false);
  assert.equal(tracker.update(15,true),false);
  assert.equal(tracker.update(15.02,false),false);
  assert.equal(tracker.update(15.3,false),false);
});

test('audio stays unloaded and silent until enabled; the same icon mutes it',async()=> {
  const {button,sound,contexts}=setup();
  assert.equal(contexts.length,0);
  assert.equal(button.hidden,false);
  assert.equal(button.attrs['aria-pressed'],'false');
  await button.emit('click');
  const context=contexts[0];
  assert.equal(context.state,'running');
  assert.equal(button.attrs['aria-pressed'],'true');
  assert.equal(button.attrs['aria-label'],'Mute mountain sounds');
  const climate={snow:1,green:0};
  sound.update(.29,climate,true); sound.update(.31,climate,true);
  assert.equal(context.sources.filter(source=>!source.loop).length,1);
  sound.update(.31,climate,false);
  assert.equal(context.sources.filter(source=>!source.loop).length,1);
  await button.emit('click');
  assert.equal(context.state,'suspended');
  assert.equal(button.attrs['aria-pressed'],'false');
  assert.equal(button.attrs['aria-label'],'Enable mountain sounds');
  assert.ok(context.sources.filter(source=>!source.loop).every(source=>source.stopped));
  sound.destroy();
});

test('hidden tabs and page navigation suspend sound and retain the chosen toggle',async()=> {
  const {button,document,lifecycle,sound,contexts}=setup();
  await button.emit('click');
  document.hidden=true; await document.emit('visibilitychange');
  assert.equal(contexts[0].state,'suspended');
  assert.equal(button.attrs['aria-pressed'],'true');
  document.hidden=false; await document.emit('visibilitychange');
  assert.equal(contexts[0].state,'running');
  await lifecycle.emit('pagehide');
  assert.equal(contexts[0].state,'suspended');
  await lifecycle.emit('pageshow');
  assert.equal(contexts[0].state,'running');
  sound.setPaused(true); assert.equal(contexts[0].state,'suspended');
  sound.setPaused(false); assert.equal(contexts[0].state,'running');
  sound.destroy(); assert.equal(contexts[0].state,'closed');
});

test('a rapid on/off gesture cannot leave audio enabled',async()=> {
  const {button,sound,contexts}=setup();
  const enabling=button.emit('click');
  await button.emit('click'); await enabling;
  assert.equal(button.attrs['aria-pressed'],'false');
  assert.equal(contexts[0].state,'suspended');
  sound.destroy();
});

test('audio permission failures restore the muted button without affecting the scene',async()=> {
  const {button,sound,contexts}=setup({resumeFails:true});
  const warn=console.warn;
  try { console.warn=()=>{}; await button.emit('click'); }
  finally { console.warn=warn; }
  assert.equal(button.attrs['aria-pressed'],'false');
  assert.equal(contexts[0].state,'suspended');
  sound.destroy();
});
