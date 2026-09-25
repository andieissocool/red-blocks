import * as THREE from 'three';
import { BOARD, PALETTE, ROAD } from '../config.js';
import { makeObb } from '../utils/obb.js';

const LINE_WIDTH = 0.08;
const DASH_LENGTH = 0.5;
const DASH_GAP = 0.5;

function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc9c0, 1.4));

  const sun = new THREE.DirectionalLight(0xfff4e8, 2.4);
  sun.position.set(-7, 14, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 12, bottom: -12, near: 1, far: 40 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun);
}

function roundedRect(halfX, halfY, radius) {
  const shape = new THREE.Shape();
  shape.moveTo(-halfX + radius, -halfY);
  shape.lineTo(halfX - radius, -halfY);
  shape.quadraticCurveTo(halfX, -halfY, halfX, -halfY + radius);
  shape.lineTo(halfX, halfY - radius);
  shape.quadraticCurveTo(halfX, halfY, halfX - radius, halfY);
  shape.lineTo(-halfX + radius, halfY);
  shape.quadraticCurveTo(-halfX, halfY, -halfX, halfY - radius);
  shape.lineTo(-halfX, -halfY + radius);
  shape.quadraticCurveTo(-halfX, -halfY, -halfX + radius, -halfY);
  return shape;
}

// Die Platte, auf der das Diorama steht. Oberseite auf y = 0.
function createBoard() {
  const geometry = new THREE.ExtrudeGeometry(roundedRect(BOARD.halfX, BOARD.halfZ, 1.4), {
    depth: 0.6,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.1,
    bevelSegments: 3,
    curveSegments: 16,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -0.7, 0);
  const board = new THREE.Mesh(geometry, [
    new THREE.MeshStandardMaterial({ color: PALETTE.board, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: PALETTE.boardSide, roughness: 1 }),
  ]);
  board.receiveShadow = true;
  return board;
}

function flat(material, width, depth, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2), material);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  return mesh;
}

// Straße quer über die Platte, mit Randlinien und gestrichelter Mittellinie.
function createRoad() {
  const group = new THREE.Group();
  const asphalt = new THREE.MeshStandardMaterial({ color: PALETTE.charcoal, roughness: 0.95 });
  const paint = new THREE.MeshStandardMaterial({ color: PALETTE.white, roughness: 0.8 });
  const length = BOARD.halfX * 2 + 0.2;

  group.add(flat(asphalt, length, ROAD.halfWidth * 2, 0, 0.004, ROAD.z));
  for (const side of [-1, 1]) {
    group.add(flat(paint, length, LINE_WIDTH, 0, 0.008, ROAD.z + side * (ROAD.halfWidth - 0.14)));
  }
  for (let x = -BOARD.halfX + DASH_GAP; x + DASH_LENGTH <= BOARD.halfX; x += DASH_LENGTH + DASH_GAP) {
    group.add(flat(paint, DASH_LENGTH, LINE_WIDTH, x + DASH_LENGTH / 2, 0.008, ROAD.z));
  }
  return group;
}

// Licht, Platte und Straße. Liefert die Flächen, auf die kein Paket abgelegt werden darf.
export function createEnvironment(scene) {
  scene.background = new THREE.Color(PALETTE.sky);
  addLights(scene);
  scene.add(createBoard(), createRoad());
  return { obstacles: [makeObb(0, ROAD.z, BOARD.halfX + 1, ROAD.halfWidth + 0.05, 0)] };
}
