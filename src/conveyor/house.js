import * as THREE from 'three';
import { HOUSE, PALETTE } from '../config.js';
import { makeObb } from '../utils/obb.js';

const DOOR_HALF_WIDTH = 0.95;
const DOOR_BOTTOM = 0.35;
const DOOR_ARCH_Y = 0.85; // Mittelpunkt des Türbogens
const TRIM_WIDTH = 0.12;
const ROOF_OVERHANG = 0.2;
const ROOF_HEIGHT = 0.9;
const ROOF_THICKNESS = 0.12;

function doorShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-DOOR_HALF_WIDTH, DOOR_BOTTOM);
  shape.lineTo(DOOR_HALF_WIDTH, DOOR_BOTTOM);
  shape.lineTo(DOOR_HALF_WIDTH, DOOR_ARCH_Y);
  shape.absarc(0, DOOR_ARCH_Y, DOOR_HALF_WIDTH, 0, Math.PI, false);
  shape.lineTo(-DOOR_HALF_WIDTH, DOOR_BOTTOM);
  return shape;
}

// U-förmige Zierleiste um den Türbogen.
function trimShape() {
  const outer = DOOR_HALF_WIDTH + TRIM_WIDTH;
  const inner = DOOR_HALF_WIDTH;
  const shape = new THREE.Shape();
  shape.moveTo(-outer, DOOR_BOTTOM);
  shape.lineTo(-outer, DOOR_ARCH_Y);
  shape.absarc(0, DOOR_ARCH_Y, outer, Math.PI, 0, true);
  shape.lineTo(outer, DOOR_BOTTOM);
  shape.lineTo(inner, DOOR_BOTTOM);
  shape.lineTo(inner, DOOR_ARCH_Y);
  shape.absarc(0, DOOR_ARCH_Y, inner, 0, Math.PI, false);
  shape.lineTo(-inner, DOOR_BOTTOM);
  shape.lineTo(-outer, DOOR_BOTTOM);
  return shape;
}

// Giebel in Wandfarbe. Der First läuft quer zum Band, so zeigt ein Giebeldreieck zur Kamera.
function gableGeometry() {
  const half = HOUSE.depth / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(half, 0);
  shape.lineTo(0, ROOF_HEIGHT);
  shape.lineTo(-half, 0);
  const width = HOUSE.halfWidth * 2;
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  geometry.translate(0, 0, -width / 2);
  geometry.rotateY(Math.PI / 2); // Form liegt jetzt in der lokalen z/y-Ebene
  geometry.translate(0, HOUSE.height, 0);
  return geometry;
}

// Zwei Dachplatten auf den Giebelschrägen, mit Überstand an Traufe und Seiten.
function roofSlabs(material) {
  const half = HOUSE.depth / 2;
  const slope = Math.atan2(ROOF_HEIGHT, half);
  const slopeLength = Math.hypot(half, ROOF_HEIGHT);
  // Oben ragen die Platten um ihre Dicke über den First, damit sie sich dort ohne Kerbe treffen.
  const length = slopeLength + ROOF_OVERHANG + ROOF_THICKNESS;
  const geometry = new THREE.BoxGeometry(HOUSE.halfWidth * 2 + ROOF_OVERHANG * 2, ROOF_THICKNESS, length);

  // Richtungen in der lokalen (z, y)-Ebene für die Schräge auf der +z-Seite.
  const [downZ, downY] = [half / slopeLength, -ROOF_HEIGHT / slopeLength]; // First -> Traufe
  const [outZ, outY] = [ROOF_HEIGHT / slopeLength, half / slopeLength]; // Normale nach außen
  const shift = (ROOF_OVERHANG - ROOF_THICKNESS) / 2;
  const centerZ = half / 2 + downZ * shift + outZ * (ROOF_THICKNESS / 2);
  const centerY = HOUSE.height + ROOF_HEIGHT / 2 + downY * shift + outY * (ROOF_THICKNESS / 2);

  return [-1, 1].map((side) => {
    const slab = new THREE.Mesh(geometry, material);
    slab.position.set(0, centerY, side * centerZ);
    slab.rotation.x = side * slope;
    return slab;
  });
}

// Häuschen über einem Bandende. Es ist ein massiver Körper mit dunkler Türöffnung:
// Alles, was im Inneren liegt (Bandende, neue oder verschwindende Pakete), wird verdeckt.
// Lokale z-Achse = Fahrtrichtung, die Tür zeigt zur Bandmitte.
export function createHouse(path, { end, wallColor, roofColor }) {
  const atStart = end === 'start';
  const s = atStart ? HOUSE.depth / 2 - HOUSE.inset : path.length - HOUSE.depth / 2 + HOUSE.inset;
  const doorSign = atStart ? 1 : -1;
  const frame = path.frameAt(s);

  const group = new THREE.Group();
  group.position.set(frame.x, 0, frame.z);
  group.rotation.y = frame.yaw;

  const wallMaterial = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.85 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.8 });
  const whiteMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.white, roughness: 0.7 });
  const darkMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.void });

  const body = new THREE.Mesh(new THREE.BoxGeometry(HOUSE.halfWidth * 2, HOUSE.height, HOUSE.depth), wallMaterial);
  body.position.y = HOUSE.height / 2;

  const gable = new THREE.Mesh(gableGeometry(), wallMaterial);
  const roof = roofSlabs(roofMaterial);

  // Schornstein auf der Dachseite, die von der Tür wegzeigt.
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.26), roofMaterial);
  chimney.position.set(0.45, HOUSE.height + 0.75, -0.42 * doorSign);

  // Tür und Zierleiste sitzen auf der Fassade, die zur Bandmitte zeigt.
  const facade = new THREE.Group();
  facade.position.z = (HOUSE.depth / 2) * doorSign;
  facade.rotation.y = atStart ? 0 : Math.PI;
  const door = new THREE.Mesh(new THREE.ShapeGeometry(doorShape(), 24), darkMaterial);
  door.position.z = 0.004;
  const trim = new THREE.Mesh(
    new THREE.ExtrudeGeometry(trimShape(), { depth: 0.06, bevelEnabled: false, curveSegments: 24 }),
    whiteMaterial,
  );
  facade.add(door, trim);

  // Rundes Fenster auf der Seite, die zur Kamera zeigt.
  const window_ = new THREE.Group();
  window_.position.set(-HOUSE.halfWidth - 0.005, 1.3, 0);
  window_.rotation.y = -Math.PI / 2;
  const windowFrame = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), whiteMaterial);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.26, 24), new THREE.MeshBasicMaterial({ color: PALETTE.charcoal }));
  glass.position.z = 0.003;
  const barMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.white });
  const barH = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.05), barMaterial);
  const barV = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.52), barMaterial);
  barH.position.z = barV.position.z = 0.006;
  window_.add(windowFrame, glass, barH, barV);

  group.add(body, gable, ...roof, chimney, facade, window_);
  group.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = object.material !== darkMaterial;
    object.receiveShadow = true;
  });

  return {
    group,
    occluders: [body, gable, ...roof],
    footprint: makeObb(frame.x, frame.z, HOUSE.halfWidth + 0.1, HOUSE.depth / 2 + 0.1, frame.yaw),
  };
}
