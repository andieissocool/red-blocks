import * as THREE from 'three';
import { BOARD, DRAG_HEIGHT, PALETTE } from '../config.js';
import { clamp } from '../utils/math.js';

const MARKER_LIFT = 0.012;
const MARKER_PADDING = 0.08;

function createMarker() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.roundRect(8, 8, size - 16, size - 16, 22);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  const marker = new THREE.Mesh(geometry, material);
  marker.renderOrder = 1;
  marker.visible = false;
  return marker;
}

// Pakete mit Maus oder Finger greifen, ziehen und ablegen. Während des Ziehens zeigt
// eine Markierung, wo das Paket beim Loslassen landet.
export class DragController {
  constructor({ camera, element, scene, packages, occluders, onDragStart }) {
    this.camera = camera;
    this.element = element;
    this.packages = packages;
    this.occluders = occluders; // liefert, was dahinterliegende Pakete verdeckt (Häuser, Band, Wagen)
    this.onDragStart = onDragStart;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.planeHit = new THREE.Vector3();
    this.active = null;
    this.hovered = null;
    this.mouseInside = false;

    this.marker = createMarker();
    scene.add(this.marker);

    element.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    element.addEventListener('pointermove', (e) => this.onPointerMove(e));
    element.addEventListener('pointerup', (e) => this.onPointerUp(e));
    element.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    element.addEventListener('pointerleave', () => {
      this.mouseInside = false;
      this.setHovered(null);
    });
  }

  setPointer(event) {
    const rect = this.element.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  pick() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = [...this.packages.pickables(), ...this.occluders()];
    const [first] = this.raycaster.intersectObjects(targets, false);
    const pkg = first?.object.userData.package;
    return pkg ? { pkg, point: first.point } : null;
  }

  onPointerDown(event) {
    if (this.active || !event.isPrimary || event.button !== 0) return;
    this.setPointer(event);
    const hit = this.pick();
    if (!hit) return;

    event.preventDefault();
    this.element.setPointerCapture(event.pointerId);
    const { pkg, point } = hit;

    // Die Zeigerebene liegt auf Höhe des Griffpunkts am angehobenen Paket,
    // so bleibt das Paket beim Ziehen genau unter dem Zeiger.
    this.plane.constant = -(DRAG_HEIGHT + (point.y - pkg.y));
    this.active = {
      pkg,
      pointerId: event.pointerId,
      offsetX: pkg.vx - point.x,
      offsetZ: pkg.vz - point.z,
    };
    this.setHovered(null);
    this.packages.beginDrag(pkg);
    this.element.style.cursor = 'grabbing';
    this.onDragStart?.();
  }

  onPointerMove(event) {
    if (event.pointerType === 'mouse') this.mouseInside = true;
    if (this.active) {
      if (event.pointerId !== this.active.pointerId) return;
      this.setPointer(event);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      if (!this.raycaster.ray.intersectPlane(this.plane, this.planeHit)) return;
      const { pkg, offsetX, offsetZ } = this.active;
      pkg.dragTo(
        clamp(this.planeHit.x + offsetX, -BOARD.halfX + 0.4, BOARD.halfX - 0.4),
        clamp(this.planeHit.z + offsetZ, -BOARD.halfZ + 0.4, BOARD.halfZ - 0.4),
      );
      return;
    }
    if (event.pointerType === 'mouse') this.setPointer(event);
  }

  onPointerUp(event) {
    if (!this.active || event.pointerId !== this.active.pointerId) return;
    this.packages.drop(this.active.pkg);
    if (this.element.hasPointerCapture(event.pointerId)) this.element.releasePointerCapture(event.pointerId);
    this.active = null;
    this.marker.visible = false;
    this.element.style.cursor = '';
  }

  setHovered(pkg) {
    if (pkg === this.hovered) return;
    this.hovered?.setHighlighted(false);
    this.hovered = pkg;
    pkg?.setHighlighted(true);
    if (!this.active) this.element.style.cursor = pkg ? 'grab' : '';
  }

  // Einmal pro Frame nach dem Bewegen der Pakete.
  update() {
    if (!this.active) {
      // Auch bei ruhender Maus, denn die Pakete fahren unter ihr hindurch.
      this.setHovered(this.mouseInside ? (this.pick()?.pkg ?? null) : null);
      return;
    }

    const { pkg } = this.active;
    const spot = this.packages.resolveDrop(pkg, pkg.x, pkg.z);
    const pose = this.packages.poseOf(spot);
    this.marker.position.set(pose.x, pose.y + MARKER_LIFT, pose.z);
    this.marker.rotation.y = pose.yaw;
    // Im Laderaum rastet das Paket genau ins Raster, dort sitzt die Markierung knapp.
    const padding = spot.state === 'van' ? 0.02 : MARKER_PADDING;
    this.marker.scale.set(pkg.width + padding, 1, pkg.length + padding);
    this.marker.material.color.setHex(spot.state === 'ground' ? PALETTE.black : PALETTE.white);
    this.marker.visible = true;
  }
}
