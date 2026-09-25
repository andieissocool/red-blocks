import * as THREE from 'three';
import { HOLD, PALETTE, ROAD } from '../config.js';
import { CargoHold } from './cargo.js';

const YAW = Math.PI / 2; // Fahrtrichtung +x
const PARK_X = -0.6;
const ENTRY_X = -19;
const EXIT_X = 19;
const MAX_SPEED = 7;
const ACCELERATION = 5;
const DEPART_DELAY = 1.2; // Sekunden zwischen "abfahrbereit" und Abfahrt

// Aufbau in lokalen Koordinaten: z nach vorne, x quer (+x = von der Kamera weg).
const FLOOR_Y = 0.55;
const WALL = 0.08;
const WALL_HEIGHT = HOLD.height + 0.1;
const HOLD_CENTER_Z = -0.55; // Laderaum hinten, Fahrerhaus vorne
const HALF_X = CargoHold.halfX + WALL;
const REAR_Z = HOLD_CENTER_Z - CargoHold.halfZ - WALL;
const PARTITION_Z = HOLD_CENTER_Z + CargoHold.halfZ;
const CAB_BACK_Z = PARTITION_Z + WALL;
const CAB_FRONT_Z = CAB_BACK_Z + 1.1;
const CAB_WAIST_Y = 1.1;
const CAB_ROOF_Y = 1.62;
const WHEEL_RADIUS = 0.27;
const HOLD_MARGIN = 0.4; // so weit neben dem Laderaum zählt ein Drop noch als "hinein"

function box(material, [sx, sy, sz], [x, y, z]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(x, y, z);
  return mesh;
}

// Fahrerhaus mit schräger Frontscheibe: Seitenprofil (z, y) quer extrudiert.
function cabinGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(CAB_BACK_Z, CAB_WAIST_Y);
  shape.lineTo(CAB_FRONT_Z - 0.08, CAB_WAIST_Y);
  shape.lineTo(CAB_FRONT_Z - 0.41, CAB_ROOF_Y);
  shape.lineTo(CAB_BACK_Z, CAB_ROOF_Y);
  shape.lineTo(CAB_BACK_Z, CAB_WAIST_Y);
  const width = HALF_X * 2 - 0.04;
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  geometry.translate(0, 0, -width / 2);
  geometry.rotateY(-Math.PI / 2); // Profil-x wird lokales z
  return geometry;
}

function buildModel() {
  const red = new THREE.MeshStandardMaterial({ color: PALETTE.red, roughness: 0.55 });
  const black = new THREE.MeshStandardMaterial({ color: PALETTE.black, roughness: 0.7 });
  const floor = new THREE.MeshStandardMaterial({ color: PALETTE.grey, roughness: 0.9 });
  const white = new THREE.MeshStandardMaterial({ color: PALETTE.white, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: PALETTE.charcoal, roughness: 0.2 });

  const group = new THREE.Group();
  const length = CAB_FRONT_Z - REAR_Z;
  const midZ = (CAB_FRONT_Z + REAR_Z) / 2;

  // Unterbau und Ladeboden
  const chassis = box(black, [HALF_X * 2 - 0.1, 0.12, length - 0.1], [0, 0.36, midZ]);
  const base = box(red, [HALF_X * 2, FLOOR_Y - 0.425, length], [0, (0.42 + FLOOR_Y - 0.005) / 2, midZ]);
  const floorPlate = box(floor, [CargoHold.halfX * 2, 0.02, CargoHold.halfZ * 2], [0, FLOOR_Y - 0.01, HOLD_CENTER_Z]);

  // Laderaum: hohe Wände hinten, gegenüber und zum Fahrerhaus; zur Kamera nur eine niedrige Kante.
  const wallY = FLOOR_Y + WALL_HEIGHT / 2;
  const farWall = box(red, [WALL, WALL_HEIGHT, CargoHold.halfZ * 2 + WALL * 2], [CargoHold.halfX + WALL / 2, wallY, HOLD_CENTER_Z]);
  const rearWall = box(red, [HALF_X * 2, WALL_HEIGHT, WALL], [0, wallY, REAR_Z + WALL / 2]);
  const partition = box(red, [HALF_X * 2, WALL_HEIGHT, WALL], [0, wallY, PARTITION_Z + WALL / 2]);
  const sill = box(red, [WALL, 0.14, CargoHold.halfZ * 2], [-CargoHold.halfX - WALL / 2, FLOOR_Y + 0.07, HOLD_CENTER_Z]);
  const rimY = FLOOR_Y + WALL_HEIGHT + 0.02;
  const farRim = box(black, [WALL + 0.02, 0.04, CargoHold.halfZ * 2 + WALL * 2 + 0.02], [CargoHold.halfX + WALL / 2, rimY, HOLD_CENTER_Z]);
  const rearRim = box(black, [HALF_X * 2 + 0.02, 0.04, WALL + 0.02], [0, rimY, REAR_Z + WALL / 2]);
  // Ersetzt die Heckwand, wenn die Kamera von hinten in den Laderaum schaut.
  const rearSill = box(red, [HALF_X * 2, 0.14, WALL], [0, FLOOR_Y + 0.07, REAR_Z + WALL / 2]);
  rearSill.visible = false;

  // Fahrerhaus
  const cabLower = box(red, [HALF_X * 2, CAB_WAIST_Y - 0.42, CAB_FRONT_Z - CAB_BACK_Z], [0, (CAB_WAIST_Y + 0.42) / 2, (CAB_FRONT_Z + CAB_BACK_Z) / 2]);
  const cabin = new THREE.Mesh(cabinGeometry(), red);

  const slantZ = [CAB_FRONT_Z - 0.08, CAB_FRONT_Z - 0.41];
  const slantLength = Math.hypot(slantZ[0] - slantZ[1], CAB_ROOF_Y - CAB_WAIST_Y);
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(HALF_X * 2 - 0.2, slantLength * 0.78), glass);
  const tilt = Math.atan2(slantZ[0] - slantZ[1], CAB_ROOF_Y - CAB_WAIST_Y); // Neigung gegen die Senkrechte
  windshield.rotation.x = -tilt;
  windshield.position.set(
    0,
    (CAB_WAIST_Y + CAB_ROOF_Y) / 2 + Math.sin(tilt) * 0.006,
    (slantZ[0] + slantZ[1]) / 2 + Math.cos(tilt) * 0.006,
  );

  const sideShape = new THREE.Shape();
  sideShape.moveTo(CAB_BACK_Z + 0.09, CAB_WAIST_Y + 0.06);
  sideShape.lineTo(CAB_FRONT_Z - 0.2, CAB_WAIST_Y + 0.06);
  sideShape.lineTo(CAB_FRONT_Z - 0.46, CAB_ROOF_Y - 0.06);
  sideShape.lineTo(CAB_BACK_Z + 0.09, CAB_ROOF_Y - 0.06);
  const sideWindow = new THREE.Mesh(new THREE.ShapeGeometry(sideShape), glass);
  sideWindow.rotation.y = -Math.PI / 2;
  sideWindow.position.x = -(HALF_X - 0.02) - 0.006;

  const grille = box(black, [1.0, 0.28, 0.04], [0, 0.72, CAB_FRONT_Z + 0.02]);
  const headlights = [-1, 1].map((side) => box(white, [0.2, 0.12, 0.04], [side * 0.5, 0.93, CAB_FRONT_Z + 0.02]));
  const bumpers = [CAB_FRONT_Z + 0.05, REAR_Z - 0.05].map((z) => box(black, [HALF_X * 2 + 0.04, 0.14, 0.12], [0, 0.45, z]));

  // Räder
  const tire = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.22, 16).rotateZ(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(0.11, 0.11, 0.24, 10).rotateZ(Math.PI / 2);
  const wheels = [];
  for (const z of [REAR_Z + 0.55, CAB_FRONT_Z - 0.45]) {
    for (const side of [-1, 1]) {
      const wheel = new THREE.Group();
      wheel.add(new THREE.Mesh(tire, black), new THREE.Mesh(hub, floor));
      wheel.position.set(side * (HALF_X - 0.08), WHEEL_RADIUS, z);
      wheels.push(wheel);
    }
  }

  group.add(
    chassis, base, floorPlate, farWall, rearWall, partition, sill, farRim, rearRim, rearSill,
    cabLower, cabin, windshield, sideWindow, grille, ...headlights, ...bumpers, ...wheels,
  );
  group.traverse((object) => {
    if (object.isMesh) object.castShadow = object.receiveShadow = true;
  });

  return {
    group,
    wheels,
    rear: { wall: rearWall, rim: rearRim, sill: rearSill },
    occluders: [base, farWall, rearWall, partition, cabLower, cabin],
  };
}

// Lieferwagen auf der Straße. Fährt von links vor, parkt, und fährt nach rechts ab,
// sobald er gut gefüllt ist. Der Laderaum (`hold`) verwaltet das Raster.
export class Van {
  constructor() {
    this.hold = new CargoHold();
    this.yaw = YAW;
    this.floorY = FLOOR_Y;
    this.x = ENTRY_X;
    this.speed = 0;
    this.state = 'arriving'; // 'arriving' | 'parked' | 'leaving'
    this.departIn = null;

    const model = buildModel();
    this.group = model.group;
    this.wheels = model.wheels;
    this.rear = model.rear;
    this.walls = model.occluders;
    this.group.rotation.y = YAW;
    this.group.position.set(this.x, 0, ROAD.z);
  }

  // Ausgeblendete Wände verdecken nichts, der Raycaster würde sie aber trotzdem treffen.
  get occluders() {
    return this.walls.filter((mesh) => mesh.visible);
  }

  // Schaut die Kamera von hinten in den Laderaum, wird die Heckwand zur niedrigen Kante.
  setOpenRear(open) {
    this.rear.wall.visible = this.rear.rim.visible = !open;
    this.rear.sill.visible = open;
  }

  get moving() {
    return this.state !== 'parked';
  }

  get loadable() {
    return this.state === 'parked';
  }

  get gone() {
    return this.state === 'leaving' && this.x > EXIT_X;
  }

  // Laderaum-Koordinaten (Mitte = 0, Höhe ab Ladeboden) <-> Welt.
  holdToWorld(lx, lz) {
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    const z = HOLD_CENTER_Z + lz;
    return { x: this.x + lx * cos + z * sin, z: ROAD.z - lx * sin + z * cos };
  }

  worldToHold(x, z) {
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    const dx = x - this.x;
    const dz = z - ROAD.z;
    return { x: dx * cos - dz * sin, z: dx * sin + dz * cos - HOLD_CENTER_Z };
  }

  isOverHold({ x, z }) {
    return Math.abs(x) <= CargoHold.halfX + HOLD_MARGIN && Math.abs(z) <= CargoHold.halfZ + HOLD_MARGIN;
  }

  scheduleDeparture() {
    this.departIn ??= DEPART_DELAY;
  }

  cancelDeparture() {
    this.departIn = null;
  }

  update(dt) {
    const before = this.x;
    if (this.state === 'arriving') {
      // Bremst kurz vor dem Parkplatz sanft ab.
      const speed = Math.min(MAX_SPEED, 0.4 + (PARK_X - this.x) * 1.8);
      this.x = Math.min(PARK_X, this.x + speed * dt);
      if (PARK_X - this.x < 0.005) {
        this.x = PARK_X;
        this.state = 'parked';
      }
    } else if (this.state === 'parked' && this.departIn !== null) {
      this.departIn -= dt;
      if (this.departIn <= 0) this.state = 'leaving';
    } else if (this.state === 'leaving') {
      this.speed = Math.min(MAX_SPEED, this.speed + ACCELERATION * dt);
      this.x += this.speed * dt;
    }

    for (const wheel of this.wheels) wheel.rotation.x += (this.x - before) / WHEEL_RADIUS;
    this.group.position.x = this.x;
  }

  dispose() {
    this.group.traverse((object) => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      object.material.dispose();
    });
  }
}
