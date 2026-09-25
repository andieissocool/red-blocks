import * as THREE from 'three';
import { DOOR_DISTANCE, PALETTE } from './config.js';
import { createEnvironment } from './scene/environment.js';
import { createBeltPath } from './conveyor/path.js';
import { createBelt } from './conveyor/belt.js';
import { createHouse } from './conveyor/house.js';
import { PackageManager } from './packages/packageManager.js';
import { DragController } from './interaction/drag.js';

const canvas = document.querySelector('#scene');
const hint = document.querySelector('#hint');
const counter = document.querySelector('#counter');

function showDelivered(count) {
  counter.querySelector('strong').textContent = count;
  counter.querySelector('span').textContent = count === 1 ? 'Paket' : 'Pakete';
  // Kurz aufpoppen lassen: Klasse entfernen, Reflow erzwingen, wieder setzen.
  counter.classList.remove('bump');
  void counter.offsetWidth;
  counter.classList.add('bump');
}

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

// Szene
const scene = new THREE.Scene();
const { obstacles } = createEnvironment(scene);

const path = createBeltPath();
const doors = { start: DOOR_DISTANCE, end: path.length - DOOR_DISTANCE };

const belt = createBelt(path, { doors, maxAnisotropy: renderer.capabilities.getMaxAnisotropy() });
scene.add(belt.group);

const houses = [
  createHouse(path, { end: 'start', wallColor: PALETTE.red, roofColor: PALETTE.black }),
  createHouse(path, { end: 'end', wallColor: PALETTE.black, roofColor: PALETTE.red }),
];
for (const house of houses) scene.add(house.group);

const packages = new PackageManager({
  scene,
  path,
  doors,
  obstacles: [...obstacles, ...houses.map((house) => house.footprint)],
  onDelivered: showDelivered,
});
packages.populate();

// Kamera: fest, schräg von oben, mit Band und Straße im Bild
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
const CAMERA_TARGET = new THREE.Vector3(0, 0.3, 1.5);
const CAMERA_ELEVATION = THREE.MathUtils.degToRad(50);
const VIEW_DIRECTION = new THREE.Vector3(0, Math.sin(CAMERA_ELEVATION), Math.cos(CAMERA_ELEVATION));

const staticOccluders = [...belt.occluders, ...houses.flatMap((house) => house.occluders)];
const drag = new DragController({
  camera,
  element: canvas,
  scene,
  packages,
  occluders: () => [...staticOccluders, ...packages.vanOccluders()],
  onDragStart: () => hint.classList.add('is-hidden'),
});

// Der Abstand wird so gewählt, dass die ganze Strecke samt Häusern ins Bild passt.
function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);

  camera.aspect = width / height;
  const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const halfWidth = camera.aspect < 1 ? 7.8 : 11.6;
  const distance = Math.max(halfWidth / (tanHalfFov * camera.aspect), 5.2 / tanHalfFov);
  camera.position.copy(CAMERA_TARGET).addScaledVector(VIEW_DIRECTION, distance);
  camera.lookAt(CAMERA_TARGET);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Loop
const timer = new THREE.Timer();
timer.connect(document);

renderer.setAnimationLoop((timestamp) => {
  timer.update(timestamp);
  const dt = Math.min(timer.getDelta(), 1 / 20);

  packages.update(dt);
  drag.update();
  belt.update(dt);
  renderer.render(scene, camera);
});
