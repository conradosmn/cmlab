import type { ManifoldToplevel, Manifold, CrossSection } from "manifold-3d";
import type { Font } from "opentype.js";

/**
 * Chaveiro de nome articulado, impresso já montado (print-in-place).
 *
 * Cada letra fica presa a um segmento de "espinha" no fundo da peça. Entre um
 * segmento e o próximo há uma dobradiça de eixo vertical: um pino em losango
 * (dois cones de 45°) do segmento da esquerda, dentro de um furo do mesmo
 * formato no "nó" do segmento da direita. Nenhuma face passa de 45°, então
 * imprime sem suporte, e o losango impede o pino de soltar.
 *
 *  z
 *  S ┤   ┌──── placa (esq.) ────┐┌──── barra superior (dir.) ──
 *    ┤   └──────────┐ pino ┌────┘
 *    ┤ barra inf.   │  ◇   │  nó (dir.) com furo em losango
 *  0 ┼──(esq.)──────┘      └─────────────────────────────────
 */

export interface KeychainParams {
  name: string;
  /** Altura das letras maiúsculas (mm). */
  heightMm: number;
  /** Espaço mínimo entre letras vizinhas (mm). */
  letterGapMm: number;
  /** Folga das dobradiças (mm). */
  clearanceMm: number;
  /** Espessura total da peça (mm). */
  thicknessMm: number;
  /** Camada de cor da face das letras (mm). */
  faceMm: number;
  /** Argola para chaveiro na ponta esquerda. */
  ring: boolean;
}

export const DEFAULT_KEYCHAIN: Omit<KeychainParams, "name"> = {
  heightMm: 14,
  letterGapMm: 0.6,
  clearanceMm: 0.4,
  thicknessMm: 8,
  faceMm: 1.6,
  ring: true,
};

/** Letras aceitas (maiúsculas, números e acentos do português). */
export const KEYCHAIN_ALLOWED = /[A-Z0-9ÇÃÕÁÉÍÓÚÂÊÔÀÜ ]/;
export const KEYCHAIN_MAX_CHARS = 16;

export function sanitizeName(raw: string): string {
  return raw
    .toLocaleUpperCase("pt-BR")
    .split("")
    .filter((c) => KEYCHAIN_ALLOWED.test(c))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, KEYCHAIN_MAX_CHARS);
}

/** Medidas fixas da dobradiça (mm). */
const HINGE = {
  knuckleH: 3.0, // altura do nó
  plate: 1.2, // espessura da placa por cima do nó
  pinR: 1.0, // raio do pino
  bulgeR: 1.8, // raio no meio do losango
  wall: 1.2, // parede do nó em volta do furo
};

export interface KeychainResult {
  /** Corpo + espinha (filamento 1), em mm, z para cima, origem no canto. */
  body: { positions: Float32Array; indices: Uint32Array };
  /** Face colorida das letras (filamento 2). */
  face: { positions: Float32Array; indices: Uint32Array };
  widthMm: number;
  depthMm: number;
  heightMm: number;
  /** Nº de peças soltas do corpo; deve ser igual ao nº de segmentos. */
  bodyParts: number;
  segments: number;
}

/* ------------------------------------------------------------------------ */
/* Fonte -> polígonos                                                        */
/* ------------------------------------------------------------------------ */

type Ring = [number, number][];

function glyphPolygons(font: Font, ch: string, size: number): Ring[] {
  const path = font.charToGlyph(ch).getPath(0, 0, size);
  const rings: Ring[] = [];
  let cur: Ring = [];
  let px = 0;
  let py = 0;
  const STEPS = 8;
  const push = (x: number, y: number) => cur.push([x, -y]); // fonte: y para baixo
  for (const c of path.commands) {
    if (c.type === "M") {
      if (cur.length > 2) rings.push(cur);
      cur = [];
      push(c.x, c.y);
      px = c.x;
      py = c.y;
    } else if (c.type === "L") {
      push(c.x, c.y);
      px = c.x;
      py = c.y;
    } else if (c.type === "Q") {
      for (let s = 1; s <= STEPS; s++) {
        const t = s / STEPS;
        const a = (1 - t) * (1 - t);
        const b = 2 * (1 - t) * t;
        const d = t * t;
        push(a * px + b * c.x1 + d * c.x, a * py + b * c.y1 + d * c.y);
      }
      px = c.x;
      py = c.y;
    } else if (c.type === "C") {
      for (let s = 1; s <= STEPS; s++) {
        const t = s / STEPS;
        const a = (1 - t) ** 3;
        const b = 3 * (1 - t) ** 2 * t;
        const d = 3 * (1 - t) * t * t;
        const e = t ** 3;
        push(
          a * px + b * c.x1 + d * c.x2 + e * c.x,
          a * py + b * c.y1 + d * c.y2 + e * c.y
        );
      }
      px = c.x;
      py = c.y;
    } else if (c.type === "Z") {
      if (cur.length > 2) rings.push(cur);
      cur = [];
    }
  }
  if (cur.length > 2) rings.push(cur);
  return rings;
}

function capHeightUnits(font: Font): number {
  const os2 = (font.tables as { os2?: { sCapHeight?: number } }).os2;
  if (os2?.sCapHeight && os2.sCapHeight > 0) return os2.sCapHeight;
  const bb = font.charToGlyph("H").getBoundingBox();
  return bb.y2 - bb.y1 || font.unitsPerEm * 0.7;
}

/* ------------------------------------------------------------------------ */
/* Geração                                                                   */
/* ------------------------------------------------------------------------ */

export function buildKeychain(
  wasm: ManifoldToplevel,
  font: Font,
  params: KeychainParams
): KeychainResult {
  const { Manifold, CrossSection } = wasm;
  const trash: { delete(): void }[] = [];
  const keep = <T extends { delete(): void }>(o: T): T => {
    trash.push(o);
    return o;
  };

  try {
    const text = sanitizeName(params.name);
    if (text.replace(/ /g, "").length < 1) throw new Error("Digite um nome.");

    const H = params.heightMm;
    const c = params.clearanceMm;
    const g = Math.max(params.letterGapMm, 0.2);
    const T = params.thicknessMm;
    const F = params.faceMm;
    const cz = Math.max(0.3, c); // folga vertical acima do nó
    const kH = HINGE.knuckleH;
    const S = kH + cz + HINGE.plate; // topo da espinha
    if (T - F < S + c + 0.4) {
      throw new Error(
        `Espessura total muito baixa: precisa de pelo menos ${(S + c + 0.4 + F).toFixed(1)} mm.`
      );
    }
    const R = HINGE.bulgeR + c + HINGE.wall; // raio do nó e da placa
    const W = 2 * R * 0.85; // largura da espinha
    const yc = H / 2;
    const minCell = 2 * (R + c) + 1.6;

    // 1. Letras: polígonos, medidas e posição em células.
    const size = (H * font.unitsPerEm) / capHeightUnits(font);
    type Cell = { ch: string; cs: CrossSection | null; a: number; b: number };
    const cells: Cell[] = [];
    let cursor = 0;
    for (const ch of text) {
      if (ch === " ") {
        cursor += H * 0.35;
        if (cells.length) cells[cells.length - 1].b = cursor;
        continue;
      }
      const rings = glyphPolygons(font, ch, size);
      let cs = rings.length ? keep(new CrossSection(rings, "NonZero")) : null;
      if (cs && cs.isEmpty()) cs = null;
      let w = H * 0.4;
      let minX = 0;
      if (cs) {
        const bb = cs.bounds();
        w = bb.max[0] - bb.min[0];
        minX = bb.min[0];
      }
      const cellW = Math.max(w + g, minCell);
      const a = cursor;
      const b = cursor + cellW;
      if (cs) cs = keep(cs.translate([a + (cellW - w) / 2 - minX, 0]));
      cells.push({ ch, cs, a, b });
      cursor = b;
    }
    const n = cells.length;
    const ringOuter = 4.2;
    const ringHole = 2.2;
    const xStart = params.ring ? -(ringOuter * 2 - 0.5) : 0;

    // 2. Espinha. `grow` > 0 gera o "envelope" com folga, usado para cavar as
    //    letras vizinhas (sem furo, já que o pino alheio também é cavado).
    const box = (x0: number, x1: number, z0: number, z1: number, grow: number) => {
      const w = x1 - x0 + grow * 2;
      const d = W + grow * 2;
      const h = z1 - z0 + grow * 2;
      if (w <= 0 || h <= 0) return null;
      return keep(
        keep(Manifold.cube([w, d, h])).translate([x0 - grow, yc - d / 2, z0 - grow])
      );
    };
    const disk = (x: number, r: number, z0: number, z1: number, grow: number) =>
      keep(
        keep(Manifold.cylinder(z1 - z0 + grow * 2, r + grow, r + grow, 48)).translate([
          x,
          yc,
          z0 - grow,
        ])
      );
    /** Pino em losango, do chão até dentro da placa. */
    const pin = (x: number, grow: number) => {
      const zMid = kH / 2;
      const dr = HINGE.bulgeR - HINGE.pinR;
      const rP = HINGE.pinR + grow;
      const rB = HINGE.bulgeR + grow;
      const parts = [
        keep(Manifold.cylinder(kH + cz + 0.6 + grow, rP, rP, 32)).translate([x, yc, -grow]),
        keep(Manifold.cylinder(dr, rP, rB, 32)).translate([x, yc, zMid - dr]),
        keep(Manifold.cylinder(dr, rB, rP, 32)).translate([x, yc, zMid]),
      ].map(keep);
      return keep(Manifold.union(parts));
    };

    const spine = (i: number, grow: number): Manifold => {
      const { a, b } = cells[i];
      const left = i > 0; // tem nó (dobradiça com o anterior)
      const right = i < n - 1; // tem placa + pino (dobradiça com o próximo)
      const x0 = i === 0 ? xStart + ringOuter : a;
      const parts: Manifold[] = [];
      const add = (m: Manifold | null) => m && parts.push(m);
      // inferior
      add(box(x0, right ? b - R - c : b, 0, kH, grow));
      // meio (liga inferior e superior do mesmo segmento)
      add(box(left ? a + R + c : x0, right ? b - R - c : b, kH - 0.01, kH + cz + 0.01, grow));
      // superior
      add(box(left ? a + R + c : x0, b, kH + cz, S, grow));
      if (left) add(disk(a, R, 0, kH, grow));
      if (right) {
        add(disk(b, R, kH + cz, S, grow));
        add(pin(b, grow));
      }
      if (i === 0 && params.ring) {
        const cx = xStart + ringOuter;
        const ring = keep(
          keep(Manifold.cylinder(S + grow * 2, ringOuter + grow, ringOuter + grow, 48)).translate([
            cx,
            yc,
            -grow,
          ])
        );
        add(ring);
      }
      let m = keep(Manifold.union(parts));
      if (grow === 0) {
        if (left) {
          // furo do nó: pino do vizinho + folga
          m = keep(m.subtract(pin(a, c)));
          // Alívio na 1ª camada: o "pé de elefante" esparrama o filamento e
          // pode colar o pino no furo.
          const relief = keep(
            keep(Manifold.cylinder(1.5, HINGE.pinR + c + 0.3, HINGE.pinR + c + 0.3, 32)).translate([
              a,
              yc,
              -1,
            ])
          );
          m = keep(m.subtract(relief));
        }
        if (i === 0 && params.ring) {
          const cx = xStart + ringOuter;
          m = keep(
            m.subtract(
              keep(keep(Manifold.cylinder(S + 2, ringHole, ringHole, 32)).translate([cx, yc, -1]))
            )
          );
        }
      }
      return m;
    };

    const spines = cells.map((_, i) => spine(i, 0));
    const envelopes = cells.map((_, i) => spine(i, c));

    // 3. Letras: do chão ao topo, cavadas em volta das espinhas vizinhas.
    const faceSlab = keep(
      keep(Manifold.cube([cursor - xStart + 40, H * 3, F + 1])).translate([xStart - 20, -H, T - F])
    );
    const bodies: Manifold[] = [];
    const faces: Manifold[] = [];
    cells.forEach((cell, i) => {
      let body = spines[i];
      if (cell.cs) {
        let letter = keep(keep(Manifold.extrude(cell.cs, T)));
        const others = envelopes.filter((_, j) => j !== i);
        if (others.length) letter = keep(letter.subtract(keep(Manifold.union(others))));
        faces.push(keep(letter.intersect(faceSlab)));
        body = keep(Manifold.union(body, keep(letter.subtract(faceSlab))));
      }
      bodies.push(body);
    });

    const bodyAll = keep(Manifold.union(bodies));
    const faceAll = keep(faces.length ? Manifold.union(faces) : Manifold.cube(0.001));
    const bodyParts = bodyAll.decompose().map(keep).length;

    const toArrays = (m: Manifold) => {
      const mesh = m.getMesh();
      const np = mesh.numProp;
      const nv = mesh.vertProperties.length / np;
      const positions = new Float32Array(nv * 3);
      for (let v = 0; v < nv; v++) {
        positions[v * 3] = mesh.vertProperties[v * np] - xStart;
        positions[v * 3 + 1] = mesh.vertProperties[v * np + 1];
        positions[v * 3 + 2] = mesh.vertProperties[v * np + 2];
      }
      return { positions, indices: new Uint32Array(mesh.triVerts) };
    };

    return {
      body: toArrays(bodyAll),
      face: toArrays(faceAll),
      widthMm: cursor - xStart,
      depthMm: H,
      heightMm: T,
      bodyParts,
      segments: n,
    };
  } finally {
    for (const o of trash) {
      try {
        o.delete();
      } catch {
        // já liberado
      }
    }
  }
}
