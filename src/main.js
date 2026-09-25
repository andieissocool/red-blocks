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

// Kamera: fest, schräg von oben, mit Band und Straße im Bild. Im Querformat blickt sie von
// vorne, im Hochformat vom Bandanfang aus: Dann läuft die Strecke von unten nach oben und
// füllt auch einen schmalen Bildschirm.
//   side                 – Richtung vom Blickziel zur Kamera in der Ebene: von vorne (+z) oder vom Bandanfang (-x)
//   halfWidth/halfHeight – was mindestens ins Bild muss, gemessen auf Höhe des Blickziels
const VIEWS = {
  landscape: { fov: 32, elevation: 50, side: [0, 1], target: [0, 0.3, 1.5], halfWidth: 11.6, halfHeight: 5.2 },
  portrait: { fov: 26, elevation: 60, side: [-1, 0], target: [1.0, 0.3, 1.8], halfWidth: 4.4, halfHeight: 9.4 },
};
const camera = new THREE.PerspectiveCamera(VIEWS.landscape.fov, 1, 0.1, 200);

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
  const portrait = camera.aspect < 1;
  const { fov, elevation, side, target, halfWidth, halfHeight } = portrait ? VIEWS.portrait : VIEWS.landscape;
  camera.fov = fov;
  const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  const distance = Math.max(halfWidth / (tanHalfFov * camera.aspect), halfHeight / tanHalfFov);
  const angle = THREE.MathUtils.degToRad(elevation);
  const flat = Math.cos(angle) * distance;
  const [x, y, z] = target;
  camera.position.set(x + side[0] * flat, y + Math.sin(angle) * distance, z + side[1] * flat);
  camera.lookAt(x, y, z);
  camera.updateProjectionMatrix();
  packages.setOpenRear(portrait);
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
