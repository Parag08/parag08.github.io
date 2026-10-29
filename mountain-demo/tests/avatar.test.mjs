import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createSleeveGeometry} from '../avatar.mjs';
import {loadClimberJacket} from './model-fixture.mjs';

test('the shipped avatar keeps its cuffs attached to the arm bones instead of the hips',()=> {
  const {geometry,boneNames}=loadClimberJacket();
  const sleeves=createSleeveGeometry(geometry,boneNames);
  const position=sleeves.getAttribute('position'),joints=sleeves.getAttribute('skinIndex'),weights=sleeves.getAttribute('skinWeight');
  const ids=[...new Set(sleeves.index.array)].filter(id=>position.getY(id)<1.045);
  assert.ok(ids.length>=20,'the test must exercise the actual low sleeve vertices');
  for(const id of ids) {
    assert.deepEqual(Array.from({length:3},(_,i)=>position.getComponent(id,i)),Array.from({length:3},(_,i)=>geometry.getAttribute('position').getComponent(id,i)));
    for(let k=0;k<4;k++) {
      assert.equal(joints.getComponent(id,k),geometry.getAttribute('skinIndex').getComponent(id,k));
      assert.equal(weights.getComponent(id,k),geometry.getAttribute('skinWeight').getComponent(id,k));
    }
  }
});

test('raising and swinging the arms does not pull long strips of jacket out of the sleeves',()=> {
  const {geometry,boneNames,rig}=loadClimberJacket();
  const sleeves=createSleeveGeometry(geometry,boneNames);
  const {root,mesh,bones,skeleton}=rig(sleeves);
  const rest=new Map(Object.values(bones).map(bone=>[bone,bone.quaternion.clone()]));
  for(const swing of [-.8,-.4,0,.4,.8]) {
    for(const [bone,q] of rest) bone.quaternion.copy(q);
    bones.LeftArm.rotation.x+=swing; bones.RightArm.rotation.x-=swing;
    bones.LeftForeArm.rotation.y+=.7; bones.RightForeArm.rotation.y-=.7;
    root.updateMatrixWorld(true); skeleton.update();
    const points=new Map();
    for(const id of new Set(sleeves.index.array)) {
      points.set(id,mesh.applyBoneTransform(id,new THREE.Vector3().fromBufferAttribute(sleeves.getAttribute('position'),id)).applyMatrix4(mesh.matrixWorld));
    }
    for(let i=0;i<sleeves.index.count;i+=3) {
      const p=[0,1,2].map(k=>points.get(sleeves.index.getX(i+k)));
      for(let k=0;k<3;k++) assert.ok(p[k].distanceTo(p[(k+1)%3])<.14,'a sleeve edge stretches into a visible line');
    }
  }
});
