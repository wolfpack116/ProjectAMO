"""해외 DEM 타일 준비 (3단계).

overseas-tile-manifest.json의 Copernicus GLO-90(3초=90m) 타일을 받아
한국 korea3sec 타일과 동일 규격으로 변환하고 metadata.json에 병합한다.

우리 규격(prepare-terrain-tiles.js와 동일):
  - 1201×1201 (모서리 포함), pointsPerDegree=1200
  - Int16 빅엔디안(int16be), 없음값 -32768, 단위 m
  - row0 = 남쪽(tileLat), col0 = 서쪽(tileLon)
  - 타일명 E{lon:03d}_{N|S}{lat:02d}.bin

한 타일씩 받아→변환→원본 삭제(순간 디스크 최소). 이미 있는 .bin은 건너뜀(재개 가능).
사용: python scripts/prepare_overseas_terrain_tiles.py [--limit N] [--workers 8]
"""
from __future__ import annotations

import argparse
import json
import sys
import tempfile
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
import rasterio

ROOT = Path(__file__).resolve().parents[1]
TERRAIN = ROOT / "backend" / "data" / "terrain"
TILES = TERRAIN / "tiles"
META = TILES / "metadata.json"
MANIFEST = TERRAIN / "overseas-tile-manifest.json"
S3 = "https://copernicus-dem-90m.s3.amazonaws.com"
PPD = 1200
NODATA = -32768


def tile_bin_name(lon: int, lat: int) -> str:
    ns = f"N{lat:02d}" if lat >= 0 else f"S{abs(lat):02d}"
    return f"E{lon:03d}_{ns}.bin"


def convert_one(lon: int, lat: int, cop_name: str) -> dict | None:
    """GLO-90 타일 1장 → 우리 .bin. 성공 시 metadata용 tile dict, 이미 있으면 그대로, 실패 None."""
    out_path = TILES / tile_bin_name(lon, lat)
    bounds = {"minLon": lon, "maxLon": lon + 1, "minLat": lat, "maxLat": lat + 1}
    entry = {"name": out_path.name, "bounds": bounds, "rows": PPD + 1, "cols": PPD + 1}
    if out_path.exists():
        return entry

    url = f"{S3}/{cop_name}/{cop_name}.tif"
    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        urllib.request.urlretrieve(url, tmp_path)
        with rasterio.open(tmp_path) as ds:
            arr = ds.read(1).astype(np.float64)
            t = ds.transform
            nod = ds.nodata
        # 우리 격자 좌표에서 최근접 샘플(row0=남=lat, col0=서=lon). 모서리(lon+1/lat+1)는 가장자리 클램프.
        tgt_lat = lat + np.arange(PPD + 1) / PPD
        tgt_lon = lon + np.arange(PPD + 1) / PPD
        src_rows = np.clip(((tgt_lat - t.f) / t.e).astype(int), 0, arr.shape[0] - 1)
        src_cols = np.clip(((tgt_lon - t.c) / t.a).astype(int), 0, arr.shape[1] - 1)
        grid = arr[np.ix_(src_rows, src_cols)]
        if nod is not None:
            grid = np.where(grid == nod, NODATA, grid)
        out = np.clip(np.round(grid), -32767, 32767).astype(">i2")  # int16 빅엔디안
        out[grid == NODATA] = NODATA
        out.tofile(out_path)
        return entry
    except Exception as e:  # noqa: BLE001
        print(f"  [FAIL] {cop_name}: {e}", file=sys.stderr)
        return None
    finally:
        tmp_path.unlink(missing_ok=True)


def merge_metadata(entries: list[dict]) -> None:
    """기존 한국 metadata.json에 해외 타일 병합 + bounds 확장. 없으면 새로."""
    if META.exists():
        meta = json.loads(META.read_text(encoding="utf-8").replace("﻿", ""))
    else:
        meta = {"byteOrder": "int16be", "heightUnit": "m", "pointsPerDegree": PPD,
                "noDataValues": [NODATA], "tileOrder": "lat-ascending-lon-ascending", "tiles": {}}
    tiles = meta.setdefault("tiles", {})
    for e in entries:
        tiles[e["name"]] = e
    # bounds = 모든 타일 포함 범위
    los = [t["bounds"]["minLon"] for t in tiles.values()]
    las = [t["bounds"]["minLat"] for t in tiles.values()]
    meta["bounds"] = {
        "minLon": min(los), "maxLon": max(t["bounds"]["maxLon"] for t in tiles.values()),
        "minLat": min(las), "maxLat": max(t["bounds"]["maxLat"] for t in tiles.values()),
    }
    META.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="처음 N개만(테스트)")
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()

    if not MANIFEST.exists():
        raise SystemExit(f"매니페스트 없음: {MANIFEST}. 먼저 generate_terrain_manifest.py 실행.")
    TILES.mkdir(parents=True, exist_ok=True)
    tiles = json.loads(MANIFEST.read_text(encoding="utf-8"))["tiles"]
    if args.limit:
        tiles = tiles[: args.limit]

    total = len(tiles)
    print(f"변환 대상 {total}타일 (workers={args.workers})")
    entries, done, fail = [], 0, 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(convert_one, t["lon"], t["lat"], t["copName"]): t for t in tiles}
        for fut in as_completed(futs):
            e = fut.result()
            done += 1
            if e:
                entries.append(e)
            else:
                fail += 1
            if done % 50 == 0 or done == total:
                print(f"  {done}/{total} (실패 {fail})")

    merge_metadata(entries)
    b = json.loads(META.read_text(encoding="utf-8"))["bounds"]
    print(f"완료: {len(entries)}타일 병합, 실패 {fail} | metadata bounds {b}")


if __name__ == "__main__":
    main()
