import test from 'node:test';
import assert from 'node:assert/strict';
import {summitIdlePose} from '../idle.mjs';

test('the idle sequence moves gently and stays continuous over repeated cycles',()=> {
  let previous=summitIdlePose(0),left=false,right=false,breathing=false,shifting=false;
  for(let frame=1;frame<=60*46;frame++) {
    const pose=summitIdlePose(frame/60);
    assert.ok(Math.abs(pose.lookYaw)<=.25);
    assert.ok(Math.abs(pose.chestLift)<=.006);
    assert.ok(Math.abs(pose.weightShift)<=.015);
    for(const key of Object.keys(pose)) {
      assert.ok(Number.isFinite(pose[key]));
      assert.ok(Math.abs(pose[key]-previous[key])<.006,`${key} jumps between frames`);
    }
    left ||= pose.lookYaw>.1; right ||= pose.lookYaw<-.1;
    breathing ||= Math.abs(pose.chestLift)>.003;
    shifting ||= Math.abs(pose.weightShift)>.008;
    previous=pose;
  }
  assert.ok(left&&right&&breathing&&shifting);
});

test('reduced motion leaves the summit idle pose still at every point in the sequence',()=> {
  for(const seconds of [0,2.7,6,14,22,98]) {
    const pose=summitIdlePose(seconds,{reducedMotion:true});
    assert.ok(Object.values(pose).every(value=>value===0));
  }
});
