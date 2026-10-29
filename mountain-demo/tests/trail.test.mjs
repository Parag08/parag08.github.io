import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createTrailPoints,trailClimate} from '../trail.mjs';

const routeFor=chapters=> {
  const route=new THREE.CatmullRomCurve3(createTrailPoints(chapters).map(p=>new THREE.Vector3(...p)),false,'centripetal');
  route.arcLengthDivisions=1200;
  return route;
};

test('the extended route grows with additional career sections',()=> {
  const current=routeFor(11).getLength();
  assert.ok(current>24&&current<30);
  assert.ok(routeFor(16).getLength()>current*1.35);
  assert.ok(routeFor(24).getLength()>current*2);
});

test('longer routes remain walkable, avoid doubling back, and finish level',()=> {
  for(const chapters of [11,16,24]) {
    const route=routeFor(chapters);
    let previous=route.getPointAt(0);
    for(let i=1;i<=2000;i++) {
      const next=route.getPointAt(i/2000);
      assert.ok(next.z>previous.z,'the narrow trail must not intersect itself');
      const grade=Math.abs(next.y-previous.y)/Math.hypot(next.x-previous.x,next.z-previous.z);
      assert.ok(grade<.65,'slopes must stay within the existing walking pose');
      previous=next;
    }
    assert.ok(Math.abs(route.getTangentAt(1).y)<.01,'arrival is flat');
  }
});

test('the summit is snowy and the foothills are green',()=> {
  assert.deepEqual(trailClimate(0),{snow:1,green:0});
  assert.ok(trailClimate(.2).snow>.8);
  assert.ok(trailClimate(.45).snow>0&&trailClimate(.45).green>0);
  assert.equal(trailClimate(.6).snow,0);
  assert.deepEqual(trailClimate(1),{snow:0,green:1});
});

test('snow thaws and vegetation increases smoothly along the entire trail',()=> {
  let previous=trailClimate(0);
  for(let i=1;i<=1000;i++) {
    const next=trailClimate(i/1000);
    assert.ok(next.snow<=previous.snow&&next.snow>=0);
    assert.ok(next.green>=previous.green&&next.green<=1);
    assert.ok(previous.snow-next.snow<.004);
    assert.ok(next.green-previous.green<.003);
    previous=next;
  }
});
