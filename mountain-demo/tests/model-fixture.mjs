import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';

export function loadClimberJacket() {
  const buffer=readFileSync(new URL('../models/climber.glb',import.meta.url));
  const jsonLength=buffer.readUInt32LE(12);
  const json=JSON.parse(buffer.toString('utf8',20,20+jsonLength));
  const binaryOffset=28+jsonLength;
  const itemSizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
  function attribute(id) {
    const accessor=json.accessors[id],view=json.bufferViews[accessor.bufferView];
    const itemSize=itemSizes[accessor.type];
    const bytes=accessor.componentType===5126?4:accessor.componentType===5123?2:1;
    const ArrayType=bytes===4?Float32Array:bytes===2?Uint16Array:Uint8Array;
    const values=new ArrayType(accessor.count*itemSize);
    for(let i=0;i<accessor.count;i++) for(let k=0;k<itemSize;k++) {
      const offset=binaryOffset+(view.byteOffset||0)+(accessor.byteOffset||0)+i*(view.byteStride||bytes*itemSize)+k*bytes;
      values[i*itemSize+k]=bytes===4?buffer.readFloatLE(offset):bytes===2?buffer.readUInt16LE(offset):buffer.readUInt8(offset);
    }
    return new THREE.BufferAttribute(values,itemSize,Boolean(accessor.normalized));
  }
  const meshIndex=json.meshes.findIndex(mesh=>mesh.name==='Wolf3D_Outfit_Top');
  const primitive=json.meshes[meshIndex].primitives[0];
  const geometry=new THREE.BufferGeometry();
  for(const [input,output] of [['POSITION','position'],['NORMAL','normal'],['JOINTS_0','skinIndex'],['WEIGHTS_0','skinWeight']]) {
    geometry.setAttribute(output,attribute(primitive.attributes[input]));
  }
  geometry.setIndex(attribute(primitive.indices));
  const skin=json.skins[0];
  const boneNames=skin.joints.map(index=>json.nodes[index].name);
  function rig(sleeves) {
    let mesh;
    const nodes=json.nodes.map((data,i)=> {
      const node=data.mesh===meshIndex?(mesh=new THREE.SkinnedMesh(sleeves,new THREE.MeshStandardMaterial())):skin.joints.includes(i)?new THREE.Bone():new THREE.Object3D();
      node.name=data.name||'';
      if(data.translation) node.position.fromArray(data.translation);
      if(data.rotation) node.quaternion.fromArray(data.rotation);
      if(data.scale) node.scale.fromArray(data.scale);
      if(data.matrix) new THREE.Matrix4().fromArray(data.matrix).decompose(node.position,node.quaternion,node.scale);
      return node;
    });
    json.nodes.forEach((data,i)=> { for(const child of data.children||[]) nodes[i].add(nodes[child]); });
    const root=new THREE.Group();
    for(const index of json.scenes[json.scene||0].nodes) root.add(nodes[index]);
    root.updateMatrixWorld(true);
    const inverses=attribute(skin.inverseBindMatrices);
    const skeleton=new THREE.Skeleton(skin.joints.map(i=>nodes[i]),skin.joints.map((_,i)=>new THREE.Matrix4().fromArray(inverses.array,i*16)));
    mesh.bind(skeleton,new THREE.Matrix4());
    const bones=Object.fromEntries(skin.joints.map(i=>[nodes[i].name,nodes[i]]));
    return {root,mesh,bones,skeleton};
  }
  return {geometry,boneNames,rig};
}
