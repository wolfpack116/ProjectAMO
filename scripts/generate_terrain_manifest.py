"""해외 DEM 타일 매니페스트 생성 (1단계).

연직단면도 지형 확장을 위해 받을 Copernicus GLO-30 1°×1° 타일 목록을 산출한다.
- 후보 셀 = 해외 항로가 지나는 1° 셀 ∪ 공항 주변 3×3 (IFR는 항로 위만 나므로 이걸로 충분)
- 한국 기존 커버(경도 124~130, 위도 33~43)는 제외
- 각 후보를 Copernicus 오픈 S3에 HEAD 요청 → 실제 존재(=육지) 타일만 + 정확한 용량 집계

출력: backend/data/terrain/overseas-tile-manifest.json  (실제 존재 타일 목록 + 용량)
사용: python scripts/generate_terrain_manifest.py
"""
from __future__ import annotations

import json
import math
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "frontend" / "public" / "data"
OUT = ROOT / "backend" / "data" / "terrain" / "overseas-tile-manifest.json"

KOREA = {(lo, la) for lo in range(124, 130) for la in range(33, 43)}  # 이미 커버
# GLO-90(3초=90m) — 우리 한국 DEM과 같은 해상도. GLO-30(30m)은 8배 크고 어차피 90m로 버림.
S3 = "https://copernicus-dem-90m.s3.amazonaws.com"


def cell(lon: float, lat: float) -> tuple[int, int]:
    return (math.floor(lon), math.floor(lat))


def candidate_cells() -> set[tuple[int, int]]:
    cells: set[tuple[int, int]] = set()
    # 공항 + 3×3 이웃(접근·이탈 구역)
    ap = json.loads((PUBLIC / "navdata" / "airports-overseas.json").read_text(encoding="utf-8"))
    for a in ap.values():
        c = cell(a["coordinates"]["lon"], a["coordinates"]["lat"])
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                cells.add((c[0] + dx, c[1] + dy))
    # 항로가 지나는 셀(선 보간 샘플 0.2°)
    aw = json.loads((PUBLIC / "airways-overseas.geojson").read_text(encoding="utf-8"))
    for f in aw["features"]:
        for part in f["geometry"]["coordinates"]:
            for i in range(len(part) - 1):
                (x1, y1), (x2, y2) = part[i], part[i + 1]
                n = max(2, int(math.hypot(x2 - x1, y2 - y1) / 0.2))
                for t in range(n + 1):
                    cells.add(cell(x1 + (x2 - x1) * t / n, y1 + (y2 - y1) * t / n))
    return cells - KOREA


def cop_name(lon: int, lat: int) -> str:
    ns = f"N{lat:02d}" if lat >= 0 else f"S{abs(lat):02d}"
    return f"Copernicus_DSM_COG_30_{ns}_00_E{lon:03d}_00_DEM"  # COG_30 = GLO-90(90m)


def probe(lonlat: tuple[int, int]) -> tuple[tuple[int, int], int | None]:
    """존재하면 (cell, bytes), 없으면 (cell, None). Content-Length로 정확 용량."""
    lon, lat = lonlat
    name = cop_name(lon, lat)
    url = f"{S3}/{name}/{name}.tif"
    req = urllib.request.Request(url, method="HEAD")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return lonlat, int(r.headers.get("Content-Length") or 0)
    except Exception:
        return lonlat, None


def main() -> None:
    cands = sorted(candidate_cells())
    print(f"후보 셀(항로+공항, 한국 제외): {len(cands)}개  검증 중(Copernicus HEAD)...")
    with ThreadPoolExecutor(max_workers=24) as ex:
        results = list(ex.map(probe, cands))

    land = [(c, b) for c, b in results if b is not None]
    total_bytes = sum(b for _, b in land)
    lats = [c[1] for c, _ in land]
    south = [c for c, _ in land if c[1] < 0]

    tiles = [{"lon": lo, "lat": la, "srcBytes": b, "copName": cop_name(lo, la)} for (lo, la), b in sorted(land)]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "candidateCells": len(cands),
        "existingTiles": len(land),
        "totalSrcBytes": total_bytes,
        "latRange": [min(lats), max(lats)] if lats else None,
        "southTiles": len(south),
        "tiles": tiles,
    }, indent=2), encoding="utf-8")

    gb = total_bytes / 1024**3
    print(f"실제 존재(육지) 타일: {len(land)} / {len(cands)}")
    print(f"원본(GeoTIFF) 총 용량: {gb:.2f} GB  (평균 {total_bytes/len(land)/1024**2:.1f} MB/타일)" if land else "(없음)")
    print(f"위도 범위: {min(lats)}~{max(lats)+1}  | 남반구(S) 타일: {len(south)}개")
    print(f"매니페스트 저장: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
