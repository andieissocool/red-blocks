import { BELT, BOARD } from '../config.js';
import { Van } from '../delivery/van.js';
import { makeObb, obbOutlinePoints, obbOverlap } from '../utils/obb.js';
import { clamp, randomRange, wrapAngle } from '../utils/math.js';
import { Package, beltExtents } from './package.js';

const SPAWN_DELAY = [1.0, 2.3]; // Sekunden zwischen zwei neuen Paketen
const MAX_HALF_ALONG = 0.56; // größtmögliche halbe Paketlänge entlang des Bands
const EDGE_MARGIN = 0.06; // Abstand der Pakete zum Gurtrand
const BELT_CLEARANCE = BELT.frameHalfWidth + 0.08; // so weit bleiben Bodenpakete vom Band weg
const BELT_SEARCH_STEP = 0.05;
const GROUND_SEARCH_STEP = 0.12;
const SEARCH_RADIUS = 4;
const NEXT_VAN_DELAY = 1.5; // so lange nach der Abfahrt kommt der nächste Wagen
const START_ON_GROUND = [
  [-4.5, -3.8, 0.3],
  [3.8, -3.5, -0.2],
  [-6.5, 2.4, 0.15],
];

// Überlappen sich zwei Pakete auf dem Band in der Breite, können sie sich nicht überholen.
function overlapsAcross(a, b) {
  return Math.abs(a.offset - b.offset) < a.halfAcross + b.halfAcross;
}

export class PackageManager {
  constructor({ scene, path, doors, obstacles, onDelivered }) {
    this.scene = scene;
    this.path = path;
    this.doors = doors; // Streckenmeter der Türen: { start, end }
    this.obstacles = obstacles; // gedrehte Rechtecke, auf die kein Paket abgelegt werden darf
    this.onDelivered = onDelivered; // wird mit der Gesamtzahl zugestellter Pakete aufgerufen
    this.packages = [];
    this.spawnIn = randomRange(...SPAWN_DELAY);

    this.van = null; // der Wagen, der gerade vorfährt oder parkt
    this.leavingVans = [];
    this.nextVanIn = 0;
    this.delivered = 0;
  }

  // Band vorab füllen und ein paar Pakete daneben legen, damit die Szene nicht leer startet.
  populate() {
    let s = this.doors.end - 0.6;
    while (s > this.doors.start - 0.5) {
      const pkg = this.spawnOnBelt(s);
      s -= pkg.halfAlong + MAX_HALF_ALONG + BELT.gap + randomRange(0.3, 1.3);
    }
    for (const [x, z, yaw] of START_ON_GROUND) {
      const pkg = this.add(new Package());
      pkg.place(this.findGroundSpot(pkg, x, z, yaw));
      pkg.syncVisual(this.path);
    }
  }

  add(pkg) {
    this.packages.push(pkg);
    this.scene.add(pkg.root);
    return pkg;
  }

  remove(pkg) {
    this.packages.splice(this.packages.indexOf(pkg), 1);
    this.scene.remove(pkg.root);
    pkg.dispose();
  }

  // Ohne `s` entsteht das Paket ganz versteckt im linken Haus.
  spawnOnBelt(s) {
    const pkg = this.add(new Package());
    const yawOffset = randomRange(-0.12, 0.12);
    const { halfAlong } = beltExtents(pkg.length, pkg.width, yawOffset);
    pkg.place({ state: 'belt', s: s ?? halfAlong + 0.03, offset: randomRange(-0.08, 0.08), yawOffset });
    pkg.syncVisual(this.path);
    return pkg;
  }

  update(dt) {
    this.advanceBelt(dt);
    this.spawn(dt);
    this.updateVans(dt);
    for (const pkg of this.packages) pkg.update(dt, this.path);
  }

  updateVans(dt) {
    if (!this.van) {
      this.nextVanIn -= dt;
      if (this.nextVanIn <= 0) {
        this.van = new Van();
        this.scene.add(this.van.group);
      }
    }

    if (this.van) {
      this.van.update(dt);
      if (this.van.state === 'leaving') {
        this.delivered += this.van.hold.items.length;
        this.onDelivered?.(this.delivered);
        this.leavingVans.push(this.van);
        this.van = null;
        this.nextVanIn = NEXT_VAN_DELAY;
      }
    }

    for (const van of this.leavingVans) van.update(dt);
    for (const van of this.leavingVans.filter((v) => v.gone)) {
      for (const pkg of this.packages.filter((p) => p.state === 'van' && p.van === van)) this.remove(pkg);
      this.leavingVans.splice(this.leavingVans.indexOf(van), 1);
      this.scene.remove(van.group);
      van.dispose();
    }
  }

  // Von vorne nach hinten: Jedes Paket fährt höchstens bis kurz hinter seinen Vordermann.
  advanceBelt(dt) {
    const onBelt = this.packages.filter((p) => p.state === 'belt').sort((a, b) => b.s - a.s);
    for (let i = 0; i < onBelt.length; i++) {
      const pkg = onBelt[i];
      let limit = this.path.length;
      for (let j = 0; j < i; j++) {
        const ahead = onBelt[j];
        if (!overlapsAcross(pkg, ahead)) continue;
        limit = Math.min(limit, ahead.s - ahead.halfAlong - pkg.halfAlong - BELT.gap);
      }
      pkg.s = Math.min(pkg.s + BELT.speed * dt, Math.max(pkg.s, limit));

      // Ganz im rechten Haus verschwunden.
      if (pkg.s - pkg.halfAlong > this.doors.end + 0.02) this.remove(pkg);
    }
  }

  spawn(dt) {
    this.spawnIn -= dt;
    if (this.spawnIn > 0) return;

    const rearmost = Math.min(
      Infinity,
      ...this.packages.filter((p) => p.state === 'belt').map((p) => p.s - p.halfAlong),
    );
    if (rearmost < MAX_HALF_ALONG * 2 + 0.03 + BELT.gap) return; // noch kein Platz, nächster Frame
    this.spawnOnBelt();
    this.spawnIn = randomRange(...SPAWN_DELAY);
  }

  // Pakete in einem fahrenden Wagen lassen sich nicht greifen.
  pickables() {
    return this.packages.filter((p) => p.state !== 'van' || p.van.loadable).map((p) => p.body);
  }

  vanOccluders() {
    return [this.van, ...this.leavingVans].filter(Boolean).flatMap((van) => van.occluders);
  }

  beginDrag(pkg) {
    if (pkg.state === 'van') this.unload(pkg);
    pkg.startDrag();
  }

  // Aus dem Laderaum nehmen: Was darüber lag, rutscht nach. Passt danach wieder etwas
  // hinein, bleibt der Wagen stehen.
  unload(pkg) {
    const { van } = pkg;
    van.hold.remove(pkg);
    for (const item of van.hold.items) item.pkg.rest = item.rest;
    if (!van.hold.isFull()) van.cancelDeparture();
  }

  drop(pkg) {
    const spot = this.resolveDrop(pkg, pkg.x, pkg.z);
    pkg.place(spot);
    if (spot.state !== 'van') return;
    spot.van.hold.add(pkg, spot.cell);
    if (spot.van.hold.isFull()) spot.van.scheduleDeparture();
  }

  // Wohin landet `pkg`, wenn es bei (x, z) losgelassen wird?
  resolveDrop(pkg, x, z) {
    const vanSpot = this.findVanSpot(pkg, x, z);
    if (vanSpot) return vanSpot;

    const hit = this.path.closest(x, z);
    if (hit.distance <= BELT.halfWidth + BELT.snapTolerance) {
      const spot = this.findBeltSpot(pkg, hit);
      if (spot) return spot;
    }
    return this.findGroundSpot(pkg, x, z, pkg.yaw);
  }

  // Platz im Laderaum des parkenden Wagens. Das Paket liegt dort immer längs,
  // mit der Stirnseite nach vorne oder hinten, je nachdem, was näher an seiner Drehung liegt.
  findVanSpot(pkg, x, z) {
    const { van } = this;
    if (!van?.loadable) return null;
    const local = van.worldToHold(x, z);
    if (!van.isOverHold(local)) return null;
    const cell = van.hold.findSpot(pkg, local.x, local.z);
    if (!cell) return null;
    const yawFlip = Math.abs(wrapAngle(pkg.yaw - van.yaw)) <= Math.PI / 2 ? 0 : Math.PI;
    return { state: 'van', van, cell, holdX: cell.x, holdZ: cell.z, rest: cell.rest, yawFlip };
  }

  // Weltpose eines Ablageplatzes (für die Markierung).
  poseOf(spot) {
    if (spot.state === 'van') {
      const p = spot.van.holdToWorld(spot.holdX, spot.holdZ);
      return { x: p.x, z: p.z, yaw: spot.van.yaw + spot.yawFlip, y: spot.van.floorY + spot.rest };
    }
    if (spot.state !== 'belt') return { x: spot.x, z: spot.z, yaw: spot.yaw, y: 0 };
    const f = this.path.frameAt(spot.s);
    return {
      x: f.x + f.nx * spot.offset,
      z: f.z + f.nz * spot.offset,
      yaw: f.yaw + spot.yawOffset,
      y: BELT.height,
    };
  }

  // Nächste freie Stelle auf dem Band zwischen den Türen. Drehung und seitlicher Versatz
  // bleiben erhalten, soweit das Paket auf den Gurt passt.
  findBeltSpot(pkg, hit) {
    const yawOffset = wrapAngle(pkg.yaw - this.path.frameAt(hit.s).yaw);
    const { halfAlong, halfAcross } = beltExtents(pkg.length, pkg.width, yawOffset);
    const maxOffset = Math.max(0, BELT.halfWidth - EDGE_MARGIN - halfAcross);
    const offset = clamp(hit.offset, -maxOffset, maxOffset);
    const minS = this.doors.start + halfAlong + 0.05;
    const maxS = this.doors.end - halfAlong - 0.05;
    const start = clamp(hit.s, minS, maxS);
    const candidate = { offset, halfAlong, halfAcross };
    const others = this.packages.filter((p) => p !== pkg && p.state === 'belt' && overlapsAcross(candidate, p));

    for (let step = 0; step * BELT_SEARCH_STEP <= SEARCH_RADIUS; step++) {
      for (const direction of step === 0 ? [0] : [-1, 1]) {
        const s = start + direction * step * BELT_SEARCH_STEP;
        if (s < minS || s > maxS) continue;
        const blocked = others.some((o) => Math.abs(s - o.s) < halfAlong + o.halfAlong + BELT.gap);
        if (!blocked) return { state: 'belt', s, offset, yawOffset };
      }
    }
    return null;
  }

  // Sucht in wachsenden Ringen um (x, z) die nächste Stelle, an der das Paket frei liegt.
  findGroundSpot(pkg, x, z, yaw) {
    const blockers = [...this.obstacles];
    for (const other of this.packages) {
      if (other !== pkg && other.state === 'ground') blockers.push(other.footprint());
    }

    for (let r = 0; r <= SEARCH_RADIUS; r += GROUND_SEARCH_STEP) {
      const steps = r === 0 ? 1 : Math.ceil((2 * Math.PI * r) / GROUND_SEARCH_STEP);
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const cx = x + Math.cos(angle) * r;
        const cz = z + Math.sin(angle) * r;
        if (this.isGroundFree(pkg, cx, cz, yaw, blockers)) return { state: 'ground', x: cx, z: cz, yaw };
      }
    }
    return { state: 'ground', x, z, yaw };
  }

  isGroundFree(pkg, x, z, yaw, blockers) {
    const area = makeObb(x, z, pkg.width / 2, pkg.length / 2, yaw);
    const radius = Math.hypot(area.hx, area.hz);
    if (Math.abs(x) + radius > BOARD.halfX - 0.2 || Math.abs(z) + radius > BOARD.halfZ - 0.2) return false;

    // Nicht aufs oder ins Band ragen. Die Umrisspunkte prüfen wir nur, wenn es knapp wird.
    const centerDistance = this.path.closest(x, z).distance;
    if (centerDistance < BELT_CLEARANCE) return false;
    if (centerDistance < BELT_CLEARANCE + radius) {
      for (const [px, pz] of obbOutlinePoints(area)) {
        if (this.path.closest(px, pz).distance < BELT_CLEARANCE) return false;
      }
    }

    return !blockers.some((blocker) => obbOverlap(area, blocker, 0.05));
  }
}
