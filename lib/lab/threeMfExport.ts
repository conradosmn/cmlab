import JSZip from "jszip";
import * as THREE from "three";
import type { PlatePiece } from "./plateGeometry";

/**
 * Gera um .3mf no formato de projeto do Bambu Studio: cada plaquinha é um
 * objeto com duas partes — base (filamento 1) e linhas (filamento 2) — para
 * abrir já com as cores separadas, como no kit de referência.
 */

const fmt = (n: number) => {
  const s = n.toFixed(4);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function meshXml(geo: THREE.BufferGeometry): string {
  const pos = geo.getAttribute("position");
  const index = geo.getIndex();
  const parts: string[] = ["<mesh><vertices>"];
  for (let i = 0; i < pos.count; i++) {
    parts.push(
      `<vertex x="${fmt(pos.getX(i))}" y="${fmt(pos.getY(i))}" z="${fmt(pos.getZ(i))}"/>`
    );
  }
  parts.push("</vertices><triangles>");
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      const b = index.getX(i + 1);
      const c = index.getX(i + 2);
      if (a === b || b === c || a === c) continue;
      parts.push(`<triangle v1="${a}" v2="${b}" v3="${c}"/>`);
    }
  } else {
    for (let i = 0; i < pos.count; i += 3) {
      parts.push(`<triangle v1="${i}" v2="${i + 1}" v3="${i + 2}"/>`);
    }
  }
  parts.push("</triangles></mesh>");
  return parts.join("");
}

const hasTriangles = (g: THREE.BufferGeometry) =>
  (g.getIndex()?.count ?? g.getAttribute("position")?.count ?? 0) >= 3;

export interface ExportOptions {
  title: string;
  /**
   * Configuração de impressão do Bambu Studio (Metadata/project_settings.config).
   * Sem ela, o Bambu abre com o perfil que estiver selecionado.
   */
  projectSettings?: Record<string, unknown>;
  /** Filamento (1-based) de cada parte. */
  baseExtruder?: number;
  lineExtruder?: number;
  /** Altura de camada por objeto (mm), sobrepondo a do perfil. */
  layerHeightMm?: number;
  /** Nome das duas partes de cada objeto no Bambu. */
  partNames?: [string, string];
  /** Cores gravadas nos filamentos da base e das linhas. */
  baseColor?: string;
  lineColor?: string;
}

export async function exportPlates3mf(
  pieces: PlatePiece[],
  opts: ExportOptions
): Promise<Blob> {
  const zip = new JSZip();
  const today = new Date().toISOString().slice(0, 10);
  const objectsPath = "/3D/Objects/object_1.model";

  const baseExtruder = opts.baseExtruder ?? 1;
  const lineExtruder = opts.lineExtruder ?? 2;
  const partNames = opts.partNames ?? ["Base", "Linhas"];
  const layerMeta = opts.layerHeightMm
    ? `
    <metadata key="layer_height" value="${opts.layerHeightMm}"/>`
    : "";

  let nextId = 1;
  const meshObjects: string[] = [];
  const assemblies: string[] = [];
  const buildItems: string[] = [];
  const settingsObjects: string[] = [];
  const plateInstances: string[] = [];

  pieces.forEach((piece, idx) => {
    const parts: { geo: THREE.BufferGeometry; name: string; extruder: number }[] = [
      { geo: piece.base, name: partNames[0], extruder: baseExtruder },
      { geo: piece.lines, name: partNames[1], extruder: lineExtruder },
    ].filter((p) => hasTriangles(p.geo));
    if (parts.length === 0) return;

    const partIds = parts.map((p) => {
      const id = nextId++;
      meshObjects.push(
        `<object id="${id}" type="model">${meshXml(p.geo)}</object>`
      );
      return id;
    });

    const assemblyId = nextId++;
    const components = partIds
      .map(
        (id) =>
          `<component p:path="${objectsPath}" objectid="${id}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>`
      )
      .join("");
    assemblies.push(
      `<object id="${assemblyId}" type="model"><components>${components}</components></object>`
    );
    buildItems.push(
      `<item objectid="${assemblyId}" transform="1 0 0 0 1 0 0 0 1 ${fmt(piece.x)} ${fmt(
        piece.y
      )} 0" printable="1"/>`
    );

    const safeName = escapeXml(piece.name);
    const partSettings = parts
      .map(
        (p, i) => `    <part id="${partIds[i]}" subtype="normal_part">
      <metadata key="name" value="${safeName} - ${p.name}"/>
      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
      <metadata key="extruder" value="${p.extruder}"/>
    </part>`
      )
      .join("\n");
    settingsObjects.push(`  <object id="${assemblyId}">
    <metadata key="name" value="${safeName}"/>
    <metadata key="extruder" value="${baseExtruder}"/>${layerMeta}
${partSettings}
  </object>`);
    plateInstances.push(`    <model_instance>
      <metadata key="object_id" value="${assemblyId}"/>
      <metadata key="instance_id" value="0"/>
      <metadata key="identify_id" value="${100 + idx}"/>
    </model_instance>`);
  });

  if (buildItems.length === 0) {
    throw new Error("Nenhuma plaquinha para exportar.");
  }

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
 <Default Extension="config" ContentType="text/xml"/>
</Types>`
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`
  );

  zip.file(
    "3D/_rels/3dmodel.model.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="${objectsPath}" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`
  );

  const ns =
    'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021"';

  zip.file(
    "3D/3dmodel.model",
    `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="pt-BR" ${ns} requiredextensions="p">
 <metadata name="Application">BambuStudio-02.00.00.00</metadata>
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <metadata name="Title">${escapeXml(opts.title)}</metadata>
 <metadata name="Designer">CMLab - Laboratório</metadata>
 <metadata name="CreationDate">${today}</metadata>
 <metadata name="ModificationDate">${today}</metadata>
 <resources>
${assemblies.join("\n")}
 </resources>
 <build>
${buildItems.join("\n")}
 </build>
</model>`
  );

  zip.file(
    "3D/Objects/object_1.model",
    `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="pt-BR" ${ns}>
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <resources>
${meshObjects.join("\n")}
 </resources>
 <build/>
</model>`
  );

  zip.file(
    "Metadata/model_settings.config",
    `<?xml version="1.0" encoding="UTF-8"?>
<config>
${settingsObjects.join("\n")}
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value=""/>
    <metadata key="locked" value="false"/>
${plateInstances.join("\n")}
  </plate>
</config>`
  );

  if (opts.projectSettings) {
    const settings = JSON.parse(JSON.stringify(opts.projectSettings)) as Record<string, unknown>;
    const colours = settings.filament_colour;
    if (Array.isArray(colours)) {
      if (opts.baseColor && baseExtruder <= colours.length) colours[baseExtruder - 1] = opts.baseColor.toUpperCase();
      if (opts.lineColor && lineExtruder <= colours.length) colours[lineExtruder - 1] = opts.lineColor.toUpperCase();
    }
    zip.file("Metadata/project_settings.config", JSON.stringify(settings, null, 4));
  }

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
