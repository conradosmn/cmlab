import * as THREE from "three";
import { PLATE_SIZE_MM, type PlatePiece } from "./plateGeometry";
import type { KeychainResult } from "./nameKeychain";

function toGeometry(part: KeychainResult["body"]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(part.positions, 3));
  geo.setIndex(new THREE.BufferAttribute(part.indices, 1));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Converte cada chaveiro em peça (corpo + face), centrada na origem, e
 * empilha em fileiras na mesa de 256 mm.
 */
export function layoutKeychains(
  items: { name: string; result: KeychainResult }[],
  gapMm = 5
): { pieces: PlatePiece[]; overflow: boolean } {
  const usable = PLATE_SIZE_MM - 10;
  const raw = items.map(({ name, result }) => {
    const body = toGeometry(result.body);
    const face = toGeometry(result.face);
    body.computeBoundingBox();
    const bb = body.boundingBox!;
    const cx = (bb.min.x + bb.max.x) / 2;
    const cy = (bb.min.y + bb.max.y) / 2;
    body.translate(-cx, -cy, -bb.min.z);
    face.translate(-cx, -cy, -bb.min.z);
    return {
      name,
      body,
      face,
      w: bb.max.x - bb.min.x,
      h: bb.max.y - bb.min.y,
    };
  });

  // Fileiras: enche cada linha até a largura útil.
  const rows: { items: typeof raw; w: number; h: number }[] = [];
  for (const it of raw) {
    const row = rows[rows.length - 1];
    if (row && row.w + gapMm + it.w <= usable) {
      row.items.push(it);
      row.w += gapMm + it.w;
      row.h = Math.max(row.h, it.h);
    } else {
      rows.push({ items: [it], w: it.w, h: it.h });
    }
  }
  const totalH = rows.reduce((s, r) => s + r.h, 0) + gapMm * Math.max(0, rows.length - 1);
  let y = PLATE_SIZE_MM / 2 + totalH / 2;
  const pieces: PlatePiece[] = [];
  let overflow = totalH > usable;
  for (const row of rows) {
    if (row.w > usable) overflow = true;
    let x = PLATE_SIZE_MM / 2 - row.w / 2;
    const rowCenterY = y - row.h / 2;
    for (const it of row.items) {
      pieces.push({
        name: it.name,
        x: x + it.w / 2,
        y: rowCenterY,
        widthMm: it.w,
        heightMm: it.h,
        base: it.body,
        lines: it.face,
      });
      x += it.w + gapMm;
    }
    y -= row.h + gapMm;
  }
  return { pieces, overflow };
}
