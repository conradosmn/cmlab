"""
Aplica um perfil de filamento oficial do Bambu Studio aos 2 filamentos do
perfil das plaquinhas (lib/lab/bambu-a1-plate-settings.json).

O Bambu guarda os perfis em cadeia de herança (ex: "Generic PLA @BBL A1" ->
"Generic PLA @base" -> "fdm_filament_pla" -> "fdm_filament_common"). Este
script resolve a cadeia e grava os valores finais, como o próprio Bambu faz ao
salvar um projeto.

Uso:
  python scripts/bambu-filament-profile.py "Generic PLA @BBL A1"
  python scripts/bambu-filament-profile.py "Bambu PLA Lite @BBL A1" --bambu "C:/Program Files/Bambu Studio"
"""

import argparse
import json
import os
import sys

SETTINGS = os.path.join(os.path.dirname(__file__), "..", "lib", "lab", "bambu-a1-plate-settings.json")
SKIP = {
    "name", "inherits", "from", "setting_id", "instantiation", "type", "description",
    "compatible_printers", "compatible_printers_condition", "compatible_prints",
    "compatible_prints_condition", "version", "filament_settings_id",
}


def index_profiles(pdir):
    by_name = {}
    for root, _, files in os.walk(pdir):
        for f in files:
            if f.endswith(".json"):
                try:
                    j = json.load(open(os.path.join(root, f), encoding="utf-8"))
                except (ValueError, OSError):
                    continue
                if isinstance(j, dict) and j.get("name"):
                    by_name.setdefault(j["name"], j)
    return by_name


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("profile", help='Nome do perfil, ex: "Generic PLA @BBL A1"')
    ap.add_argument("--bambu", default="C:/Program Files/Bambu Studio")
    args = ap.parse_args()

    profiles = index_profiles(os.path.join(args.bambu, "resources", "profiles", "BBL", "filament"))
    chain, name = [], args.profile
    while name:
        if name not in profiles:
            sys.exit(f"Perfil não encontrado: {name}")
        chain.append(name)
        name = profiles[name].get("inherits")
    resolved = {}
    for nm in reversed(chain):
        resolved.update(profiles[nm])

    settings = json.load(open(SETTINGS, encoding="utf-8"))
    nf = len(settings["filament_settings_id"])
    changed = []
    for k, v in resolved.items():
        if k in SKIP:
            continue
        cur = settings.get(k)
        if isinstance(cur, list) and len(cur) == nf and isinstance(v, list) and len(v) == 1:
            if cur != [v[0]] * nf:
                changed.append((k, cur[0], v[0]))
            settings[k] = [v[0]] * nf

    settings["filament_settings_id"] = [args.profile] * nf
    settings["filament_ids"] = [resolved.get("filament_id", "")] * nf
    json.dump(settings, open(SETTINGS, "w", encoding="utf-8"), indent=4, ensure_ascii=False)

    print("Herança:", " <- ".join(chain))
    print(f"{len(changed)} valores alterados:")
    for k, a, b in changed:
        print(f"  {k}: {str(a)[:50]!r} -> {str(b)[:50]!r}")
    print("filament_ids:", settings["filament_ids"])


if __name__ == "__main__":
    main()
