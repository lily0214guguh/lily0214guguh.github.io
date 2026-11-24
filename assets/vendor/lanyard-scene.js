/* Rendering and picking adapted from the supplied React Bits Lanyard source.
 * License: assets/licenses/react-bits-LICENSE.md. Local Three.js is MIT licensed.
 */
import { createSimulation, configureSimulation, placeHanging, stepSimulation } from './lanyard-physics.js';

const THICKNESS = .018;
const BEVEL = .007;
const RING_RADIUS = .095;
const EYELET_RADIUS = .036;
const CLAMP_BODY = .15;
const SAMPLES = 72;
const BAND_COLUMNS = [0, .07, .93, 1];
const BAND_BEND = [-.95, -.28, .28, .95];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function roundedRect(shape, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  const k = r * .4477;
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.bezierCurveTo(x + width - k, y, x + width, y + k, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.bezierCurveTo(x + width, y + height - k, x + width - k, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.bezierCurveTo(x + k, y + height, x, y + height - k, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.bezierCurveTo(x, y + k, x + k, y, x + r, y);
}

function buildCard(THREE, layout) {
  const shape = new THREE.Shape();
  roundedRect(shape, -layout.width / 2 + BEVEL, -layout.height / 2 + BEVEL,
    layout.width - BEVEL * 2, layout.height - BEVEL * 2, layout.radius - BEVEL);
  const hole = new THREE.Path();
  roundedRect(hole, -.17 - BEVEL, layout.height / 2 - .165 - BEVEL, .34 + BEVEL * 2, .07 + BEVEL * 2, .035 + BEVEL);
  shape.holes.push(hole);
  const body = new THREE.ExtrudeGeometry(shape, {
    depth: THICKNESS, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL,
    bevelSegments: 5, curveSegments: 24
  });
  body.translate(0, 0, -THICKNESS / 2);
  const face = new THREE.ShapeGeometry(shape, 24);
  const position = face.getAttribute('position');
  const uv = face.getAttribute('uv');
  for (let index = 0; index < position.count; index++) {
    uv.setXY(index, (position.getX(index) + layout.width / 2) / layout.width,
      (position.getY(index) + layout.height / 2) / layout.height);
  }
  uv.needsUpdate = true;
  return { body, face };
}

function buildBand(THREE) {
  const columns = BAND_COLUMNS.length;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SAMPLES * columns * 3), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(SAMPLES * columns * 3), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(SAMPLES * columns * 2), 2));
  const indices = [];
  for (let index = 0; index < SAMPLES - 1; index++) for (let column = 0; column < columns - 1; column++) {
    const a = index * columns + column;
    indices.push(a, a + columns, a + 1, a + 1, a + columns, a + columns + 1);
  }
  geometry.setIndex(indices);
  return geometry;
}

function buildEnvironment(THREE, renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(.035, .035, .04);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const materials = [];
  for (const [intensity, position, scale] of [
    [2.6, [0, 4.5, 8], [9, 4]], [6, [-5.5, .5, 7], [.9, 14]],
    [4, [5, -.5, 8], [.6, 14]], [1.4, [0, 6, -6], [12, 4]], [.5, [0, -7, 1], [16, 6]]
  ]) {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity), side: THREE.DoubleSide });
    materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale, 1);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  }
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(scene, .035);
  generator.dispose();
  geometry.dispose();
  materials.forEach(material => material.dispose());
  return target;
}

function makeFace(THREE, layout, draw, anisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.round(canvas.width * layout.height / layout.width);
  const context = canvas.getContext('2d');
  context.fillStyle = '#faf9f6';
  context.fillRect(0, 0, canvas.width, canvas.height);
  draw(context, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

async function loadImage(url) {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await image.decode();
  return image;
}

export async function createLanyard(THREE, container, { onFlip, onFailure }) {
  const portrait = container.querySelector('.portrait-badge-front img');
  const back = container.querySelector('.portrait-badge-back');
  const [image, logo] = await Promise.all([loadImage(portrait.currentSrc || portrait.src), loadImage(back.querySelector('img').src)]);
  let renderer;
  const resources = [];
  const signal = new AbortController();
  const observers = [];
  let frame = 0;
  const own = resource => { resources.push(resource); return resource; };
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    const canvas = renderer.domElement;
    canvas.className = 'lanyard-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    container.append(canvas);
    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const scene = new THREE.Scene();
    const environment = own(buildEnvironment(THREE, renderer));
    scene.environment = environment.texture;
    const camera = new THREE.PerspectiveCamera(24, 1, .1, 200);
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-2.5, 4, 6);
    const fill = new THREE.DirectionalLight(0xffffff, .35);
    fill.position.set(3, -1, 4);
    scene.add(key, fill);
    const layout = { width: 1.6, height: 2.25, radius: .117, ringY: 1.07, hangY: 1.165 };
    const geometry = buildCard(THREE, layout);
    own(geometry.body); own(geometry.face);
    const frontTexture = own(makeFace(THREE, layout, (context, width, height) => {
      const scale = Math.min(width / image.width, height / image.height);
      const w = image.width * scale, h = image.height * scale;
      context.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
    }, anisotropy));
    const backTexture = own(makeFace(THREE, layout, (context, width, height) => {
      const displayFont = getComputedStyle(back.querySelector('.portrait-back-name')).fontFamily;
      const bodyFont = getComputedStyle(back.querySelector('.portrait-back-role')).fontFamily;
      context.drawImage(logo, width / 2 - 86, height * .27, 172, 172);
      context.textAlign = 'center';
      context.fillStyle = '#282824';
      context.font = '400 115px ' + displayFont;
      context.fillText(back.querySelector('.portrait-back-name').textContent, width / 2, height * .53);
      context.fillStyle = '#69665f';
      context.font = '400 40px ' + bodyFont;
      back.querySelector('.portrait-back-role').innerText.split(/\n/).filter(Boolean).forEach((line, index) => context.fillText(line, width / 2, height * .61 + index * 64));
    }, anisotropy));
    const faceMaterial = texture => own(new THREE.MeshPhysicalMaterial({ map: texture, roughness: .42, metalness: 0, clearcoat: .8, clearcoatRoughness: .08 }));
    const frontMaterial = faceMaterial(frontTexture), backMaterial = faceMaterial(backTexture);
    const edgeMaterial = own(new THREE.MeshPhysicalMaterial({ color: '#ece9e2', roughness: .35, clearcoat: 1 }));
    const metalMaterial = own(new THREE.MeshStandardMaterial({ color: '#d9dce2', roughness: .16, metalness: 1 }));
    const card = new THREE.Group();
    const bodyMesh = new THREE.Mesh(geometry.body, edgeMaterial);
    const frontMesh = new THREE.Mesh(geometry.face, frontMaterial);
    const backMesh = new THREE.Mesh(geometry.face, backMaterial);
    frontMesh.position.z = THICKNESS / 2 + BEVEL + .0006;
    backMesh.position.z = -frontMesh.position.z;
    backMesh.rotation.y = Math.PI;
    const ring = new THREE.Mesh(own(new THREE.TorusGeometry(RING_RADIUS, .0135, 18, 72)), metalMaterial);
    ring.rotation.y = Math.PI / 2 - .7;
    ring.position.y = layout.ringY;
    card.add(bodyMesh, frontMesh, backMesh, ring);
    scene.add(card);

    const bandCanvas = document.createElement('canvas');
    bandCanvas.width = 192; bandCanvas.height = 384;
    const bandContext = bandCanvas.getContext('2d');
    bandContext.fillStyle = '#d01c1f';
    bandContext.fillRect(0, 0, 192, 384);
    bandContext.fillStyle = '#ffffff18';
    for (let y = 0; y < 384; y += 4) bandContext.fillRect(0, y, 192, 1);
    bandContext.fillStyle = '#ffffff50';
    for (let y = 0; y < 384; y += 14) { bandContext.fillRect(14, y, 2, 8); bandContext.fillRect(176, y, 2, 8); }
    const bandTexture = own(new THREE.CanvasTexture(bandCanvas));
    bandTexture.colorSpace = THREE.SRGBColorSpace;
    bandTexture.wrapT = THREE.RepeatWrapping;
    bandTexture.anisotropy = anisotropy;
    const bandGeometry = own(buildBand(THREE));
    const bandMaterial = own(new THREE.MeshPhysicalMaterial({ map: bandTexture, roughness: .85, sheen: 1, sheenRoughness: .5, side: THREE.DoubleSide }));
    const band = new THREE.Mesh(bandGeometry, bandMaterial);
    band.frustumCulled = false;
    scene.add(band);
    const strapWidth = .36 * .65;
    const claspShape = new THREE.Shape();
    roundedRect(claspShape, -strapWidth * .58 + .014, -CLAMP_BODY / 2 + .014, strapWidth * 1.16 - .028, CLAMP_BODY - .028, .024);
    const claspGeometry = own(new THREE.ExtrudeGeometry(claspShape, { depth: .02, bevelEnabled: true, bevelThickness: .014, bevelSize: .014, bevelSegments: 6, curveSegments: 10 }));
    claspGeometry.translate(0, 0, -.01);
    const clasp = new THREE.Mesh(claspGeometry, metalMaterial);
    clasp.position.y = EYELET_RADIUS + CLAMP_BODY / 2 - .004;
    const eyelet = new THREE.Mesh(own(new THREE.TorusGeometry(EYELET_RADIUS, .0105, 14, 40)), metalMaterial);
    const clampGroup = new THREE.Group();
    clampGroup.add(clasp, eyelet);
    scene.add(clampGroup);

    const sim = createSimulation();
    const controls = [];
    const curve = new THREE.CatmullRomCurve3(controls, false, 'centripetal');
    const points = Array.from({ length: SAMPLES }, () => new THREE.Vector3());
    const sides = Array.from({ length: SAMPLES }, () => new THREE.Vector3());
    const mouth = new THREE.Vector3(), tuck = new THREE.Vector3();
    const work = { axis: new THREE.Vector3(), tangent: new THREE.Vector3(), toCamera: new THREE.Vector3(), across: new THREE.Vector3(), facing: new THREE.Vector3(), end: new THREE.Vector3(), basis: new THREE.Matrix4() };
    const physics = { gravity: 40, hold: 154, stiffness: 1600, spring: 40, bandDamping: 30.4, linearDrag: 1.15, angularDrag: 2.15, breeze: .12 };
    let last = performance.now(), time = 0, alive = true, visible = false, placed = false, press = null;
    let previousWidth = 0, previousHeight = 0;
    const header = document.querySelector('.site-header');
    const paused = () => document.hidden || header.classList.contains('menu-open');

    function updateBand() {
      const hang = sim.nodes.at(-1);
      const reach = EYELET_RADIUS + CLAMP_BODY + .05;
      let guide = sim.nodes.length - 2;
      while (guide > 0 && sim.nodes[guide].distanceTo(hang) < reach * 1.1) guide--;
      const axis = work.axis.subVectors(sim.nodes[guide], hang);
      if (axis.lengthSq() < 1e-8) axis.set(0, 1, 0).applyQuaternion(sim.body.quaternion);
      axis.normalize();
      mouth.copy(hang).addScaledVector(axis, reach);
      tuck.copy(hang).addScaledVector(axis, EYELET_RADIUS + CLAMP_BODY * .35);
      controls.length = 0;
      for (let index = 0; index <= guide; index++) controls.push(sim.nodes[index]);
      controls.push(mouth, tuck);
      curve.updateArcLengths();
      for (let index = 0; index < SAMPLES; index++) curve.getPointAt(index / (SAMPLES - 1), points[index]);
      const length = curve.getLength();
      const held = Math.max(.001, 1 - mouth.distanceTo(tuck) / Math.max(length, .001));
      const restLength = sim.rest * (sim.nodes.length - 1);
      const width = strapWidth / Math.max(1, length / Math.max(restLength, .001)) ** .35;
      const position = bandGeometry.getAttribute('position'), normal = bandGeometry.getAttribute('normal'), uv = bandGeometry.getAttribute('uv');
      const { tangent, toCamera, across, facing } = work;
      for (let index = 0; index < SAMPLES; index++) {
        tangent.subVectors(points[Math.min(SAMPLES - 1, index + 1)], points[Math.max(0, index - 1)]);
        if (tangent.lengthSq() < 1e-12) tangent.set(0, -1, 0);
        tangent.normalize();
        toCamera.subVectors(camera.position, points[index]).normalize();
        const side = sides[index].crossVectors(toCamera, tangent);
        if (side.lengthSq() < 1e-10) side.copy(index > 0 ? sides[index - 1] : new THREE.Vector3(1, 0, 0));
        side.normalize();
        if (index > 0 && side.dot(sides[index - 1]) < 0) side.negate();
        const angle = -sim.twist * Math.min(1, index / (SAMPLES - 1) / held) ** 1.3;
        facing.crossVectors(tangent, side);
        across.copy(side).multiplyScalar(Math.cos(angle)).addScaledVector(facing, Math.sin(angle));
        facing.crossVectors(tangent, across);
        const p = points[index];
        for (let column = 0; column < BAND_COLUMNS.length; column++) {
          const offset = (BAND_COLUMNS[column] - .5) * width, k = index * BAND_COLUMNS.length + column;
          const bendCos = Math.cos(BAND_BEND[column]), bendSin = Math.sin(BAND_BEND[column]);
          position.setXYZ(k, p.x + across.x * offset, p.y + across.y * offset, p.z + across.z * offset);
          normal.setXYZ(k, facing.x * bendCos + across.x * bendSin, facing.y * bendCos + across.y * bendSin, facing.z * bendCos + across.z * bendSin);
          uv.setXY(k, BAND_COLUMNS[column], (1 - index / (SAMPLES - 1)) * restLength / (strapWidth * 2));
        }
      }
      work.end.copy(across);
      position.needsUpdate = normal.needsUpdate = uv.needsUpdate = true;
      across.copy(work.end).addScaledVector(axis, -work.end.dot(axis)).normalize();
      facing.crossVectors(across, axis).normalize();
      work.basis.makeBasis(across, axis, facing);
      clampGroup.quaternion.setFromRotationMatrix(work.basis);
      clampGroup.position.copy(hang);
    }

    function render() {
      card.position.copy(sim.body.position);
      card.quaternion.copy(sim.body.quaternion);
      updateBand();
      renderer.render(scene, camera);
    }

    function tick(now) {
      frame = 0;
      if (!alive || !visible || paused()) return;
      const dt = clamp((now - last) / 1000, 1 / 240, 1 / 30);
      last = now; time += dt;
      stepSimulation(sim, dt, physics, time);
      if (!Number.isFinite(sim.body.position.x + sim.body.position.y + sim.body.quaternion.w)) { sim.grab = null; placeHanging(sim); }
      render();
      frame = requestAnimationFrame(tick);
    }

    function start() {
      if (frame || !alive || !visible || paused()) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }

    function release() {
      sim.grab = null; press = null;
      canvas.style.cursor = '';
      container.dataset.dragging = 'false';
    }

    function resize() {
      const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
      if (width === previousWidth && height === previousHeight) return;
      previousWidth = width; previousHeight = height;
      const aspect = width / height;
      let viewHeight = layout.height / .68;
      if (viewHeight * aspect < layout.width / .76) viewHeight = layout.width / .76 / aspect;
      camera.aspect = aspect;
      camera.position.set(0, 0, viewHeight / 2 / Math.tan(24 * Math.PI / 360));
      camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      sim.anchor.set(0, viewHeight / 2 + .2, 0);
      const cardTop = viewHeight / 2 - viewHeight * (.12 + .3 * .28);
      configureSimulation(sim, layout, sim.anchor.y - cardTop - (layout.hangY - layout.height / 2));
      release();
      // Reframe immediately on orientation changes so the badge stays reachable.
      const flipped = sim.turn !== 0;
      placeHanging(sim, !placed);
      if (flipped) {
        sim.body.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
        sim.body.previousQuaternion.copy(sim.body.quaternion);
        sim.turn = sim.twist = sim.twistRaw = Math.PI;
      }
      placed = true;
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
      renderer.setSize(width, height, false);
      render(); start();
    }

    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    function pointAt(event) {
      const rect = canvas.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
    }
    function pick() { card.updateMatrixWorld(); return raycaster.intersectObjects([bodyMesh, frontMesh, backMesh], false)[0]; }
    function grab(event) {
      sim.grab = {
        local: press.point.clone().sub(sim.body.position).applyQuaternion(sim.body.quaternion.clone().invert()),
        rotation: sim.body.quaternion.clone(), reach: press.distance,
        from: press.point.clone(), target: press.point.clone()
      };
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing'; container.dataset.dragging = 'true';
      start();
    }
    function flip() {
      const direction = sim.turn > 0 ? -1 : 1;
      sim.turn = sim.turn === 0 ? Math.PI : 0;
      sim.body.angular.addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(sim.body.quaternion), 9 * direction);
      onFlip(sim.turn !== 0); start();
    }
    canvas.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || paused()) return;
      pointAt(event); const hit = pick();
      if (!hit) return;
      press = { id: event.pointerId, type: event.pointerType, x: event.clientX, y: event.clientY, point: hit.point.clone(), distance: hit.distance, time: performance.now(), moved: false };
      if (event.pointerType !== 'touch') { grab(event); event.preventDefault(); }
    }, { signal: signal.signal });
    canvas.addEventListener('pointermove', event => {
      if (paused()) return;
      pointAt(event);
      if (press && event.pointerId === press.id) {
        const dx = event.clientX - press.x, dy = event.clientY - press.y;
        if (press.type === 'touch' && !sim.grab) {
          if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.2) { release(); return; }
          if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) grab(event);
        }
        if (Math.hypot(dx, dy) > 6) press.moved = true;
        if (sim.grab) { raycaster.ray.at(sim.grab.reach, sim.grab.target); start(); }
      } else if (event.pointerType !== 'touch') canvas.style.cursor = pick() ? 'grab' : '';
    }, { signal: signal.signal });
    function finish(event) {
      if (!press || event.pointerId !== press.id) return;
      const click = event.type === 'pointerup' && !press.moved && performance.now() - press.time < 450;
      release();
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (click) flip();
      start();
    }
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, finish, { signal: signal.signal });
    const resizeObserver = new ResizeObserver(resize);
    observers.push(resizeObserver);
    resizeObserver.observe(container);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else { cancelAnimationFrame(frame); frame = 0; release(); }
    });
    observers.push(intersection);
    intersection.observe(container);
    const pause = () => {
      if (paused()) { cancelAnimationFrame(frame); frame = 0; release(); }
      else start();
    };
    const menuObserver = new MutationObserver(pause);
    observers.push(menuObserver);
    menuObserver.observe(header, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('visibilitychange', pause, { signal: signal.signal });
    window.addEventListener('blur', release, { signal: signal.signal });
    window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); frame = 0; release(); }, { signal: signal.signal });
    window.addEventListener('pageshow', start, { signal: signal.signal });
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); onFailure(); }, { signal: signal.signal });
    resize();
    container.classList.add('is-webgl-ready');
    return {
      flip,
      nudge(direction) { sim.body.velocity.x += 5 * direction; start(); },
      reset() { release(); placeHanging(sim); onFlip(false); render(); start(); },
      dispose() {
        alive = false;
        cancelAnimationFrame(frame);
        signal.abort(); observers.forEach(observer => observer.disconnect());
        resources.forEach(resource => resource.dispose());
        renderer.dispose(); canvas.remove(); container.classList.remove('is-webgl-ready');
      }
    };
  } catch (error) {
    cancelAnimationFrame(frame);
    signal.abort(); observers.forEach(observer => observer.disconnect());
    resources.forEach(resource => resource.dispose());
    renderer?.dispose(); renderer?.domElement.remove();
    throw error;
  }
}
