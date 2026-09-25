import * as THREE from 'three';

const X_START = -9.5;
const X_END = 9.5;
const CURVE_HALF_SPAN = 7.5; // zwischen -7.5 und 7.5 liegt die S-Kurve, außen gerade Stücke
const AMPLITUDE = 1.0;
const SAMPLES = 800;
const COARSE_STEP = 8;

// Steigung und Krümmung laufen an beiden Enden auf null aus, damit die Geraden
// ohne Knick in die Bögen übergehen (engster Radius ca. 2).
function sCurve(u) {
  return AMPLITUDE * (Math.sin(2 * Math.PI * u) - 0.5 * Math.sin(4 * Math.PI * u));
}

// Mittellinie des Bands in der XZ-Ebene, adressiert über den Streckenmeter `s`.
export function createBeltPath() {
  const points = [new THREE.Vector3(X_START, 0, 0)];
  for (let i = 0; i <= 48; i++) {
    const u = i / 48;
    points.push(new THREE.Vector3(-CURVE_HALF_SPAN + u * 2 * CURVE_HALF_SPAN, 0, -sCurve(u)));
  }
  points.push(new THREE.Vector3(X_END, 0, 0));

  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  curve.arcLengthDivisions = 1000;
  const length = curve.getLength();

  const samples = [];
  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  for (let i = 0; i <= SAMPLES; i++) {
    const u = i / SAMPLES;
    curve.getPointAt(u, point);
    curve.getTangentAt(u, tangent);
    samples.push({ s: u * length, x: point.x, z: point.z, tx: tangent.x, tz: tangent.z });
  }

  // Position, Fahrtrichtung und linke Normale bei Streckenmeter `s`.
  function frameAt(s) {
    const f = THREE.MathUtils.clamp(s / length, 0, 1) * SAMPLES;
    const i = Math.min(Math.floor(f), SAMPLES - 1);
    const t = f - i;
    const a = samples[i];
    const b = samples[i + 1];
    let tx = a.tx + (b.tx - a.tx) * t;
    let tz = a.tz + (b.tz - a.tz) * t;
    const norm = Math.hypot(tx, tz);
    tx /= norm;
    tz /= norm;
    return {
      s,
      x: a.x + (b.x - a.x) * t,
      z: a.z + (b.z - a.z) * t,
      tx,
      tz,
      nx: tz,
      nz: -tx,
      yaw: Math.atan2(tx, tz),
    };
  }

  function distanceSq(i, x, z) {
    const dx = samples[i].x - x;
    const dz = samples[i].z - z;
    return dx * dx + dz * dz;
  }

  // Nächster Punkt auf der Mittellinie: Streckenmeter, seitlicher Versatz
  // (positiv = links in Fahrtrichtung) und Abstand.
  function closest(x, z) {
    let best = 0;
    let bestSq = Infinity;
    for (let i = 0; i <= SAMPLES; i += COARSE_STEP) {
      const d = distanceSq(i, x, z);
      if (d < bestSq) [best, bestSq] = [i, d];
    }
    const from = Math.max(0, best - COARSE_STEP);
    const to = Math.min(SAMPLES, best + COARSE_STEP);
    for (let i = from; i <= to; i++) {
      const d = distanceSq(i, x, z);
      if (d < bestSq) [best, bestSq] = [i, d];
    }

    // Auf die angrenzenden Segmente projizieren, damit `s` nicht in Stufen springt.
    let result = { s: samples[best].s, qx: samples[best].x, qz: samples[best].z };
    let resultSq = bestSq;
    let dirX = samples[best].tx;
    let dirZ = samples[best].tz;
    for (const [ia, ib] of [[best - 1, best], [best, best + 1]]) {
      if (ia < 0 || ib > SAMPLES) continue;
      const a = samples[ia];
      const b = samples[ib];
      const ex = b.x - a.x;
      const ez = b.z - a.z;
      const lenSq = ex * ex + ez * ez;
      const t = THREE.MathUtils.clamp(((x - a.x) * ex + (z - a.z) * ez) / lenSq, 0, 1);
      const qx = a.x + ex * t;
      const qz = a.z + ez * t;
      const d = (x - qx) ** 2 + (z - qz) ** 2;
      if (d <= resultSq) {
        resultSq = d;
        result = { s: a.s + (b.s - a.s) * t, qx, qz };
        const len = Math.sqrt(lenSq);
        dirX = ex / len;
        dirZ = ez / len;
      }
    }

    const offset = (x - result.qx) * dirZ + (z - result.qz) * -dirX;
    return { s: result.s, offset, distance: Math.sqrt(resultSq) };
  }

  return { length, frameAt, closest };
}
