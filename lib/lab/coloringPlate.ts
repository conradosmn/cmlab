import {
  Mask,
  and,
  andNot,
  close,
  countMask,
  createMask,
  dilate,
  erode,
  fillHoles,
  luminance,
  open,
  or,
  removeSmall,
  rgbToLab,
} from "./raster";

/* ------------------------------------------------------------------------ */
/* Carregamento da arte                                                      */
/* ------------------------------------------------------------------------ */

export interface LoadedArt {
  kind: "svg" | "raster";
  name: string;
  image: HTMLImageElement;
  /** Proporção largura / altura da área útil (já sem margens). */
  aspect: number;
  /** Área útil da imagem, em px da imagem original: margens vazias ficam de fora. */
  crop: { sx: number; sy: number; sw: number; sh: number };
  /** Modo sugerido pela análise da imagem. */
  suggestedMode: PlateMode;
  /** URL para mostrar a imagem original na tela. */
  previewUrl: string;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
    img.src = url;
  });
}

/**
 * SVG sem width/height abre com 300×150 no navegador. Fixamos um tamanho a
 * partir do viewBox para rasterizar sem distorcer.
 */
function normalizeSvg(text: string): { svg: string; aspect: number } {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) {
    throw new Error("Arquivo SVG inválido.");
  }
  let w = 0;
  let h = 0;
  const vb = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
    w = vb[2];
    h = vb[3];
  } else {
    w = parseFloat(root.getAttribute("width") || "0");
    h = parseFloat(root.getAttribute("height") || "0");
    if (w > 0 && h > 0) root.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }
  if (!(w > 0 && h > 0)) {
    w = 1000;
    h = 1000;
  }
  const base = 2000;
  const aspect = w / h;
  root.setAttribute("width", String(aspect >= 1 ? base : Math.round(base * aspect)));
  root.setAttribute("height", String(aspect >= 1 ? Math.round(base / aspect) : base));
  root.setAttribute("preserveAspectRatio", "xMidYMid meet");
  return { svg: new XMLSerializer().serializeToString(root), aspect };
}

/**
 * Onde está o desenho (sem as margens vazias) e se ele é preto e branco.
 * Função pura, sem DOM.
 */
export function analyzeContent(img: RgbaImage): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  isLineArt: boolean;
} {
  const { width: w, height: h, data } = img;
  let hasAlpha = false;
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] < 250) {
      hasAlpha = true;
      break;
    }
  }
  let minX = w, minY = h, maxX = -1, maxY = -1;
  let content = 0;
  let colored = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const isContent = hasAlpha ? a > 127 : luminance(r, g, b) < 245;
      if (!isContent) continue;
      content++;
      if (Math.max(r, g, b) - Math.min(r, g, b) > 40) colored++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { minX: 0, minY: 0, maxX: w - 1, maxY: h - 1, isLineArt: true };
  return { minX, minY, maxX, maxY, isLineArt: colored / content < 0.03 };
}

async function finishLoad(
  kind: LoadedArt["kind"],
  name: string,
  url: string
): Promise<LoadedArt> {
  const image = await loadImage(url);
  const nw = image.naturalWidth;
  const nh = image.naturalHeight;
  // Analisa numa cópia reduzida: rápido e suficiente para achar as bordas.
  const scale = Math.min(1, 1000 / Math.max(nw, nh));
  const aw = Math.max(1, Math.round(nw * scale));
  const ah = Math.max(1, Math.round(nh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = aw;
  canvas.height = ah;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, aw, ah);
  const info = analyzeContent(ctx.getImageData(0, 0, aw, ah));

  // Margem de 2% para o contorno não encostar na borda do recorte.
  const pad = Math.round(Math.max(info.maxX - info.minX, info.maxY - info.minY) * 0.02) + 1;
  const x0 = Math.max(0, info.minX - pad);
  const y0 = Math.max(0, info.minY - pad);
  const x1 = Math.min(aw, info.maxX + 1 + pad);
  const y1 = Math.min(ah, info.maxY + 1 + pad);
  const crop = { sx: x0 / scale, sy: y0 / scale, sw: (x1 - x0) / scale, sh: (y1 - y0) / scale };

  return {
    kind,
    name,
    image,
    aspect: crop.sw / crop.sh,
    crop,
    suggestedMode: info.isLineArt ? "lineart" : "illustration",
    previewUrl: url,
  };
}

export async function loadArt(file: File): Promise<LoadedArt> {
  const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
  if (isSvg) {
    const { svg } = normalizeSvg(await file.text());
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    return finishLoad("svg", file.name, url);
  }
  return finishLoad("raster", file.name, URL.createObjectURL(file));
}

/* ------------------------------------------------------------------------ */
/* Parâmetros                                                                */
/* ------------------------------------------------------------------------ */

export type PlateMode = "lineart" | "illustration";

export interface PlateParams {
  /** lineart = desenho de contorno pronto; illustration = imagem colorida. */
  mode: PlateMode;
  /** Largura física da arte, em mm. */
  widthMm: number;
  /** Abaixo desse brilho (0–255) o pixel vira linha. */
  darkThreshold: number;
  /** Nº de cores na simplificação (modo ilustração). */
  colors: number;
  /** Áreas menores que isso (mm²) são absorvidas pelas vizinhas. */
  detailMm2: number;
  /** Espessura das linhas geradas (mm). */
  lineWidthMm: number;
  /** Mantém em relevo as partes bem escuras da ilustração (óculos, pneus). */
  keepDarkAreas: boolean;
  /** Linha de contorno na borda da plaquinha. */
  borderLine: boolean;
  /** Engrossa automaticamente linhas abaixo do mínimo imprimível. */
  autoThicken: boolean;
  /** Margem branca além do contorno externo (mm). */
  marginMm: number;
  baseThicknessMm: number;
  reliefMm: number;
}

/** Linha mínima imprimível com bico 0,4 mm (duas larguras de extrusão). */
export const MIN_LINE_MM = 0.8;

export function defaultParams(mode: PlateMode): PlateParams {
  const kind = mode === "lineart" ? "svg" : "raster";
  return {
    mode,
    widthMm: 80,
    darkThreshold: kind === "svg" ? 128 : 60,
    colors: 12,
    detailMm2: 4,
    lineWidthMm: 1,
    keepDarkAreas: true,
    borderLine: true,
    autoThicken: true,
    marginMm: 0,
    baseThicknessMm: 0.8,
    reliefMm: 0.4,
  };
}

/* ------------------------------------------------------------------------ */
/* Pipeline                                                                  */
/* ------------------------------------------------------------------------ */

/** Mesmo formato do ImageData, mas sem depender do navegador. */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export interface PlateResult {
  width: number;
  height: number;
  pxPerMm: number;
  /** Silhueta da plaquinha (base branca). */
  base: Mask;
  /** Linhas em relevo. */
  lines: Mask;
  /** Trechos de linha ainda abaixo do mínimo imprimível. */
  thin: Mask;
  widthMm: number;
  heightMm: number;
  thinPercent: number;
}

/** Resolução de trabalho: 10 px/mm, limitada para não travar a aba. */
function pickPxPerMm(widthMm: number, aspect: number): number {
  const heightMm = widthMm / aspect;
  const maxPixels = 1_600_000;
  const ideal = 10;
  const fit = Math.sqrt(maxPixels / (widthMm * heightMm));
  return Math.max(4, Math.min(ideal, fit));
}

function rasterize(art: LoadedArt, w: number, h: number): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  const { sx, sy, sw, sh } = art.crop;
  ctx.drawImage(art.image, sx, sy, sw, sh, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

function boxBlurRgb(img: RgbaImage, radius: number): Float32Array {
  const { width: w, height: h, data } = img;
  const src = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    src[i * 3] = data[i * 4];
    src[i * 3 + 1] = data[i * 4 + 1];
    src[i * 3 + 2] = data[i * 4 + 2];
  }
  if (radius < 1) return src;
  const tmp = new Float32Array(src.length);
  const pass = (from: Float32Array, to: Float32Array, horizontal: boolean) => {
    const len = horizontal ? w : h;
    const lines = horizontal ? h : w;
    for (let l = 0; l < lines; l++) {
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        let count = 0;
        const idx = (p: number) =>
          (horizontal ? l * w + p : p * w + l) * 3 + c;
        for (let p = 0; p <= Math.min(radius, len - 1); p++) {
          acc += from[idx(p)];
          count++;
        }
        for (let p = 0; p < len; p++) {
          to[idx(p)] = acc / count;
          const add = p + radius + 1;
          const rem = p - radius;
          if (add < len) {
            acc += from[idx(add)];
            count++;
          }
          if (rem >= 0) {
            acc -= from[idx(rem)];
            count--;
          }
        }
      }
    }
  };
  pass(src, tmp, true);
  pass(tmp, src, false);
  return src;
}

/** Gerador pseudoaleatório determinístico: mesma imagem, mesmo resultado. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * K-means em Lab com peso menor no brilho (L): sombras e degradês mudam
 * sobretudo o brilho, então pesar menos o L junta "vermelho claro" e
 * "vermelho escuro" do mesmo carro numa área só.
 */
function quantize(
  lab: Float32Array,
  opaque: Uint8Array,
  k: number
): Int16Array {
  const L_WEIGHT = 0.5;
  const n = opaque.length;
  const labels = new Int16Array(n).fill(-1);
  const idxs: number[] = [];
  for (let i = 0; i < n; i++) if (opaque[i]) idxs.push(i);
  if (idxs.length === 0) return labels;

  const rand = mulberry32(1234);
  const sampleSize = Math.min(idxs.length, 20000);
  const sample = new Int32Array(sampleSize);
  for (let s = 0; s < sampleSize; s++) sample[s] = idxs[Math.floor(rand() * idxs.length)];

  const dist = (i: number, c: Float32Array, ci: number) => {
    const dl = (lab[i * 3] - c[ci * 3]) * L_WEIGHT;
    const da = lab[i * 3 + 1] - c[ci * 3 + 1];
    const db = lab[i * 3 + 2] - c[ci * 3 + 2];
    return dl * dl + da * da + db * db;
  };

  // k-means++
  const centers = new Float32Array(k * 3);
  const first = sample[Math.floor(rand() * sampleSize)];
  centers.set(lab.subarray(first * 3, first * 3 + 3), 0);
  const best = new Float64Array(sampleSize).fill(Infinity);
  for (let c = 1; c < k; c++) {
    let total = 0;
    for (let s = 0; s < sampleSize; s++) {
      const d = dist(sample[s], centers, c - 1);
      if (d < best[s]) best[s] = d;
      total += best[s];
    }
    let r = rand() * total;
    let chosen = sample[sampleSize - 1];
    for (let s = 0; s < sampleSize; s++) {
      r -= best[s];
      if (r <= 0) {
        chosen = sample[s];
        break;
      }
    }
    centers.set(lab.subarray(chosen * 3, chosen * 3 + 3), c * 3);
  }

  const assign = new Int16Array(sampleSize);
  for (let iter = 0; iter < 12; iter++) {
    const sums = new Float64Array(k * 3);
    const counts = new Int32Array(k);
    for (let s = 0; s < sampleSize; s++) {
      let bi = 0;
      let bd = Infinity;
      for (let c = 0; c < k; c++) {
        const d = dist(sample[s], centers, c);
        if (d < bd) {
          bd = d;
          bi = c;
        }
      }
      assign[s] = bi;
      counts[bi]++;
      const i = sample[s];
      sums[bi * 3] += lab[i * 3];
      sums[bi * 3 + 1] += lab[i * 3 + 1];
      sums[bi * 3 + 2] += lab[i * 3 + 2];
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) continue;
      centers[c * 3] = sums[c * 3] / counts[c];
      centers[c * 3 + 1] = sums[c * 3 + 1] / counts[c];
      centers[c * 3 + 2] = sums[c * 3 + 2] / counts[c];
    }
  }

  for (const i of idxs) {
    let bi = 0;
    let bd = Infinity;
    for (let c = 0; c < k; c++) {
      const d = dist(i, centers, c);
      if (d < bd) {
        bd = d;
        bi = c;
      }
    }
    labels[i] = bi;
  }
  return labels;
}

/** Áreas de cor menores que `minArea` px herdam a cor da vizinha mais presente. */
function mergeSmallRegions(labels: Int16Array, w: number, h: number, minArea: number) {
  const n = w * h;
  for (let pass = 0; pass < 3; pass++) {
    const region = new Int32Array(n).fill(-1);
    const stack = new Int32Array(n);
    let changed = false;
    let regionId = 0;
    for (let start = 0; start < n; start++) {
      if (labels[start] < 0 || region[start] >= 0) continue;
      const lab = labels[start];
      const pixels: number[] = [];
      let sp = 0;
      stack[sp++] = start;
      region[start] = regionId;
      const neighborCount = new Map<number, number>();
      while (sp > 0) {
        const i = stack[--sp];
        pixels.push(i);
        const x = i % w;
        const y = (i - x) / w;
        const visit = (j: number) => {
          const lj = labels[j];
          if (lj === lab) {
            if (region[j] < 0) {
              region[j] = regionId;
              stack[sp++] = j;
            }
          } else if (lj >= 0) {
            neighborCount.set(lj, (neighborCount.get(lj) || 0) + 1);
          }
        };
        if (x > 0) visit(i - 1);
        if (x < w - 1) visit(i + 1);
        if (y > 0) visit(i - w);
        if (y < h - 1) visit(i + w);
      }
      regionId++;
      if (pixels.length < minArea && neighborCount.size > 0) {
        let target = lab;
        let bestCount = -1;
        neighborCount.forEach((count, l) => {
          if (count > bestCount) {
            bestCount = count;
            target = l;
          }
        });
        for (const p of pixels) labels[p] = target;
        changed = true;
      }
    }
    if (!changed) break;
  }
}

/**
 * Filtro de moda: cada pixel assume a cor mais comum na vizinhança. Alisa as
 * fronteiras serrilhadas entre áreas e apaga pontinhos isolados.
 */
function modeFilter(labels: Int16Array, w: number, h: number, radius: number, k: number) {
  const src = new Int16Array(labels);
  const counts = new Int32Array(k);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (src[i] < 0) continue;
      counts.fill(0);
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const l = src[ny * w + nx];
          if (l >= 0) counts[l]++;
        }
      }
      let best = src[i];
      let bestCount = counts[best];
      for (let c = 0; c < k; c++) {
        if (counts[c] > bestCount) {
          bestCount = counts[c];
          best = c;
        }
      }
      labels[i] = best;
    }
  }
}

/** Tamanho em px em que a arte será processada. */
export function plateRasterSize(aspect: number, widthMm: number) {
  const ppm = pickPxPerMm(widthMm, aspect);
  return {
    ppm,
    w: Math.max(8, Math.round(widthMm * ppm)),
    h: Math.max(8, Math.round((widthMm / aspect) * ppm)),
  };
}

export function processPlate(art: LoadedArt, params: PlateParams): PlateResult {
  const { ppm, w, h } = plateRasterSize(art.aspect, params.widthMm);
  return processImage(rasterize(art, w, h), ppm, params);
}

/** Núcleo do pipeline, sem DOM: recebe os pixels já no tamanho final. */
export function processImage(img: RgbaImage, ppm: number, params: PlateParams): PlateResult {
  const { data, width: w, height: h } = img;
  const n = w * h;

  // 1. O que é desenho e o que é fundo.
  let hasAlpha = false;
  for (let i = 0; i < n; i++) {
    if (data[i * 4 + 3] < 250) {
      hasAlpha = true;
      break;
    }
  }
  const opaque = createMask(w, h);
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3] / 255;
    // Composição sobre branco: semitransparente conta como mais claro.
    const r = data[i * 4] * a + 255 * (1 - a);
    const g = data[i * 4 + 1] * a + 255 * (1 - a);
    const b = data[i * 4 + 2] * a + 255 * (1 - a);
    lum[i] = luminance(r, g, b);
    opaque.data[i] = hasAlpha ? (a > 0.5 ? 1 : 0) : lum[i] < 245 ? 1 : 0;
  }

  const lineHalfPx = Math.max(0.5, (params.lineWidthMm * ppm) / 2);
  const detailPx = Math.max(1, params.detailMm2 * ppm * ppm);

  // 2. Linhas.
  let lines = createMask(w, h);
  const dark = createMask(w, h);
  for (let i = 0; i < n; i++) {
    dark.data[i] = opaque.data[i] && lum[i] < params.darkThreshold ? 1 : 0;
  }

  if (params.mode === "lineart") {
    lines = dark;
  } else {
    const blurred = boxBlurRgb(img, Math.max(1, Math.round(ppm * 0.15)));
    const lab = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      if (!opaque.data[i]) continue;
      const [L, A, B] = rgbToLab(blurred[i * 3], blurred[i * 3 + 1], blurred[i * 3 + 2]);
      lab[i * 3] = L;
      lab[i * 3 + 1] = A;
      lab[i * 3 + 2] = B;
    }
    const k = Math.max(2, Math.min(24, params.colors));
    const labels = quantize(lab, opaque.data, k);
    const modeRadius = Math.max(1, Math.round(ppm * 0.25));
    modeFilter(labels, w, h, modeRadius, k);
    mergeSmallRegions(labels, w, h, detailPx);
    modeFilter(labels, w, h, modeRadius, k);

    const boundary = createMask(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const l = labels[i];
        if (l < 0) continue;
        if (
          (x < w - 1 && labels[i + 1] >= 0 && labels[i + 1] !== l) ||
          (y < h - 1 && labels[i + w] >= 0 && labels[i + w] !== l)
        ) {
          boundary.data[i] = 1;
        }
      }
    }
    lines = dilate(boundary, lineHalfPx);

    if (params.keepDarkAreas) {
      // Abre para tirar pontinhos escuros de ruído antes de somar.
      const cleanDark = removeSmall(open(dark, Math.max(1, ppm * 0.2)), detailPx);
      lines = or(lines, cleanDark);
    }
  }

  // 3. Silhueta (base): desenho + linhas, falhas fechadas, buracos preenchidos.
  let base = or(opaque, lines);
  base = close(base, Math.max(1, ppm * 0.6));
  base = fillHoles(base);
  base = removeSmall(base, detailPx * 4);
  if (params.marginMm > 0) base = dilate(base, params.marginMm * ppm);

  // 4. Contorno na borda.
  const borderRing = params.borderLine ? andNot(base, erode(base, lineHalfPx * 2)) : null;
  if (borderRing) lines = or(lines, borderRing);

  // Acabamento: arredonda as linhas e fecha microfalhas.
  const smoothPx = Math.max(1, ppm * 0.2);
  lines = open(close(lines, smoothPx), smoothPx * 0.75);
  // O open pode comer o contorno da borda em cantos finos: repõe.
  if (borderRing) lines = or(lines, borderRing);
  lines = and(lines, base);

  // 5. Linha mínima imprimível.
  const minHalfPx = (MIN_LINE_MM * ppm) / 2;
  const findThin = (m: Mask) => andNot(m, open(m, minHalfPx));
  if (params.autoThicken) {
    const thin = findThin(lines);
    lines = and(or(lines, dilate(thin, minHalfPx * 0.75)), base);
  }
  lines = removeSmall(lines, Math.max(4, detailPx / 2));
  const thin = findThin(lines);

  const linesCount = countMask(lines);
  return {
    width: w,
    height: h,
    pxPerMm: ppm,
    base,
    lines,
    thin,
    widthMm: w / ppm,
    heightMm: h / ppm,
    thinPercent: linesCount ? (countMask(thin) / linesCount) * 100 : 0,
  };
}
