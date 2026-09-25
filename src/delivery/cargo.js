import { CELL, HOLD, PACKAGE_SIZES } from '../config.js';

const HALF_X = (HOLD.cellsX * CELL) / 2;
const HALF_Z = (HOLD.cellsZ * CELL) / 2;
const SEARCH_DISTANCE = 1.2; // so weit darf ein Paket vom Zeiger weg einrasten
const MIN_SUPPORT = 0.5; // Anteil der Grundfläche, der aufliegen muss

function cellsOf(size) {
  return { w: Math.round(size.width / CELL), l: Math.round(size.length / CELL) };
}

// Laderaum im Raster. Koordinaten sind lokal zum Laderaum: Mitte = (0, 0),
// x quer, z längs, Höhe ab Ladeboden. Pakete liegen immer längs (Länge entlang z).
export class CargoHold {
  constructor() {
    this.items = []; // { pkg, i, j, w, l, h, rest }: Startzelle, Größe in Zellen, Höhe, Auflagehöhe
  }

  static get halfX() {
    return HALF_X;
  }

  static get halfZ() {
    return HALF_Z;
  }

  // Auflage für eine Grundfläche: die höchste Oberkante darunter (`rest`) und der Anteil
  // der Zellen, die genau auf dieser Höhe tragen (`carried`). Der Ladeboden trägt überall.
  // Alle Höhen sind Vielfache von 0,25, deshalb ist der Vergleich exakt.
  support(i, j, w, l, items = this.items) {
    const tops = new Array(w * l).fill(0);
    for (const item of items) {
      const top = item.rest + item.h;
      for (let a = Math.max(i, item.i); a < Math.min(i + w, item.i + item.w); a++) {
        for (let b = Math.max(j, item.j); b < Math.min(j + l, item.j + item.l); b++) {
          const k = (a - i) * l + (b - j);
          tops[k] = Math.max(tops[k], top);
        }
      }
    }
    const rest = Math.max(...tops);
    return { rest, carried: tops.filter((top) => top === rest).length / tops.length };
  }

  // Zelle, deren Paketmitte (lx, lz) am nächsten liegt und an der das Paket unter die
  // Oberkante passt und mindestens zur Hälfte aufliegt. `null`, wenn es im Umkreis keinen Platz gibt.
  findSpot(size, lx, lz, maxDistance = SEARCH_DISTANCE) {
    const { w, l } = cellsOf(size);
    let best = null;
    for (let i = 0; i + w <= HOLD.cellsX; i++) {
      for (let j = 0; j + l <= HOLD.cellsZ; j++) {
        const x = (i + w / 2) * CELL - HALF_X;
        const z = (j + l / 2) * CELL - HALF_Z;
        const distance = Math.hypot(x - lx, z - lz);
        if (distance > maxDistance || (best && distance >= best.distance)) continue;
        const { rest, carried } = this.support(i, j, w, l);
        if (rest + size.height > HOLD.height || carried < MIN_SUPPORT) continue;
        best = { i, j, w, l, h: size.height, rest, x, z, distance };
      }
    }
    return best;
  }

  add(pkg, spot) {
    const { i, j, w, l, h, rest } = spot;
    this.items.push({ pkg, i, j, w, l, h, rest });
  }

  // Nimmt ein Paket heraus und lässt alles darüber nachrutschen (von unten nach oben neu abgesetzt).
  remove(pkg) {
    this.items = this.items.filter((item) => item.pkg !== pkg);
    const settled = [];
    for (const item of [...this.items].sort((a, b) => a.rest - b.rest)) {
      item.rest = this.support(item.i, item.j, item.w, item.l, settled).rest;
      settled.push(item);
    }
  }

  // Voll, wenn keine der Paketgrößen mehr irgendwo hineinpasst.
  isFull() {
    return PACKAGE_SIZES.every((size) => !this.findSpot(size, 0, 0, Infinity));
  }
}
