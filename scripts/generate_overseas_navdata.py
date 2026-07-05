"""해외 항로 navdata 변환기 (테스트용).

X-Plane earth_awy.dat / earth_fix.dat → 우리 route-graph 포맷(generate_navdata.py와 동일 shape).
국내(한국 AIP 기반)는 그대로 두고, 해외 세그먼트만 *-overseas.json 으로 따로 출력한다.
정식 회사 AIRAC 자료가 오면 SRC만 교체하면 됨.

ponytail: 항로명이 'G472-N895' 처럼 여러 개면 첫 이름만 사용(테스트엔 충분, 대부분 단일).

사용:
  NAVDATA_SRC=<earth_awy.dat/earth_fix.dat 있는 폴더> \
  NAVDATA_OUT=<출력 폴더> \
  python scripts/generate_overseas_navdata.py
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(os.environ.get("NAVDATA_SRC", ROOT / "reference" / "navdata-xplane"))
OUT = Path(os.environ.get("NAVDATA_OUT", ROOT / "frontend" / "public" / "data" / "navdata"))
CYCLE = "X-Plane 2012.08 (test placeholder — replace with company AIRAC)"

# 대상: 아시아 박스. 한국 국내(이미 AIP로 보유)는 중복 방지로 제외.
ASIA = {"lat": (0.0, 45.0), "lon": (95.0, 150.0)}
KOREA = {"lat": (33.0, 39.0), "lon": (124.0, 131.5)}
RNAV_PREFIX = {"L", "Y", "Z"}


def in_box(lat: float, lon: float, box: dict) -> bool:
    return box["lat"][0] <= lat <= box["lat"][1] and box["lon"][0] <= lon <= box["lon"][1]


def haversine_nm(a: dict, b: dict) -> float:
    r = 3440.065
    lat1, lat2 = math.radians(a["lat"]), math.radians(b["lat"])
    dlat = math.radians(b["lat"] - a["lat"])
    dlon = math.radians(b["lon"] - a["lon"])
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return round(r * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h)), 2)


def route_type(route_id: str) -> str:
    return "RNAV" if route_id[:1] in RNAV_PREFIX else "ATS"


def load_incheon_fir(public_dir: Path):
    """fir.geojson에서 인천 FIR 외곽 링들을 뽑는다. 국내 도메스틱 항로가 정확히 이 FIR을 덮으므로,
    이 폴리곤 안쪽 해외 항로를 제외하면 겹침이 사라진다. 없으면 None(→ 박스 폴백)."""
    path = public_dir / "fir.geojson"
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    for feat in data.get("features", []):
        geom = feat.get("geometry") or {}
        if geom.get("type") == "MultiPolygon":
            return [poly[0] for poly in geom["coordinates"]]  # 외곽 링만(홀 무시)
    return None


def point_in_ring(lon: float, lat: float, ring) -> bool:
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def rings_bbox(rings):
    xs = [p[0] for r in rings for p in r]
    ys = [p[1] for r in rings for p in r]
    return (min(xs), max(xs), min(ys), max(ys))


def point_in_fir(lon: float, lat: float, fir_rings, bbox) -> bool:
    """점이 인천 FIR 안이면 True. bbox로 먼 점은 즉시 제외."""
    if not fir_rings:
        return False
    lo_min, lo_max, la_min, la_max = bbox
    if lon < lo_min or lon > lo_max or lat < la_min or lat > la_max:
        return False
    return any(point_in_ring(lon, lat, r) for r in fir_rings)


def parse_awy(path: Path, fir_rings=None):
    """earth_awy.dat: id1 lat1 lon1 id2 lat2 lon2 type baseFL topFL airway[-airway...]"""
    segments, seen = [], set()
    fir_bbox = rings_bbox(fir_rings) if fir_rings else None
    with path.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            parts = line.split()
            if len(parts) < 10:
                continue
            try:
                id1, la1, lo1, id2, la2, lo2 = parts[0], float(parts[1]), float(parts[2]), parts[3], float(parts[4]), float(parts[5])
            except ValueError:
                continue  # 헤더/버전 줄 스킵
            a, b = {"lat": la1, "lon": lo1}, {"lat": la2, "lon": lo2}
            # 한쪽이라도 아시아 안
            if not (in_box(la1, lo1, ASIA) or in_box(la2, lo2, ASIA)):
                continue
            # 국내 겹침 제거: 양끝이 모두 인천 FIR 안인 항로만 제외(순수 국내 중복 = 도메스틱이 이미 덮음).
            # 한쪽이라도 FIR 밖이면 유지 → FIR 밖으로 나가는 연결 보존.
            # FIR 폴리곤 없으면 박스 폴백(양끝 다 국내 박스면 제외).
            if fir_rings is not None:
                if point_in_fir(lo1, la1, fir_rings, fir_bbox) and point_in_fir(lo2, la2, fir_rings, fir_bbox):
                    continue
            elif in_box(la1, lo1, KOREA) and in_box(la2, lo2, KOREA):
                continue
            airway = parts[9].split("-")[0]
            # X-Plane은 같은 구간을 저/고고도 두 줄로 싣음 → (양끝, 항로) 기준 중복 제거
            key = (tuple(sorted((id1, id2))), airway)
            if key in seen:
                continue
            seen.add(key)
            segments.append({"id1": id1, "a": a, "id2": id2, "b": b, "awy": airway})
    return segments


def build_key_resolver(segments):
    """짧은 항행표지 코드(JB·KK·MKG 등)는 전세계에서 재사용되어 이름만으로 노드를 만들면
    한국 JB와 싱가포르 JB가 한 노드로 합쳐져 '순간이동' 경로가 생긴다.
    → 같은 ident이 50nm 넘게 떨어진 여러 위치에 있으면 ident#0, ident#1로 분리한다.
    (5글자 경계 웨이포인트는 대개 단일 위치라 bare ident 유지 → 국내 그래프와 연결됨)."""
    from collections import defaultdict
    clusters = defaultdict(list)  # ident -> [[lat, lon], ...]

    def cluster_index(ident, coord):
        cl = clusters[ident]
        for i, (la, lo) in enumerate(cl):
            if haversine_nm({"lat": la, "lon": lo}, coord) < 50:
                return i
        cl.append([coord["lat"], coord["lon"]])
        return len(cl) - 1

    for s in segments:
        cluster_index(s["id1"], s["a"])
        cluster_index(s["id2"], s["b"])

    def key_of(ident, coord):
        cl = clusters[ident]
        if len(cl) <= 1:
            return ident
        return f"{ident}#{cluster_index(ident, coord)}"

    multi = sum(1 for cl in clusters.values() if len(cl) > 1)
    return key_of, multi


def parse_fix(path: Path):
    """earth_fix.dat: lat lon ident  → 이름 표시용 좌표 사전(옵션)."""
    fixes = {}
    if not path.exists():
        return fixes
    with path.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            parts = line.split()
            if len(parts) < 3:
                continue
            try:
                lat, lon = float(parts[0]), float(parts[1])
            except ValueError:
                continue
            fixes[parts[2]] = {"lat": lat, "lon": lon}
    return fixes


def build(segments):
    navpoints, routes, route_segments, seq_counter = {}, {}, [], {}

    for s in segments:
        for ident, coord in ((s["id1"], s["a"]), (s["id2"], s["b"])):
            navpoints.setdefault(ident, {"id": ident, "coordinates": coord, "kind": "waypoint", "source": "xplane", "cycle": CYCLE})

        rid = s["awy"]
        rtype = route_type(rid)
        seq_counter[rid] = seq_counter.get(rid, 0) + 1
        seq = seq_counter[rid]
        dist = haversine_nm(s["a"], s["b"])
        route_segments.append({
            # 국내와 같은 항로명(A582 등)을 X-Plane도 가져 세그먼트 id가 겹침 → OVS- 접두어로 분리.
            # 그래프 링크도 seg["id"]를 참조하므로 접두어가 함께 전파됨.
            "id": f"OVS-{rid}-{seq:03d}",
            "routeId": rid,
            "routeType": rtype,
            "sequence": seq,
            "from": s["id1"],
            "to": s["id2"],
            "distanceNm": dist,
            "geometry": {"type": "LineString", "coordinates": [[s["a"]["lon"], s["a"]["lat"]], [s["b"]["lon"], s["b"]["lat"]]]},
            "source": "xplane earth_awy.dat",
            "cycle": CYCLE,
        })
        r = routes.setdefault(rid, {"id": rid, "type": rtype, "sources": ["xplane"], "sequence": [], "segmentCount": 0, "cycle": CYCLE})
        for ident in (s["id1"], s["id2"]):
            if ident not in r["sequence"]:
                r["sequence"].append(ident)
        r["segmentCount"] += 1

    graph = {}
    for seg in route_segments:
        for start, end in ((seg["from"], seg["to"]), (seg["to"], seg["from"])):
            graph.setdefault(start, []).append({
                "to": end, "routeId": seg["routeId"], "routeType": seg["routeType"],
                "segmentId": seg["id"], "distanceNm": seg["distanceNm"],
            })
    for links in graph.values():
        links.sort(key=lambda l: (l["to"], l["routeId"]))

    return navpoints, routes, route_segments, {k: graph[k] for k in sorted(graph)}


def write_json(name: str, data) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / name).open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=True, indent=2, sort_keys=True)
        f.write("\n")


def write_airways_geojson(route_segments) -> int:
    """지도 표시용: 항로별로 세그먼트를 MultiLineString으로 묶어 도메스틱 airways.geojson과
    동일 스키마(ident_txt)로 출력 → 기존 ats-route/rnav-route 렌더러가 그대로 그림."""
    by_route: dict[str, dict] = {}
    for s in route_segments:
        entry = by_route.setdefault(s["routeId"], {"type": s["routeType"], "coords": []})
        entry["coords"].append(s["geometry"]["coordinates"])
    features = [
        {
            "type": "Feature",
            "properties": {"ident_txt": rid, "routeType": info["type"], "source": "xplane", "cycle": CYCLE},
            "geometry": {"type": "MultiLineString", "coordinates": info["coords"]},
        }
        for rid, info in sorted(by_route.items())
    ]
    path = OUT.parent / "airways-overseas.geojson"  # public/data/ (navdata의 부모)
    with path.open("w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f, ensure_ascii=True)
        f.write("\n")
    return len(features)


def write_waypoints_geojson(navpoints: dict) -> int:
    """지도 표시용 해외 웨이포인트 Point GeoJSON. `ident`+circle 표시(라벨은 밀집이라 기본 비활성)."""
    features = [
        {
            "type": "Feature",
            "properties": {"ident": ident, "source": "xplane", "cycle": CYCLE},
            "geometry": {"type": "Point", "coordinates": [p["coordinates"]["lon"], p["coordinates"]["lat"]]},
        }
        for ident, p in sorted(navpoints.items())
    ]
    path = OUT.parent / "waypoints-overseas.geojson"
    with path.open("w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f, ensure_ascii=True)
        f.write("\n")
    return len(features)


def main() -> None:
    fir_rings = load_incheon_fir(OUT.parent)  # public/data/fir.geojson
    segments = parse_awy(SRC / "earth_awy.dat", fir_rings)
    # 이름 중복 지점 분리(웜홀 방지): 같은 ident이 여러 위치면 ident#0/#1로.
    key_of, multi_count = build_key_resolver(segments)
    for s in segments:
        s["id1"] = key_of(s["id1"], s["a"])
        s["id2"] = key_of(s["id2"], s["b"])
    build_fixes = parse_fix(SRC / "earth_fix.dat")  # 표시 보강용(현재 좌표는 awy 인라인으로 충분)
    navpoints, routes, route_segments, graph = build(segments)

    write_json("navpoints-overseas.json", {k: navpoints[k] for k in sorted(navpoints)})
    write_json("routes-overseas.json", routes)
    write_json("route-segments-overseas.json", route_segments)
    write_json("route-graph-overseas.json", graph)
    airway_features = write_airways_geojson(route_segments)
    waypoint_features = write_waypoints_geojson(navpoints)

    print(json.dumps({
        "srcFixes": len(build_fixes),
        "overseasSegments": len(route_segments),
        "routes": len(routes),
        "graphNodes": len(graph),
        "navpoints": len(navpoints),
        "airwayGeojsonFeatures": airway_features,
        "waypointGeojsonFeatures": waypoint_features,
    }, indent=2))

    # ponytail 셀프체크: (1) 해외 항로가 실제로 남았고 (2) 인천 FIR을 통과하는 세그먼트가 하나도 없어야
    # 한다(도메스틱과 겹침 제거 검증). (3) 좌표 유효.
    assert len(route_segments) > 500, "too few overseas segments"
    if fir_rings:
        fir_bbox = rings_bbox(fir_rings)
        def both_in(s):
            (lo1, la1), (lo2, la2) = s["geometry"]["coordinates"]
            return point_in_fir(lo1, la1, fir_rings, fir_bbox) and point_in_fir(lo2, la2, fir_rings, fir_bbox)
        internal = [s for s in route_segments if both_in(s)]
        assert not internal, f"{len(internal)} purely-internal segments remain (overlap not removed)"
        # 경계 밖으로 나가는 연결이 실제로 남아있는지: FIR 안쪽 끝점을 가진(=경계 통과) 세그먼트 존재
        crossing = sum(1 for s in route_segments
                       if point_in_fir(*s["geometry"]["coordinates"][0], fir_rings, fir_bbox)
                       or point_in_fir(*s["geometry"]["coordinates"][1], fir_rings, fir_bbox))
        print(f"selfcheck OK: {len(route_segments)} segments, 0 purely-internal, {crossing} boundary-connecting kept")
    assert all(-90 <= s["geometry"]["coordinates"][0][1] <= 90 for s in route_segments), "bad lat"


if __name__ == "__main__":
    main()
