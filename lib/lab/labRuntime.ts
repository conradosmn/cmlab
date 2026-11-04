"use client";

import type { ManifoldToplevel } from "manifold-3d";
import type { Font } from "opentype.js";
import { fontUrl } from "./keychainFonts";

/** Carregamentos pesados do Laboratório, feitos uma vez por sessão. */

let manifoldPromise: Promise<ManifoldToplevel> | null = null;
const fontCache = new Map<string, Promise<Font>>();

export function loadManifold(): Promise<ManifoldToplevel> {
  if (!manifoldPromise) {
    manifoldPromise = import("manifold-3d").then(async ({ default: Module }) => {
      const wasm = await Module({ locateFile: () => "/lab/manifold.wasm" });
      wasm.setup();
      return wasm;
    });
    manifoldPromise.catch(() => {
      manifoldPromise = null;
    });
  }
  return manifoldPromise;
}

export function loadFont(id: string): Promise<Font> {
  let p = fontCache.get(id);
  if (!p) {
    p = Promise.all([import("opentype.js"), fetch(fontUrl(id))]).then(async ([ot, res]) => {
      if (!res.ok) throw new Error(`Fonte ${id} não encontrada.`);
      return ot.default.parse(await res.arrayBuffer());
    });
    p.catch(() => fontCache.delete(id));
    fontCache.set(id, p);
  }
  return p;
}
