-- ProjectAMO 계정·개인데이터 스키마 (#7). SQLite. 최초 연결 시 idempotent 생성(IF NOT EXISTS).
-- 세션 테이블은 express-session 스토어(step2)가 별도 생성·관리.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'pilot' CHECK (role IN ('pilot','forecaster','admin')),
  display_name  TEXT,
  airports      TEXT,                         -- 예보관 담당공항(JSON 배열, 7개 부분집합). #6
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','rejected')),  -- 가입 승인
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
  payload      TEXT,                         -- 프론트 snapshot 전체(JSON) — 무손실 왕복용(#5)
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

CREATE TABLE IF NOT EXISTS metrics (        -- 리소스 시계열(60초 샘플, 7일 보관). 관리자 콘솔
  ts         TEXT NOT NULL,
  cpu_pct    REAL, mem_used INTEGER, mem_total INTEGER, disk_used INTEGER, disk_total INTEGER
);

CREATE TABLE IF NOT EXISTS visits (         -- 익명 포함 방문 추적. 관리자 콘솔
  visitor_id TEXT PRIMARY KEY, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_presets_user ON presets(user_id);
CREATE INDEX IF NOT EXISTS idx_routes_user ON routes(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status, target_airport);
CREATE INDEX IF NOT EXISTS idx_metrics_ts ON metrics(ts);
CREATE INDEX IF NOT EXISTS idx_visits_last ON visits(last_seen);
