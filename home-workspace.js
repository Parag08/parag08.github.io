import * as THREE from 'three';
import { RoundedBoxGeometry } from './mountain-demo/vendor/RoundedBoxGeometry.js';

const stage = document.querySelector('.workspace__stage');
if (stage) {
  try { createWorkspace(stage); }
  catch (error) {
    console.warn('Workspace illustration unavailable:', error);
    const fallback = document.createElement('p');
    fallback.className = 'workspace__fallback';
    fallback.textContent = 'Turning ideas into things people can use. ☕';
    stage.replaceChildren(fallback);
  }
}

function createWorkspace(stage) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  stage.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, .1, 30);
  camera.position.set(4.2, 3.15, 5.5);
  camera.lookAt(0, 1.15, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xa2a9b9, 3));
  const light = new THREE.DirectionalLight(0xffeddb, 4);
  light.position.set(-3, 6, 4);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 15 });
  light.shadow.normalBias = .035;
  scene.add(light);
  const rim = new THREE.DirectionalLight(0xb9d3ff, 2);
  rim.position.set(4, 4, -3); scene.add(rim);
  const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .65, ...extra });
  const blue = material('#1674c4'), navy = material('#183452');
  const skin = material('#c78f66'), hair = material('#252a32');
  const trouser = material('#303d53'), shoe = material('#e8eaf0');
  const wood = material('#d9b88c'), cream = material('#faf8f3');
  const metal = material('#b9c2cd', { metalness: .45, roughness: .35 });
  const dark = material('#253044');
  const v = (x,y,z) => new THREE.Vector3(x,y,z);
  function mesh(geometry, mat, position, parent = scene) {
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(...position); object.castShadow = true; object.receiveShadow = true;
    parent.add(object); return object;
  }
  function box(size, position, mat, radius = .04, parent = scene) {
    return mesh(new RoundedBoxGeometry(...size, 3, radius), mat, position, parent);
  }
  function sphere(size, position, mat, parent = scene) {
    const object = mesh(new THREE.SphereGeometry(1, 24, 16), mat, position, parent);
    object.scale.set(...size); return object;
  }
  function limb(a, b, radius, mat, parent = scene) {
    const start = v(...a), end = v(...b), delta = end.clone().sub(start);
    const object = mesh(new THREE.CapsuleGeometry(radius, Math.max(.001, delta.length()-radius*2), 6, 12), mat, [0,0,0], parent);
    object.position.copy(start).add(end).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(v(0,1,0), delta.normalize());
    return object;
  }
  function tube(points, radius, mat, parent = scene) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>v(...p))), 24, radius, 8, false), mat, [0,0,0], parent);
  }

  // A quiet oval stage and contact shadow ground the illustration on the page.
  const floor = mesh(new THREE.CylinderGeometry(1.8, 1.8, .065, 64), material('#e6e8ee'), [0,-.04,0]);
  floor.scale.z = .78;
  floor.castShadow = false;
  const shadow = mesh(new THREE.PlaneGeometry(8,8), new THREE.ShadowMaterial({opacity:.08}), [0,-.079,0]);
  shadow.rotation.x = -Math.PI/2;

  // Chair: upholstered back, a swivel column and five feet.
  box([.78,.13,.64], [0,.78,-.48], navy, .08);
  box([.77,.72,.13], [0,1.16,-.83], navy, .08).rotation.x = -.12;
  limb([0,.12,-.48],[0,.73,-.48],.055,metal);
  for(let i=0;i<5;i++) {
    const a=i/5*Math.PI*2, x=Math.sin(a)*.48, z=-.48+Math.cos(a)*.48;
    limb([0,.14,-.48],[x,.1,z],.03,metal);
    sphere([.065,.065,.065],[x,.07,z],dark);
  }
  // Legs point beneath the desk, with relaxed knees and clean white trainers.
  for(const side of [-1,1]) {
    const x=side*.18;
    limb([x,.93,-.46],[x,.8,.12],.13,trouser);
    limb([x,.8,.12],[x,.22,.25],.105,trouser);
    limb([x,.17,.25],[x,.34,.25],.07,trouser);
    box([.24,.16,.4],[x,.13,.36],shoe,.065);
    box([.245,.035,.4],[x,.06,.36],navy,.012);
    for(let i=0;i<3;i++) box([.14,.014,.018],[x,.216,.32+i*.045],cream,.005);
  }
  box([.57,.28,.43],[0,1,-.43],trouser,.1);
  const torso = box([.69,.68,.47],[0,1.45,-.44],blue,.14);
  torso.rotation.x = .08;
  limb([0,1.74,-.4],[0,1.94,-.36],.11,skin);
  // Collar and ribbed cuffs give the person the same blue palette as About.
  box([.25,.055,.2],[0,1.8,-.38],navy,.025);
  const head = new THREE.Group(); head.position.set(0,2.05,-.31); scene.add(head);
  sphere([.255,.31,.235],[0,.08,0],skin,head);
  for(const side of [-1,1]) sphere([.055,.09,.06],[side*.25,.06,-.005],skin,head);
  sphere([.263,.19,.243],[0,.27,-.025],hair,head);
  for(let i=0;i<5;i++) {
    const tuft=sphere([.105,.085,.15],[-.16+i*.075,.36+i*.008,.035],hair,head);
    tuft.rotation.z=-.32;
  }
  sphere([.045,.06,.07],[0,.065,.225],skin,head);
  const glasses = material('#222c3b', {roughness:.35});
  for(const side of [-1,1]) {
    sphere([.021,.025,.014],[side*.10,.12,.215],hair,head);
    const frame=mesh(new THREE.TorusGeometry(.075,.009,8,24),glasses,[side*.105,.12,.222],head);
    frame.scale.y=.78;
    tube([[side*.17,.13,.21],[side*.23,.14,.13],[side*.25,.13,-.015]],.009,glasses,head);
    tube([[side*.05,.208,.204],[side*.11,.218,.207],[side*.15,.21,.2]],.011,hair,head);
  }
  tube([[-.03,.12,.23],[0,.13,.24],[.03,.12,.23]],.009,glasses,head);
  tube([[-.05,-.06,.21],[0,-.074,.23],[.055,-.056,.207]],.007,material('#824d3e'),head);
  head.rotation.x=.12;

  // Desk and laptop. The lid opens towards the seated person; the back bears
  // a small abstract mark, while actual changing code lines face the user.
  box([2.4,.12,1.15],[0,1.25,.28],wood,.06);
  for(const x of [-.98,.98]) for(const z of [-.12,.68]) limb([x,.03,z],[x,1.2,z],.035,cream);
  const laptop = new THREE.Group(); laptop.position.set(.08,1.33,.29); scene.add(laptop);
  box([.9,.045,.61],[0,0,0],metal,.025,laptop);
  box([.73,.006,.31],[0,.026,-.065],dark,.015,laptop);
  for(let row=0;row<4;row++) for(let col=0;col<10;col++) {
    box([.055,.006,.045],[-.31+col*.069,.033,-.18+row*.068],material('#8995a9'),.004,laptop);
  }
  box([.26,.004,.12],[0,.027,.18],material('#d2d9e2'),.012,laptop);
  const lid = new THREE.Group(); lid.position.set(0,.02,.29); lid.rotation.x=.19; laptop.add(lid);
  box([.92,.6,.045],[0,.3,0],metal,.025,lid);
  box([.83,.5,.006],[0,.31,-.025],dark,.014,lid);
  const codeLines=[];
  for(let i=0;i<7;i++) {
    const width=.18+(i%3)*.13;
    const line=box([width,.012,.004],[-.32+width/2,.48-i*.053,-.03],material(i%3===0?'#7dd9b0':i%3===1?'#a7b7ff':'#c8d6e9'),.003,lid);
    codeLines.push(line);
  }
  const logo=mesh(new THREE.TorusGeometry(.065,.012,10,32),cream,[0,.31,.026],lid);
  logo.rotation.z=-.35;

  const hands=[];
  for(const side of [-1,1]) {
    limb([side*.28,1.7,-.4],[side*.43,1.41,-.19],.105,blue);
    limb([side*.43,1.41,-.19],[side*.23,1.36,.1],.085,blue);
    const hand=new THREE.Group(); hand.position.set(side*.22,1.375,.09); scene.add(hand); hands.push(hand);
    box([.14,.06,.16],[0,0,0],skin,.035,hand);
    for(let i=0;i<4;i++) {
      limb([-.052+i*.034,0,.04],[-.052+i*.034,-.018,.16],.016,skin,hand);
    }
    sphere([.028,.027,.055],[-side*.078,0,.03],skin,hand);
  }

  // Ceramic mug, visible dark coffee and a curved handle.
  const mugX=-.82, mugZ=.41;
  mesh(new THREE.CylinderGeometry(.14,.12,.24,32,1,true),cream,[mugX,1.44,mugZ]);
  const rimMug=mesh(new THREE.TorusGeometry(.132,.014,8,32),cream,[mugX,1.56,mugZ]); rimMug.rotation.x=Math.PI/2;
  mesh(new THREE.CylinderGeometry(.119,.119,.008,32),material('#54382c'),[mugX,1.546,mugZ]);
  const handle=mesh(new THREE.TorusGeometry(.085,.025,10,24),cream,[mugX-.16,1.45,mugZ]);
  handle.rotation.y=Math.PI/2;
  // A little notebook beside the laptop adds a warm, lived-in detail.
  box([.3,.035,.42],[.83,1.335,.15],navy,.014).rotation.y=-.16;
  limb([.72,1.365,-.01],[.91,1.365,.31],.012,wood);

  // Thin translucent wisps rise, curl and dissolve above the coffee. Geometry
  // is updated at 30fps only while visible; there are no video/texture assets.
  const steam=[];
  for(let strand=0;strand<3;strand++) {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(22*3),3));
    const wisp=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#9aabbd',transparent:true,opacity:.5,depthWrite:false}));
    wisp.frustumCulled=false; scene.add(wisp); steam.push(wisp);
  }
  const steamCanvas=document.createElement('canvas');
  steamCanvas.width=steamCanvas.height=64;
  const steamContext=steamCanvas.getContext('2d');
  const haze=steamContext.createRadialGradient(32,32,0,32,32,32);
  haze.addColorStop(0,'rgba(153,169,185,.7)');
  haze.addColorStop(.4,'rgba(171,186,200,.3)');
  haze.addColorStop(1,'rgba(171,186,200,0)');
  steamContext.fillStyle=haze;steamContext.fillRect(0,0,64,64);
  const steamTexture=new THREE.CanvasTexture(steamCanvas);
  const puffs=Array.from({length:9},()=> {
    const puff=new THREE.Sprite(new THREE.SpriteMaterial({map:steamTexture,transparent:true,depthWrite:false}));
    scene.add(puff);return puff;
  });
  function pose(time) {
    const busy=(time%9)<7.1;
    hands.forEach((hand,i)=> {
      hand.position.y=1.375+(busy?Math.max(0,Math.sin(time*17+i*2.8))*.025:0);
      hand.rotation.x=busy?Math.sin(time*17+i*2.8)*.055:0;
    });
    head.rotation.x=.12+Math.sin(time*.85)*.025;
    head.rotation.y=Math.sin(time*.45)*.035;
    torso.scale.y=1+Math.sin(time*1.6)*.007;
    codeLines.forEach((line,i)=> { line.scale.x=.5+.5*Math.min(1,Math.max(0,((time*.7+i*.14)%1)*4)); });
    steam.forEach((wisp,i)=> {
      const phase=(time*.23+i/3)%1;
      const attribute=wisp.geometry.attributes.position;
      for(let n=0;n<attribute.count;n++) {
        const t=n/(attribute.count-1);
        attribute.setXYZ(n,mugX+Math.sin(t*7+time*1.4+i)*(.018+t*.035)+(i-1)*.03,1.59+phase*.14+t*.42,mugZ+Math.cos(t*5+time+i)*.025);
      }
      attribute.needsUpdate=true;
      wisp.material.opacity=Math.sin(phase*Math.PI)*.5;
    });
    puffs.forEach((puff,i)=> {
      const phase=(time*.24+i/9)%1;
      puff.position.set(mugX+Math.sin(phase*5+time*.8)*phase*.07,1.58+phase*.52,mugZ);
      puff.scale.set(.07+phase*.13,.12+phase*.2,1);
      puff.material.opacity=Math.sin(phase*Math.PI)*.45;
    });
  }
  let width=0,height=0;
  function resize() {
    const size=stage.getBoundingClientRect();
    if(!size.width||!size.height) return;
    if(width!==size.width||height!==size.height) {
      width=size.width;height=size.height; renderer.setSize(width,height,false);
      const halfHeight=1.82, aspect=width/height;
      camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;
      camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();
    }
    renderer.render(scene,camera);
  }
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,visible=true,last=0,time=0;
  // Sound is opt-in. Synthesize brief key clicks locally after a button press;
  // no audio request, autoplay, or extra loop runs while muted.
  const soundButton=stage.parentElement.querySelector('[data-typing-sound]');
  const AudioContext=window.AudioContext||window.webkitAudioContext;
  let audio=null,master=null,noiseBuffer=null,soundEnabled=false,soundVersion=0,nextClick=0,clickIndex=0;
  function updateSoundButton() {
    soundButton.setAttribute('aria-pressed',String(soundEnabled));
    soundButton.setAttribute('aria-label',soundEnabled?'Mute typing sounds':'Enable typing sounds');
    soundButton.title=soundEnabled?'Mute typing sounds':'Enable soft typing sounds';
  }
  function syncAudio() {
    if(!audio) return;
    const active=soundEnabled&&visible&&!document.hidden;
    master.gain.setTargetAtTime(active ? .3 : 0,audio.currentTime,.012);
    const transition=active?audio.resume():audio.suspend();
    transition.catch(()=> {});
  }
  if(soundButton&&AudioContext) {
    soundButton.hidden=false;
    soundButton.addEventListener('click',async()=> {
      const version=++soundVersion;
      soundEnabled=!soundEnabled;
      updateSoundButton();
      try {
        if(soundEnabled) {
          if(!audio) {
            audio=new AudioContext();
            master=audio.createGain();master.gain.value=0;master.connect(audio.destination);
            noiseBuffer=audio.createBuffer(1,Math.floor(audio.sampleRate*.035),audio.sampleRate);
            const samples=noiseBuffer.getChannelData(0);
            for(let i=0;i<samples.length;i++) samples[i]=Math.random()*2-1;
          }
          // Resume directly from this deliberate user gesture.
          await audio.resume();
        }
        if(version!==soundVersion) {syncAudio();return;}
        nextClick=time;
        sync();
      } catch(error) {
        soundEnabled=false;updateSoundButton();syncAudio();
        soundButton.title='Typing sounds are unavailable in this browser';
        console.warn('Typing sounds unavailable:',error);
      }
    });
  }
  function playKeyClick() {
    if(!soundEnabled||audio?.state!=='running'||time<nextClick||time%9>=7.1) return;
    nextClick=time+[.13,.19,.11,.26,.17,.32][clickIndex++%6];
    if(stage.closest('main')?.hasAttribute('inert')) return;
    const now=audio.currentTime;
    const noise=audio.createBufferSource();noise.buffer=noiseBuffer;
    noise.playbackRate.value=.9+(clickIndex%4)*.08;
    const filter=audio.createBiquadFilter();filter.type='bandpass';
    filter.frequency.value=1400+(clickIndex%5)*180;filter.Q.value=.7;
    const envelope=audio.createGain();
    envelope.gain.setValueAtTime(.0001,now);
    envelope.gain.exponentialRampToValueAtTime(.08,now+.001);
    envelope.gain.exponentialRampToValueAtTime(.0001,now+.033);
    noise.connect(filter);filter.connect(envelope);envelope.connect(master);
    noise.start(now);noise.stop(now+.04);
    noise.onended=()=> {noise.disconnect();filter.disconnect();envelope.disconnect();};
    const body=audio.createOscillator(),bodyGain=audio.createGain();
    body.type='triangle';body.frequency.setValueAtTime(280+(clickIndex%3)*35,now);
    body.frequency.exponentialRampToValueAtTime(170,now+.024);
    bodyGain.gain.setValueAtTime(.026,now);
    bodyGain.gain.exponentialRampToValueAtTime(.0001,now+.027);
    body.connect(bodyGain);bodyGain.connect(master);body.start(now);body.stop(now+.03);
    body.onended=()=> {body.disconnect();bodyGain.disconnect();};
  }
  function tick(now) {
    frame=0;
    if(document.hidden||!visible||(reduced.matches&&!soundEnabled)) return;
    if(now-last>=1000/30) {
      time+=Math.min((now-last)/1000,.05);last=now;
      if(!reduced.matches) {pose(time);renderer.render(scene,camera);}
      playKeyClick();
    }
    frame=requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);frame=0;last=performance.now();
    syncAudio();
    if(visible&&!document.hidden&&(!reduced.matches||soundEnabled)) frame=requestAnimationFrame(tick);
    else { pose(0);renderer.render(scene,camera); }
  }
  new ResizeObserver(resize).observe(stage);
  if('IntersectionObserver' in window) new IntersectionObserver(([entry])=> {visible=entry.isIntersecting;sync();}).observe(stage);
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);
  renderer.domElement.addEventListener('webglcontextlost',()=> {cancelAnimationFrame(frame);frame=0;if(audio) {master.gain.value=0;audio.suspend().catch(()=> {});}},false);
  renderer.domElement.addEventListener('webglcontextrestored',()=> {resize();sync();});
  pose(0);resize();sync();
}
