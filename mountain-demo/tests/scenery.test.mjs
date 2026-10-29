import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createTrailStones} from '../scenery.mjs';

const stones=()=>createTrailStones({routeLength:24,at:d=>new THREE.Vector3(0,2-d*.4,d),direction:()=>new THREE.Vector3(0,0,1),heightAt:(x,z)=>2-z*.4});

test('all 160 trail rocks fit into seven small batches with one shared material and geometry',()=> {
  const group=stones();
  assert.equal(group.children.reduce((sum,mesh)=>sum+mesh.count,0),160);
  assert.equal(group.children.length,7);
  assert.equal(new Set(group.children.map(mesh=>mesh.geometry)).size,1);
  assert.equal(new Set(group.children.map(mesh=>mesh.material)).size,1);
  assert.ok(group.children.every(mesh=>mesh.isInstancedMesh&&mesh.count<=24&&mesh.castShadow));
});

test('batched rocks retain grounded positions, alternating trail edges and instance colors',()=> {
  const group=stones(),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
  let index=0;
  for(const batch of group.children) {
    assert.ok(Number.isFinite(batch.boundingSphere.radius));
    assert.equal(batch.instanceColor.count,batch.count);
    for(let i=0;i<batch.count;i++,index++) {
      batch.getMatrixAt(i,matrix); point.setFromMatrixPosition(matrix);
      assert.ok(Math.abs(point.y-(2-point.z*.4+.025))<.00001);
      assert.ok(Math.abs(point.x)>.24&&Math.abs(point.x)<.34,'the walking center remains clear');
      assert.equal(Math.sign(point.x),index%2?1:-1);
    }
  }
});
