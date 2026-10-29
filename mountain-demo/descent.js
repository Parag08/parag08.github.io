import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { createMotionState, advanceMotion } from './motion.mjs';
import { createTrailPoints, trailClimate } from './trail.mjs';
import { createMountainSound } from './sound.mjs';
import { createSleeveGeometry } from './avatar.mjs';
import { createMountainLandscape } from './landscape.mjs?v=3';
import { createRenderLoop } from './render-loop.mjs';
import { createTrailStones } from './scenery.mjs';

const container = document.querySelector('.descent');
const stage = container.querySelector('.descent__stage');
const status = container.querySelector('[data-descent-state]');
const percentage = container.querySelector('[data-descent-percent]');
const meter = container.querySelector('.descent__meter > span');
const viewButton = container.querySelector('.descent__view');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = THREE.MathUtils.clamp;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function loadProgress(percent,label) {
  container.dataset.loadProgress=String(percent);
  container.dataset.loadLabel=label;
  container.dispatchEvent(new CustomEvent('journey:progress',{bubbles:true}));
}

try { await start(); } catch (error) {
  console.error('The 3D climber could not start:', error);
  container.dataset.sceneState='error';
  status.textContent = 'Mountain view unavailable';
  viewButton.hidden = true;
  container.dispatchEvent(new CustomEvent('journey:error',{bubbles:true}));
  stage.innerHTML = '<p style="padding:40px;color:#6e6e73;font:12px/1.8 Arial">The mountain view could not load. You can still scroll through the full career journey.</p>';
}

async function start() {
  container.dataset.sceneState='loading';
  loadProgress(5,'Preparing the mountain…');
  const backdrop=new Image();
  backdrop.src=new URL('./assets/summit-sunrise.jpg',import.meta.url).href;
  const backdropReady=backdrop.decode().catch(()=> {});
  const scenePaper=container.dataset.scenePaper||'#f7f6f2';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(scenePaper, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  stage.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(scenePaper, 13, 26);
  const camera = new THREE.PerspectiveCamera(32, 1, .05, 80);
  scene.add(new THREE.HemisphereLight(0xf7ead6, 0x82938a, 2.2));
  const sun = new THREE.DirectionalLight(0xffd6a7, 3.0);
  sun.position.set(-3, 7, -6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 7, bottom: -6, near: .1, far: 30 });
  sun.shadow.normalBias = .025;
  sun.shadow.bias = -.0001;
  scene.add(sun); scene.add(sun.target);
  const rim = new THREE.DirectionalLight(0xd6e5ee, 2);
  rim.position.set(5, 4, -4); scene.add(rim);

  // Each chapter adds distance to the winding descent. The following camera
  // keeps the nearby hiker readable even as the full route grows much longer.
  const chapterCount=document.querySelectorAll('main > .chapter').length;
  const routePoints=createTrailPoints(chapterCount).map(([x,y,z])=>V(x,y,z));
  const route = new THREE.CatmullRomCurve3(routePoints, false, 'centripetal');
  const samples = routePoints.length*12;
  route.arcLengthDivisions=samples*2;
  const routeLength = route.getLength();
  const at = (d) => route.getPointAt(clamp(d / routeLength, 0, 1));
  const direction = (d) => at(d + .06).sub(at(d - .06)).setY(0).normalize();
  const trailSamples = Array.from({length:samples+1}, (_,i)=>at(i/samples*routeLength));
  // A short flat summit behind the starting point gives the watcher room to stand.
  const before = at(0).addScaledVector(direction(0),-.72);
  trailSamples.unshift(before);
  // Let the path continue past the final foothold so he finishes on solid ground.
  trailSamples.push(at(routeLength).addScaledVector(direction(routeLength),.8));
  function heightAt(x,z) {
    let closest=Infinity, height=at(0).y;
    for(let i=0;i<trailSamples.length-1;i++) {
      const a=trailSamples[i], b=trailSamples[i+1], dx=b.x-a.x, dz=b.z-a.z;
      const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
      const squared=(x-a.x-dx*t)**2+(z-a.z-dz*t)**2;
      if(squared<closest) { closest=squared; height=THREE.MathUtils.lerp(a.y,b.y,t); }
    }
    return height;
  }
  const mat = (color) => new THREE.MeshStandardMaterial({color, roughness:.92});
  function cylinder(a,b,radius,material,parent=scene) {
    const delta=b.clone().sub(a);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,delta.length(),10),material);
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());
    mesh.castShadow=true; parent.add(mesh); return mesh;
  }
  const positions=[], colors=[], trailColor=new THREE.Color();
  const snowTint=new THREE.Color('#edf3f7');
  const rockyTint=new THREE.Color('#a4a18c');
  const greenTint=new THREE.Color('#6b8f50');
  const roadTint=new THREE.Color('#c4b18f');
  const summitRoadTint=new THREE.Color('#bbbfb8');
  function triangle(a,b,c) {
    for(const p of [a,b,c]) {
      const climate=trailClimate(p.progress);
      const variation=.94+.06*Math.sin(p.progress*170+p.across*5);
      if(Math.abs(p.across)<=1/3+.001) {
        trailColor.copy(roadTint).lerp(summitRoadTint,climate.snow*.55);
      } else {
        trailColor.copy(rockyTint).lerp(greenTint,climate.green).lerp(snowTint,climate.snow);
      }
      trailColor.multiplyScalar(variation);
      positions.push(p.x,p.y,p.z);
      colors.push(trailColor.r,trailColor.g,trailColor.b,p.edgeOpacity);
    }
  }
  const crossSections=[];
  const columns=12;
  for(let i=0;i<trailSamples.length;i++) {
    const center=trailSamples[i];
    const progress=clamp((i-1)/samples,0,1),climate=trailClimate(progress);
    const tangent=trailSamples[Math.min(i+1,trailSamples.length-1)].clone().sub(trailSamples[Math.max(0,i-1)]).setY(0).normalize();
    const lateral=V(tangent.z,0,-tangent.x), row=[];
    const width=.72+.035*Math.sin(i*.23)+(i<10?.13*(1-i/10):0);
    for(let j=0;j<=columns;j++) {
      const across=j/columns*2-1;
      const p=center.clone().addScaledVector(lateral,across*width);
      if(Math.abs(across)>1/3+.001) {
        p.y+=Math.sin(i*.45+j*2.1)*.016+climate.snow*.075*Math.sin(Math.abs(across)*Math.PI);
      }
      // Solid snow/grass shoulders flank the dry center; only the outer edge fades.
      const edgeFade=1-THREE.MathUtils.smoothstep(Math.abs(across),.66,1);
      const endFade=i===0||i===trailSamples.length-1?0:1;
      p.edgeOpacity=edgeFade*endFade; p.progress=progress; p.across=across;
      row.push(p);
    }
    crossSections.push(row);
  }
  for(let i=0;i<crossSections.length-1;i++) {
    for(let j=0;j<columns;j++) {
      const a=crossSections[i][j], b=crossSections[i+1][j], c=crossSections[i][j+1], d=crossSections[i+1][j+1];
      triangle(a,b,c); triangle(c,b,d);
    }
  }
  const terrainGeometry=new THREE.BufferGeometry();
  terrainGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  terrainGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
  terrainGeometry.computeVertexNormals();
  const terrain=new THREE.Mesh(terrainGeometry,new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1,side:THREE.DoubleSide,transparent:true,depthWrite:false}));
  terrain.renderOrder=1; terrain.receiveShadow=true; scene.add(terrain);

  const landscape=createMountainLandscape({routeLength,at,direction});
  scene.add(landscape);

  // Static cloud banks soften the trail edges without an idle rendering loop.
  const mistCanvas=document.createElement('canvas');
  mistCanvas.width=256; mistCanvas.height=128;
  const mistContext=mistCanvas.getContext('2d');
  for(const [x,y,radius] of [[58,70,48],[106,57,54],[158,62,52],[204,72,42]]) {
    const puff=mistContext.createRadialGradient(x,y,0,x,y,radius);
    puff.addColorStop(0,'rgba(255,255,255,.76)');
    puff.addColorStop(.38,'rgba(255,255,255,.48)');
    puff.addColorStop(1,'rgba(255,255,255,0)');
    mistContext.fillStyle=puff;
    mistContext.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
  const mistTexture=new THREE.CanvasTexture(mistCanvas);
  const mistMaterial=new THREE.SpriteMaterial({map:mistTexture,color:scenePaper,transparent:true,opacity:.28,depthWrite:false,toneMapped:false});
  function cloudBank(center,width,height,strength=1) {
    if(strength<=.001) return;
    const material=strength===1?mistMaterial:mistMaterial.clone();
    if(strength!==1) material.opacity*=strength;
    const puff=new THREE.Sprite(material);
    puff.position.copy(center); puff.scale.set(width,height,1); puff.renderOrder=2;
    scene.add(puff);
  }
  const cloudCount=Math.ceil(routeLength/.4);
  for(let i=0;i<=cloudCount;i++) {
    const distance=i/cloudCount*routeLength, p=at(distance), forward=direction(distance);
    const lateral=V(forward.z,0,-forward.x);
    for(const side of [-1,1]) {
      const center=p.clone().addScaledVector(lateral,side*(.72+.045*Math.sin(i*1.7)));
      center.y-=.18+.025*Math.cos(i*1.3);
      const strength=(1-THREE.MathUtils.smoothstep(distance/routeLength,.72,.96))*.8;
      cloudBank(center,.84+.10*Math.sin(i*2.1+side),.36+.05*Math.cos(i*.9),strength);
    }
  }
  cloudBank(trailSamples[0].clone().add(V(0,-.12,0)),1.3,.54);

  // Scattered stones stay at the edges, leaving a clear place for each footfall.
  const stoneGeometry=new THREE.DodecahedronGeometry(1,0);
  scene.add(createTrailStones({routeLength,at,direction,heightAt}));
  const snowPositions=[];
  const grassPositions=[];
  const detailCount=Math.ceil(routeLength/.18);
  for(let i=0;i<detailCount;i++) {
    const progress=(i+.5)/detailCount,climate=trailClimate(progress);
    const p=at(progress*routeLength),forward=direction(progress*routeLength);
    const lateral=V(forward.z,0,-forward.x);
    for(const side of [-1,1]) {
      const shoulder=p.clone().addScaledVector(lateral,side*(.39+.035*Math.sin(i*2.7)));
      if(climate.snow>.03) snowPositions.push({p:shoulder,snow:climate.snow,i});
      if(climate.green>.12&&i%3!==0) {
        for(let blade=0;blade<5;blade++) {
          const base=shoulder.clone().addScaledVector(forward,(blade-2)*.025);
          base.y=heightAt(base.x,base.z)+.012;
          const height=(.055+.045*(.5+.5*Math.sin(i*3.7+blade)))*climate.green;
          const left=base.clone().addScaledVector(lateral,-.009);
          const right=base.clone().addScaledVector(lateral,.009);
          const tip=base.clone().addScaledVector(lateral,side*.025).add(V(0,height,0));
          for(const v of [left,right,tip]) grassPositions.push(v.x,v.y,v.z);
        }
      }
    }
  }
  const snowbanks=new THREE.InstancedMesh(new THREE.SphereGeometry(1,12,8),mat('#edf3f7'),snowPositions.length);
  const snowTransform=new THREE.Object3D();
  snowPositions.forEach(({p,snow,i},index)=> {
    snowTransform.position.copy(p).add(V(0,.014+.065*snow,0));
    snowTransform.scale.set(.105+.02*Math.sin(i*1.3),(.035+.015*Math.cos(i))*snow,.15);
    snowTransform.rotation.set(0,i*.73,0); snowTransform.updateMatrix();
    snowbanks.setMatrixAt(index,snowTransform.matrix);
  });
  snowbanks.instanceMatrix.needsUpdate=true;
  snowbanks.receiveShadow=true; scene.add(snowbanks);
  const grassMaterial=new THREE.MeshStandardMaterial({color:'#6e8d4d',roughness:1,side:THREE.DoubleSide});
  const trailGrassGeometry=new THREE.BufferGeometry();
  trailGrassGeometry.setAttribute('position',new THREE.Float32BufferAttribute(grassPositions,3));
  trailGrassGeometry.computeVertexNormals();
  scene.add(new THREE.Mesh(trailGrassGeometry,grassMaterial));

  const cairnPosition=at(0).add(V(-.36,0,-.23));
  for(let i=0;i<3;i++) {
    const stone=new THREE.Mesh(stoneGeometry,mat('#8b917f'));
    stone.position.copy(cairnPosition).add(V(0,.04+i*.075,0));
    stone.scale.set(.12-i*.025,.045,.09-i*.018); stone.rotation.y=i*.9;
    stone.castShadow=true; scene.add(stone);
  }

  // A stationary clearing at the foot of the trail. The final stretch levels
  // out onto it; only the following camera moves, not the ground itself.
  const base=at(routeLength), baseForward=direction(routeLength);
  const baseLateral=V(baseForward.z,0,-baseForward.x);
  const baseCenter=base.clone().addScaledVector(baseForward,.32);
  const groundY=base.y-.025;
  const groundPositions=[], groundColors=[], groundUVs=[], earth=new THREE.Color();
  const rings=14, segments=64;
  function groundVertex(r,angle) {
    const outline=1+.045*Math.sin(angle*5)+.025*Math.cos(angle*9);
    const across=Math.cos(angle)*r*1.75*outline;
    const along=Math.sin(angle)*r*1.65*outline;
    const p=baseCenter.clone().addScaledVector(baseLateral,across).addScaledVector(baseForward,along);
    // The arrival area is flat. Only the outer ground has small natural undulations.
    p.y=groundY+Math.max(0,r-.38)*(.035*Math.sin(angle*7+r*13)+.02*Math.cos(angle*4-r*17));
    return {p,r,across,along};
  }
  function groundTriangle(a,b,c) {
    for(const v of [a,b,c]) {
      const tint=.5+.5*Math.sin(v.across*5.7+v.along*3.2);
      earth.set('#c4b594').lerp(greenTint,THREE.MathUtils.smoothstep(v.r,.22,.72)*(.72+tint*.18));
      groundPositions.push(v.p.x,v.p.y,v.p.z);
      groundColors.push(earth.r,earth.g,earth.b,1-THREE.MathUtils.smoothstep(v.r,.78,1));
      groundUVs.push(.5+v.across/3.8,.5+v.along/3.8);
    }
  }
  for(let ring=0;ring<rings;ring++) for(let i=0;i<segments;i++) {
    const a=groundVertex(ring/rings,i/segments*Math.PI*2);
    const b=groundVertex((ring+1)/rings,i/segments*Math.PI*2);
    const c=groundVertex(ring/rings,(i+1)/segments*Math.PI*2);
    const d=groundVertex((ring+1)/rings,(i+1)/segments*Math.PI*2);
    groundTriangle(a,c,b); groundTriangle(c,d,b);
  }
  // Fine gravel detail, generated once and shared over the fixed clearing.
  const earthCanvas=document.createElement('canvas'); earthCanvas.width=earthCanvas.height=512;
  const earthContext=earthCanvas.getContext('2d');
  earthContext.fillStyle='#e0d7be'; earthContext.fillRect(0,0,512,512);
  let groundSeed=47;
  const randomGround=()=> { groundSeed=(groundSeed*16807)%2147483647; return groundSeed/2147483647; };
  for(let i=0;i<7500;i++) {
    const shade=Math.floor(95+randomGround()*90);
    earthContext.fillStyle=`rgba(${shade},${shade-8},${shade-25},${.08+randomGround()*.18})`;
    const size=.5+randomGround()*1.9;
    earthContext.fillRect(randomGround()*512,randomGround()*512,size,size*.65);
  }
  const earthTexture=new THREE.CanvasTexture(earthCanvas); earthTexture.colorSpace=THREE.SRGBColorSpace;
  const groundGeometry=new THREE.BufferGeometry();
  groundGeometry.setAttribute('position',new THREE.Float32BufferAttribute(groundPositions,3));
  groundGeometry.setAttribute('color',new THREE.Float32BufferAttribute(groundColors,4));
  groundGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(groundUVs,2));
  groundGeometry.computeVertexNormals();
  const clearing=new THREE.Mesh(groundGeometry,new THREE.MeshStandardMaterial({map:earthTexture,vertexColors:true,roughness:1,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
  clearing.receiveShadow=true; scene.add(clearing);

  for(let i=0;i<30;i++) {
    const angle=i/30*Math.PI*2;
    const r=.62+randomGround()*.18;
    const v=groundVertex(r,angle);
    // Leave the entrance from the descending trail open.
    if(v.along<-.7&&Math.abs(v.across)<.5) continue;
    const stone=new THREE.Mesh(stoneGeometry,mat(i%3?'#a8a48b':'#8e9580'));
    const size=.035+randomGround()*.08;
    stone.position.copy(v.p).add(V(0,size*.35,0));
    stone.scale.set(size*1.5,size*.7,size); stone.rotation.set(i*.23,i*.81,i*.3);
    stone.castShadow=true; scene.add(stone);
    if(i%2===0) {
      const blades=[];
      for(let blade=0;blade<4;blade++) {
        const offset=(blade-1.5)*.025, height=.065+randomGround()*.06;
        blades.push(offset-.008,0,0, offset+.008,0,0, offset+.02,height,.018);
      }
      const grassGeometry=new THREE.BufferGeometry();
      grassGeometry.setAttribute('position',new THREE.Float32BufferAttribute(blades,3)); grassGeometry.computeVertexNormals();
      const grass=new THREE.Mesh(grassGeometry,grassMaterial);
      grass.position.copy(v.p).add(V(.12,.008,.03)); grass.rotation.y=angle;
      scene.add(grass);
    }
  }

  // Face the sun in the static backdrop; the distant scenery is a single image.
  const sunrisePosition=at(0).add(V(-2,1.9,-5.5));
  const sunriseYaw=Math.atan2(sunrisePosition.x-at(0).x,sunrisePosition.z-at(0).z);

  loadProgress(25,'Loading the hiker…');
  const gltf = await new GLTFLoader().loadAsync(new URL('./models/climber.glb', import.meta.url).href,event=> {
    if(event.total>0) loadProgress(25+Math.min(40,event.loaded/event.total*40),'Loading the hiker…');
  });
  loadProgress(70,'Preparing the hiker…');
  const avatar = gltf.scene;
  const bounds = new THREE.Box3().setFromObject(avatar);
  const scale = 1.4 / bounds.getSize(V()).y;
  avatar.scale.setScalar(scale);
  const figure = new THREE.Group(); figure.add(avatar); scene.add(figure);
  const bones = {};
  let jacketSource;
  function cutHikingShorts(source,hem) {
    const position=source.getAttribute('position'),normal=source.getAttribute('normal');
    const joints=source.getAttribute('skinIndex'),weights=source.getAttribute('skinWeight'),index=source.getIndex();
    const outPositions=[],outNormals=[],outJoints=[],outWeights=[];
    const vertex=i=>({p:V(position.getX(i),position.getY(i),position.getZ(i)),n:V(normal.getX(i),normal.getY(i),normal.getZ(i)),j:[joints.getX(i),joints.getY(i),joints.getZ(i),joints.getW(i)],w:[weights.getX(i),weights.getY(i),weights.getZ(i),weights.getW(i)]});
    function intersection(a,b) {
      const t=(hem-a.p.y)/(b.p.y-a.p.y),influences=new Map();
      for(const [v,factor] of [[a,1-t],[b,t]]) v.j.forEach((joint,i)=>influences.set(joint,(influences.get(joint)||0)+v.w[i]*factor));
      const sorted=[...influences].sort((a,b)=>b[1]-a[1]).slice(0,4);
      while(sorted.length<4) sorted.push([0,0]);
      const total=sorted.reduce((sum,pair)=>sum+pair[1],0);
      return {p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),j:sorted.map(pair=>pair[0]),w:sorted.map(pair=>pair[1]/total)};
    }
    for(let i=0;i<index.count;i+=3) {
      const triangle=[vertex(index.getX(i)),vertex(index.getX(i+1)),vertex(index.getX(i+2))],polygon=[];
      for(let k=0;k<3;k++) {
        const a=triangle[(k+2)%3],b=triangle[k],insideA=a.p.y>=hem,insideB=b.p.y>=hem;
        if(insideA!==insideB) polygon.push(intersection(a,b));
        if(insideB) polygon.push(b);
      }
      for(let k=1;k<polygon.length-1;k++) for(const v of [polygon[0],polygon[k],polygon[k+1]]) {
        outPositions.push(v.p.x,v.p.y,v.p.z); outNormals.push(v.n.x,v.n.y,v.n.z);
        outJoints.push(...v.j); outWeights.push(...v.w);
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(outPositions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(outNormals,3));
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(outJoints,4));
    geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(outWeights,4));
    return geometry;
  }
  avatar.traverse((object) => {
    if (object.isBone) bones[object.name] = object;
    if (object.isMesh) {
      object.castShadow = true; object.receiveShadow = true; object.frustumCulled = false;
      const material = object.material; material.roughness = .9;
      if (/Outfit_Top/.test(object.name)) {
        jacketSource=object;
        // Keep the sleeves in their bind pose and preserve every original arm
        // weight. Only the separate torso shell is shortened to jacket length.
        const geometry=createSleeveGeometry(object.geometry,object.skeleton.bones.map(bone=>bone.name));
        const position=geometry.getAttribute('position');
        const jacketColors=[], blue=new THREE.Color('#087fc9'), navy=new THREE.Color('#07568c');
        for(let i=0;i<position.count;i++) {
          const x=position.getX(i),y=position.getY(i);
          const panel=(y>1.48&&Math.abs(x)>.12)||y<1.055;
          const color=panel?navy:blue;
          jacketColors.push(color.r,color.g,color.b);
        }
        geometry.setAttribute('color',new THREE.Float32BufferAttribute(jacketColors,3));
        geometry.computeVertexNormals(); object.geometry=geometry;
        material.map=null; material.normalMap=null; material.color.set('#ffffff');
        material.vertexColors=true; material.roughness=.78;
      }
      if (/Outfit_Bottom/.test(object.name)) {
        object.geometry=cutHikingShorts(object.geometry,.72);
        const position=object.geometry.getAttribute('position');
        const legCenters=['Left','Right'].map(side=>({
          hip:object.skeleton.getBoneByName(side+'UpLeg').getWorldPosition(V()).divideScalar(scale),
          knee:object.skeleton.getBoneByName(side+'Leg').getWorldPosition(V()).divideScalar(scale)
        }));
        for(let i=0;i<position.count;i++) {
          const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
          if(y<.92) {
            const {hip,knee}=legCenters[x>0?0:1];
            const center=hip.clone().lerp(knee,clamp((hip.y-y)/(hip.y-knee.y),0,1));
            const flare=1+.24*(1-THREE.MathUtils.smoothstep(y,.72,.92));
            position.setXYZ(i,center.x+(x-center.x)*flare,y,center.z+(z-center.z)*flare);
          }
        }
        position.needsUpdate=true;
        material.map=null; material.normalMap=null; material.color.set('#283642'); material.side=THREE.DoubleSide;
      }
      if (/Outfit_Footwear/.test(object.name)) {
        const geometry=object.geometry.clone(),position=geometry.getAttribute('position');
        const shoeColors=[],color=new THREE.Color();
        for(let i=0;i<position.count;i++) {
          let x=position.getX(i),y=position.getY(i),z=position.getZ(i);
          if(z>.17) z=.17+(z-.17)*.72;
          if(z>.08) { const center=Math.sign(x)*.16; x=center+(x-center)*1.06; }
          position.setXYZ(i,x,y,z);
          // Dark tread, thick light foam soles, blue mesh uppers and heel panels.
          color.set(y<.009?'#35434d':y<.035?'#e5ecef':z>.11||z<-.045?'#087fc9':'#214b6b');
          shoeColors.push(color.r,color.g,color.b);
        }
        position.needsUpdate=true;
        geometry.setAttribute('color',new THREE.Float32BufferAttribute(shoeColors,3));
        geometry.computeVertexNormals(); object.geometry=geometry;
        material.map=null; material.normalMap=null; material.color.set('#ffffff');
        material.vertexColors=true; material.roughness=.86;
      }
      if (/Headwear|Wolf3D_Beard/.test(object.name)) object.visible = false;
    }
  });
  // Replace the old coat's lapels and buttoned torso with a continuous shell.
  // Retain its fitted sleeves; the new body shares the same skin and skeleton.
  avatar.updateMatrixWorld(true);
  // The sample avatar omits skin beneath its trousers. Add bare knees and calves
  // to the leg bones so the new shorts reveal legs that follow the existing IK.
  const legSkin=new THREE.MeshStandardMaterial({color:'#c69a80',roughness:.90});
  function bareLimb(bone,start,end,profile) {
    const a=bone.worldToLocal(avatar.localToWorld(start.clone()));
    const b=bone.worldToLocal(avatar.localToWorld(end.clone()));
    const axis=b.clone().sub(a),length=axis.length();
    const points=profile.map(([t,r])=>new THREE.Vector2(r,t*length));
    const mesh=new THREE.Mesh(new THREE.LatheGeometry(points,20),legSkin);
    mesh.position.copy(a); mesh.quaternion.setFromUnitVectors(V(0,1,0),axis.normalize());
    mesh.castShadow=true; mesh.receiveShadow=true; bone.add(mesh);
  }
  for(const side of ['Left','Right']) {
    const thigh=bones[side+'UpLeg'],shin=bones[side+'Leg'],foot=bones[side+'Foot'];
    const hip=thigh.getWorldPosition(V()).divideScalar(scale);
    const knee=shin.getWorldPosition(V()).divideScalar(scale);
    const ankle=foot.getWorldPosition(V()).divideScalar(scale);
    const aboveHem=hip.clone().lerp(knee,(hip.y-.755)/(hip.y-knee.y));
    bareLimb(thigh,knee,aboveHem,[[0,.055],[.24,.059],[.7,.067],[1,.073]]);
    bareLimb(shin,ankle,knee,[[0,.034],[.18,.039],[.43,.055],[.65,.064],[.86,.059],[1,.055]]);
    const kneecap=new THREE.Mesh(new THREE.SphereGeometry(.055,20,14),legSkin);
    kneecap.scale.z=.94; kneecap.position.copy(shin.worldToLocal(avatar.localToWorld(knee.clone())));
    kneecap.castShadow=true; shin.add(kneecap);
  }
  const torsoBones=['Hips','Spine','Spine1','Spine2','Neck'].map(name=>({
    index:jacketSource.skeleton.bones.indexOf(bones[name]),
    height:bones[name].getWorldPosition(V()).y/scale
  })).sort((a,b)=>a.height-b.height);
  const bands=[
    [.995,.151,.103],[1.04,.167,.113],[1.15,.177,.120],[1.3,.187,.126],
    [1.43,.215,.127],[1.49,.205,.112],[1.53,.105,.081],[1.57,.078,.068]
  ];
  const torsoPositions=[],torsoColors=[],torsoIndices=[],torsoJoints=[],torsoWeights=[];
  const shellBlue=new THREE.Color('#087fc9'),panelBlue=new THREE.Color('#07588f');
  const around=48;
  for(const [ring,[y,rx,rz]] of bands.entries()) for(let j=0;j<=around;j++) {
    const angle=j/around*Math.PI*2, x=Math.sin(angle)*rx, z=Math.cos(angle)*rz;
    torsoPositions.push(x,y,z);
    const panel=ring===0||(Math.abs(x)>.145&&y>1.42)||(Math.abs(x)>.16&&y<1.3);
    const color=panel?panelBlue:shellBlue; torsoColors.push(color.r,color.g,color.b);
    let lower=torsoBones[0],upper=torsoBones[torsoBones.length-1];
    for(let k=0;k<torsoBones.length-1;k++) if(y>=torsoBones[k].height) { lower=torsoBones[k]; upper=torsoBones[k+1]; }
    const blend=clamp((y-lower.height)/(upper.height-lower.height),0,1);
    torsoJoints.push(lower.index,upper.index,0,0); torsoWeights.push(1-blend,blend,0,0);
    if(ring<bands.length-1&&j<around) {
      const a=ring*(around+1)+j,b=a+around+1;
      torsoIndices.push(a,a+1,b,a+1,b+1,b);
    }
  }
  const torsoGeometry=new THREE.BufferGeometry();
  torsoGeometry.setAttribute('position',new THREE.Float32BufferAttribute(torsoPositions,3));
  torsoGeometry.setAttribute('color',new THREE.Float32BufferAttribute(torsoColors,3));
  torsoGeometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(torsoJoints,4));
  torsoGeometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(torsoWeights,4));
  torsoGeometry.setIndex(torsoIndices); torsoGeometry.computeVertexNormals();
  const jacketBody=new THREE.SkinnedMesh(torsoGeometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.80,side:THREE.DoubleSide}));
  jacketBody.position.copy(jacketSource.position); jacketBody.quaternion.copy(jacketSource.quaternion); jacketBody.scale.copy(jacketSource.scale);
  jacketSource.parent.add(jacketBody); jacketBody.bind(jacketSource.skeleton,jacketSource.bindMatrix);
  jacketBody.castShadow=true; jacketBody.receiveShadow=true; jacketBody.frustumCulled=false;
  const rest = new Map();
  Object.values(bones).forEach(b => rest.set(b, {q:b.quaternion.clone(), p:b.position.clone()}));
  avatar.updateMatrixWorld(true);
  const footRotations = ['LeftFoot','RightFoot'].map(n=>bones[n].getWorldQuaternion(new THREE.Quaternion()));
  const hipsOffset = bones.Hips.getWorldPosition(V()).y;
  const legReach = bones.LeftUpLeg.getWorldPosition(V()).distanceTo(bones.LeftLeg.getWorldPosition(V())) + bones.LeftLeg.getWorldPosition(V()).distanceTo(bones.LeftFoot.getWorldPosition(V()));

  // Restore the earlier light climbing cap with its blue trim.
  const helmet=new THREE.Group();
  const shell=new THREE.Mesh(new THREE.SphereGeometry(.118,24,14,0,Math.PI*2,0,Math.PI/2),mat('#e8ecec'));
  shell.scale.z=1.12; shell.castShadow=true; helmet.add(shell);
  const helmetRim=new THREE.Mesh(new THREE.TorusGeometry(.119,.008,6,32),mat('#086eae'));
  helmetRim.rotation.x=Math.PI/2; helmetRim.scale.y=1.12; helmet.add(helmetRim);
  for(const side of [-1,1]) cylinder(V(side*.10,0,.015),V(side*.05,-.125,.075),.006,mat('#4d574a'),helmet);
  helmet.position.set(0,.16,.025); helmet.rotation.x=.32; bones.Head.add(helmet);

  // Lace details are attached in each foot's bind space, so they move with the shoes.
  const laceMaterial=mat('#dce9ef');
  for(const [side,sign] of [['Left',1],['Right',-1]]) {
    const foot=bones[side+'Foot'];
    const local=(x,y,z)=>foot.worldToLocal(avatar.localToWorld(V(x,y,z)));
    for(const [z,y] of [[.035,.133],[.065,.128],[.095,.112]]) {
      cylinder(local(sign*.16-.022,y,z-.008),local(sign*.16+.022,y,z+.008),.0025,laceMaterial,foot);
      cylinder(local(sign*.16+.022,y,z-.008),local(sign*.16-.022,y,z+.008),.0025,laceMaterial,foot);
    }
  }

  const collar=new THREE.Mesh(new THREE.TorusGeometry(.079,.022,8,28),mat('#076aab'));
  collar.rotation.x=Math.PI/2; collar.scale.y=.83;
  collar.position.set(0,-.028,.01); bones.Neck.add(collar);
  const hood=new THREE.Mesh(new THREE.SphereGeometry(.092,16,12),mat('#087fc9'));
  hood.scale.set(1,.60,.55); hood.position.set(0,-.045,-.065); bones.Neck.add(hood);
  // Zip, pull tab, and a small chest wordmark are attached to the moving torso.
  const zipper=new THREE.Mesh(new THREE.BoxGeometry(.009,.40,.006),mat('#24384b'));
  zipper.position.set(0,-.14,.16); bones.Spine2.add(zipper);
  const zipPull=new THREE.Mesh(new THREE.BoxGeometry(.015,.028,.009),mat('#c0d3de'));
  zipPull.position.set(0,.04,.168); bones.Spine2.add(zipPull);
  for(const side of [-1,1]) {
    const pocketZip=new THREE.Mesh(new THREE.BoxGeometry(.005,.12,.005),mat('#1a4965'));
    pocketZip.position.set(side*.105,-.235,.15); pocketZip.rotation.z=side*.25;
    bones.Spine2.add(pocketZip);
  }
  const brandCanvas=document.createElement('canvas'); brandCanvas.width=512; brandCanvas.height=128;
  const brandContext=brandCanvas.getContext('2d');
  brandContext.fillStyle='#ffffff'; brandContext.font='italic 700 63px Arial';
  brandContext.textAlign='center'; brandContext.textBaseline='middle'; brandContext.fillText('DECATHLON',256,64);
  const brandTexture=new THREE.CanvasTexture(brandCanvas); brandTexture.colorSpace=THREE.SRGBColorSpace;
  const chestMark=new THREE.Mesh(new THREE.PlaneGeometry(.115,.028),new THREE.MeshBasicMaterial({map:brandTexture,transparent:true,depthWrite:false,toneMapped:false}));
  chestMark.position.set(.076,.015,.163); bones.Spine2.add(chestMark);

  // The backpack moves with the avatar's spine, rather than floating behind it.
  const pack = new THREE.Group();
  const bag = new THREE.Mesh(new THREE.CapsuleGeometry(.16,.23,5,12), mat('#284251'));
  bag.scale.set(1,1,.65); bag.castShadow=true; pack.add(bag);
  for (const x of [-.11,.11]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(.035,.39,.018), mat('#172c39'));
    strap.position.set(x,0,-.115); pack.add(strap);
  }
  const packTrim=new THREE.Mesh(new THREE.BoxGeometry(.24,.035,.012),mat('#0c8bd2'));
  packTrim.position.set(0,-.13,-.11); pack.add(packTrim);
  pack.position.set(0,-.08,-.22); bones.Spine2.add(pack);
  const poles=Array.from({length:2},()=>{
    const group=new THREE.Group();
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.008,.006,1,8),mat('#5a6055'));
    shaft.castShadow=true; group.add(shaft);
    const grip=new THREE.Mesh(new THREE.CylinderGeometry(.018,.016,.12,8),mat('#3d473d'));
    grip.position.y=.44; group.add(grip);
    const basket=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.012,10),mat('#3d473d'));
    basket.position.y=-.43; group.add(basket);
    scene.add(group); return group;
  });

  function rotateToward(bone, child, target) {
    const origin = bone.getWorldPosition(V());
    const oldDirection = child.getWorldPosition(V()).sub(origin).normalize();
    const newDirection = target.clone().sub(origin).normalize();
    const world = bone.getWorldQuaternion(new THREE.Quaternion());
    world.premultiply(new THREE.Quaternion().setFromUnitVectors(oldDirection,newDirection));
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
    bone.updateWorldMatrix(false,true);
  }
  function solveIK(upper, lower, end, target, pole) {
    const a = upper.getWorldPosition(V()), b = lower.getWorldPosition(V()), c = end.getWorldPosition(V());
    const l1 = a.distanceTo(b), l2 = b.distanceTo(c), delta = target.clone().sub(a);
    const distance = clamp(delta.length(),.001,l1+l2-.003), unit = delta.normalize();
    const along = (l1*l1-l2*l2+distance*distance)/(2*distance);
    const height = Math.sqrt(Math.max(0,l1*l1-along*along));
    const bend = pole.clone().addScaledVector(unit,-pole.dot(unit)).normalize();
    const knee = a.clone().addScaledVector(unit,along).addScaledVector(bend,height);
    rotateToward(upper,lower,knee); rotateToward(lower,end,target);
  }
  function step(distance, offset, side, lateral) {
    const stride=.60, cycle=distance/stride+offset, phase=cycle-Math.floor(cycle);
    let d=(Math.floor(cycle)-offset)*stride+.18, lift=0;
    if (phase>.58) { const t=(phase-.58)/.42; d+=stride*t*t*(3-2*t); lift=Math.sin(t*Math.PI)*.07; }
    if (motion.matches) { d=distance+(offset ? -.08 : .08); lift=0; }
    const settle = Math.min(THREE.MathUtils.smoothstep(distance,0,.30),THREE.MathUtils.smoothstep(routeLength-distance,0,.30));
    d=THREE.MathUtils.lerp(distance+(offset ? -.035 : .035),d,settle);
    const p=at(d);
    p.addScaledVector(lateral,side*.095); p.y=heightAt(p.x,p.z)+.075+lift*settle;
    return p;
  }

  const sound=createMountainSound(container.querySelector('[data-mountain-sound]'));

  const summitForward=V(Math.sin(sunriseYaw),0,Math.cos(sunriseYaw));
  const summitLateral=V(summitForward.z,0,-summitForward.x);
  const plantedTips=[1,-1].map(sign=> {
    const tip=at(0).addScaledVector(summitForward,.22).addScaledVector(summitLateral,sign*.30);
    tip.y=heightAt(tip.x,tip.z)+.015;
    return tip;
  });
  let renderLoop;
  let lastPose=null;
  let scenePrepared=false,contextAvailable=true;
  let target=0, current=0, close=false, cameraBlend=0;
  let travelSign=1, facingYaw=sunriseYaw, ascentBlend=0, hipsY=null, poseSettling=false;
  let motionState=createMotionState(), initialized=false, lastDaylight=-1;
  let initialAnchorApplied=false;
  let stageWidth=0, stageHeight=0,compactView=null;
  let scrollRange=1, heroHeight=innerHeight;
  const hero=document.getElementById('summit');
  const journeyMain=document.querySelector('main');
  const initialHash=location.hash;
  const freshNavigation=performance.getEntriesByType('navigation')[0]?.type==='navigate';
  const chapters=[...document.querySelectorAll('main > .chapter')];
  const heroProgress=progress=>progress*scrollRange/Math.max(heroHeight,1);
  const cameraTarget=V();
  function desiredYaw(progress) {
    const forward=direction(progress*routeLength).multiplyScalar(travelSign);
    const heading=Math.atan2(forward.x,forward.z);
    const departure=THREE.MathUtils.smoothstep(heroProgress(progress),.06,.36);
    const delta=Math.atan2(Math.sin(heading-sunriseYaw),Math.cos(heading-sunriseYaw));
    return sunriseYaw+delta*departure;
  }
  function draw(progress,dt) {
    const distance=progress*routeLength, p=at(distance);
    const heroPhase=heroProgress(progress);
    const walking=THREE.MathUtils.smoothstep(heroPhase,.06,.36)*clamp((1-progress)/.025,0,1);
    const resting=1-THREE.MathUtils.smoothstep(heroPhase,.06,.36);
    const uphill=travelSign<0;
    sound.update(distance,trailClimate(progress),walking>.1&&!motion.matches&&Math.abs(motionState.velocity)*routeLength>.04);
    const poseChanged=hipsY===null||!lastPose||lastPose.progress!==progress||lastPose.yaw!==facingYaw||lastPose.ascent!==ascentBlend||lastPose.heroPhase!==heroPhase||lastPose.reduced!==motion.matches||poseSettling;
    if(poseChanged) {
      renderer.shadowMap.needsUpdate=true;
      const forward=V(Math.sin(facingYaw),0,Math.cos(facingYaw));
      const lateral=V(forward.z,0,-forward.x);
      figure.rotation.y=facingYaw;
      figure.position.copy(p);
      for(const [bone,pose] of rest) { bone.quaternion.copy(pose.q); bone.position.copy(pose.p); }
      bones.Spine.rotation.x+=THREE.MathUtils.lerp(-.045,.12,ascentBlend)*walking;
      bones.Head.rotation.x-=.045*resting;
      const feet=[step(distance,0,1,lateral),step(distance,.5,-1,lateral)];
      const desiredHips=Math.min(feet[0].y,feet[1].y)+legReach*THREE.MathUtils.lerp(.96,.89,walking)-hipsOffset;
      hipsY=hipsY===null||motion.matches?desiredHips:THREE.MathUtils.lerp(hipsY,desiredHips,1-Math.exp(-dt*22));
      figure.position.y=hipsY;
      poseSettling=Math.abs(hipsY-desiredHips)>.0003;
      figure.updateMatrixWorld(true);
      ['Left','Right'].forEach((side,i)=>{
        solveIK(bones[side+'UpLeg'],bones[side+'Leg'],bones[side+'Foot'],feet[i],forward);
        const world=figure.quaternion.clone().multiply(footRotations[i]);
        bones[side+'Foot'].quaternion.copy(bones[side+'Foot'].parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
        figure.updateMatrixWorld(true);
      });
      const stridePhase=Math.sin(distance/.60*Math.PI*2)*walking;
      for(const [i,side] of ['Left','Right'].entries()) {
        const sign=i===0?1:-1;
        // At the summit both hands rest on fixed pole grips, with relaxed elbows.
        const summitHand=plantedTips[i].clone().add(V(0,.86,0)).addScaledVector(summitForward,-.035);
        const restingHand=figure.localToWorld(V(sign*.18,.70,.045)).lerp(summitHand,resting);
        const movingHand=p.clone().addScaledVector(forward,THREE.MathUtils.lerp(.18,.26,ascentBlend)+stridePhase*.055*sign)
          .addScaledVector(lateral,sign*.16).add(V(0,THREE.MathUtils.lerp(.72,.85,ascentBlend)+stridePhase*.04*sign,0));
        const handTarget=restingHand.lerp(movingHand,walking);
        const elbow=lateral.clone().multiplyScalar(sign*.18).add(V(0,-1,0));
        solveIK(bones[side+'Arm'],bones[side+'ForeArm'],bones[side+'Hand'],handTarget,elbow);
        figure.updateMatrixWorld(true);
        const hand=bones[side+'Hand'].getWorldPosition(V());
        const walkingTip=p.clone().addScaledVector(forward,.24).addScaledVector(lateral,sign*.26);
        walkingTip.y=heightAt(walkingTip.x,walkingTip.z)+.01;
        const tip=plantedTips[i].clone().lerp(walkingTip,1-resting);
        const top=hand.clone().add(V(0,.045,0)), axis=top.clone().sub(tip);
        poles[i].position.copy(top).add(tip).multiplyScalar(.5);
        poles[i].quaternion.setFromUnitVectors(V(0,1,0),axis.clone().normalize());
        poles[i].scale.y=axis.length();
      }
      lastPose={progress,yaw:facingYaw,ascent:ascentBlend,heroPhase,reduced:motion.matches};
    }
    meter.style.transform=`scaleX(${progress})`;
    const nextPercent=`${String(Math.round(progress*100)).padStart(2,'0')}%`;
    if(percentage.textContent!==nextPercent) percentage.textContent=nextPercent;
    const nextStatus=heroProgress(progress)<.024?'Watching the sunrise':progress>.99?'Trail complete':uphill?'Trekking uphill':'On the descent';
    if(status.textContent!==nextStatus) status.textContent=nextStatus;
    const daylight=Math.round((1-THREE.MathUtils.smoothstep(heroProgress(progress),.105,.66))*1000)/1000;
    if(daylight!==lastDaylight) { container.style.setProperty('--sunrise',String(daylight)); lastDaylight=daylight; }

    const aspect=stage.clientWidth/stage.clientHeight;
    const fit=clamp(.49/aspect,1,1.3);
    const scenicOffset=V(3.2,1.8,6.8).lerp(V(3.6,1.55,7.5),resting).multiplyScalar(fit);
    const closeOffset=V(2.3,1.35,4.6).multiplyScalar(fit);
    camera.position.copy(p).add(scenicOffset.lerp(closeOffset,cameraBlend));
    const cameraRight=V(scenicOffset.z,0,-scenicOffset.x).normalize();
    cameraTarget.copy(p).add(V(0,.70,0)).addScaledVector(cameraRight,.18);
    // Keep the original sunrise direction and contact shadows all the way down.
    sun.position.copy(p).add(V(-3,7,-6)); sun.target.position.copy(p);
    camera.lookAt(cameraTarget); renderer.render(scene,camera);
  }
  function animate(dt) {
    const smoothing=motion.matches?1:1-Math.exp(-dt*8);
    const previous=current;
    motionState=advanceMotion(motionState,target,dt,routeLength,{reducedMotion:motion.matches});
    current=motionState.position;
    if(Math.abs(motionState.velocity*routeLength)>.035) travelSign=Math.sign(motionState.velocity);
    else if(motion.matches&&Math.abs(current-previous)>.000001) travelSign=Math.sign(current-previous);
    const desiredAscent=travelSign<0?1:0;
    ascentBlend=THREE.MathUtils.lerp(ascentBlend,desiredAscent,smoothing);
    if(Math.abs(ascentBlend-desiredAscent)<.001) ascentBlend=desiredAscent;
    cameraBlend=THREE.MathUtils.lerp(cameraBlend,close?1:0,smoothing);
    if(Math.abs(cameraBlend-(close?1:0))<.0001) cameraBlend=close?1:0;
    const yawTarget=desiredYaw(current);
    const yawDelta=Math.atan2(Math.sin(yawTarget-facingYaw),Math.cos(yawTarget-facingYaw));
    facingYaw=Math.abs(yawDelta)<.0001?yawTarget:facingYaw+yawDelta*smoothing;
    draw(current,dt);
    return current!==target||motionState.velocity!==0||cameraBlend!==(close?1:0)||Math.abs(yawDelta)>=.0001||poseSettling||ascentBlend!==desiredAscent;
  }
  function schedule() { if(scenePrepared&&contextAvailable) renderLoop.request(); }
  function update(event) {
    // The site footer can follow the journey without delaying arrival at camp.
    const journeyEnd=journeyMain?journeyMain.offsetTop+journeyMain.offsetHeight:document.documentElement.scrollHeight;
    scrollRange=Math.max(0,journeyEnd-innerHeight);
    heroHeight=hero?.offsetHeight||innerHeight;
    target=scrollRange>0?clamp(scrollY/scrollRange,0,1):0;
    // Restored URLs start at their actual location, rather than racing down from
    // the summit. Scroll direction then follows movement, not noisy wheel input.
    if(!initialized) {
      // A cached model can finish before the browser's initial smooth hash
      // scroll. Honour fresh deep links immediately instead of trekking there.
      if(freshNavigation&&initialHash&&!initialAnchorApplied) {
        initialAnchorApplied=true;
        let anchor;
        try { anchor=document.getElementById(decodeURIComponent(initialHash.slice(1))); } catch { /* malformed fragment */ }
        if(anchor) {
          const margin=parseFloat(getComputedStyle(anchor).scrollMarginTop)||0;
          window.scrollTo({top:anchor.getBoundingClientRect().top+scrollY-margin,behavior:'instant'});
          target=scrollRange>0?clamp(scrollY/scrollRange,0,1):0;
        }
      }
      current=target; motionState=createMotionState(target); facingYaw=desiredYaw(target); initialized=true;
    }
    const midpoint=scrollY+innerHeight*.45;
    const active=chapters.find(section=>midpoint>=section.offsetTop&&midpoint<section.offsetTop+section.offsetHeight)||(midpoint>=journeyEnd?chapters[chapters.length-1]:chapters[0]);
    const chapter=active?.dataset.chapter||'hero';
    if(document.body.dataset.chapter!==chapter) document.body.dataset.chapter=chapter;
    schedule();
  }
  function resize() {
    const compact=innerWidth<=760;
    if(compactView!==compact) {
      compactView=compact; landscape.userData.setCompact(compact);
      renderer.shadowMap.needsUpdate=true;
    }
    const w=Math.round(stage.clientWidth),h=Math.round(stage.clientHeight);
    if(w>0&&h>0&&(w!==stageWidth||h!==stageHeight)) {
      stageWidth=w; stageHeight=h;
      renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
    }
    update();
  }
  renderLoop=createRenderLoop(animate);
  viewButton.addEventListener('click',()=> { close=!close; viewButton.setAttribute('aria-pressed',String(close)); viewButton.innerHTML=close?'Trail view <span>↙</span>':'Closer look <span>↗</span>'; schedule(); });
  addEventListener('scroll',update,{passive:true});
  addEventListener('pageshow',()=> { initialized=false; hipsY=null; update(); });
  motion.addEventListener('change',update);
  document.addEventListener('visibilitychange',()=> {
    if(document.hidden) renderLoop.pause();
    else { renderLoop.resume(); schedule(); }
  });
  new ResizeObserver(resize).observe(stage); new ResizeObserver(update).observe(document.body);
  renderer.domElement.addEventListener('webglcontextlost',(event)=> { event.preventDefault(); contextAvailable=false; renderLoop.pause(); sound.setPaused(true); status.textContent='3D paused — reload to resume'; });
  renderer.domElement.addEventListener('webglcontextrestored',()=> { contextAvailable=true; renderer.shadowMap.needsUpdate=true; sound.setPaused(false); renderLoop.resume(); schedule(); });
  loadProgress(85,'Preparing the first view…');
  await Promise.all([backdropReady,document.fonts?.ready]);
  resize();
  // Prepare every avatar material before exposing the page. The initial render
  // also uploads textures and draws the hiker at the restored URL/scroll position.
  await renderer.compileAsync(scene,camera);
  loadProgress(95,'Finishing the first view…');
  draw(current,1/60);
  await new Promise(resolve=>requestAnimationFrame(resolve));
  scenePrepared=true;
  container.dataset.sceneState='ready';
  loadProgress(100,'Ready to explore');
  container.dispatchEvent(new CustomEvent('journey:ready',{bubbles:true}));
  schedule();
}
