import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BELT, DRAG_HEIGHT, PACKAGE_SIZES, PALETTE } from '../config.js';
import { makeObb } from '../utils/obb.js';
import { clamp, damp, randomItem, randomRange, wrapAngle } from '../utils/math.js';

const CARDBOARD = [0xc99a6b, 0xbd8d5e, 0xd4a878];
const TOTAL_WEIGHT = PACKAGE_SIZES.reduce((sum, size) => sum + size.weight, 0);

const GRAVITY = 22;
const BOUNCE = 0.28;
const FOLLOW_RATE = 18;
const LIFT_RATE = 12;
const TILT_RATE = 10;
const MAX_TILT = 0.3;

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const labelMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.white, roughness: 0.6 });
const tapeMaterials = {
  red: new THREE.MeshStandardMaterial({ color: PALETTE.red, roughness: 0.45 }),
  black: new THREE.MeshStandardMaterial({ color: PALETTE.black, roughness: 0.45 }),
};

function randomSize() {
  let pick = Math.random() * TOTAL_WEIGHT;
  return PACKAGE_SIZES.find((size) => (pick -= size.weight) < 0) ?? PACKAGE_SIZES[0];
}

// Ausdehnung entlang und quer zum Band, wenn das Paket um `yawOffset` gegen die
// Fahrtrichtung verdreht liegt.
export function beltExtents(length, width, yawOffset) {
  const cos = Math.abs(Math.cos(yawOffset));
  const sin = Math.abs(Math.sin(yawOffset));
  return {
    halfAlong: (cos * length + sin * width) / 2,
    halfAcross: (sin * length + cos * width) / 2,
  };
}

// Ein Karton. Er kennt vier Zustände:
//   'belt'   – fährt mit, Position über Streckenmeter `s` und seitlichen Versatz `offset`
//   'drag'   – hängt am Zeiger, Position `x`/`z`
//   'ground' – liegt auf der Platte bei `x`/`z`
//   'van'    – liegt im Laderaum von `van` bei (`holdX`, `holdZ`), `rest` über dem Ladeboden
// Die sichtbare Pose (`vx`, `vz`, `vyaw`, `y`) zieht der logischen weich hinterher.
export class Package {
  constructor() {
    const size = randomSize();
    this.length = size.length; // entlang der lokalen z-Achse
    this.width = size.width; // entlang der lokalen x-Achse
    this.height = size.height;

    this.root = new THREE.Group(); // Position und Neigung
    this.pivot = new THREE.Group(); // Drehung um y
    this.root.add(this.pivot);

    const color = new THREE.Color(randomItem(CARDBOARD));
    color.offsetHSL(0, 0, randomRange(-0.03, 0.03));
    this.material = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    this.body = new THREE.Mesh(
      new RoundedBoxGeometry(this.width, this.height, this.length, 2, 0.035),
      this.material,
    );
    this.body.position.y = this.height / 2;
    this.body.userData.package = this;
    this.pivot.add(this.body);
    this.addTapeAndLabel();

    this.root.traverse((object) => {
      if (object.isMesh) object.castShadow = object.receiveShadow = true;
    });

    this.state = 'ground';
    this.s = 0;
    this.offset = 0;
    this.yawOffset = 0;
    this.halfAlong = 0;
    this.halfAcross = 0;
    this.van = null;
    this.holdX = 0;
    this.holdZ = 0;
    this.rest = 0;
    this.yawFlip = 0;
    this.x = 0;
    this.z = 0;
    this.yaw = 0;

    this.vx = 0;
    this.vz = 0;
    this.vyaw = 0;
    this.y = 0; // Unterkante
    this.vy = 0;
    this.tiltX = 0;
    this.tiltZ = 0;
  }

  addTapeAndLabel() {
    const { width, height, length } = this;
    const tape = Math.random() < 0.6 ? tapeMaterials.red : tapeMaterials.black;
    const add = (material, [sx, sy, sz], [x, y, z]) => {
      const mesh = new THREE.Mesh(unitBox, material);
      mesh.scale.set(sx, sy, sz);
      mesh.position.set(x, y, z);
      this.pivot.add(mesh);
    };

    // Klebeband über den Deckel und ein Stück die Stirnseiten hinunter.
    const tapeWidth = Math.min(0.16, width * 0.3);
    const flap = height * 0.35;
    add(tape, [tapeWidth, 0.012, length - 0.04], [0, height + 0.004, 0]);
    for (const side of [-1, 1]) {
      add(tape, [tapeWidth, flap, 0.012], [0, height - 0.035 - flap / 2, side * (length / 2 + 0.004)]);
    }

    if (width >= 0.62 && Math.random() < 0.7) {
      add(labelMaterial, [0.16, 0.01, 0.12], [width / 2 - 0.13, height + 0.003, length / 2 - 0.13]);
    }
  }

  footprint() {
    return makeObb(this.x, this.z, this.width / 2, this.length / 2, this.yaw);
  }

  // Übernimmt einen Ablageplatz aus PackageManager.resolveDrop().
  place(spot) {
    this.state = spot.state;
    if (spot.state === 'belt') {
      this.s = spot.s;
      this.offset = spot.offset;
      this.yawOffset = spot.yawOffset;
      Object.assign(this, beltExtents(this.length, this.width, spot.yawOffset));
    } else if (spot.state === 'van') {
      this.van = spot.van;
      this.holdX = spot.holdX;
      this.holdZ = spot.holdZ;
      this.rest = spot.rest;
      this.yawFlip = spot.yawFlip;
    } else {
      this.x = spot.x;
      this.z = spot.z;
      this.yaw = spot.yaw;
    }
  }

  startDrag() {
    this.state = 'drag';
    this.x = this.vx;
    this.z = this.vz;
    this.yaw = this.vyaw;
  }

  dragTo(x, z) {
    this.x = x;
    this.z = z;
  }

  supportHeight() {
    if (this.state === 'belt') return BELT.height;
    if (this.state === 'van') return this.van.floorY + this.rest;
    return 0;
  }

  // Auf dem Band ergibt sich die logische Position aus Streckenmeter und Versatz,
  // im Wagen aus dem Platz im Laderaum und der aktuellen Position des Wagens.
  updateTarget(path) {
    if (this.state === 'belt') {
      const f = path.frameAt(this.s);
      this.x = f.x + f.nx * this.offset;
      this.z = f.z + f.nz * this.offset;
      this.yaw = f.yaw + this.yawOffset;
    } else if (this.state === 'van') {
      const p = this.van.holdToWorld(this.holdX, this.holdZ);
      this.x = p.x;
      this.z = p.z;
      this.yaw = this.van.yaw + this.yawFlip;
    }
  }

  // Sichtbare Pose sofort auf die logische setzen (für frisch erzeugte Pakete).
  syncVisual(path) {
    this.updateTarget(path);
    this.vx = this.x;
    this.vz = this.z;
    this.vyaw = this.yaw;
    this.y = this.supportHeight();
    this.vy = 0;
    this.applyTransform();
  }

  update(dt, path) {
    if (dt <= 0) return;
    this.updateTarget(path);

    // Im fahrenden Wagen fest mitfahren, sonst würde das Paket im Laderaum nachrutschen.
    const follow = this.state === 'van' && this.van.moving ? 1 : damp(FOLLOW_RATE, dt);
    const prevX = this.vx;
    const prevZ = this.vz;
    this.vx += (this.x - this.vx) * follow;
    this.vz += (this.z - this.vz) * follow;
    this.vyaw += wrapAngle(this.yaw - this.vyaw) * follow;

    if (this.state === 'drag') {
      this.y += (DRAG_HEIGHT - this.y) * damp(LIFT_RATE, dt);
      this.vy = 0;
    } else {
      this.fall(dt);
    }

    // Beim Tragen neigt sich das Paket leicht in Bewegungsrichtung.
    const dragging = this.state === 'drag';
    const velX = (this.vx - prevX) / dt;
    const velZ = (this.vz - prevZ) / dt;
    const tiltX = dragging ? clamp(velZ * 0.06, -MAX_TILT, MAX_TILT) : 0;
    const tiltZ = dragging ? clamp(-velX * 0.06, -MAX_TILT, MAX_TILT) : 0;
    const tilt = damp(TILT_RATE, dt);
    this.tiltX += (tiltX - this.tiltX) * tilt;
    this.tiltZ += (tiltZ - this.tiltZ) * tilt;

    this.applyTransform();
  }

  fall(dt) {
    const support = this.supportHeight();
    if (this.y < support) {
      // Kurz angeklickt und aufs höhere Band gelegt: weich hochheben statt springen.
      this.y += (support - this.y) * damp(LIFT_RATE * 2, dt);
      if (support - this.y < 0.001) this.y = support;
      this.vy = 0;
      return;
    }
    if (this.y === support && this.vy === 0) return;

    this.vy -= GRAVITY * dt;
    this.y += this.vy * dt;
    if (this.y <= support) {
      this.y = support;
      this.vy = this.vy < -1.5 ? -this.vy * BOUNCE : 0;
    }
  }

  applyTransform() {
    this.root.position.set(this.vx, this.y, this.vz);
    this.root.rotation.set(this.tiltX, 0, this.tiltZ);
    this.pivot.rotation.y = this.vyaw;
  }

  setHighlighted(on) {
    this.material.emissive.setHex(on ? 0x2a1e12 : 0x000000);
  }

  dispose() {
    this.body.geometry.dispose();
    this.material.dispose();
  }
}
