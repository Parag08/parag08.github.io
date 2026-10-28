import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotionState,advanceMotion} from '../motion.mjs';

test('a large scroll jump cannot skip multiple footsteps in one frame',()=>{
  let state=createMotionState(0),previous=state.position;
  for(let i=0;i<360;i++) {
    state=advanceMotion(state,1,1/60,10);
    assert.ok((state.position-previous)*10<=1.35/60+1e-10);
    assert.ok(state.position>=previous&&state.position<=1);
    previous=state.position;
  }
  assert.ok(state.position>.65);
});

test('a paused tab cannot fast-forward the whole journey on its next frame',()=>{
  const state=advanceMotion(createMotionState(.2),.9,20,10);
  assert.ok((state.position-.2)*10<.07);
});

test('negative frame times leave the motion unchanged',()=>{
  const state={position:.4,velocity:.03};
  assert.deepEqual(advanceMotion(state,.8,-1,10),state);
});

test('reversals brake smoothly instead of instantly flipping velocity',()=>{
  let state=createMotionState(.3);
  for(let i=0;i<40;i++) state=advanceMotion(state,.8,1/60,10);
  let previous=state.velocity;
  for(let i=0;i<150;i++) {
    state=advanceMotion(state,.1,1/60,10);
    assert.ok(Math.abs(state.velocity-previous)*10<=4.5/60+1e-9||state.position===.1);
    previous=state.velocity;
  }
  assert.ok(state.velocity<0&&state.position<.3);
});

test('motion settles exactly at an endpoint and reduced motion follows directly',()=>{
  let state=createMotionState(.85);
  for(let i=0;i<600;i++) state=advanceMotion(state,1,1/60,10);
  assert.deepEqual(state,{position:1,velocity:0});
  assert.deepEqual(advanceMotion(state,.3,1/60,10,{reducedMotion:true}),{position:.3,velocity:0});
});

test('walking pace stays consistent at different rendering frame rates',()=>{
  const distances=[30,60,120].map(fps=>{
    let state=createMotionState(.1);
    for(let i=0;i<fps*2;i++) state=advanceMotion(state,.8,1/fps,10);
    return state.position*10;
  });
  assert.ok(Math.max(...distances)-Math.min(...distances)<.05);
});
