import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { contours } from "d3-contour";
import { Mask, components } from "./raster";
import type { PlateParams, PlateResult } from "./coloringPlate";

export interface PlatePiece {
  name: string;
  /** Centro da peça na mesa (mm). */
  x: number;
  y: number;
  widthMm: number;
  heightMm: number;
  base: THREE.BufferGeometry;
  lines: THREE.BufferGeometry;
}

type Ring = [number, number][];

/** Ramer–Douglas–Peucker num anel fechado. */
function simplifyRing(ring: Ring, tolerance: number): Ring {
  if (ring.length <= 4) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = 1;
  keep[ring.length - 1] = 1;
  const t2 = tolerance * tolerance;
  const stack: [number, number][] = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = ring[a];
    const [bx, by] = ring[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = ring[i];
      let d: number;
      if (len2 === 0) {
        d = (px - ax) ** 2 + (py - ay) ** 2;
      } else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
      }
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > t2 && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

function ringArea(ring: Ring): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(a / 2);
}

/**
 * Máscara recortada -> polígonos (com furos) em mm, já com Y para cima e
 * centrados em (cx, cy). Um leve desfoque antes do contorno suaviza a
 * "escadinha" dos pixels.
 */
function maskToShapes(
  mask: Mask,
  ppm: number,
  cx: number,
  cy: number
): THREE.Shape[] {
  const { width: w, height: h, data } = mask;
  const field = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      let cnt = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          acc += data[ny * w + nx];
          cnt++;
        }
      }
      field[y * w + x] = acc / cnt;
    }
  }

  const [multi] = contours().size([w, h]).smooth(true).thresholds([0.5])(
    Array.from(field)
  );
  const tolerance = 0.04; // mm
  const minArea = 0.05; // mm²
  const shapes: THREE.Shape[] = [];

  const toMm = (ring: number[][]): Ring => {
    const out: Ring = ring.map(([x, y]) => [x / ppm - cx, cy - y / ppm]);
    // d3 fecha o anel repetindo o primeiro ponto; o THREE não quer isso.
    const f = out[0];
    const l = out[out.length - 1];
    if (out.length > 1 && f[0] === l[0] && f[1] === l[1]) out.pop();
    return out;
  };

  for (const polygon of multi.coordinates) {
    const outer = simplifyRing(toMm(polygon[0]), tolerance);
    if (outer.length < 3 || ringArea(outer) < minArea) continue;
    const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
    for (let r = 1; r < polygon.length; r++) {
      const hole = simplifyRing(toMm(polygon[r]), tolerance);
      if (hole.length < 3 || ringArea(hole) < minArea) continue;
      shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
    }
    shapes.push(shape);
  }
  return shapes;
}

function extrude(shapes: THREE.Shape[], z0: number, depth: number): THREE.BufferGeometry {
  if (shapes.length === 0) return new THREE.BufferGeometry();
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  });
  geo.translate(0, 0, z0);
  // Sem normais/UV para que vértices iguais se fundam: malha fechada e menor.
  geo.deleteAttribute("normal");
  geo.deleteAttribute("uv");
  const merged = mergeVertices(geo, 1e-4);
  geo.dispose();
  merged.computeVertexNormals();
  return merged;
}

/** Recorta o retângulo [x0,x1)×[y0,y1) mantendo só os pixels do componente. */
function cropComponent(
  src: Mask,
  pick: Uint8Array | null,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  pad: number
): Mask {
  const w = x1 - x0 + pad * 2;
  const h = y1 - y0 + pad * 2;
  const out = { width: w, height: h, data: new Uint8Array(w * h) };
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * src.width + x;
      if (src.data[i] && (!pick || pick[i])) {
        out.data[(y - y0 + pad) * w + (x - x0 + pad)] = 1;
      }
    }
  }
  return out;
}

export interface ArtPieces {
  pieces: Omit<PlatePiece, "x" | "y">[];
  /** Posição de cada peça relativa ao canto da arte (mm), para preservar o arranjo. */
  offsets: { x: number; y: number }[];
  widthMm: number;
  heightMm: number;
}

/** Cada ilha da base vira uma plaquinha independente. */
export function buildArtPieces(
  result: PlateResult,
  params: PlateParams,
  name: string
): ArtPieces {
  const { base, lines, pxPerMm: ppm, width: W, height: H } = result;
  const minPiecePx = 25 * ppm * ppm; // ignora fragmentos < 25 mm²
  const comps = components(base).filter((c) => c.pixels.length >= minPiecePx);
  comps.sort((a, b) => a.minY - b.minY || a.minX - b.minX);

  const pieces: ArtPieces["pieces"] = [];
  const offsets: ArtPieces["offsets"] = [];
  const pick = new Uint8Array(W * H);
  const pad = 2;

  comps.forEach((c, idx) => {
    pick.fill(0);
    for (let k = 0; k < c.pixels.length; k++) pick[c.pixels[k]] = 1;
    const x0 = c.minX;
    const y0 = c.minY;
    const x1 = c.maxX + 1;
    const y1 = c.maxY + 1;
    const baseCrop = cropComponent(base, pick, x0, y0, x1, y1, pad);
    const linesCrop = cropComponent(lines, pick, x0, y0, x1, y1, pad);

    const cw = baseCrop.width / ppm;
    const ch = baseCrop.height / ppm;
    const baseShapes = maskToShapes(baseCrop, ppm, cw / 2, ch / 2);
    const lineShapes = maskToShapes(linesCrop, ppm, cw / 2, ch / 2);

    pieces.push({
      name: comps.length > 1 ? `${name} ${idx + 1}` : name,
      widthMm: (x1 - x0) / ppm,
      heightMm: (y1 - y0) / ppm,
      base: extrude(baseShapes, 0, params.baseThicknessMm),
      lines: extrude(lineShapes, params.baseThicknessMm, params.reliefMm),
    });
    // Centro da peça em mm, medido a partir do canto superior esquerdo da arte.
    offsets.push({
      x: (x0 - pad) / ppm + cw / 2,
      y: (y0 - pad) / ppm + ch / 2,
    });
  });

  return { pieces, offsets, widthMm: W / ppm, heightMm: H / ppm };
}

export const PLATE_SIZE_MM = 256;

/**
 * Distribui as artes na mesa em prateleiras, mantendo o arranjo interno de
 * cada arte. Devolve as peças com o centro final (mm, origem no canto da mesa).
 */
export function layoutOnPlate(arts: ArtPieces[], gapMm = 6): {
  pieces: PlatePiece[];
  overflow: boolean;
} {
  const usable = PLATE_SIZE_MM - 10;
  const out: PlatePiece[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowH = 0;
  let maxX = 0;
  const placed: { art: ArtPieces; ox: number; oy: number }[] = [];

  for (const art of arts) {
    if (art.pieces.length === 0) continue;
    if (cursorX > 0 && cursorX + art.widthMm > usable) {
      cursorX = 0;
      cursorY += rowH + gapMm;
      rowH = 0;
    }
    placed.push({ art, ox: cursorX, oy: cursorY });
    cursorX += art.widthMm + gapMm;
    maxX = Math.max(maxX, cursorX - gapMm);
    rowH = Math.max(rowH, art.heightMm);
  }
  const totalH = cursorY + rowH;
  // Centraliza o conjunto na mesa.
  const shiftX = (PLATE_SIZE_MM - maxX) / 2;
  const shiftY = (PLATE_SIZE_MM - totalH) / 2;

  for (const { art, ox, oy } of placed) {
    art.pieces.forEach((p, i) => {
      const off = art.offsets[i];
      out.push({
        ...p,
        x: shiftX + ox + off.x,
        // Y da imagem cresce para baixo; o da mesa, para cima.
        y: PLATE_SIZE_MM - (shiftY + oy + off.y),
      });
    });
  }
  return { pieces: out, overflow: maxX > usable || totalH > usable };
}
