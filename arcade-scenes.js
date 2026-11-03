import * as THREE from 'three';
import { RoundedBoxGeometry } from './mountain-demo/vendor/RoundedBoxGeometry.js';

/* Case-study scenes. Two small THREE.js stages share one renderer setup:
   - "slots": game cartridges on the index, kept in step with the save-slot list
   - "flow":  files streaming from SMB/NFS shares into Nutanix Files
   Each pauses off screen, renders a single still frame under reduced motion,
   and falls back to a line of text if WebGL is unavailable. */

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Save-slot list: one selected slot, moved by hover, focus or the arrow keys.
   Works with or without the 3D scene, which subscribes to changes. */
const slotList = (() => {
  const slots = [...document.querySelectorAll('[data-slot]')];
  const listeners = new Set();
  let selected = 0;
  const select = (index) => {
    selected = Math.max(0, Math.min(slots.length - 1, index));
    slots.forEach((slot, i) => slot.classList.toggle('is-selected', i === selected));
    listeners.forEach((fn) => fn(selected));
  };
  slots.forEach((slot, i) => {
    slot.addEventListener('pointerenter', () => select(i));
    slot.addEventListener('focus', () => select(i));
    slot.addEventListener('keydown', (event) => {
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = (i + step + slots.length) % slots.length;
      select(next);
      slots[next].focus();
    });
  });
  if (slots.length) select(0);
  return { slots, select, get selected() { return selected; }, onChange: (fn) => listeners.add(fn) };
})();

/* Click-to-load video: nothing from YouTube loads until the viewer presses play. */
document.querySelectorAll('[data-video]').forEach((button) => {
  button.addEventListener('click', () => {
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${button.dataset.video}?autoplay=1&rel=0`;
    frame.title = button.dataset.title || 'Video';
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    frame.allowFullscreen = true;
    button.replaceWith(frame);
  }, { once: true });
});

/* ------------------------------------------------------------------ shared */
function createStage(stage, { fov = 32 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 50);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b6e8, 2.6));
  const key = new THREE.DirectionalLight(0xfff3e6, 3.2);
  key.position.set(-3, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.1, far: 20 });
  key.shadow.normalBias = 0.03;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc9c7ff, 1.6);
  rim.position.set(4, 3, -4);
  scene.add(rim);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.12 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();

  return { renderer, scene, camera, floor, resize };
}

/* Runs `tick` only while the stage is on screen and the tab is visible. */
function runLoop(stage, tick, onResize) {
  let visible = true;
  let frame = 0;
  let last = performance.now();

  const step = (now) => {
    frame = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tick(dt, now / 1000);
    if (visible && !document.hidden && !reduced) frame = requestAnimationFrame(step);
  };
  const start = () => {
    if (frame || reduced) return;
    last = performance.now();
    frame = requestAnimationFrame(step);
  };

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    }).observe(stage);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) frame = 0;
    else start();
  });
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      onResize();
      if (reduced || !frame) tick(0, performance.now() / 1000);
    }).observe(stage);
  }

  tick(0, performance.now() / 1000);
  start();
}

const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...extra });

/* -------------------------------------------------------- save-slot carts */
function cartLabel({ num, title, sub, color, locked }) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 448;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = locked ? '#f2f2f5' : '#ffffff';
  ctx.fillRect(0, 0, 512, 448);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 512, 120);
  // Pixel stripes across the colour band.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let x = 0; x < 512; x += 32) ctx.fillRect(x, 96, 16, 8);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 64px ui-monospace, Menlo, monospace';
  ctx.fillText(num, 28, 82);
  ctx.fillStyle = locked ? '#8e8e93' : '#1d1d1f';
  ctx.font = '700 46px Inter, -apple-system, sans-serif';
  title.split('\n').forEach((line, i) => ctx.fillText(line, 28, 196 + i * 56));
  ctx.fillStyle = '#6e6e73';
  ctx.font = '600 28px ui-monospace, Menlo, monospace';
  ctx.fillText(sub, 28, 404);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createSlots(stage) {
  const { renderer, scene, camera, resize } = createStage(stage, { fov: 30 });
  const { slots } = slotList;
  const carts = [];
  const group = new THREE.Group();
  scene.add(group);

  const bodyGeo = new RoundedBoxGeometry(1.2, 1.5, 0.24, 4, 0.07);
  const ridgeGeo = new RoundedBoxGeometry(0.9, 0.05, 0.05, 2, 0.02);
  const labelGeo = new THREE.PlaneGeometry(1.0, 0.875);

  slots.forEach((slot, index) => {
    const locked = slot.classList.contains('is-locked');
    const color = slot.dataset.color || '#5e5ce6';
    const cart = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, material(locked ? '#d1d1d6' : color, locked ? { transparent: true, opacity: 0.7 } : {}));
    body.castShadow = true;
    cart.add(body);

    const label = new THREE.Mesh(labelGeo, new THREE.MeshStandardMaterial({
      map: cartLabel({
        num: slot.dataset.num || String(index + 1).padStart(2, '0'),
        title: slot.dataset.cart || '',
        sub: slot.dataset.sub || '',
        color: locked ? '#aeaeb2' : color,
        locked
      }),
      roughness: 0.8
    }));
    label.position.set(0, 0.17, 0.125);
    cart.add(label);

    for (let r = 0; r < 3; r += 1) {
      const ridge = new THREE.Mesh(ridgeGeo, material(locked ? '#c7c7cc' : new THREE.Color(color).multiplyScalar(0.7)));
      ridge.position.set(0, -0.44 - r * 0.09, 0.125);
      cart.add(ridge);
    }

    cart.userData = { index, href: slot.getAttribute('href'), lift: 0, base: new THREE.Vector3() };
    cart.traverse((child) => { child.userData.cart = cart; });
    group.add(cart);
    carts.push(cart);
  });

  // Fan the cartridges in a shallow arc, like a shelf seen from the couch.
  const layout = () => {
    const narrow = stage.clientWidth < 520;
    const spacing = narrow ? 1.05 : 1.4;
    const mid = (carts.length - 1) / 2;
    carts.forEach((cart, i) => {
      const offset = i - mid;
      cart.userData.base.set(offset * spacing, 0.95, -Math.abs(offset) * 0.35);
      cart.userData.turn = -offset * 0.22;
    });
    // Back the camera off until the whole shelf, plus a lifted cart, fits the width.
    const span = (carts.length - 1) * spacing + 2.2;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const distance = Math.max(6, span / 2 / (halfTan * camera.aspect) + 1);
    camera.position.set(0, 2.0, distance);
    camera.lookAt(0, 0.9, 0);
  };
  layout();

  // The list drives the scene; hovering a cartridge drives the list.
  let selected = slotList.selected;
  slotList.onChange((index) => { selected = index; });
  const select = slotList.select;

  // Hover and click the cartridges themselves.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(9, 9);
  let tiltX = 0;
  let tiltY = 0;
  const hit = () => {
    raycaster.setFromCamera(pointer, camera);
    const found = raycaster.intersectObjects(carts, true)[0];
    return found?.object.userData.cart;
  };
  const aim = (event) => {
    const rect = stage.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  };
  stage.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    aim(event);
    tiltX = pointer.x;
    tiltY = pointer.y;
    const cart = hit();
    stage.style.cursor = cart ? 'pointer' : '';
    if (cart) select(cart.userData.index);
  });
  stage.addEventListener('pointerleave', () => {
    pointer.set(9, 9);
    tiltX = 0;
    tiltY = 0;
  });
  // A tap sends no pointermove first, so aim from the click itself. On touch
  // the first tap picks a cartridge and a second tap on it loads it, the way
  // hover then click works with a mouse.
  stage.addEventListener('click', (event) => {
    aim(event);
    const cart = hit();
    if (!cart) return;
    const touch = !window.matchMedia('(hover: hover)').matches;
    if (touch && cart.userData.index !== selected) {
      select(cart.userData.index);
      return;
    }
    if (cart.userData.href) window.location.href = cart.userData.href;
  });

  let rotX = 0;
  let rotY = 0;
  runLoop(stage, (dt, t) => {
    const ease = reduced ? 1 : 1 - Math.pow(0.0015, dt);
    carts.forEach((cart, i) => {
      const on = i === selected;
      const { base, turn } = cart.userData;
      cart.userData.lift += ((on ? 1 : 0) - cart.userData.lift) * ease;
      const lift = cart.userData.lift;
      const bob = reduced ? 0 : Math.sin(t * 1.6 + i * 1.3) * 0.04;
      cart.position.set(base.x, base.y + lift * 0.42 + bob, base.z + lift * 0.9);
      cart.rotation.set(-0.08 - lift * 0.06, turn * (1 - lift) + (reduced ? 0 : Math.sin(t * 0.9 + i) * 0.03 * (1 - lift)), lift * Math.sin(t * 2.2) * 0.025);
    });
    rotY += (tiltX * 0.12 - rotY) * ease;
    rotX += (-tiltY * 0.05 - rotX) * ease;
    group.rotation.set(rotX, rotY, 0);
    renderer.render(scene, camera);
  }, () => { resize(); layout(); });
}

/* ---------------------------------------------------------------- data flow */
const PHASES = [
  { key: 'copy', seconds: 4.6, rate: 34, color: '#ffffff' },
  { key: 'delta', seconds: 3.8, rate: 6, color: '#7dd3c0' },
  { key: 'cutover', seconds: 2.6, rate: 0, color: '#ffffff' }
];

function createFlow(stage) {
  const { renderer, scene, camera, resize } = createStage(stage, { fov: 30 });
  const steps = [...stage.querySelectorAll('[data-step]')];
  const labels = [...stage.querySelectorAll('[data-anchor]')];

  // A stack of storage slabs with a row of status lights.
  const slabGeo = new RoundedBoxGeometry(1.7, 0.36, 1.2, 3, 0.05);
  const ledGeo = new THREE.BoxGeometry(0.08, 0.05, 0.02);
  const stack = (x, color, ledColor) => {
    const group = new THREE.Group();
    const bodyMat = material(color);
    const ledMat = new THREE.MeshStandardMaterial({ color: ledColor, emissive: ledColor, emissiveIntensity: 0.6 });
    for (let i = 0; i < 3; i += 1) {
      const slab = new THREE.Mesh(slabGeo, bodyMat);
      slab.position.y = 0.2 + i * 0.42;
      slab.castShadow = true;
      group.add(slab);
      for (let l = 0; l < 4; l += 1) {
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(-0.6 + l * 0.14, slab.position.y, 0.61);
        group.add(led);
      }
    }
    group.position.x = x;
    scene.add(group);
    return { group, bodyMat, ledMat };
  };

  const source = stack(-2.7, '#8e8e93', '#34c759');
  const target = stack(2.7, '#5e5ce6', '#ffffff');

  // Move: the control plane hovering over the middle, wired to Files by an API line.
  const move = new THREE.Mesh(new RoundedBoxGeometry(1.25, 0.34, 0.8, 3, 0.08), material('#1d1d1f'));
  move.position.set(0, 2.55, 0);
  move.castShadow = true;
  scene.add(move);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 8, 48), new THREE.MeshStandardMaterial({ color: '#5e5ce6', emissive: '#5e5ce6', emissiveIntensity: 0.8 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.copy(move.position);
  scene.add(ring);

  const apiCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.62, 2.5, 0), new THREE.Vector3(2.3, 2.6, 0), new THREE.Vector3(2.7, 1.42, 0));
  const apiLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(apiCurve.getPoints(32)),
    new THREE.LineDashedMaterial({ color: '#5e5ce6', dashSize: 0.1, gapSize: 0.08 })
  );
  apiLine.computeLineDistances();
  scene.add(apiLine);

  // The data path: packets ride an arc from the source shares into Files.
  const path = new THREE.CubicBezierCurve3(
    new THREE.Vector3(-2.7, 1.05, 0.2),
    new THREE.Vector3(-1.2, 1.9, 0.6),
    new THREE.Vector3(1.2, 1.9, 0.6),
    new THREE.Vector3(2.7, 1.05, 0.2)
  );
  const trail = new THREE.Mesh(
    new THREE.TubeGeometry(path, 64, 0.012, 6, false),
    new THREE.MeshBasicMaterial({ color: '#c7c6f5', transparent: true, opacity: 0.7 })
  );
  scene.add(trail);

  const MAX = 90;
  const packets = new THREE.InstancedMesh(
    new RoundedBoxGeometry(0.14, 0.14, 0.14, 2, 0.03),
    new THREE.MeshStandardMaterial({ roughness: 0.4 }),
    MAX
  );
  packets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  packets.castShadow = true;
  scene.add(packets);
  const live = Array.from({ length: MAX }, () => ({ t: -1, speed: 0, jitter: 0, color: new THREE.Color() }));
  const dummy = new THREE.Object3D();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < MAX; i += 1) {
    packets.setMatrixAt(i, hidden);
    packets.setColorAt(i, new THREE.Color('#ffffff'));
  }

  const spawn = (color) => {
    const slot = live.find((p) => p.t < 0);
    if (!slot) return;
    slot.t = 0;
    slot.speed = 0.32 + Math.random() * 0.12;
    slot.jitter = (Math.random() - 0.5) * 0.35;
    slot.color.set(color);
  };

  const layout = () => {
    // Fit both storage stacks, with room for their labels, inside the width.
    const span = 9.4;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const distance = Math.max(9.2, span / 2 / (halfTan * camera.aspect));
    camera.position.set(0, 3.1, distance);
    camera.lookAt(0, 1.3, 0);
  };
  layout();

  const anchorPoints = {
    source: new THREE.Vector3(-2.7, 1.6, 0.6),
    target: new THREE.Vector3(2.7, 1.6, 0.6),
    move: new THREE.Vector3(0, 2.95, 0)
  };
  const projected = new THREE.Vector3();
  const placeLabels = () => {
    const { clientWidth: w, clientHeight: h } = stage;
    labels.forEach((label) => {
      const point = anchorPoints[label.dataset.anchor];
      if (!point) return;
      projected.copy(point).project(camera);
      // Keep each label fully inside the stage on narrow screens.
      const half = label.offsetWidth / 2 + 8;
      const x = Math.min(w - half, Math.max(half, ((projected.x + 1) / 2) * w));
      label.style.left = `${x}px`;
      label.style.top = `${((1 - projected.y) / 2) * h - 6}px`;
    });
  };

  const total = PHASES.reduce((sum, phase) => sum + phase.seconds, 0);
  let clock = reduced ? 1.8 : 0;
  let carry = 0;
  let current = -1;

  const showPhase = (index) => {
    if (index === current) return;
    current = index;
    steps.forEach((step) => step.classList.toggle('is-on', step.dataset.step === PHASES[index].key));
  };

  // Reduced motion: lay out a frozen mid-copy stream once.
  if (reduced) {
    for (let i = 0; i < 14; i += 1) {
      spawn(PHASES[0].color);
      live[i].t = i / 14;
    }
  }

  const tint = new THREE.Color();
  const dimSource = new THREE.Color('#8e8e93');
  const lightSource = new THREE.Color('#d1d1d6');

  runLoop(stage, (dt, t) => {
    clock = (clock + dt) % total;
    let acc = 0;
    let index = 0;
    for (; index < PHASES.length; index += 1) {
      if (clock < acc + PHASES[index].seconds) break;
      acc += PHASES[index].seconds;
    }
    index = Math.min(index, PHASES.length - 1);
    const phase = PHASES[index];
    const within = (clock - acc) / phase.seconds;
    showPhase(index);

    carry += phase.rate * dt;
    while (carry >= 1) {
      spawn(phase.color);
      carry -= 1;
    }

    live.forEach((p, i) => {
      if (p.t < 0) return;
      p.t += p.speed * dt;
      if (p.t >= 1) {
        p.t = -1;
        packets.setMatrixAt(i, hidden);
        return;
      }
      path.getPoint(p.t, dummy.position);
      dummy.position.z += p.jitter;
      dummy.rotation.set(p.t * 6, p.t * 4, 0);
      const s = Math.sin(Math.PI * p.t) * 0.6 + 0.4;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      packets.setMatrixAt(i, dummy.matrix);
      packets.setColorAt(i, p.color);
    });
    packets.instanceMatrix.needsUpdate = true;
    if (packets.instanceColor) packets.instanceColor.needsUpdate = true;

    // Cutover: the source fades out and Files lights up as the new home.
    const cut = phase.key === 'cutover' ? Math.sin(Math.PI * Math.min(1, within * 1.4)) : 0;
    const gone = phase.key === 'cutover' ? Math.min(1, within * 2) : 0;
    source.bodyMat.color.copy(tint.copy(dimSource).lerp(lightSource, gone));
    source.ledMat.emissiveIntensity = 0.6 * (1 - gone);
    target.ledMat.emissiveIntensity = 0.6 + cut * 2.2;
    target.bodyMat.emissive.set('#5e5ce6');
    target.bodyMat.emissiveIntensity = cut * 0.35;

    ring.rotation.z = t * 0.8;
    ring.scale.setScalar(1 + Math.sin(t * 2) * 0.04);

    renderer.render(scene, camera);
    placeLabels();
  }, () => { resize(); layout(); });
}

/* ------------------------------------------------------- rolling conversion
   An in-place ESXi-to-AHV conversion on a three-node cluster. The workloads
   (coloured cubes) never change; only the hypervisor under them does. Each
   node in turn is emptied, reimaged with AHV and brought back, and the VMs
   are converted onto AHV as they land on it. */
const E = 'esxi';
const A = 'ahv';
const D = 'down';
const ROLLING = [
  { step: 'start', caption: 'A 3-node cluster running on VMware ESXi', vms: [0, 0, 1, 1, 2, 2], tags: 'eeeeee', nodes: [E, E, E] },
  { step: 'evacuate', caption: 'Node 1: its VMs move to the other nodes', vms: [1, 2, 1, 1, 2, 2], tags: 'eeeeee', nodes: [E, E, E] },
  { step: 'reimage', caption: 'Node 1: brought down and reimaged', vms: [1, 2, 1, 1, 2, 2], tags: 'eeeeee', nodes: [D, E, E] },
  { step: 'reimage', caption: 'Node 1: back up on AHV', vms: [1, 2, 1, 1, 2, 2], tags: 'eeeeee', nodes: [A, E, E] },
  { step: 'convert', caption: 'VMs convert onto AHV as the load rebalances', vms: [0, 0, 1, 1, 2, 2], tags: 'aaeeee', nodes: [A, E, E] },
  { step: 'evacuate', caption: 'Node 2: its VMs move to the spare ESXi node', vms: [0, 0, 2, 2, 2, 2], tags: 'aaeeee', nodes: [A, E, E] },
  { step: 'reimage', caption: 'Node 2: brought down and reimaged', vms: [0, 0, 2, 2, 2, 2], tags: 'aaeeee', nodes: [A, D, E] },
  { step: 'reimage', caption: 'Node 2: back up on AHV', vms: [0, 0, 2, 2, 2, 2], tags: 'aaeeee', nodes: [A, A, E] },
  { step: 'convert', caption: 'Those VMs convert onto AHV', vms: [0, 0, 1, 1, 2, 2], tags: 'aaaaee', nodes: [A, A, E] },
  { step: 'convert', caption: 'Node 3: its last VMs convert onto AHV', vms: [0, 0, 1, 1, 0, 1], tags: 'aaaaaa', nodes: [A, A, E] },
  { step: 'reimage', caption: 'Node 3: brought down and reimaged', vms: [0, 0, 1, 1, 0, 1], tags: 'aaaaaa', nodes: [A, A, D] },
  { step: 'reimage', caption: 'Node 3: back up on AHV', vms: [0, 0, 1, 1, 0, 1], tags: 'aaaaaa', nodes: [A, A, A] },
  { step: 'done', caption: 'Same workloads, now all on AHV', vms: [0, 0, 1, 1, 2, 2], tags: 'aaaaaa', nodes: [A, A, A] }
];
const VM_COLORS = ['#ff9f0a', '#30b0c7', '#ff375f', '#34c759', '#bf5af2', '#ffd60a'];
const HYPERVISOR = { esxi: new THREE.Color('#8e8e93'), ahv: new THREE.Color('#5e5ce6'), down: new THREE.Color('#d1d1d6') };

function createRolling(stage) {
  const { renderer, scene, camera, resize } = createStage(stage, { fov: 30 });
  const steps = [...stage.querySelectorAll('[data-step]')];
  const caption = stage.querySelector('[data-caption]');
  const nodeLabels = [...stage.querySelectorAll('[data-node-label]')];
  const vmLabels = [...stage.querySelectorAll('[data-vm-label]')];

  const NODE_X = [-2.5, 0, 2.5];
  const bodyGeo = new RoundedBoxGeometry(2.0, 0.5, 1.5, 3, 0.06);
  const plateGeo = new RoundedBoxGeometry(2.0, 0.12, 1.5, 3, 0.04);
  const nodes = NODE_X.map((x) => {
    const group = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, material('#3a3a3c'));
    body.position.y = 0.25;
    body.castShadow = true;
    const plateMat = material('#8e8e93', { emissive: '#5e5ce6', emissiveIntensity: 0 });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.y = 0.56;
    plate.castShadow = true;
    group.add(body, plate);
    group.position.x = x;
    scene.add(group);
    return { group, plateMat, y: 0, flash: 0, state: E };
  });

  // Up to four VMs sit on a node, in a 2 x 2 grid on its hypervisor plate.
  const SLOTS = [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.35], [0.45, 0.35]];
  const vmGeo = new RoundedBoxGeometry(0.46, 0.46, 0.46, 3, 0.08);
  const tagGeo = new THREE.TorusGeometry(0.3, 0.035, 8, 32);
  const vms = VM_COLORS.map((color) => {
    const group = new THREE.Group();
    const cube = new THREE.Mesh(vmGeo, material(color));
    cube.position.y = 0.23;
    cube.castShadow = true;
    const tagMat = new THREE.MeshStandardMaterial({ color: '#8e8e93', emissive: '#8e8e93', emissiveIntensity: 0.25 });
    const tag = new THREE.Mesh(tagGeo, tagMat);
    tag.rotation.x = Math.PI / 2;
    tag.position.y = 0.02;
    group.add(cube, tag);
    scene.add(group);
    return { group, tagMat, from: new THREE.Vector3(), to: new THREE.Vector3(), tagFrom: new THREE.Color(), tagTo: new THREE.Color() };
  });

  const nodeTop = (state) => (state === D ? -0.45 : 0) + 0.62;
  const placement = (frame) => {
    const counts = [0, 0, 0];
    return frame.vms.map((node) => {
      const [dx, dz] = SLOTS[counts[node]++];
      return new THREE.Vector3(NODE_X[node] + dx, nodeTop(frame.nodes[node]), dz);
    });
  };

  const layout = () => {
    const span = 7.6;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const distance = Math.max(7.2, span / 2 / (halfTan * camera.aspect));
    camera.position.set(0, 3.8, distance);
    camera.lookAt(0, 0.55, 0);
  };
  layout();

  const anchor = new THREE.Vector3();
  const placeLabels = () => {
    const { clientWidth: w, clientHeight: h } = stage;
    nodeLabels.forEach((label, i) => {
      anchor.set(NODE_X[i], nodes[i].y - 0.05, 0.8).project(camera);
      label.style.left = `${((anchor.x + 1) / 2) * w}px`;
      label.style.top = `${((1 - anchor.y) / 2) * h}px`;
    });
    // Each VM's label rides just above its cube, so a workload can be followed.
    vmLabels.forEach((label, i) => {
      anchor.copy(vms[i].group.position);
      anchor.y += 0.55;
      anchor.project(camera);
      label.style.left = `${((anchor.x + 1) / 2) * w}px`;
      label.style.top = `${((1 - anchor.y) / 2) * h}px`;
    });
  };

  const NAMES = { esxi: 'ESXi', ahv: 'AHV', down: 'Reimaging…' };
  const showFrame = (frame) => {
    steps.forEach((step) => step.classList.toggle('is-on', step.dataset.step === frame.step || (frame.step === 'done' && step.dataset.step === 'convert')));
    if (caption) caption.textContent = frame.caption;
    nodeLabels.forEach((label, i) => {
      label.querySelector('b').textContent = NAMES[frame.nodes[i]];
      label.classList.toggle('is-ahv', frame.nodes[i] === A);
      label.classList.toggle('is-down', frame.nodes[i] === D);
    });
  };

  // Each frame: a short move from the previous state, then a hold to read it.
  const MOVE = 1.1;
  const HOLD = 1.0;
  const LAST_HOLD = 2.6;
  let index = 0;
  let clock = 0;
  const begin = (next) => {
    const prev = ROLLING[index];
    index = next;
    const frame = ROLLING[index];
    const fromPos = placement(prev);
    const toPos = placement(frame);
    vms.forEach((vm, i) => {
      vm.from.copy(index === 0 ? toPos[i] : fromPos[i]);
      vm.to.copy(toPos[i]);
      vm.tagFrom.copy(HYPERVISOR[prev.tags[i] === 'a' ? A : E]);
      vm.tagTo.copy(HYPERVISOR[frame.tags[i] === 'a' ? A : E]);
    });
    frame.nodes.forEach((state, i) => {
      if (state === A && prev.nodes[i] === D) nodes[i].flash = 1;
      nodes[i].state = state;
    });
    clock = 0;
    showFrame(frame);
  };

  // Reduced motion: one still frame partway through, with node 1 converted.
  begin(reduced ? 4 : 0);
  if (reduced) clock = MOVE;

  const restart = () => {
    renderer.domElement.style.transition = 'opacity 0.35s';
    renderer.domElement.style.opacity = '0';
    window.setTimeout(() => {
      index = 0;
      begin(0);
      clock = MOVE;
      renderer.domElement.style.opacity = '1';
    }, 380);
  };
  let restarting = false;

  runLoop(stage, (dt) => {
    clock += dt;
    const frame = ROLLING[index];
    const hold = index === ROLLING.length - 1 ? LAST_HOLD : HOLD;
    if (!reduced && clock > MOVE + hold) {
      if (index < ROLLING.length - 1) begin(index + 1);
      else if (!restarting) {
        restarting = true;
        restart();
        window.setTimeout(() => { restarting = false; }, 400);
      }
    }

    const p = Math.min(1, clock / MOVE);
    const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    vms.forEach((vm) => {
      vm.group.position.lerpVectors(vm.from, vm.to, ease);
      const travel = vm.from.distanceTo(vm.to);
      vm.group.position.y += Math.sin(Math.PI * ease) * Math.min(1.2, travel * 0.35);
      vm.tagMat.color.copy(vm.tagFrom).lerp(vm.tagTo, ease);
      vm.tagMat.emissive.copy(vm.tagMat.color);
    });

    nodes.forEach((node, i) => {
      const target = frame.nodes[i] === D ? -0.45 : 0;
      node.y += (target - node.y) * Math.min(1, dt * 6 || 1);
      node.group.position.y = node.y;
      node.plateMat.color.lerp(HYPERVISOR[node.state], Math.min(1, dt * 5 || 1));
      node.flash = Math.max(0, node.flash - dt * 0.8);
      node.plateMat.emissiveIntensity = node.flash * 1.2;
    });

    renderer.render(scene, camera);
    placeLabels();
  }, () => { resize(); layout(); });
}

/* ------------------------------------------------------------- city routing
   A day of home visits on a small city grid, run two ways. Excel era: every
   pair drives back to the office between visits and some orders are missed.
   Logistics Valeo: visits are chained and idle pairs wait at the nearest hub,
   so every order is served with far less driving. Routes follow the streets. */
const ROUTE_ORDERS = [[-3, -3], [-3, 3], [0, -3], [1.5, 1.5], [3, -1.5], [4.5, 3], [6, -3], [6, 1.5]];
const ROUTE_HUBS = [[-1.5, 0], [3, 0], [6, 0]];
const ROUTE_OFFICE = [-6, 0];
const ROUTE_CARS = ['#0f766e', '#ff9f0a', '#5e5ce6', '#ff375f'];
const ROUTE_MODES = [
  {
    key: 'excel', caption: 'Excel era: pairs drive back to the office between visits', km: '60',
    missed: [5, 7],
    plans: [['office', 0, 'office', 1, 'office'], ['office', 2, 'office', 3, 'office'], ['office', 4, 'office'], ['office', 6, 'office']]
  },
  {
    key: 'valeo', caption: 'Logistics Valeo: visits chained, pairs wait at the nearest hub', km: '45',
    missed: [],
    plans: [['h0', 1, 0, 'h0'], ['h0', 2, 3, 'h1'], ['h1', 4, 6, 'h2'], ['h2', 7, 5, 'h2']]
  }
];

function createRoutes(stage) {
  const { renderer, scene, camera, resize } = createStage(stage, { fov: 30 });
  const steps = [...stage.querySelectorAll('[data-step]')];
  const caption = stage.querySelector('[data-caption]');
  const kmOut = stage.querySelector('[data-km]');
  const labels = [...stage.querySelectorAll('[data-anchor]')];

  // City blocks between the streets, which run every 1.5 units.
  const blockGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.06);
  const blockMat = material('#e5e5ea');
  const cells = [];
  for (let x = -6.75; x <= 6.75; x += 1.5) {
    for (let z = -3.75; z <= 3.75; z += 1.5) cells.push([x, z]);
  }
  const blocks = new THREE.InstancedMesh(blockGeo, blockMat, cells.length);
  const dummy = new THREE.Object3D();
  cells.forEach(([x, z], i) => {
    const h = 0.08 + ((Math.sin(x * 12.9 + z * 78.2) * 43758.5) % 1 + 1) % 1 * 0.22;
    dummy.position.set(x, h / 2, z);
    dummy.scale.set(0.95, h, 0.95);
    dummy.updateMatrix();
    blocks.setMatrixAt(i, dummy.matrix);
  });
  blocks.castShadow = true;
  blocks.receiveShadow = true;
  scene.add(blocks);

  const office = new THREE.Mesh(new RoundedBoxGeometry(0.9, 1.6, 0.9, 3, 0.08), material('#1d1d1f'));
  office.position.set(ROUTE_OFFICE[0], 0.8, ROUTE_OFFICE[1]);
  office.castShadow = true;
  scene.add(office);

  const hubMat = material('#0f766e', { emissive: '#0f766e', emissiveIntensity: 0.2 });
  const hubs = ROUTE_HUBS.map(([x, z]) => {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 32), hubMat);
    hub.position.set(x, 0.06, z);
    scene.add(hub);
    return hub;
  });

  const pinGeo = new THREE.SphereGeometry(0.2, 20, 16);
  const pins = ROUTE_ORDERS.map(([x, z]) => {
    const mat = new THREE.MeshStandardMaterial({ color: '#34c759', emissive: '#34c759', emissiveIntensity: 0.3 });
    const pin = new THREE.Mesh(pinGeo, mat);
    pin.position.set(x, 0.45, z);
    pin.castShadow = true;
    scene.add(pin);
    return { pin, mat };
  });

  const point = (stop) => {
    if (stop === 'office') return ROUTE_OFFICE;
    if (typeof stop === 'string') return ROUTE_HUBS[Number(stop.slice(1))];
    return ROUTE_ORDERS[stop];
  };
  // Street routing: along x first, then along z.
  const pathFor = (plan) => {
    const pts = [];
    plan.forEach((stop, i) => {
      const [x, z] = point(stop);
      if (i > 0) {
        const [px] = point(plan[i - 1]);
        pts.push(new THREE.Vector3(x, 0.12, pts[pts.length - 1].z));
        if (px === x) pts.pop();
      }
      pts.push(new THREE.Vector3(x, 0.12, z));
    });
    const lengths = [0];
    for (let i = 1; i < pts.length; i += 1) lengths.push(lengths[i - 1] + pts[i].distanceTo(pts[i - 1]));
    return { pts, lengths, total: lengths[lengths.length - 1] };
  };
  const along = (path, t, out) => {
    const d = t * path.total;
    let i = 1;
    while (i < path.lengths.length - 1 && path.lengths[i] < d) i += 1;
    const span = path.lengths[i] - path.lengths[i - 1] || 1;
    return out.lerpVectors(path.pts[i - 1], path.pts[i], (d - path.lengths[i - 1]) / span);
  };

  const carGeo = new RoundedBoxGeometry(0.5, 0.28, 0.34, 2, 0.07);
  const cars = ROUTE_CARS.map((color) => {
    const car = new THREE.Mesh(carGeo, material(color));
    car.castShadow = true;
    scene.add(car);
    return car;
  });

  let trails = [];
  let paths = [];
  let mode = -1;
  const setMode = (index) => {
    mode = index;
    const m = ROUTE_MODES[index];
    trails.forEach((line) => scene.remove(line));
    paths = m.plans.map(pathFor);
    // Routes as flat tubes along the streets, wide enough to read at a glance.
    trails = paths.map((path, i) => {
      const curve = new THREE.CurvePath();
      for (let k = 1; k < path.pts.length; k += 1) {
        const a = path.pts[k - 1].clone().setY(0.05);
        const b = path.pts[k].clone().setY(0.05);
        if (a.distanceTo(b) > 1e-3) curve.add(new THREE.LineCurve3(a, b));
      }
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(8, curve.curves.length * 8), 0.06, 6, false),
        new THREE.MeshBasicMaterial({ color: m.key === 'excel' ? '#aeaeb2' : ROUTE_CARS[i], transparent: true, opacity: 0.85 })
      );
      scene.add(tube);
      return tube;
    });
    pins.forEach(({ mat }, i) => {
      const missed = m.missed.includes(i);
      mat.color.set(missed ? '#ff3b30' : '#34c759');
      mat.emissive.set(missed ? '#ff3b30' : '#34c759');
    });
    hubMat.opacity = 1;
    hubs.forEach((hub) => { hub.visible = m.key === 'valeo'; });
    steps.forEach((step) => step.classList.toggle('is-on', step.dataset.step === m.key));
    if (caption) caption.textContent = m.caption;
    if (kmOut) kmOut.textContent = m.km;
    labels.forEach((label) => {
      if (label.dataset.anchor.startsWith('hub')) label.hidden = m.key !== 'valeo';
    });
  };

  const layout = () => {
    const span = 15;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const distance = Math.max(12, span / 2 / (halfTan * camera.aspect));
    camera.position.set(0, distance * 0.78, distance * 0.62);
    camera.lookAt(0, 0, 0.3);
  };
  layout();

  const anchors = {
    office: new THREE.Vector3(ROUTE_OFFICE[0], 1.75, ROUTE_OFFICE[1]),
    hub0: new THREE.Vector3(ROUTE_HUBS[0][0], 0.3, ROUTE_HUBS[0][1]),
    hub1: new THREE.Vector3(ROUTE_HUBS[1][0], 0.3, ROUTE_HUBS[1][1]),
    hub2: new THREE.Vector3(ROUTE_HUBS[2][0], 0.3, ROUTE_HUBS[2][1])
  };
  const projected = new THREE.Vector3();
  const placeLabels = () => {
    const { clientWidth: w, clientHeight: h } = stage;
    labels.forEach((label) => {
      const at = anchors[label.dataset.anchor];
      if (!at) return;
      projected.copy(at).project(camera);
      label.style.left = `${((projected.x + 1) / 2) * w}px`;
      label.style.top = `${((1 - projected.y) / 2) * h}px`;
    });
  };

  // Each mode runs one full lap of every route, then the other mode takes over.
  const LAP = 7.5;
  let clock = 0;
  setMode(reduced ? 1 : 0);
  if (reduced) clock = LAP * 0.4;

  runLoop(stage, (dt, t) => {
    clock += dt;
    if (!reduced && clock > LAP) {
      clock = 0;
      setMode((mode + 1) % ROUTE_MODES.length);
    }
    const lap = Math.min(1, clock / LAP);
    cars.forEach((car, i) => {
      const path = paths[i];
      along(path, lap, car.position);
      car.position.y = 0.24;
      const ahead = along(path, Math.min(1, lap + 0.01), projected);
      const dx = ahead.x - car.position.x;
      const dz = ahead.z - car.position.z;
      if (Math.abs(dx) + Math.abs(dz) > 1e-4) car.rotation.y = Math.atan2(-dz, dx);
    });
    pins.forEach(({ pin }, i) => { pin.position.y = 0.45 + Math.sin(t * 2.4 + i) * 0.05; });
    hubMat.emissiveIntensity = 0.2 + Math.sin(t * 2) * 0.12;
    renderer.render(scene, camera);
    placeLabels();
  }, () => { resize(); layout(); });
}

/* ---------------------------------------------------------------- bootstrap
   Last, so every const above is initialised before a scene reads it. */
document.querySelectorAll('[data-arcade-scene]').forEach((stage) => {
  try {
    if (stage.dataset.arcadeScene === 'slots') createSlots(stage);
    else if (stage.dataset.arcadeScene === 'flow') createFlow(stage);
    else if (stage.dataset.arcadeScene === 'rolling') createRolling(stage);
    else if (stage.dataset.arcadeScene === 'routes') createRoutes(stage);
  } catch (error) {
    console.warn('Arcade scene unavailable:', error);
    const fallback = document.createElement('p');
    fallback.className = 'stage-fallback';
    fallback.textContent = stage.dataset.fallback || 'Press start.';
    stage.querySelector('canvas')?.remove();
    stage.append(fallback);
  }
});
