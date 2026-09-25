// Maße, Farben und Tempo, die sich mehrere Module teilen.

// Rot und Schwarz als Hauptfarben, dazu helle Grau- und Weißtöne.
export const PALETTE = {
  sky: 0xf3f1ed,
  board: 0xe8e4de,
  boardSide: 0xcdc7be,
  red: 0xd7263d,
  black: 0x1f1f23,
  charcoal: 0x2c2c31,
  void: 0x0e0e10,
  grey: 0xd6d2cb,
  white: 0xf7f5f2,
};

export const BELT = {
  height: 0.8, // Oberkante des Gurts
  halfWidth: 0.75, // halbe Gurtbreite
  frameHalfWidth: 0.85, // halbe Breite inklusive Rahmen
  speed: 1.1, // Einheiten pro Sekunde
  gap: 0.18, // Mindestabstand zwischen zwei Paketen
  snapTolerance: 0.2, // so weit neben dem Gurt zählt ein Drop noch als "aufs Band"
};

export const HOUSE = {
  depth: 1.9, // Länge entlang des Bands
  halfWidth: 1.2,
  height: 2.1,
  inset: 0.2, // so weit ragt das Haus über das Bandende hinaus
};

// Streckenmeter der beiden Türen, gemessen vom Bandanfang bzw. -ende.
export const DOOR_DISTANCE = HOUSE.depth - HOUSE.inset;

// Die Platte, auf der das Diorama steht.
export const BOARD = { halfX: 13, halfZ: 7 };

// Straße vor dem Band, auf der der Lieferwagen parkt.
export const ROAD = { z: 4.6, halfWidth: 1.25 };

// Raster des Laderaums: Zellen quer (x) und längs (z) zum Wagen, Höhe bis zur Oberkante.
export const CELL = 0.25;
export const HOLD = { cellsX: 5, cellsZ: 8, height: 1.0 };

// Feste Paketgrößen im Raster: Breite (lokal x) × Länge (lokal z) × Höhe, dazu die Häufigkeit.
export const PACKAGE_SIZES = [
  { width: 0.5, length: 0.5, height: 0.5, weight: 3 },
  { width: 0.5, length: 0.75, height: 0.5, weight: 2.5 },
  { width: 0.75, length: 0.75, height: 0.5, weight: 2 },
  { width: 0.75, length: 1.0, height: 0.25, weight: 1.5 },
  { width: 0.5, length: 0.5, height: 0.75, weight: 1 },
];

// Unterkante eines angehobenen Pakets, knapp über den höchsten Paketen auf Band und Wagen.
export const DRAG_HEIGHT = BELT.height + 0.85;
