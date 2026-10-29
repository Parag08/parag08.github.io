import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderLoop} from '../render-loop.mjs';
import {createMotionState,advanceMotion} from '../motion.mjs';

function clock() {
  const queue=new Map(); let next=0,time=0,visible=true;
  return {
    queue,
    options:{requestFrame:callback=> { const id=next++; queue.set(id,callback); return id; },cancelFrame:id=>queue.delete(id),isVisible:()=>visible},
    setVisible(value) { visible=value; },
    tick(milliseconds=1000/60) {
      time+=milliseconds;
      const frame=[...queue.values()]; queue.clear();
      frame.forEach(callback=>callback(time));
    }
  };
}

test('a stationary scene draws once and schedules no idle rendering',()=> {
  const time=clock(); let draws=0;
  const loop=createRenderLoop(()=> { draws++; return false; },time.options);
  for(let i=0;i<100;i++) loop.request();
  assert.equal(time.queue.size,1,'scroll/resize requests share the same pending frame');
  time.tick(); assert.equal(draws,1); assert.equal(time.queue.size,0);
  for(let i=0;i<300;i++) time.tick();
  assert.equal(draws,1,'reading a section should not keep rendering the scene');
});

test('scroll-driven motion finishes accurately, sleeps, and wakes for another scroll',()=> {
  const time=clock(); let state=createMotionState(),target=.8,draws=0;
  const loop=createRenderLoop(seconds=> {
    draws++; state=advanceMotion(state,target,seconds,10);
    return state.position!==target||state.velocity!==0;
  },time.options);
  loop.request();
  for(let i=0;i<1200&&time.queue.size;i++) time.tick();
  assert.deepEqual(state,{position:.8,velocity:0});
  assert.equal(time.queue.size,0);
  const restingDraws=draws;
  time.tick(5000); assert.equal(draws,restingDraws);
  target=.1; loop.request(); time.tick();
  assert.ok(state.position<.8); assert.ok(time.queue.size>0);
});

test('hidden tabs and paused WebGL cancel frames without a large resume jump',()=> {
  const time=clock(),elapsed=[];
  const loop=createRenderLoop(seconds=> { elapsed.push(seconds); return true; },time.options);
  loop.request(); time.tick();
  loop.pause(); assert.equal(time.queue.size,0);
  time.tick(30000); loop.request(); assert.equal(time.queue.size,0);
  loop.resume(); time.setVisible(false); loop.request(); assert.equal(time.queue.size,0);
  time.setVisible(true); loop.request(); time.tick(30000);
  assert.equal(elapsed.at(-1),1/60);
  time.setVisible(false); time.tick();
  assert.equal(time.queue.size,0);
});

test('an update requested during a render is not lost when the current motion settles',()=> {
  const time=clock(); let draws=0,loop;
  loop=createRenderLoop(()=> { if(++draws===1) loop.request(); return false; },time.options);
  loop.request(); time.tick();
  assert.equal(time.queue.size,1);
  time.tick(); assert.equal(draws,2); assert.equal(time.queue.size,0);
});
