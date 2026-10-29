import * as THREE from './vendor/three.module.js';
import {trailClimate} from './trail.mjs';

// Nearby rocks share a draw call and material, with small batches preserving
// camera/shadow culling along the long route. Their positions and colors match
// the original individual rocks.
export function createTrailStones({routeLength,at,direction,heightAt}) {
  const group=new THREE.Group(); group.name='Trail stones';
  const geometry=new THREE.DodecahedronGeometry(1,0);
  const material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.92});
  const colors=['#949984','#a7a18a','#bcc6cb'].map(color=>new THREE.Color(color));
  const count=Math.min(180,Math.ceil(routeLength/.15));
  const transform=new THREE.Object3D(),lateral=new THREE.Vector3();
  for(let start=0;start<count;start+=24) {
    const size=Math.min(24,count-start);
    const batch=new THREE.InstancedMesh(geometry,material,size);
    for(let j=0;j<size;j++) {
      const i=start+j,distance=(i+.5)/count*routeLength;
      const point=at(distance),forward=direction(distance);
      lateral.set(forward.z,0,-forward.x);
      point.addScaledVector(lateral,(i%2?1:-1)*(.29+.045*Math.sin(i*2.3)));
      point.y=heightAt(point.x,point.z)+.025;
      const radius=.025+(i%4)*.014;
      transform.position.copy(point);
      transform.scale.set(radius*1.5,radius*.8,radius);
      transform.rotation.set(i*.7,i*.43,i*.11); transform.updateMatrix();
      batch.setMatrixAt(j,transform.matrix);
      batch.setColorAt(j,colors[trailClimate(distance/routeLength).snow>.6?2:i%2]);
    }
    batch.instanceMatrix.needsUpdate=true;
    batch.instanceColor.needsUpdate=true;
    batch.computeBoundingBox(); batch.computeBoundingSphere();
    batch.castShadow=true;
    group.add(batch);
  }
  return group;
}
