import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import config from '../config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')

// 스키마 적용된 연결 생성. dbPath=':memory:'면 테스트용 인메모리.
export function createDb(dbPath) {
  const database = new Database(dbPath)
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON') // REFERENCES 강제(better-sqlite3 기본 off)
  database.exec(schema)
  return database
}

let db = null

// 앱 공용 싱글턴. backend/data/projectamo.db (data/는 gitignore).
export function getDb() {
  if (db) return db
  fs.mkdirSync(config.storage.base_path, { recursive: true })
  db = createDb(path.join(config.storage.base_path, 'projectamo.db'))
  return db
}

export default { createDb, getDb }
