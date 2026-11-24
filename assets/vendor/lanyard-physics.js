/* Adapted from the React Bits Lanyard source supplied by the portfolio author.
 * The accompanying React Bits license is in assets/licenses/react-bits-LICENSE.md.
 * Four elastic band joints support a card with orientation and rotational inertia.
 */
import * as THREE from './three-0.170.0.module.min.js';

const JOINTS = 4;
const NODE_WEIGHT = 20;
const MAX_STEP = 1 / 960;
const ITERATIONS = 2;
const scratch = {
  a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(),
  d: new THREE.Vector3(), e: new THREE.Vector3(), f: new THREE.Vector3(),
  g: new THREE.Vector3(), pin: new THREE.Vector3(),
  q: new THREE.Quaternion(), r: new THREE.Quaternion()
};

export function createSimulation() {
  const vectors = () => Array.from({ length: JOINTS + 1 }, () => new THREE.Vector3());
  return {
    nodes: vectors(), previous: vectors(), velocities: vectors(),
    lengths: new Float64Array(JOINTS), impulses: new Float64Array(JOINTS),
    rest: 1, anchor: new THREE.Vector3(),
    body: {
      position: new THREE.Vector3(), previous: new THREE.Vector3(), velocity: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(), previousQuaternion: new THREE.Quaternion(),
      angular: new THREE.Vector3(), mass: 1, inverseInertia: new THREE.Vector3(1, 1, 1),
      hang: new THREE.Vector3()
    },
    grab: null, turn: 0, twist: 0, twistRaw: 0, calm: 0
  };
}

function inverseInertia(body, vector, out) {
  scratch.r.copy(body.quaternion).invert();
  out.copy(vector).applyQuaternion(scratch.r);
  out.set(out.x * body.inverseInertia.x, out.y * body.inverseInertia.y, out.z * body.inverseInertia.z);
  return out.applyQuaternion(body.quaternion);
}

function rotateBody(q, w) {
  const { x, y, z, w: scalar } = q;
  q.x += .5 * (w.x * scalar + w.y * z - w.z * y);
  q.y += .5 * (w.y * scalar + w.z * x - w.x * z);
  q.z += .5 * (w.z * scalar + w.x * y - w.y * x);
  q.w += .5 * (-w.x * x - w.y * y - w.z * z);
  q.normalize();
}

function bodyWeight(body, r, normal) {
  const rn = scratch.c.crossVectors(r, normal);
  return 1 / body.mass + rn.dot(inverseInertia(body, rn, scratch.d));
}

function pushBody(body, r, impulse) {
  body.position.addScaledVector(impulse, 1 / body.mass);
  rotateBody(body.quaternion, inverseInertia(body, scratch.e.crossVectors(r, impulse), scratch.f));
}

function solveSegment(sim, index, h, physics) {
  const { nodes, body } = sim;
  const a = nodes[index];
  const wa = index === 0 ? 0 : NODE_WEIGHT;
  const last = index === JOINTS - 1;
  const r = scratch.g;
  let b = nodes[index + 1];
  if (last) {
    r.copy(body.hang).applyQuaternion(body.quaternion);
    b = scratch.b.copy(body.position).add(r);
  }
  const delta = scratch.a.subVectors(b, a);
  const length = delta.length();
  const stretch = length - sim.rest;
  if (stretch <= 0 || length < 1e-9) return;
  const normal = delta.divideScalar(length);
  const wb = last ? bodyWeight(body, r, normal) : NODE_WEIGHT;
  const rate = (length - sim.lengths[index]) / h;
  const tension = physics.hold * Math.tanh(physics.stiffness * stretch / physics.hold)
    + physics.spring * stretch + physics.bandDamping * Math.max(0, rate);
  const room = tension * h * h - sim.impulses[index];
  if (room <= 0) return;
  const lambda = Math.min(stretch / (wa + wb), room);
  sim.impulses[index] += lambda;
  if (wa) a.addScaledVector(normal, lambda * wa);
  if (last) pushBody(body, r, normal.multiplyScalar(-lambda));
  else b.addScaledVector(normal, -lambda * wb);
}

function solvePin(body, grab, target) {
  const r = scratch.g.copy(grab.local).applyQuaternion(body.quaternion);
  const delta = scratch.a.copy(target).sub(body.position).sub(r);
  const distance = delta.length();
  if (distance < 1e-9) return;
  const normal = delta.divideScalar(distance);
  pushBody(body, r, normal.multiplyScalar(distance / bodyWeight(body, r, normal)));
}

export function configureSimulation(sim, layout, length) {
  sim.rest = length / JOINTS;
  const thickness = .032;
  sim.body.inverseInertia.set(
    12 / (layout.height ** 2 + thickness ** 2),
    12 / (layout.width ** 2 + thickness ** 2),
    12 / (layout.width ** 2 + layout.height ** 2)
  );
  sim.body.hang.set(0, layout.hangY, 0);
}

export function placeHanging(sim, intro = false) {
  const { nodes, previous, velocities, body, anchor } = sim;
  nodes[0].copy(anchor);
  for (let index = 1; index <= JOINTS; index++) {
    nodes[index].copy(nodes[index - 1]);
    if (intro) nodes[index].x += sim.rest;
    else nodes[index].y -= sim.rest;
  }
  body.quaternion.identity();
  if (intro) body.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  body.position.copy(nodes[JOINTS]).sub(scratch.a.copy(body.hang).applyQuaternion(body.quaternion));
  body.previous.copy(body.position);
  body.previousQuaternion.copy(body.quaternion);
  body.velocity.set(0, 0, 0);
  body.angular.set(0, 0, 0);
  nodes.forEach((node, index) => { previous[index].copy(node); velocities[index].set(0, 0, 0); });
  sim.lengths.fill(sim.rest);
  sim.turn = sim.twist = sim.twistRaw = sim.calm = 0;
}

export function stepSimulation(sim, dt, physics, time) {
  const steps = Math.max(1, Math.ceil(dt / MAX_STEP - 1e-6));
  const h = dt / steps;
  const { nodes, previous, velocities, body } = sim;
  const windX = physics.breeze * (Math.sin(time * .53) * .7 + Math.sin(time * 1.31 + 1.7) * .3) * 3;
  const windZ = physics.breeze * Math.sin(time * .37 + .6) * 2;
  const grab = sim.grab;
  for (let step = 0; step < steps; step++) {
    for (let index = 1; index < JOINTS; index++) {
      const v = velocities[index];
      v.y -= physics.gravity * h;
      v.x += windX * h;
      v.z += windZ * h;
      previous[index].copy(nodes[index]);
      nodes[index].addScaledVector(v, h);
    }
    body.previous.copy(body.position);
    body.previousQuaternion.copy(body.quaternion);
    const q = body.quaternion;
    if (grab) {
      const turn = scratch.q.copy(grab.rotation).multiply(scratch.r.copy(q).invert());
      if (turn.w < 0) turn.set(-turn.x, -turn.y, -turn.z, -turn.w);
      const torque = scratch.a.set(turn.x, turn.y, turn.z).multiplyScalar(80).addScaledVector(body.angular, -6);
      body.angular.addScaledVector(inverseInertia(body, torque, scratch.b), h);
    }
    const up = scratch.a.set(0, 1, 0).applyQuaternion(q);
    const front = scratch.b.set(-up.x * up.z, -up.y * up.z, 1 - up.z * up.z);
    if (front.lengthSq() > 1e-3) {
      const facing = scratch.d.set(0, 0, 1).applyQuaternion(q);
      const raw = Math.atan2(scratch.e.crossVectors(front, facing).dot(up), front.dot(facing));
      let turned = raw - sim.twistRaw;
      if (turned > Math.PI) turned -= Math.PI * 2;
      else if (turned < -Math.PI) turned += Math.PI * 2;
      sim.twist += turned;
      sim.twistRaw = raw;
    }
    if (!grab) body.angular.addScaledVector(up, (30 * (sim.turn - sim.twist) - 3 * body.angular.dot(up)) * h);
    body.velocity.y -= physics.gravity * h;
    body.velocity.x += windX * .35 * h;
    body.velocity.z += windZ * .35 * h;
    body.position.addScaledVector(body.velocity, h);
    rotateBody(body.quaternion, scratch.f.copy(body.angular).multiplyScalar(h));

    sim.impulses.fill(0);
    if (grab) scratch.pin.lerpVectors(grab.from, grab.target, (step + 1) / steps);
    for (let iteration = 0; iteration < ITERATIONS; iteration++) {
      for (let index = 0; index < JOINTS; index++) solveSegment(sim, index, h, physics);
      if (grab) solvePin(body, grab, scratch.pin);
    }
    for (let index = 1; index < JOINTS; index++) {
      const v = velocities[index].subVectors(nodes[index], previous[index]).divideScalar(h).multiplyScalar(Math.exp(-2 * h));
      v.multiplyScalar(1 / (1 + .2 * v.length() * h));
    }
    body.velocity.subVectors(body.position, body.previous).divideScalar(h);
    const dq = scratch.q.copy(body.previousQuaternion).invert().premultiply(body.quaternion);
    body.angular.set(dq.x, dq.y, dq.z).multiplyScalar(2 / h * (dq.w < 0 ? -1 : 1));
    const normal = scratch.a.set(0, 0, 1).applyQuaternion(body.quaternion);
    const across = body.velocity.dot(normal);
    const along = scratch.b.copy(body.velocity).addScaledVector(normal, -across);
    along.multiplyScalar(1 / (1 + .15 * along.length() * h));
    body.velocity.copy(along).addScaledVector(normal, across / (1 + .5 * Math.abs(across) * h)).multiplyScalar(Math.exp(-physics.linearDrag * h));
    body.angular.multiplyScalar(Math.exp(-physics.angularDrag * h) / (1 + .03 * body.angular.length() * h));
    if (body.velocity.lengthSq() > 3600) body.velocity.setLength(60);
    if (body.angular.lengthSq() > 1600) body.angular.setLength(40);
    nodes[JOINTS].copy(body.hang).applyQuaternion(body.quaternion).add(body.position);
    for (let index = 0; index < JOINTS; index++) sim.lengths[index] = nodes[index].distanceTo(nodes[index + 1]);
  }
  if (grab) grab.from.copy(grab.target);
  let energy = body.velocity.lengthSq() + body.angular.lengthSq() * .3;
  for (let index = 1; index < JOINTS; index++) energy += velocities[index].lengthSq() * .05;
  sim.calm = energy < 2e-4 ? sim.calm + dt : 0;
}
