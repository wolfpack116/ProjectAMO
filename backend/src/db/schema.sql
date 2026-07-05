-- ProjectAMO 계정·개인데이터 스키마 (#7). SQLite. 최초 연결 시 idempotent 생성(IF NOT EXISTS).
-- 세션 테이블은 express-session 스토어(step2)가 별도 생성·관리.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'pilot' CHECK (role IN ('pilot','forecaster','admin')),
  display_name  TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS presets (        -- 개인 미니마 (localStorage airport_minima_settings → 서버)
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  icao         TEXT NOT NULL CHECK (length(icao)=4),
  ceiling_ft   INTEGER CHECK (ceiling_ft BETWEEN 0 AND 60000),
  visibility_m INTEGER CHECK (visibility_m BETWEEN 0 AND 10000),
  wind_kt      INTEGER,
  xwind_kt     INTEGER,
  gust_kt      INTEGER,
  pilot_type   TEXT CHECK (pilot_type IN ('VFR','IFR') OR pilot_type IS NULL),
  updated_at   TEXT NOT NULL,
  UNIQUE(user_id, icao)
);

CREATE TABLE IF NOT EXISTS routes (         -- 저장 경로(= 문의·#13 감시 대상). inputs only.
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  name         TEXT,
  dep          TEXT,
  dest         TEXT,
  altn         TEXT,
  waypoints    TEXT,                         -- JSON, 개수·길이 상한은 서버 검증(step5)
  altitude_ft  INTEGER CHECK (altitude_ft BETWEEN 0 AND 60000),
  etd          TEXT,                         -- ISO, #13 감시
  rules        TEXT CHECK (rules IN ('VFR','IFR') OR rules IS NULL),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS requests (       -- 조종사→예보관 문의
  id                  INTEGER PRIMARY KEY,
  pilot_id            INTEGER NOT NULL REFERENCES users(id),
  route_id            INTEGER NOT NULL REFERENCES routes(id),
  target_airport      TEXT NOT NULL,
  message             TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','viewed','closed')),
  assigned_forecaster INTEGER REFERENCES users(id),
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_presets_user ON presets(user_id);
CREATE INDEX IF NOT EXISTS idx_routes_user ON routes(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status, target_airport);
