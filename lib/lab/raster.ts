/**
 * Operações sobre máscaras binárias (Uint8Array, 1 = cheio) usadas pelas
 * ferramentas do Laboratório. Tudo roda no navegador, sem dependências.
 */

export interface Mask {
  width: number;
  height: number;
  data: Uint8Array;
}

export function createMask(width: number, height: number): Mask {
  return { width, height, data: new Uint8Array(width * height) };
}

export function cloneMask(m: Mask): Mask {
  return { width: m.width, height: m.height, data: new Uint8Array(m.data) };
}

export function countMask(m: Mask): number {
  let n = 0;
  for (let i = 0; i < m.data.length; i++) n += m.data[i];
  return n;
}

export function and(a: Mask, b: Mask): Mask {
  const out = createMask(a.width, a.height);
  for (let i = 0; i < a.data.length; i++) out.data[i] = a.data[i] & b.data[i];
  return out;
}

export function or(a: Mask, b: Mask): Mask {
  const out = createMask(a.width, a.height);
  for (let i = 0; i < a.data.length; i++) out.data[i] = a.data[i] | b.data[i];
  return out;
}

export function andNot(a: Mask, b: Mask): Mask {
  const out = createMask(a.width, a.height);
  for (let i = 0; i < a.data.length; i++) out.data[i] = a.data[i] & (b.data[i] ^ 1);
  return out;
}

/* ------------------------------------------------------------------------ */
/* Transformada de distância euclidiana (Felzenszwalb & Huttenlocher)        */
/* ------------------------------------------------------------------------ */

const INF = 1e20;

function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const dq = q - v[k];
    d[q] = dq * dq + f[v[k]];
  }
}

/**
 * Distância (ao quadrado, em px²) de cada pixel até o pixel "alvo" mais
 * próximo. Alvo = pixels onde target[i] === 1.
 */
export function squaredDistanceTo(target: Mask): Float64Array {
  const { width: w, height: h } = target;
  const grid = new Float64Array(w * h);
  for (let i = 0; i < grid.length; i++) grid[i] = target.data[i] ? 0 : INF;

  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
  }
  return grid;
}

/** Engrossa a máscara em `radius` px (disco). */
export function dilate(m: Mask, radius: number): Mask {
  if (radius <= 0) return cloneMask(m);
  const dist = squaredDistanceTo(m);
  const r2 = radius * radius;
  const out = createMask(m.width, m.height);
  for (let i = 0; i < dist.length; i++) out.data[i] = dist[i] <= r2 ? 1 : 0;
  return out;
}

/** Afina a máscara em `radius` px (disco). */
export function erode(m: Mask, radius: number): Mask {
  if (radius <= 0) return cloneMask(m);
  const inv = createMask(m.width, m.height);
  for (let i = 0; i < m.data.length; i++) inv.data[i] = m.data[i] ^ 1;
  // Fora da imagem conta como vazio: a borda também afina.
  const padded = padMask(inv, 1, 1);
  const dist = squaredDistanceTo(padded);
  const r2 = radius * radius;
  const out = createMask(m.width, m.height);
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      const pd = dist[(y + 1) * padded.width + (x + 1)];
      out.data[y * m.width + x] = pd > r2 ? 1 : 0;
    }
  }
  return out;
}

export function close(m: Mask, radius: number): Mask {
  return erode(dilate(m, radius), radius);
}

export function open(m: Mask, radius: number): Mask {
  return dilate(erode(m, radius), radius);
}

export function padMask(m: Mask, pad: number, fill: 0 | 1 = 0): Mask {
  const w = m.width + pad * 2;
  const h = m.height + pad * 2;
  const out = createMask(w, h);
  if (fill) out.data.fill(1);
  for (let y = 0; y < m.height; y++) {
    out.data.set(m.data.subarray(y * m.width, (y + 1) * m.width), (y + pad) * w + pad);
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Componentes conexos                                                       */
/* ------------------------------------------------------------------------ */

export interface Component {
  /** Índices dos pixels do componente. */
  pixels: Int32Array;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Componentes de pixels com valor 1 (vizinhança-8 se `diagonal`). */
export function components(m: Mask, diagonal = true): Component[] {
  const { width: w, height: h, data } = m;
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const result: Component[] = [];
  const buffer: number[] = [];

  for (let start = 0; start < data.length; start++) {
    if (!data[start] || seen[start]) continue;
    let sp = 0;
    stack[sp++] = start;
    seen[start] = 1;
    buffer.length = 0;
    let minX = w, minY = h, maxX = 0, maxY = 0;

    while (sp > 0) {
      const i = stack[--sp];
      buffer.push(i);
      const x = i % w;
      const y = (i - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (!diagonal && dx !== 0 && dy !== 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const j = ny * w + nx;
          if (data[j] && !seen[j]) {
            seen[j] = 1;
            stack[sp++] = j;
          }
        }
      }
    }
    result.push({ pixels: Int32Array.from(buffer), minX, minY, maxX, maxY });
  }
  return result;
}

/** Remove ilhas com menos de `minArea` px. */
export function removeSmall(m: Mask, minArea: number): Mask {
  const out = cloneMask(m);
  if (minArea <= 1) return out;
  for (const c of components(m)) {
    if (c.pixels.length < minArea) {
      for (let k = 0; k < c.pixels.length; k++) out.data[c.pixels[k]] = 0;
    }
  }
  return out;
}

/** Preenche buracos internos (tudo que não é alcançável a partir da borda). */
export function fillHoles(m: Mask): Mask {
  const { width: w, height: h, data } = m;
  const outside = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  const push = (i: number) => {
    if (!data[i] && !outside[i]) {
      outside[i] = 1;
      stack[sp++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (sp > 0) {
    const i = stack[--sp];
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  const out = createMask(w, h);
  for (let i = 0; i < out.data.length; i++) out.data[i] = outside[i] ? 0 : 1;
  return out;
}

/* ------------------------------------------------------------------------ */
/* Cor                                                                       */
/* ------------------------------------------------------------------------ */

export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** sRGB (0–255) -> CIE Lab. Distâncias em Lab acompanham a percepção humana. */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
