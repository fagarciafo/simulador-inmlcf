#!/usr/bin/env python3
"""Valida y une los archivos de fuentes/ en data/banco.json y data/banco.js.

Uso:  python3 tools/build_banco.py
Cada ítem: id, comp, ind, eje, enunciado, opciones (3), clave (0-2), just; opcional: caso.
"""
import json, pathlib, sys, collections

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "fuentes"
estructura = json.loads((ROOT / "data" / "estructura.json").read_text(encoding="utf-8"))
ind_validos = {i["id"]: comp for comp, lst in estructura["indicadores"].items() if not comp.startswith("_") for i in lst}

items, casos, errores = [], [], []
for f in sorted(SRC.glob("*.json")):
    data = json.loads(f.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        casos += data.get("casos", [])
        data = data.get("items", [])
    for it in data:
        it.setdefault("fuente", "Banco base (preguntas originales)")
        items.append(it)

ids = collections.Counter(i["id"] for i in items)
for i in items:
    p = i["id"]
    if ids[p] > 1: errores.append(f"{p}: id duplicado")
    if len(i.get("opciones", [])) != 3: errores.append(f"{p}: debe tener 3 opciones")
    if i.get("clave") not in (0, 1, 2): errores.append(f"{p}: clave inválida")
    if ind_validos.get(i.get("ind")) != i.get("comp"): errores.append(f"{p}: indicador {i.get('ind')} no corresponde a {i.get('comp')}")
    for k in ("enunciado", "just", "eje"):
        if not i.get(k): errores.append(f"{p}: falta {k}")

if errores:
    print("\n".join(errores)); sys.exit(1)

banco = {"version": "1.0", "items": items, "casos": casos}
(ROOT / "data" / "banco.json").write_text(json.dumps(banco, ensure_ascii=False, indent=1), encoding="utf-8")
(ROOT / "data" / "banco.js").write_text("window.BANCO_BASE = " + json.dumps(banco, ensure_ascii=False) + ";\nwindow.ESTRUCTURA = " + json.dumps(estructura, ensure_ascii=False) + ";\n", encoding="utf-8")

por_comp = collections.Counter(i["comp"] for i in items if not i.get("caso"))
por_ind = collections.Counter(i["ind"] for i in items if not i.get("caso"))
claves = collections.Counter("ABC"[i["clave"]] for i in items)
print(f"Ítems: {len(items)} (independientes {sum(por_comp.values())}, de casos {len(items)-sum(por_comp.values())}); casos: {len(casos)}")
print("Por componente:", dict(por_comp))
print("Por indicador:", dict(sorted(por_ind.items())))
print("Distribución de claves en la fuente:", dict(claves))
prof = {c["id"]: c["items"] for c in estructura["niveles"]["profesional"]["componentes"]}
for c, n in prof.items():
    estado = "OK" if por_comp.get(c, 0) >= n else "FALTAN"
    print(f"  Profesional {c}: requiere {n}, banco {por_comp.get(c,0)} -> {estado}")
