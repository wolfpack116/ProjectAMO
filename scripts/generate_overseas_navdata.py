"""해외 항로 navdata 변환기 (테스트용).

X-Plane earth_awy.dat / earth_nav.dat → 우리 route-graph 포맷(generate_navdata.py와 동일 shape).
표시 대상 = 이 프로젝트의 '해외 FIR 폴리곤(fir-overseas.geojson, role=overseas-fir)' 안에 들어오는 항로 전부.
FIR 폴리곤 자체로 고르고(과거의 사각형 박스 아님), 표시용 선은 FIR 경계까지 잘라 붙인다.
국내(인천 RKRR)는 도메스틱 AIP 항로가 이미 덮으므로 해외셋에서 제외(fir-overseas에 RKRR 없음).
정식 회사 AIRAC 자료가 오면 SRC만 교체하면 됨.

ponytail: 항로명이 'G472-N895' 처럼 여러 개면 첫 이름만 사용(테스트엔 충분, 대부분 단일).

사용:
  NAVDATA_SRC=<earth_awy.dat/earth_nav.dat 있는 폴더> \
  NAVDATA_OUT=<출력 폴더> \
  python scripts/generate_overseas_navdata.py
"""
from __future__ import annotations

import json
import math
import os
import re
from pathlib import Path

from shapely.geometry import LineString, Point, shape
from shapely.ops import unary_union
from shapely.prepared import prep

# 정식 ICAO 항로명 = 1~2글자 + 숫자(A582·UL888·Y51 …). 군사/비표준(3MIL20·3E102·25A 등, 숫자 시작)은 제외.
STD_AIRWAY = re.compile(r"^[A-Z]{1,2}\d")
# 정식 en-route 웨이포인트 = 5글자 순수 알파벳(ICAO 5LNC: LEDIM·ABASA …).
# 숫자 섞인 건 접근/절차용 픽스(NZ556·ARC01·AP38A·APU32 등) → 지도 표시에서 제외.
EN_ROUTE_WAYPOINT = re.compile(r"^[A-Z]{5}$")

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(os.environ.get("NAVDATA_SRC", ROOT / "reference" / "navdata-xplane"))
OUT = Path(os.environ.get("NAVDATA_OUT", ROOT / "frontend" / "public" / "data" / "navdata"))
CYCLE = "X-Plane 2012.08 (test placeholder — replace with company AIRAC)"
RNAV_PREFIX = {"L", "Y", "Z"}


def haversine_nm(a: dict, b: dict) -> float:
    r = 3440.065
    lat1, lat2 = math.radians(a["lat"]), math.radians(b["lat"])
    dlat = math.radians(b["lat"] - a["lat"])
    dlon = math.radians(b["lon"] - a["lon"])
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return round(r * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h)), 2)


def route_type(route_id: str) -> str:
    return "RNAV" if route_id[:1] in RNAV_PREFIX else "ATS"


class FirMask:
    """해외 FIR 폴리곤 합집합. 항로 선택(intersects)·표시 클립(intersection)·검증(contains)에 모두 쓴다.
    bbox 선거르기 + prepared 지오메트리로 70k 세그먼트 스캔을 1초 안에 끝낸다."""

    def __init__(self, union):
        self.union = union
        self.prepared = prep(union)
        self.minx, self.miny, self.maxx, self.maxy = union.bounds

    def _bbox_miss(self, lo1, la1, lo2, la2) -> bool:
        return (max(lo1, lo2) < self.minx or min(lo1, lo2) > self.maxx
                or max(la1, la2) < self.miny or min(la1, la2) > self.maxy)

    def seg_hits(self, lo1, la1, lo2, la2) -> bool:
        if self._bbox_miss(lo1, la1, lo2, la2):
            return False
        return self.prepared.intersects(LineString([(lo1, la1), (lo2, la2)]))

    def point_in(self, lon, lat) -> bool:
        if lon < self.minx or lon > self.maxx or lat < self.miny or lat > self.maxy:
            return False
        return self.prepared.intersects(Point(lon, lat))

    def clip_line(self, coords):
        """선을 FIR 합집합으로 자른다. FIR 밖은 사라지고, 경계를 넘는 선은 경계 교차점에서 끝난다.
        FIR 사이 빈 구간을 지나면 조각이 여러 개(MultiLineString)로 나뉜다."""
        inter = self.union.intersection(LineString(coords))
        if inter.is_empty:
            return []
        parts = []
        for geom in getattr(inter, "geoms", [inter]):
            if geom.geom_type == "LineString" and len(geom.coords) >= 2:
                parts.append([[round(x, 6), round(y, 6)] for x, y in geom.coords])
        return parts


def load_overseas_mask(public_dir: Path) -> FirMask:
    """fir-overseas.geojson의 해외 FIR 폴리곤(role=overseas-fir) 합집합을 FirMask로."""
    path = public_dir / "fir-overseas.geojson"
    polys = []
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
        for feat in data.get("features", []):
            geom = feat.get("geometry") or {}
            if geom.get("type") in ("Polygon", "MultiPolygon") and (feat.get("properties") or {}).get("role") == "overseas-fir":
                polys.append(shape(geom))
    if not polys:
        raise SystemExit(f"No overseas-fir polygons in {path}. 해외 FIR 파일을 먼저 준비하세요.")
    return FirMask(unary_union(polys))


def parse_awy(path: Path, mask: FirMask):
    """earth_awy.dat: id1 lat1 lon1 id2 lat2 lon2 type baseFL topFL airway[-airway...].
    해외 FIR에 걸치는 세그먼트만 선택. X-Plane은 저/고고도 두 줄로 실으므로 (양끝, 항로)로 중복 제거."""
    segments, seen = [], set()
    with path.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            parts = line.split()
            if len(parts) < 10:
                continue
            try:
                id1, la1, lo1, id2, la2, lo2 = parts[0], float(parts[1]), float(parts[2]), parts[3], float(parts[4]), float(parts[5])
            except ValueError:
                continue  # 헤더/버전 줄 스킵
            if abs(lo1 - lo2) > 180:
                continue  # 날짜변경선(180°) 넘는 세그먼트 — 평면좌표에선 FIR을 가로지르는 가짜 수평선이 됨
            airway = parts[9].split("-")[0]
            if not STD_AIRWAY.match(airway):
                continue  # 군사/비표준 항로(3MIL·3E·25A 등) 제외
            if not mask.seg_hits(lo1, la1, lo2, la2):
                continue
            key = (tuple(sorted((id1, id2))), airway)
            if key in seen:
                continue
            seen.add(key)
            segments.append({"id1": id1, "a": {"lat": la1, "lon": lo1}, "id2": id2, "b": {"lat": la2, "lon": lo2}, "awy": airway})
    return segments


def build_key_resolver(segments):
    """짧은 항행표지 코드(JB·KK·MKG 등)는 전세계에서 재사용되어 이름만으로 노드를 만들면
    한국 JB와 싱가포르 JB가 한 노드로 합쳐져 '순간이동' 경로가 생긴다.
    → 같은 ident이 50nm 넘게 떨어진 여러 위치에 있으면 ident#0, ident#1로 분리한다."""
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


def write_airways_geojson(route_segments, mask: FirMask) -> int:
    """지도 표시용: 항로별로 세그먼트를 MultiLineString으로 묶어 도메스틱 airways.geojson과
    동일 스키마(ident_txt)로 출력 → 기존 ats-route/rnav-route 렌더러가 그대로 그림.
    각 선을 해외 FIR 합집합으로 잘라 FIR 밖은 지우고 경계까지만 그린다."""
    by_route: dict[str, dict] = {}
    for s in route_segments:
        entry = by_route.setdefault(s["routeId"], {"type": s["routeType"], "coords": []})
        entry["coords"].extend(mask.clip_line(s["geometry"]["coordinates"]))
    features = [
        {
            "type": "Feature",
            "properties": {"ident_txt": rid, "routeType": info["type"], "source": "xplane", "cycle": CYCLE},
            "geometry": {"type": "MultiLineString", "coordinates": info["coords"]},
        }
        for rid, info in sorted(by_route.items())
        if info["coords"]  # 클립 후 남은 조각이 없는 항로는 피처 생략
    ]
    path = OUT.parent / "airways-overseas.geojson"  # public/data/ (navdata의 부모)
    with path.open("w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f, ensure_ascii=True)
        f.write("\n")
    return len(features)


def classify_vor(name_tokens) -> str:
    """VOR 레코드 이름 끝 키워드로 국내와 동일한 종류로 분류(VORTAC/VOR/DME/TACAN)."""
    last = name_tokens[-1] if name_tokens else ""
    if last == "VORTAC":
        return "VORTAC"
    if last == "TACAN":
        return "TACAN"
    return "VOR/DME"  # VOR-DME 및 순수 VOR → VOR/DME 아이콘


def parse_nav(path: Path, mask: FirMask):
    """earth_nav.dat에서 VOR 계열(타입 3)만 — 국내 항행안전시설이 VORTAC/VOR/DME/TACAN이라 그에 맞춤.
    NDB(2)·DME(12,13)는 제외. 해외 FIR 안의 것만."""
    if not path.exists():
        return []
    out, seen = [], set()
    with path.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            parts = line.split()
            if len(parts) < 8 or parts[0] != "3":  # VOR 계열만
                continue
            try:
                lat, lon = float(parts[1]), float(parts[2])
            except ValueError:
                continue
            if not mask.point_in(lon, lat):
                continue
            ident = parts[7]
            key = (ident, round(lat, 3), round(lon, 3))
            if key in seen:
                continue
            seen.add(key)
            out.append({"ident": ident, "lat": lat, "lon": lon, "navType": classify_vor(parts[8:])})
    return out


def write_navaids_geojson(navaids) -> int:
    """지도 표시용 해외 항행안전시설 Point GeoJSON. `type`은 국내 navaid와 동일 값(아이콘 매칭)."""
    features = [
        {
            "type": "Feature",
            "properties": {"ident": n["ident"], "type": n["navType"], "source": "xplane", "cycle": CYCLE},
            "geometry": {"type": "Point", "coordinates": [n["lon"], n["lat"]]},
        }
        for n in sorted(navaids, key=lambda x: x["ident"])
    ]
    path = OUT.parent / "navaids-overseas.geojson"
    with path.open("w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f, ensure_ascii=True)
        f.write("\n")
    return len(features)


def parse_fix(path: Path, mask: FirMask):
    """earth_fix.dat: lat lon ident. 해외 FIR 안의 모든 픽스를 표시용 웨이포인트로(밖은 제외, 안은 전부).
    같은 ident이 여러 위치에 있을 수 있어(전세계 재사용) 좌표까지 묶어 중복만 제거."""
    if not path.exists():
        return []
    out, seen = [], set()
    with path.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            parts = line.split()
            if len(parts) < 3:
                continue
            try:
                lat, lon = float(parts[0]), float(parts[1])
            except ValueError:
                continue
            ident = parts[2]
            if not EN_ROUTE_WAYPOINT.match(ident):
                continue  # 접근/절차용 픽스(숫자 섞인 이름) 제외 — 정식 en-route 웨이포인트만
            if not mask.point_in(lon, lat):
                continue
            key = (ident, round(lat, 4), round(lon, 4))
            if key in seen:
                continue
            seen.add(key)
            out.append({"ident": ident, "lat": lat, "lon": lon})
    return out


def write_waypoints_geojson(fixes) -> int:
    """지도 표시용 해외 웨이포인트 Point GeoJSON. `ident`+circle 표시(라벨은 밀집이라 기본 비활성).
    소스 = FIR 안의 모든 earth_fix.dat 픽스(항로 끝점만이 아니라 영역 전체)."""
    features = [
        {
            "type": "Feature",
            "properties": {"ident": fx["ident"], "source": "xplane", "cycle": CYCLE},
            "geometry": {"type": "Point", "coordinates": [fx["lon"], fx["lat"]]},
        }
        for fx in sorted(fixes, key=lambda x: (x["ident"], x["lat"], x["lon"]))
    ]
    path = OUT.parent / "waypoints-overseas.geojson"
    with path.open("w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f, ensure_ascii=True)
        f.write("\n")
    return len(features)


def main() -> None:
    mask = load_overseas_mask(OUT.parent)  # 해외 FIR 폴리곤 합집합(선택·클립·검증 공통)
    segments = parse_awy(SRC / "earth_awy.dat", mask)
    # 이름 중복 지점 분리(웜홀 방지): 같은 ident이 여러 위치면 ident#0/#1로.
    key_of, multi_count = build_key_resolver(segments)
    for s in segments:
        s["id1"] = key_of(s["id1"], s["a"])
        s["id2"] = key_of(s["id2"], s["b"])
    navpoints, routes, route_segments, graph = build(segments)

    write_json("navpoints-overseas.json", {k: navpoints[k] for k in sorted(navpoints)})
    write_json("routes-overseas.json", routes)
    write_json("route-segments-overseas.json", route_segments)
    write_json("route-graph-overseas.json", graph)
    airway_features = write_airways_geojson(route_segments, mask)
    waypoint_features = write_waypoints_geojson(parse_fix(SRC / "earth_fix.dat", mask))
    navaid_features = write_navaids_geojson(parse_nav(SRC / "earth_nav.dat", mask))

    print(json.dumps({
        "overseasSegments": len(route_segments),
        "routes": len(routes),
        "graphNodes": len(graph),
        "navpoints": len(navpoints),
        "duplicateIdentClusters": multi_count,
        "airwayGeojsonFeatures": airway_features,
        "waypointGeojsonFeatures": waypoint_features,
        "navaidGeojsonFeatures": navaid_features,
    }, indent=2))

    # 셀프체크: (1) 항로가 충분히 남았고 (2) 표시 선의 모든 좌표가 해외 FIR 합집합 안이며
    # (3) 경계에서 잘린 지점(연결점)이 실제로 존재하고 (4) 좌표 유효.
    assert len(route_segments) > 1000, "too few overseas segments — FIR selection likely broke"
    buffered = mask.union.buffer(0.02)  # 경계 반올림 오차 허용(약 2km)
    boundary = mask.union.boundary
    gj = json.loads((OUT.parent / "airways-overseas.geojson").read_text(encoding="utf-8"))
    outside = on_boundary = 0
    for feat in gj["features"]:
        for part in feat["geometry"]["coordinates"]:
            for lon, lat in part:
                if not buffered.contains(Point(lon, lat)):
                    outside += 1
                if boundary.distance(Point(lon, lat)) < 1e-6:
                    on_boundary += 1
    assert outside == 0, f"{outside} airway vertices fell outside overseas FIRs after clip"
    assert on_boundary > 0, "no boundary-terminated vertices — clip did not cut anything"
    assert all(-90 <= s["geometry"]["coordinates"][0][1] <= 90 for s in route_segments), "bad lat"
    print(f"clip OK: {airway_features} airway features, all vertices inside overseas FIRs, "
          f"{on_boundary} vertices terminate on FIR boundary")


if __name__ == "__main__":
    main()
