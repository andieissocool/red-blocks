// Gedrehte Rechtecke in der XZ-Ebene: Mittelpunkt, halbe Kantenlängen entlang der
// lokalen x- bzw. z-Achse und Drehung um y (wie Object3D.rotation.y).

export function makeObb(x, z, hx, hz, yaw) {
  return { x, z, hx, hz, yaw };
}

// Lokale x- und z-Achse in Weltkoordinaten, jeweils als [x, z].
function axesOf(obb) {
  const cos = Math.cos(obb.yaw);
  const sin = Math.sin(obb.yaw);
  return [
    [cos, -sin],
    [sin, cos],
  ];
}

function projectedRadius(obb, axes, ax, az) {
  return (
    obb.hx * Math.abs(axes[0][0] * ax + axes[0][1] * az) +
    obb.hz * Math.abs(axes[1][0] * ax + axes[1][1] * az)
  );
}

// Trennende-Achsen-Test. `margin` hält zusätzlich Abstand zwischen den Rechtecken.
export function obbOverlap(a, b, margin = 0) {
  const axesA = axesOf(a);
  const axesB = axesOf(b);
  const dx = b.x - a.x;
  const dz = b.z - a.z;

  for (const [ax, az] of [...axesA, ...axesB]) {
    const distance = Math.abs(dx * ax + dz * az);
    const reach = projectedRadius(a, axesA, ax, az) + projectedRadius(b, axesB, ax, az) + margin;
    if (distance >= reach) return false;
  }
  return true;
}

// Ecken und Kantenmitten, um grob zu prüfen, ob ein Rechteck in einen Bereich ragt.
export function obbOutlinePoints(obb) {
  const [[xx, xz], [zx, zz]] = axesOf(obb);
  const points = [];
  for (const [sx, sz] of [
    [-1, -1], [0, -1], [1, -1], [1, 0],
    [1, 1], [0, 1], [-1, 1], [-1, 0],
  ]) {
    points.push([
      obb.x + xx * sx * obb.hx + zx * sz * obb.hz,
      obb.z + xz * sx * obb.hx + zz * sz * obb.hz,
    ]);
  }
  return points;
}
