import * as THREE from 'three';
import { BELT, PALETTE } from '../config.js';

const SEGMENT_LENGTH = 0.08;
const RIB_LENGTH = 0.32; // Abstand der Rillen auf dem Gurt
const BELT_THICKNESS = 0.06;
const FRAME_TOP = BELT.height - 0.015;
const FRAME_BOTTOM = BELT.height - 0.3;
const RAIL_OFFSET = 0.83;
const RAIL_Y = FRAME_TOP + 0.03;
const RAIL_RADIUS = 0.05;
const LEG_SPACING = 2.3;
const LEG_OFFSET = 0.68;

function createRibTexture(maxAnisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#232327';
  ctx.fillRect(0, 0, 4, 64);
  ctx.fillStyle = '#303036';
  ctx.fillRect(0, 0, 4, 22);
  ctx.fillStyle = '#3c3c43';
  ctx.fillRect(0, 0, 4, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

// Quader, der der Strecke folgt. Gruppe 0 ist die Oberseite (mit Textur-Koordinaten
// entlang der Strecke), Gruppe 1 sind Seiten und Unterseite.
function buildSlab(path, { halfWidth, top, bottom }) {
  const segments = Math.ceil(path.length / SEGMENT_LENGTH);
  const frames = [];
  for (let i = 0; i <= segments; i++) frames.push(path.frameAt((i / segments) * path.length));

  const edge = (f, side, y) => [f.x + f.nx * halfWidth * side, y, f.z + f.nz * halfWidth * side];
  const positions = [];
  const uvs = [];
  const indices = [];

  // Streifen zwischen zwei Längskanten. Die Fläche zeigt nach (b - a) x Fahrtrichtung.
  function strip(a, b, textured) {
    const base = positions.length / 3;
    for (const f of frames) {
      positions.push(...a(f), ...b(f));
      const v = textured ? f.s / RIB_LENGTH : 0;
      uvs.push(0, v, 1, v);
    }
    for (let i = 0; i < segments; i++) {
      const a0 = base + i * 2;
      indices.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2);
    }
  }

  strip((f) => edge(f, 1, top), (f) => edge(f, -1, top), true);
  const topCount = indices.length;
  strip((f) => edge(f, -1, top), (f) => edge(f, -1, bottom));
  strip((f) => edge(f, -1, bottom), (f) => edge(f, 1, bottom));
  strip((f) => edge(f, 1, bottom), (f) => edge(f, 1, top));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.addGroup(0, topCount, 0);
  geometry.addGroup(topCount, indices.length - topCount, 1);
  return geometry;
}

function buildRail(path, side) {
  const points = [];
  const count = Math.ceil(path.length / 0.2);
  for (let i = 0; i <= count; i++) {
    const f = path.frameAt((i / count) * path.length);
    points.push(new THREE.Vector3(f.x + f.nx * RAIL_OFFSET * side, RAIL_Y, f.z + f.nz * RAIL_OFFSET * side));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), count * 3, RAIL_RADIUS, 8, false);
}

// Gurt mit laufenden Rillen, Rahmen, Handläufe und Beine.
// Die Beine stehen nur zwischen den Türen, im Inneren der Häuser sieht man sie ohnehin nicht.
export function createBelt(path, { doors, maxAnisotropy }) {
  const group = new THREE.Group();
  const ribs = createRibTexture(maxAnisotropy);

  const rubber = new THREE.MeshStandardMaterial({ color: PALETTE.black, roughness: 0.95 });
  const beltTop = new THREE.MeshStandardMaterial({ map: ribs, roughness: 0.95 });
  const frameMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.red, roughness: 0.6 });
  const railMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.grey, roughness: 0.5 });
  const legMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.black, roughness: 0.8 });

  const surface = new THREE.Mesh(
    buildSlab(path, { halfWidth: BELT.halfWidth, top: BELT.height, bottom: BELT.height - BELT_THICKNESS }),
    [beltTop, rubber],
  );
  const frame = new THREE.Mesh(
    buildSlab(path, { halfWidth: BELT.frameHalfWidth, top: FRAME_TOP, bottom: FRAME_BOTTOM }),
    [frameMaterial, frameMaterial],
  );
  group.add(surface, frame);
  for (const side of [-1, 1]) group.add(new THREE.Mesh(buildRail(path, side), railMaterial));

  const legGeometry = new THREE.CylinderGeometry(0.055, 0.055, FRAME_BOTTOM, 8);
  legGeometry.translate(0, FRAME_BOTTOM / 2, 0);
  const footGeometry = new THREE.CylinderGeometry(0.11, 0.13, 0.05, 8);
  footGeometry.translate(0, 0.025, 0);

  const from = doors.start + 0.6;
  const to = doors.end - 0.6;
  const legPairs = Math.max(1, Math.round((to - from) / LEG_SPACING));
  for (let i = 0; i <= legPairs; i++) {
    const f = path.frameAt(from + ((to - from) * i) / legPairs);
    for (const side of [-1, 1]) {
      const x = f.x + f.nx * LEG_OFFSET * side;
      const z = f.z + f.nz * LEG_OFFSET * side;
      for (const geometry of [legGeometry, footGeometry]) {
        const mesh = new THREE.Mesh(geometry, legMaterial);
        mesh.position.set(x, 0, z);
        group.add(mesh);
      }
    }
  }

  group.traverse((object) => {
    if (object.isMesh) object.castShadow = object.receiveShadow = true;
  });

  return {
    group,
    occluders: [surface, frame],
    update(dt) {
      // Rillen laufen mit derselben Geschwindigkeit wie die Pakete.
      ribs.offset.y = (ribs.offset.y - (BELT.speed * dt) / RIB_LENGTH) % 1;
    },
  };
}
