#!/usr/bin/env python3
from __future__ import annotations

import os
import json
import shutil
from pathlib import Path


ROOT = Path("/Users/gguthrie/Desktop/CS1.5")
SOURCE = ROOT / "source_game" / "DATA"
RESLISTS = SOURCE / "reslists"
STAGE = ROOT / "bundle_stage"
OUT = ROOT / "assets" / "valve.zip"
MANIFEST = STAGE / "manifest.json"


def normalize(line: str) -> str | None:
    line = line.strip()
    if not line or line.startswith("//"):
        return None
    if line.startswith("@"):
        return line.replace("\\", "/")
    path = line.split(",", 1)[0].strip().replace("\\", "/")
    return path if path else None


def add_from_list(ref: str, seen_lists: set[str], seen_files: set[str]) -> None:
    ref = ref.replace("\\", "/")
    if ref.startswith("@"):
        rel = ref[1:]
        if rel in seen_lists:
            return
        seen_lists.add(rel)
        list_path = SOURCE / rel
        for raw in list_path.read_text(errors="ignore").splitlines():
            entry = normalize(raw)
            if entry:
                add_from_list(entry, seen_lists, seen_files)
        return

    seen_files.add(ref)


def copy_tree(rel: str, seen_files: set[str]) -> None:
    base = SOURCE / rel
    if not base.exists():
        return
    for path in base.rglob("*"):
        if path.is_file():
            seen_files.add(path.relative_to(SOURCE).as_posix())


def copy_file(rel: str, seen_files: set[str]) -> None:
    path = SOURCE / rel
    if path.is_file():
        seen_files.add(rel)


def copy_root_files(rel: str, seen_files: set[str]) -> None:
    base = SOURCE / rel
    if not base.exists():
        return
    for path in base.iterdir():
        if path.is_file():
            seen_files.add(path.relative_to(SOURCE).as_posix())


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"missing source tree: {SOURCE}")

    seen_lists: set[str] = set()
    seen_files: set[str] = set()

    seeds = [
        "@reslists/Counter-Strike/counter-strike precache.lst",
        "@reslists/Counter-Strike/launcher_preloads.lst",
        "@reslists/Half-Life/base valve precache.lst",
        "@reslists/Counter-Strike/de_dust2.lst",
        "@reslists/Counter-Strike/cs_office.lst",
    ]

    for seed in seeds:
        add_from_list(seed, seen_lists, seen_files)

    for rel in [
        "cstrike/resource",
        "cstrike/gfx",
        "cstrike/sprites",
        "cstrike/sound",
        "valve/resource",
        "valve/gfx",
        "valve/hw",
    ]:
        copy_tree(rel, seen_files)

    copy_root_files("valve", seen_files)
    copy_root_files("cstrike", seen_files)

    if STAGE.exists():
        shutil.rmtree(STAGE)
    STAGE.mkdir(parents=True)
    (ROOT / "assets").mkdir(parents=True, exist_ok=True)

    for rel in sorted(seen_files):
        src = SOURCE / rel
        if not src.is_file():
            continue
        dst = STAGE / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    cstrike_liblist = STAGE / "cstrike" / "liblist.gam"
    if cstrike_liblist.exists():
        text = cstrike_liblist.read_text(errors="ignore")
        text = text.replace('gamedll "dlls\\mp.dll"', 'gamedll "dlls\\cs.dll"')
        os.chmod(cstrike_liblist, 0o644)
        cstrike_liblist.write_text(text)

    manifest_files = sorted(
        str(path.relative_to(STAGE).as_posix())
        for path in STAGE.rglob("*")
        if path.is_file()
    )
    MANIFEST.write_text(json.dumps({"files": manifest_files}, indent=2))

    if OUT.exists():
        OUT.unlink()

    os.chdir(STAGE)
    os.system(f"zip -qry '{OUT}' valve cstrike")

    size_mb = OUT.stat().st_size / (1024 * 1024)
    print(f"created {OUT} ({size_mb:.1f} MiB)")
    print(f"wrote {MANIFEST}")


if __name__ == "__main__":
    main()
