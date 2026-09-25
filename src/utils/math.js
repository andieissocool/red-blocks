export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Winkel auf (-PI, PI] bringen, damit Drehungen den kurzen Weg nehmen.
export function wrapAngle(angle) {
  return angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2));
}

// Anteil für frameratenunabhängiges Nachziehen: 1 - e^(-rate * dt).
export function damp(rate, dt) {
  return 1 - Math.exp(-rate * dt);
}

export function randomRange(min, max, random = Math.random) {
  return min + (max - min) * random();
}

export function randomItem(items, random = Math.random) {
  return items[Math.floor(random() * items.length)];
}
