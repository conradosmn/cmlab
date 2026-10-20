import { CustomKeychainData } from "./types";

const FONT_MAP: Record<string, string> = {
  rounded: "Fredoka:style=Bold",
  modern: "Montserrat:style=ExtraBold",
  script: "Pacifico:style=Regular",
};

/**
 * Gera script OpenSCAD parametrizado pronto para Bambu Studio (Multicolor / AMS Lite A1)
 * Inclui o chaveiro com argola no início (esquerda) e pingente VAZADO (shell 3D com furinho para elo).
 */
export function generateKeychainOpenSCAD(data: CustomKeychainData, orderNumber?: number): string {
  const scadFont = FONT_MAP[data.font] || "Fredoka:style=Bold";
  const safeName = (data.text || "Maria").replace(/"/g, "");

  return `// ============================================================================
// CM Casa Criativa (CMLab) - Gerador OpenSCAD p/ Bambu Lab A1 (AMS Lite)
// Pedido #${orderNumber ?? "AVULSO"} | Nome: "${safeName}"
// Base: ${data.base_color_name} (${data.base_hex})
// Letras: ${data.letter_color_name} (${data.letter_hex})
// Pingente Vazado: ${data.charm !== "none" ? `${data.charm.toUpperCase()} - ${data.charm_color_name} (${data.charm_hex})` : "Sem pingente"}
// ============================================================================

$fn = 64;

texto_nome = "${safeName}";
fonte_escolhida = "${scadFont}";
tamanho_fonte = 13;
espessura_base = 3.2;     // 3.2mm de base sólida
espessura_letras = 1.6;   // +1.6mm de relevo (troca de cor via objeto AMS)
raio_borda_offset = 3.2;  // Contorno orgânico ao redor das letras
incluir_pingente_vazado = ${data.charm !== "none" ? "true" : "false"};
tipo_pingente = "${data.charm}"; // star, flower, heart, butterfly, cat, cross

module texto_2d() {
    text(texto_nome, size = tamanho_fonte, font = fonte_escolhida, halign = "left", valign = "center", spacing = 1.02);
}

// 1. CORPO DA BASE + OLHAL DA ARGOLA NO INÍCIO DO CHAVEIRO (Extrusor 1 - ${data.base_color_name})
color("${data.base_hex}")
linear_extrude(height = espessura_base) {
    difference() {
        union() {
            offset(r = raio_borda_offset)
                texto_2d();
            // Olhal no início do nome (esquerda) para argola e pingente
            translate([-5.5, 0, 0])
                circle(d = 9);
        }
        // Furo de 4.2mm para argola no início do chaveiro
        translate([-6.0, 0, 0])
            circle(d = 4.2);
    }
}

// 2. RELEVO DAS LETRAS (Extrusor 2 - ${data.letter_color_name})
color("${data.letter_hex}")
translate([0, 0, espessura_base])
linear_extrude(height = espessura_letras) {
    texto_2d();
}

// 3. PINGENTE 3D VAZADO COM OLHAL P/ ELO (Extrusor 3 - ${data.charm_color_name || "Opcional"})
module pingente_vazado_2d() {
    difference() {
        union() {
            // Contorno externo arredondado
            offset(r = 2.4) circle(d = 15, $fn = (tipo_pingente == "star" ? 5 : 48));
            // Olhal superior para a argolinha/ilha
            translate([0, 9.5, 0]) circle(d = 4.6);
        }
        // Recorte central vazado
        offset(r = -0.8) circle(d = 11, $fn = (tipo_pingente == "star" ? 5 : 48));
        // Furinho de 2.0mm para o elo metálico
        translate([0, 9.8, 0]) circle(d = 2.0);
    }
}

if (incluir_pingente_vazado) {
    color("${data.charm_hex || "#D4AF37"}")
    translate([-24, 0, 0])
    linear_extrude(height = espessura_base) {
        pingente_vazado_2d();
    }
}
`;
}
