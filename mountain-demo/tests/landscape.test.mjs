import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createMountainLandscape,mountainsideDrop} from '../landscape.mjs';

const length=24;
const at=distance=>new THREE.Vector3(0,2-distance*.4,distance);
const direction=()=>new THREE.Vector3(0,0,1);
const landscape=()=>createMountainLandscape({routeLength:length,at,direction});

test('the mountain falls away from the trail without pushing terrain above the walking surface',()=> {
  const group=landscape();
  let previous=0;
  for(const across of [.43,.65,1,2,4,6.5]) {
    assert.ok(mountainsideDrop(across)>=previous); previous=mountainsideDrop(across);
    for(const distance of [0,4,12,24]) assert.ok(group.userData.surface(distance,across).y<at(distance).y);
  }
  const slope=group.userData.summitSlope;
  slope.geometry.computeBoundingBox();
  assert.ok(slope.geometry.boundingBox.min.z<0,'the slope supports the stance behind the route start');
  assert.ok(slope.geometry.getIndex(),'shared vertices smooth the continuous terrain');
  for(const mesh of group.children) {
    const positions=mesh.geometry.getAttribute('position');
    assert.ok([...positions.array].every(Number.isFinite));
  }
});

test('the forest starts below the snowy summit and leaves the walking lane clear',()=> {
  const group=landscape(),trunks=group.getObjectByName('Evergreen trunks');
  assert.ok(trunks.count>30&&trunks.count<120);
  const matrix=new THREE.Matrix4(),point=new THREE.Vector3();
  for(let i=0;i<trunks.count;i++) {
    trunks.getMatrixAt(i,matrix); point.setFromMatrixPosition(matrix);
    assert.ok(point.z/length>.35,'trees should not grow on the summit');
    assert.ok(point.x>=1,'trees should stay away from the hiker and poles');
  }
});

test('mobile reduces tree instances while keeping the same terrain and summit',()=> {
  const group=landscape(),trunks=group.getObjectByName('Evergreen trunks'),crowns=group.getObjectByName('Evergreen crowns');
  const total=trunks.count,slope=group.userData.summitSlope;
  group.userData.setCompact(true);
  assert.equal(trunks.count,Math.ceil(total/2)); assert.equal(crowns.count,trunks.count*3);
  assert.equal(group.userData.summitSlope,slope);
  group.userData.setCompact(false);
  assert.equal(trunks.count,total); assert.equal(crowns.count,total*3);
});
