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

test('snow caps sit outside the foliage instead of sharing the same faces',()=> {
  const group=landscape();
  const crowns=group.getObjectByName('Evergreen crowns');
  const caps=group.getObjectByName('Snow on evergreen crowns');
  assert.ok(caps.count>0,'exercise the snowy trees in the transition below the summit');
  const geometry=crowns.geometry,position=geometry.getAttribute('position'),index=geometry.getIndex();
  const sides=geometry.groups.find(part=>part.materialIndex===0);
  const capMatrix=new THREE.Matrix4(),crownMatrix=new THREE.Matrix4(),inverse=new THREE.Matrix4();
  const capCenter=new THREE.Vector3(),crownCenter=new THREE.Vector3();
  for(let cap=0;cap<caps.count;cap++) {
    caps.getMatrixAt(cap,capMatrix); capCenter.setFromMatrixPosition(capMatrix);
    const capTip=new THREE.Vector3(0,.5,0).applyMatrix4(capMatrix);
    let nearest=Infinity,match=null;
    for(let crown=0;crown<crowns.count;crown++) {
      crowns.getMatrixAt(crown,crownMatrix); crownCenter.setFromMatrixPosition(crownMatrix);
      if(Math.hypot(capCenter.x-crownCenter.x,capCenter.z-crownCenter.z)>.00001) continue;
      const gap=capTip.distanceTo(new THREE.Vector3(0,.5,0).applyMatrix4(crownMatrix));
      if(gap<nearest) { nearest=gap; match=crownMatrix.clone(); }
    }
    assert.ok(match,'each snow cap must remain aligned with its tree tier');
    inverse.copy(match).invert();
    for(let triangle=sides.start;triangle<sides.start+sides.count;triangle+=3) {
      const vertices=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(position,index.getX(triangle+k)));
      const plane=new THREE.Plane().setFromCoplanarPoints(...vertices);
      if(plane.normal.lengthSq()<.5) continue; // cone-tip triangles can be degenerate
      const snowFace=vertices[0].clone().add(vertices[1]).add(vertices[2]).divideScalar(3)
        .applyMatrix4(capMatrix).applyMatrix4(inverse);
      assert.ok(plane.distanceToPoint(snowFace)>.0001,'coplanar snow and foliage cause striped z-fighting');
    }
  }
});
