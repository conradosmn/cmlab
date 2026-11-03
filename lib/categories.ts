import { Product, ProductCategoryDef } from "./types";

/** As quatro categorias originais da Feira TCE. Sempre presentes. */
export const DEFAULT_PRODUCT_CATEGORIES: ProductCategoryDef[] = [
  { id: "decoracao", label: "Vasos & Luminárias", tagline: "Vasos & Luminárias" },
  { id: "religioso", label: "Artigos Religiosos", tagline: "Espiritualidade & Fé" },
  { id: "fidgets", label: "Fidgets & Mimos", tagline: "Mimos & Fidgets" },
  { id: "chaveiros", label: "Chaveiros Personalizados", tagline: "Personalizados com Nome" },
];

/** "Organizadores de Escritório" -> "organizadores-de-escritorio" */
export function slugifyCategory(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "organizadores-de-escritorio" -> "Organizadores De Escritorio" (fallback). */
function labelFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Lista final de categorias: padrões + cadastradas + qualquer slug usado por
 * um produto que não esteja na lista (para nunca "sumir" uma categoria).
 */
export function mergeProductCategories(
  saved: ProductCategoryDef[] | undefined,
  products: Product[] = []
): ProductCategoryDef[] {
  const byId = new Map<string, ProductCategoryDef>();
  for (const c of DEFAULT_PRODUCT_CATEGORIES) byId.set(c.id, c);
  for (const c of Array.isArray(saved) ? saved : []) {
    if (c && typeof c.id === "string" && c.id.trim() && typeof c.label === "string") {
      byId.set(c.id, { ...byId.get(c.id), ...c });
    }
  }
  for (const p of products) {
    if (p.category && !byId.has(p.category)) {
      byId.set(p.category, { id: p.category, label: labelFromSlug(p.category) });
    }
  }
  return Array.from(byId.values());
}

export function findCategory(
  categories: ProductCategoryDef[],
  id: string
): ProductCategoryDef | undefined {
  return categories.find((c) => c.id === id);
}
