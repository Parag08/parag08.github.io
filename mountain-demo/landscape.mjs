import * as THREE from './vendor/three.module.js';
import {trailClimate} from './trail.mjs';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const smooth=THREE.MathUtils.smoothstep;

// The outside flank drops away from the trail, leaving room for the vista.
export const mountainsideDrop=across=>Math.pow(Math.max(0,across-.65),1.45)*.39;

export function createMountainLandscape({routeLength,at,direction}) {
  const group=new THREE.Group(); group.name='Mountain landscape';
  const snow=new THREE.Color('#e5eef4');
  const meadow=new THREE.Color('#7e9663'),rock=new THREE.Color('#a1a294');
  function surface(distance,across) {
    const center=at(Math.max(0,distance)),forward=direction(Math.max(0,distance)),lateral=V(forward.z,0,-forward.x);
    // Extend behind the starting stance without a separate flat-topped platform.
    if(distance<0) center.addScaledVector(forward,distance);
    const point=center.clone().addScaledVector(lateral,across);
    const width=Math.abs(across);
    const roughness=smooth(width,.65,2.3)*(.06*Math.sin(distance*2.7+width*2)+.035*Math.cos(distance*1.3-width*3.8));
    point.y-=.035+mountainsideDrop(width)-roughness;
    return point;
  }

  // One continuous ridge shares the trail's elevation all the way downhill.
  // Shared vertices and interpolated normals give the snow a rounded surface.
  const positions=[],colors=[],indices=[];
  const across=[-1.05,-.82,-.6,-.4,-.2,0,.2,.43];
  for(let width=.7;width<6.5;width+=.25) across.push(width);
  across.push(6.5);
  const startDistance=-1.1;
  const rows=Math.ceil((routeLength-startDistance)/.14);
  const tint=new THREE.Color();
  for(let row=0;row<=rows;row++) {
    const distance=THREE.MathUtils.lerp(startDistance,routeLength,row/rows);
    const progress=THREE.MathUtils.clamp(distance/routeLength,0,1);
    const climate=trailClimate(progress);
    const summitWidth=THREE.MathUtils.lerp(.16,1,1-smooth(distance,.35,1.8));
    for(let column=0;column<across.length;column++) {
      const rawWidth=across[column];
      const width=rawWidth<0?rawWidth*summitWidth:rawWidth;
      const point=surface(distance,width);
      const variation=.95+.045*Math.sin(distance*3.1+width*2.7);
      tint.copy(rock).lerp(meadow,climate.green*.86).lerp(snow,climate.snow).multiplyScalar(variation);
      const edge=rawWidth<0?1-smooth(-rawWidth,.72,1.05):1-smooth(width,4.6,6.5);
      const end=smooth(distance,startDistance,startDistance+.28)*(1-smooth(progress,.965,1));
      positions.push(point.x,point.y,point.z);
      colors.push(tint.r,tint.g,tint.b,edge*end);
      if(row<rows&&column<across.length-1) {
        const a=row*across.length+column,b=a+across.length;
        indices.push(a,b,a+1,a+1,b,b+1);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const flank=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide,transparent:true,depthWrite:true}));
  flank.name='Snow to meadow mountainside'; flank.receiveShadow=true; group.add(flank);

  const summit=at(0),forward=direction(0),lateral=V(forward.z,0,-forward.x);
  // Small distant peaks sit below the summit and behind the hiker's line of sight.
  const peakGeometry=new THREE.ConeGeometry(1,1,7);
  const peakRock=new THREE.MeshStandardMaterial({color:'#a6b3bd',roughness:1,flatShading:true});
  const peakSnow=new THREE.MeshStandardMaterial({color:'#e4edf3',roughness:1,flatShading:true});
  for(let i=0;i<4;i++) {
    const height=2.5+(i%3)*.6;
    const center=summit.clone().addScaledVector(lateral,3.8+i*1.65).addScaledVector(forward,-3-i*.55);
    center.y=summit.y-2.7-height*.5;
    const peak=new THREE.Mesh(peakGeometry,peakRock);
    peak.position.copy(center); peak.scale.set(1.65,height,1.45); peak.rotation.y=i*.8; group.add(peak);
    const cap=new THREE.Mesh(peakGeometry,peakSnow);
    cap.position.copy(center).add(V(0,height*.33,0)); cap.scale.set(.56,height*.34,.49); cap.rotation.y=peak.rotation.y; group.add(cap);
  }

  // Instanced evergreen trunks and crowns keep the expanded view inexpensive.
  let seed=731;
  const random=()=> { seed=seed*16807%2147483647; return seed/2147483647; };
  const trees=[];
  const candidates=Math.ceil(routeLength/.16);
  for(let i=0;i<candidates;i++) {
    const progress=(i+.4)/candidates,climate=trailClimate(progress);
    if(climate.green<.06||random()>.3+climate.green*.6) continue;
    const distance=progress*routeLength,width=1+random()*3.45;
    trees.push({point:surface(distance,width),height:.48+random()*.65,turn:random()*Math.PI*2,snow:climate.snow,shade:random()});
  }
  // Each prefix covers the full descent, including when mobile uses fewer trees.
  const ordered=trees.filter((_,i)=>i%2===0).concat(trees.filter((_,i)=>i%2===1));
  const trunkGeometry=new THREE.CylinderGeometry(.018,.026,1,6);
  const crownGeometry=new THREE.ConeGeometry(1,1,7);
  const trunkMaterial=new THREE.MeshStandardMaterial({color:'#706b56',roughness:1,flatShading:true});
  const leafMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,flatShading:true});
  const trunks=new THREE.InstancedMesh(trunkGeometry,trunkMaterial,ordered.length);
  const crowns=new THREE.InstancedMesh(crownGeometry,leafMaterial,ordered.length*3);
  trunks.name='Evergreen trunks'; crowns.name='Evergreen crowns';
  const snowyCrowns=[];
  const transform=new THREE.Object3D(),leafColor=new THREE.Color();
  ordered.forEach((tree,i)=> {
    transform.rotation.set(0,tree.turn,0);
    transform.position.copy(tree.point).add(V(0,tree.height*.24,0));
    transform.scale.setScalar(1); transform.scale.y=tree.height*.48; transform.updateMatrix();
    trunks.setMatrixAt(i,transform.matrix);
    for(let tier=0;tier<3;tier++) {
      const height=tree.height*(.55-tier*.075),radius=tree.height*(.28-tier*.06);
      const y=tree.height*(.43+tier*.21);
      transform.position.copy(tree.point).add(V(0,y,0)); transform.scale.set(radius,height,radius); transform.updateMatrix();
      crowns.setMatrixAt(i*3+tier,transform.matrix);
      leafColor.set('#365d49').lerp(new THREE.Color('#658166'),tree.shade*.6+tier*.06);
      crowns.setColorAt(i*3+tier,leafColor);
      if(tree.snow>.055) snowyCrowns.push({treeIndex:i,point:tree.point.clone().add(V(0,y+height*.2,0)),radius:radius*.6,height:height*.6,turn:tree.turn});
    }
  });
  const snowCaps=new THREE.InstancedMesh(crownGeometry,peakSnow,snowyCrowns.length);
  snowCaps.name='Snow on evergreen crowns';
  snowyCrowns.forEach((cap,i)=> {
    transform.position.copy(cap.point); transform.rotation.set(0,cap.turn,0); transform.scale.set(cap.radius,cap.height,cap.radius); transform.updateMatrix();
    snowCaps.setMatrixAt(i,transform.matrix);
  });
  for(const mesh of [trunks,crowns,snowCaps]) {
    mesh.instanceMatrix.needsUpdate=true; mesh.receiveShadow=true; group.add(mesh);
  }
  if(crowns.instanceColor) crowns.instanceColor.needsUpdate=true;
  crowns.castShadow=true;
  const baseTrunks=trunks.instanceMatrix.array.slice();
  const baseCrowns=crowns.instanceMatrix.array.slice();
  const baseSnow=snowCaps.instanceMatrix.array.slice();
  const pivot=new THREE.Matrix4(),baseMatrix=new THREE.Matrix4(),posed=new THREE.Matrix4();
  const angles=new THREE.Euler(),offset=new THREE.Vector3();
  const pivots=ordered.map(()=>new THREE.Matrix4());
  let windAt=null,windReduced=false;
  group.userData.updateWind=(time,reduced=false)=> {
    if(windAt===time&&windReduced===reduced) return;
    windAt=time; windReduced=reduced;
    if(reduced) {
      trunks.instanceMatrix.array.set(baseTrunks);
      crowns.instanceMatrix.array.set(baseCrowns);
      snowCaps.instanceMatrix.array.set(baseSnow);
    } else {
      for(let i=0;i<trunks.count;i++) {
        const tree=ordered[i],phase=i*1.73;
        const sway=Math.sin(time*.82+phase)*.013+Math.sin(time*1.37+phase*.6)*.004;
        angles.set(sway,0,Math.sin(time*.67+phase)*.012);
        pivot.makeRotationFromEuler(angles);
        offset.copy(tree.point).applyMatrix4(pivot).multiplyScalar(-1).add(tree.point);
        pivot.setPosition(offset); pivots[i].copy(pivot);
        trunks.setMatrixAt(i,posed.multiplyMatrices(pivot,baseMatrix.fromArray(baseTrunks,i*16)));
        for(let tier=0;tier<3;tier++) {
          const index=i*3+tier;
          crowns.setMatrixAt(index,posed.multiplyMatrices(pivot,baseMatrix.fromArray(baseCrowns,index*16)));
        }
      }
      if(snowCaps.visible) for(let i=0;i<snowyCrowns.length;i++) {
        snowCaps.setMatrixAt(i,posed.multiplyMatrices(pivots[snowyCrowns[i].treeIndex],baseMatrix.fromArray(baseSnow,i*16)));
      }
    }
    trunks.instanceMatrix.needsUpdate=true;
    crowns.instanceMatrix.needsUpdate=true;
    if(reduced||snowCaps.visible) snowCaps.instanceMatrix.needsUpdate=true;
  };
  group.userData.treeCount=ordered.length;
  group.userData.surface=surface;
  group.userData.summitSlope=flank;
  group.userData.setCompact=compact=> {
    windAt=null;
    const count=compact?Math.ceil(ordered.length/2):ordered.length;
    trunks.count=count; crowns.count=count*3;
    snowCaps.visible=!compact;
  };
  return group;
}
