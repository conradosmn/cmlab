/**
 * Fontes do chaveiro articulado (OFL/Apache, copiadas para public/fonts/lab
 * por scripts/copy-lab-assets.mjs). Letras separadas articulam melhor.
 */
export interface KeychainFont {
  id: string;
  label: string;
  group: "Divertidas" | "Temáticas" | "Escritas à mão" | "Cursivas";
}

export const KEYCHAIN_FONTS: KeychainFont[] = [
  { id: "luckiest-guy", label: "Luckiest Guy", group: "Divertidas" },
  { id: "lilita-one", label: "Lilita One", group: "Divertidas" },
  { id: "chewy", label: "Chewy", group: "Divertidas" },
  { id: "titan-one", label: "Titan One", group: "Divertidas" },
  { id: "bubblegum-sans", label: "Bubblegum Sans", group: "Divertidas" },
  { id: "fredoka", label: "Fredoka", group: "Divertidas" },
  { id: "bangers", label: "Bangers", group: "Temáticas" },
  { id: "bungee", label: "Bungee", group: "Temáticas" },
  { id: "righteous", label: "Righteous", group: "Temáticas" },
  { id: "alfa-slab-one", label: "Alfa Slab One", group: "Temáticas" },
  { id: "permanent-marker", label: "Permanent Marker", group: "Escritas à mão" },
  { id: "pacifico", label: "Pacifico", group: "Cursivas" },
];

export const fontUrl = (id: string) => `/fonts/lab/${id}.woff`;
