"""해외 공항 데이터 생성 (테스트용).

OurAirports(퍼블릭 도메인) CSV에서 MVP 대상 해외 공항 좌표를 뽑아
국내 airports.geojson과 동일 스키마로 airports-overseas.geojson 출력.
routePlanner용 navdata/airports-overseas.json(공항 id→좌표)도 함께 출력.

한글명은 korean_airlines_international_mvp_data_scope.md 기준으로 매핑.
회사 정식 자료가 오면 좌표 소스만 교체하면 됨.

사용: python scripts/generate_overseas_airports.py
"""
from __future__ import annotations

import csv
import io
import json
import os
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "frontend" / "public" / "data"
NAVDATA = PUBLIC / "navdata"
OURAIRPORTS_CSV = os.environ.get(
    "OURAIRPORTS_CSV",
    "https://davidmegginson.github.io/ourairports-data/airports.csv",
)

# ICAO → 한글명 (MVP 문서 5장). 이 목록이 대상 해외 공항 = 50개.
AIRPORTS_KO = {
    # 일본
    "RJAA": "도쿄 나리타", "RJTT": "도쿄 하네다", "RJBB": "오사카 간사이", "RJFF": "후쿠오카",
    "RJCC": "삿포로 신치토세", "RJGG": "나고야 주부", "ROAH": "오키나와 나하", "RJSS": "센다이",
    "RJOA": "히로시마", "RJOT": "다카마쓰", "RJOM": "마쓰야마", "RJFR": "기타큐슈",
    "RJFT": "구마모토", "RJFK": "가고시마", "RJOH": "요나고", "ROMY": "미야코지마",
    # 중국
    "ZBAA": "베이징 수도", "ZBAD": "베이징 다싱", "ZSPD": "상하이 푸둥", "ZSSS": "상하이 훙차오",
    "ZSQD": "칭다오", "ZYTL": "다롄", "ZYTX": "선양", "ZGGG": "광저우",
    "ZGSZ": "선전", "ZSHC": "항저우",
    # 대만·홍콩·마카오·몽골 (RCSS 쑹산=국적사 미취항으로 제외)
    "RCTP": "타이베이 타오위안", "RCKH": "가오슝", "RCMQ": "타이중",
    "VHHH": "홍콩", "VMMC": "마카오", "ZMCK": "울란바토르",
    # 베트남
    "VVNB": "하노이", "VVTS": "호찌민", "VVDN": "다낭", "VVCR": "나트랑 깜라인", "VVPQ": "푸꾸옥",
    # 필리핀 (RPSP 보홀=직항 근거 없어 제외)
    "RPLL": "마닐라", "RPVM": "세부", "RPLC": "클라크",
    # 태국 (VTBD 돈므앙=국적사 직항 근거 없어 제외, 수완나품에 집중)
    "VTBS": "방콕 수완나품", "VTCC": "치앙마이",
    # 기타 동남아
    "WSSS": "싱가포르 창이", "WMKK": "쿠알라룸푸르", "WBKK": "코타키나발루",
    "WIII": "자카르타 수카르노하타", "WADD": "발리 덴파사르", "VDPP": "프놈펜",
}


def fetch_csv(url: str) -> str:
    if url.startswith("http"):
        with urllib.request.urlopen(url, timeout=120) as resp:
            return resp.read().decode("utf-8", errors="replace")
    return Path(url).read_text(encoding="utf-8", errors="replace")


def main() -> None:
    wanted = set(AIRPORTS_KO)
    rows = {}
    text = fetch_csv(OURAIRPORTS_CSV)
    reader = csv.DictReader(io.StringIO(text))
    for row in reader:
        code = (row.get("ident") or "").strip().upper()
        if code not in wanted:
            code2 = (row.get("gps_code") or "").strip().upper()
            if code2 in wanted:
                code = code2
            else:
                continue
        # 같은 코드 중복 시 첫 항목 유지
        rows.setdefault(code, row)

    features = []
    airports_json = {}
    for icao in sorted(wanted):
        row = rows.get(icao)
        if not row:
            print(f"  [MISSING] {icao} ({AIRPORTS_KO[icao]}) — OurAirports에 없음")
            continue
        lat = float(row["latitude_deg"])
        lon = float(row["longitude_deg"])
        name = row.get("name") or icao
        features.append({
            "type": "Feature",
            "properties": {
                "icao": icao,
                "name": name,
                "nameKo": AIRPORTS_KO[icao],
                "airportUse": "civil",
                "source": "OurAirports",
            },
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
        })
        airports_json[icao] = {
            "id": icao,
            "coordinates": {"lat": lat, "lon": lon},
            "name": name,
            "nameKo": AIRPORTS_KO[icao],
            "source": "OurAirports",
        }

    PUBLIC.mkdir(parents=True, exist_ok=True)
    NAVDATA.mkdir(parents=True, exist_ok=True)
    with (PUBLIC / "airports-overseas.geojson").open("w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f, ensure_ascii=False, indent=2)
        f.write("\n")
    with (NAVDATA / "airports-overseas.json").open("w", encoding="utf-8") as f:
        json.dump(airports_json, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")

    print(json.dumps({
        "wanted": len(wanted),
        "found": len(features),
        "missing": len(wanted) - len(features),
    }, indent=2, ensure_ascii=False))

    # 셀프체크: 주요 목적지 3개 좌표가 상식 범위인지
    idx = {ft["properties"]["icao"]: ft["geometry"]["coordinates"] for ft in features}
    for icao, (lo, la) in (("RJTT", idx.get("RJTT", (0, 0))), ("VHHH", idx.get("VHHH", (0, 0)))):
        assert 100 < lo < 155 and 0 < la < 46, f"{icao} coords look wrong: {lo},{la}"
    print("selfcheck OK: RJTT/VHHH coords in Asia range")


if __name__ == "__main__":
    main()
