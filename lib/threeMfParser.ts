import JSZip from "jszip";
import { compressImageBlobToDataUrl } from "./imageUtils";

export interface Parsed3mfResult {
  title: string;
  weightGrams: number;
  printTimeMinutes: number;
  weightSource: "slice_info" | "mesh_geometry" | "none";
  plateCount: number;
  maxColors: number;
  filamentHexColors: string[];
  filamentTypes: string[];
  photos: string[];
}

/**
 * Calcula novo peso (g), tempo (min) e preço sugerido quando uma peça 3D é escalada
 * uniformemente em X/Y/Z (ex: +20% => scalePercent = 120, delta = +20%).
 *
 * Na impressão 3D FDM (paredes + preenchimento), o peso e o tempo não crescem de forma
 * puramente linear (S^1) nem puramente cúbica maciça (S^3), mas seguem uma potência
 * efetiva de ~S^2.35 (combinando perímetros S^2 e infill S^3).
 */
export function calculateScaled3DMetrics(params: {
  baseWeightGrams: number;
  basePrintTimeMinutes: number;
  basePriceBrl: number;
  scaleDeltaPercent: number; // ex: +20 para +20% (escala 120%), 0 para padrão (100%), -15 para -15% (85%)
}) {
  const scaleFactor = Math.max(0.2, (100 + params.scaleDeltaPercent) / 100);
  if (Math.abs(scaleFactor - 1) < 0.001) {
    return {
      scaleFactor: 1,
      scaleTotalPercent: 100,
      scaledWeightGrams: Math.round(params.baseWeightGrams),
      scaledPrintTimeMinutes: Math.round(params.basePrintTimeMinutes),
      scaledPriceBrl: Number(params.basePriceBrl.toFixed(2)),
      volumeMultiplier: 1,
    };
  }

  // Expoente real empírico do Bambu Studio (2 paredes + 12~15% gyroid/grid infill)
  const weightMultiplier = Math.pow(scaleFactor, 2.38);
  const timeMultiplier = Math.pow(scaleFactor, 2.15);
  // Preço acompanha o crescimento de material/tempo com arredondamento comercial suave
  const rawPrice = params.basePriceBrl * Math.pow(scaleFactor, 2.1);

  return {
    scaleFactor: Number(scaleFactor.toFixed(2)),
    scaleTotalPercent: Math.round(scaleFactor * 100),
    scaledWeightGrams: Math.max(1, Math.round(params.baseWeightGrams * weightMultiplier)),
    scaledPrintTimeMinutes: Math.max(
      1,
      Math.round(params.basePrintTimeMinutes * timeMultiplier)
    ),
    scaledPriceBrl: Math.ceil(rawPrice),
    volumeMultiplier: Number(weightMultiplier.toFixed(2)),
  };
}

/**
 * Calcula o volume (cm³) e a área superficial (cm²) de uma malha triangular XML (.model do 3MF)
 * aplicando eventual fator de escala da matriz 3D transform="m00 m01 m02 m10 m11 m12 m20 m21 m22 tx ty tz".
 */
function computeMeshVolumeAndAreaFromXml(
  xmlText: string,
  globalScaleFactor = 1
): { volumeCm3: number; areaCm2: number } {
  let totalVolumeMm3 = 0;
  let totalAreaMm2 = 0;

  // Detecta se há <item ... transform="..."> no próprio arquivo aplicando escala aos objetos
  const objectScales = new Map<string, number>();
  const itemRegex = /<item\b([^>]*)\/>/gi;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemRegex.exec(xmlText)) !== null) {
    const attrs = itemMatch[1];
    const objIdMatch = attrs.match(/objectid="([^"]+)"/i);
    const transformMatch = attrs.match(/transform="([^"]+)"/i);
    if (objIdMatch && transformMatch) {
      const nums = transformMatch[1]
        .trim()
        .split(/\s+/)
        .map((n) => parseFloat(n));
      if (nums.length >= 9 && !nums.some(isNaN)) {
        // Determinante da submatriz 3x3 de rotação/escala
        const det =
          nums[0] * (nums[4] * nums[8] - nums[5] * nums[7]) -
          nums[1] * (nums[3] * nums[8] - nums[5] * nums[6]) +
          nums[2] * (nums[3] * nums[7] - nums[4] * nums[6]);
        const linearScale = Math.cbrt(Math.abs(det)) || 1;
        const prev = objectScales.get(objIdMatch[1]) || 0;
        objectScales.set(objIdMatch[1], prev + linearScale);
      }
    } else if (objIdMatch) {
      const prev = objectScales.get(objIdMatch[1]) || 0;
      objectScales.set(objIdMatch[1], prev + 1);
    }
  }

  // Percorre cada <object id="..."> que contém um <mesh>
  const objectRegex = /<object\b([^>]*)>([\s\S]*?)<\/object>/gi;
  let objMatch: RegExpExecArray | null;

  while ((objMatch = objectRegex.exec(xmlText)) !== null) {
    const objAttrs = objMatch[1];
    const objBody = objMatch[2];
    if (!objBody.includes("<mesh")) continue;

    const idMatch = objAttrs.match(/id="([^"]+)"/i);
    const objId = idMatch ? idMatch[1] : "";
    const instanceLinearScale =
      (objectScales.get(objId) || 1) * globalScaleFactor;

    // Extrai vértices
    const vertices: Array<[number, number, number]> = [];
    const vertexRegex =
      /<vertex\s+x="([-+\d.eE]+)"\s+y="([-+\d.eE]+)"\s+z="([-+\d.eE]+)"/gi;
    let vMatch: RegExpExecArray | null;
    while ((vMatch = vertexRegex.exec(objBody)) !== null) {
      vertices.push([
        parseFloat(vMatch[1]),
        parseFloat(vMatch[2]),
        parseFloat(vMatch[3]),
      ]);
    }

    if (vertices.length < 3) continue;

    let meshSignedVol6 = 0;
    let meshArea2 = 0;

    const triRegex =
      /<triangle\s+v1="(\d+)"\s+v2="(\d+)"\s+v3="(\d+)"/gi;
    let tMatch: RegExpExecArray | null;
    while ((tMatch = triRegex.exec(objBody)) !== null) {
      const p1 = vertices[parseInt(tMatch[1], 10)];
      const p2 = vertices[parseInt(tMatch[2], 10)];
      const p3 = vertices[parseInt(tMatch[3], 10)];
      if (!p1 || !p2 || !p3) continue;

      // Volume assinado * 6
      const crossX = p2[1] * p3[2] - p2[2] * p3[1];
      const crossY = p2[2] * p3[0] - p2[0] * p3[2];
      const crossZ = p2[0] * p3[1] - p2[1] * p3[0];
      meshSignedVol6 += p1[0] * crossX + p1[1] * crossY + p1[2] * crossZ;

      // Área do triângulo * 2 = |(p2 - p1) x (p3 - p1)|
      const ux = p2[0] - p1[0];
      const uy = p2[1] - p1[1];
      const uz = p2[2] - p1[2];
      const vx = p3[0] - p1[0];
      const vy = p3[1] - p1[1];
      const vz = p3[2] - p1[2];
      const cx = uy * vz - uz * vy;
      const cy = uz * vx - ux * vz;
      const cz = ux * vy - uy * vx;
      meshArea2 += Math.sqrt(cx * cx + cy * cy + cz * cz);
    }

    const volMm3 =
      (Math.abs(meshSignedVol6) / 6.0) * Math.pow(instanceLinearScale, 3);
    const areaMm2 = (meshArea2 / 2.0) * Math.pow(instanceLinearScale, 2);

    totalVolumeMm3 += volMm3;
    totalAreaMm2 += areaMm2;
  }

  return {
    volumeCm3: totalVolumeMm3 / 1000.0,
    areaCm2: totalAreaMm2 / 100.0,
  };
}

/**
 * Lê um arquivo .3mf do Bambu Studio / MakerWorld e extrai:
 * 1. Peso total (soma de todas as placas em slice_info.config OU cálculo geométrico 3D caso o .3mf não esteja fatiado)
 * 2. Tempo total de impressão em minutos
 * 3. Fotos reais únicas (removendo duplicatas de .thumbnails)
 * 4. Cores e tipos de filamento do projeto
 */
export async function parseBambu3mfFile(file: File): Promise<Parsed3mfResult> {
  const zip = await JSZip.loadAsync(file);
  let title = file.name.replace(/\.3mf$/i, "").replace(/[-_]/g, " ");

  let extractedWeight = 0;
  let extractedSeconds = 0;
  let plateCount = 0;
  let weightSource: "slice_info" | "mesh_geometry" | "none" = "none";

  // 1. Lê configurações do projeto (densidade de infill, paredes, cores, etc.)
  let wallLoops = 2;
  let infillDensity = 0.15;
  let layerHeight = 0.2;
  const filamentHexColors: string[] = [];
  const filamentTypes: string[] = [];

  const projSettingsFile = zip.file("Metadata/project_settings.config");
  if (projSettingsFile) {
    try {
      const projJson = JSON.parse(await projSettingsFile.async("string"));
      if (projJson?.wall_loops) {
        wallLoops = parseInt(String(projJson.wall_loops), 10) || 2;
      }
      if (projJson?.sparse_infill_density) {
        const rawInf = parseFloat(
          String(projJson.sparse_infill_density).replace("%", "")
        );
        if (!isNaN(rawInf)) {
          infillDensity = rawInf > 1 ? rawInf / 100 : rawInf;
        }
      }
      if (projJson?.layer_height) {
        layerHeight = parseFloat(String(projJson.layer_height)) || 0.2;
      }
      if (Array.isArray(projJson?.filament_colour)) {
        for (const c of projJson.filament_colour) {
          if (typeof c === "string" && c.startsWith("#")) {
            filamentHexColors.push(c);
          }
        }
      }
      if (Array.isArray(projJson?.filament_type)) {
        for (const t of projJson.filament_type) {
          if (typeof t === "string") filamentTypes.push(t);
        }
      }
    } catch {
      // Ignora erro de parse do JSON
    }
  }

  // 2. Tenta extrair o peso e tempo exatos de TODAS as placas em Metadata/slice_info.config
  const sliceInfoFile = zip.file("Metadata/slice_info.config");
  if (sliceInfoFile) {
    const xmlText = await sliceInfoFile.async("string");
    const plateMatches = Array.from(
      xmlText.matchAll(/<plate>([\s\S]*?)<\/plate>/gi)
    );
    plateCount = plateMatches.length;

    let sumMetadataWeight = 0;
    let sumFilamentUsedG = 0;
    let sumPredictionSec = 0;

    // Soma todos os <metadata key="weight" value="..."/>
    for (const m of xmlText.matchAll(
      /key="weight"\s+value="([\d.]+)"/gi
    )) {
      const val = parseFloat(m[1]);
      if (!isNaN(val) && val > 0) sumMetadataWeight += val;
    }

    // Soma todos os <filament ... used_g="..."/> (muito comum em .3mf multi-cor / multi-placa)
    for (const m of xmlText.matchAll(/used_g="([\d.]+)"/gi)) {
      const val = parseFloat(m[1]);
      if (!isNaN(val) && val > 0) sumFilamentUsedG += val;
    }

    // Soma todos os <metadata key="prediction" value="..."/> (em segundos)
    for (const m of xmlText.matchAll(
      /key="prediction"\s+value="([\d.]+)"/gi
    )) {
      const val = parseFloat(m[1]);
      if (!isNaN(val) && val > 0) sumPredictionSec += val;
    }

    const bestWeight = Math.max(sumMetadataWeight, sumFilamentUsedG);
    if (bestWeight > 0) {
      extractedWeight = Math.ceil(bestWeight);
      weightSource = "slice_info";
    }
    if (sumPredictionSec > 0) {
      extractedSeconds = sumPredictionSec;
    }
  }

  // 3. Se o arquivo .3mf foi baixado do MakerWorld SEM estar fatiado (slice_info vazio/zerado),
  // calculamos o volume 3D real e área superficial de todas as malhas em 3D/*.model e 3D/Objects/*.model!
  if (extractedWeight <= 0) {
    const modelPaths = Object.keys(zip.files).filter(
      (p) => !zip.files[p].dir && /\.model$/i.test(p)
    );

    // Verifica em 3D/3dmodel.model se há transformações de escala (<component ... transform="..."/> ou <item ... transform="..."/>)
    let globalDetectedLinearScale = 1;
    const mainModelEntry = zip.file("3D/3dmodel.model");
    if (mainModelEntry) {
      const mainXml = await mainModelEntry.async("string");
      const titleMeta = mainXml.match(
        /<metadata\s+name="Title"[^>]*>([\s\S]*?)<\/metadata>/i
      );
      if (titleMeta?.[1]?.trim()) {
        title = titleMeta[1].trim();
      }

      // Analisa matrizes transform="m00 m01 m02 m10 m11 m12 m20 m21 m22 tx ty tz" em <item> e <component>
      const scalesFound: number[] = [];
      for (const tm of mainXml.matchAll(/<(?:item|component)\b[^>]*\btransform="([^"]+)"/gi)) {
        const nums = tm[1]
          .trim()
          .split(/\s+/)
          .map((n) => parseFloat(n));
        if (nums.length >= 9 && !nums.some(isNaN)) {
          const det =
            nums[0] * (nums[4] * nums[8] - nums[5] * nums[7]) -
            nums[1] * (nums[3] * nums[8] - nums[5] * nums[6]) +
            nums[2] * (nums[3] * nums[7] - nums[4] * nums[6]);
          const s = Math.cbrt(Math.abs(det));
          if (s > 0.05 && s < 20 && Math.abs(s - 1) > 0.01) {
            scalesFound.push(s);
          }
        }
      }
      if (scalesFound.length > 0) {
        globalDetectedLinearScale =
          scalesFound.reduce((a, b) => a + b, 0) / scalesFound.length;
      }
    }

    let totalVolumeCm3 = 0;
    let totalAreaCm2 = 0;

    for (const modelPath of modelPaths) {
      const entry = zip.file(modelPath);
      if (!entry) continue;
      const modelXml = await entry.async("string");

      const { volumeCm3, areaCm2 } = computeMeshVolumeAndAreaFromXml(
        modelXml,
        modelPath.toLowerCase().includes("objects/") ? globalDetectedLinearScale : 1
      );
      totalVolumeCm3 += volumeCm3;
      totalAreaCm2 += areaCm2;
    }

    if (totalVolumeCm3 > 0.2) {
      // Física de fatiamento FDM Bambu Lab A1:
      // - Espessura média da casca (paredes + topo/base): wallLoops * 0.042 cm (~0.84 mm para 2 paredes)
      const shellThicknessCm = Math.max(0.08, wallLoops * 0.042);
      const shellVolumeCm3 = Math.min(
        totalVolumeCm3 * 0.88,
        totalAreaCm2 * shellThicknessCm * 0.82
      );
      const interiorVolumeCm3 = Math.max(0, totalVolumeCm3 - shellVolumeCm3);
      const infillVolumeCm3 =
        interiorVolumeCm3 * Math.max(0.08, infillDensity);

      // Densidade PLA = 1.24 g/cm³ + 8% de linha de purga/suporte/brim
      const estimatedGrams =
        (shellVolumeCm3 + infillVolumeCm3) * 1.24 * 1.08;

      extractedWeight = Math.max(2, Math.round(estimatedGrams));
      weightSource = "mesh_geometry";

      // Na Bambu Lab A1 (0.20mm layer), a taxa média efetiva (contando viagens, primeira camada e retração)
      // fica em torno de ~1.65 min por grama em peças monocromáticas e ~2.1 min/g em peças detalhadas/multicor
      const minutesPerGram =
        (filamentHexColors.length > 1 ? 2.05 : 1.65) * (0.2 / layerHeight);
      extractedSeconds = Math.round(extractedWeight * minutesPerGram * 60);
    }
  } else {
    // Ainda assim, tenta ler o título oficial de 3D/3dmodel.model se existir
    const mainModel = zip.file("3D/3dmodel.model");
    if (mainModel) {
      const modelXml = await mainModel.async("string");
      const titleMeta = modelXml.match(
        /<metadata\s+name="Title"[^>]*>([\s\S]*?)<\/metadata>/i
      );
      if (titleMeta?.[1]?.trim()) {
        title = titleMeta[1].trim();
      }
    }
  }

  const printTimeMinutes =
    extractedSeconds > 0
      ? Math.max(1, Math.ceil(extractedSeconds / 60))
      : extractedWeight > 0
      ? Math.max(5, Math.round(extractedWeight * 1.7))
      : 0;

  // 4. Extrai fotos reais sem duplicar miniaturas (.thumbnails)
  const zipEntries = Object.keys(zip.files);

  // Prioridade 1: Fotos reais em Auxiliaries/Model Pictures (ignorando pasta .thumbnails)
  const modelPictures = zipEntries.filter(
    (p) =>
      !zip.files[p].dir &&
      /\.(png|jpe?g|webp)$/i.test(p) &&
      !p.toLowerCase().includes(".thumbnails") &&
      !p.toLowerCase().includes("profile") &&
      (p.toLowerCase().includes("model pictures") ||
        p.toLowerCase().includes("auxiliaries") ||
        p.toLowerCase().includes("pictures"))
  );

  // Prioridade 2: Miniaturas das placas 3D (plate_1.png,plate_2.png) sem small/no_light
  const plateThumbnails = zipEntries.filter(
    (p) =>
      !zip.files[p].dir &&
      /\.(png|jpe?g|webp)$/i.test(p) &&
      !p.toLowerCase().includes(".thumbnails") &&
      /metadata\/plate_\d+\.png$/i.test(p)
  );

  // Deduplica pelo nome-base do arquivo (ex: evita pegar cover.png e cover.jpg repetidos)
  const seenBasenames = new Set<string>();
  const uniqueCandidatePaths: string[] = [];

  for (const path of [...modelPictures, ...plateThumbnails]) {
    const base =
      path
        .split("/")
        .pop()
        ?.toLowerCase()
        .replace(/\.(png|jpe?g|webp)$/i, "") || path;
    if (seenBasenames.has(base)) continue;
    seenBasenames.add(base);
    uniqueCandidatePaths.push(path);
    if (uniqueCandidatePaths.length >= 6) break;
  }

  const photos: string[] = [];
  for (const imgPath of uniqueCandidatePaths) {
    const entry = zip.file(imgPath);
    if (entry) {
      const blob = await entry.async("blob");
      const optimizedDataUrl = await compressImageBlobToDataUrl(
        blob,
        1000,
        0.84,
        imgPath
      );
      photos.push(optimizedDataUrl);
    }
  }

  return {
    title,
    weightGrams: extractedWeight,
    printTimeMinutes,
    weightSource,
    plateCount,
    maxColors: Math.min(4, Math.max(1, filamentHexColors.length || 1)),
    filamentHexColors,
    filamentTypes,
    photos,
  };
}
