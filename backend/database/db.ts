import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

// Храним подключение в переменной, чтобы переиспользовать
let dbInstance: Database | null = null;

export async function initDB() {
  if (dbInstance) return dbInstance;

  // Открываем или создаем файл db.sqlite в корне папки backend
  dbInstance = await open({
    filename: path.join(__dirname, '../db.sqlite'),
    driver: sqlite3.Database
  });

  // Включаем поддержку внешних ключей (чтобы связывать таблицы)
  await dbInstance.exec('PRAGMA foreign_keys = ON;');

  // СОЗДАЕМ ТАБЛИЦЫ
  await dbInstance.exec(`
    -- 1. Таблица пользователей (сотрудников) - теперь с паролями
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'cashier', 'financier')) NOT NULL
    );

    -- 2. Таблица физических зарядных станций (Колонок)
    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,         -- Например "6-КОЛОНКА (1-Май)"
      serial_number TEXT UNIQUE,  -- Серийный номер колонки
      ip_address TEXT,            -- Локальный IP станции
      status TEXT DEFAULT 'offline' 
    );

    -- 3. НОВАЯ: Таблица коннекторов (Ручек)
    CREATE TABLE IF NOT EXISTS connectors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id INTEGER NOT NULL,
      name TEXT NOT NULL,         -- Например: '1-ручка-А'
      type TEXT NOT NULL,         -- Например: 'GB_T_DC'
      max_power_kw INTEGER NOT NULL,
      status TEXT DEFAULT 'available', -- available, charging, faulted
      FOREIGN KEY(station_id) REFERENCES stations(id) ON DELETE CASCADE
    );

    -- 4. НОВАЯ: Таблица кассовых смен
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      status TEXT DEFAULT 'open', -- open, closed
      total_revenue REAL DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    -- 5. ОБНОВЛЕННАЯ: Таблица транзакций (привязана к Смене и Ручке)
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER,
      connector_id INTEGER,
      amount_tjs REAL,
      target_kwh REAL,
      target_amount REAL DEFAULT 0,
      consumed_kwh REAL DEFAULT 0,
      status TEXT DEFAULT 'charging',
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      stop_time DATETIME,
      finished_at DATETIME,
      meter_start REAL DEFAULT 0,
      is_full_tank INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      id_tag TEXT
    );

    -- 6. НОВАЯ: Таблица настроек
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- 7. НОВАЯ: Таблица логов
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    -- 9. НОВАЯ: Таблица RFID карт
    CREATE TABLE IF NOT EXISTS rfid_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_tag TEXT NOT NULL UNIQUE,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Обеспечиваем наличие колонок, если таблица уже существовала
  try {
    await dbInstance.run('ALTER TABLE transactions ADD COLUMN id_tag TEXT');
  } catch (e) { }
  try {
    await dbInstance.run('ALTER TABLE transactions ADD COLUMN target_amount REAL DEFAULT 0');
  } catch (e) { }

  // Установка настроек по умолчанию
  await dbInstance.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('smart_stop_reserve_sec', '20')`);
  await dbInstance.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('price_per_kwh', '3.6')`);
  await dbInstance.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('stop_reserve_wh', '200')`);

  await seedInitialData();
  console.log('✅ База данных SQLite успешно инициализирована (Защита уровня PRO + Смены + Ручки + Логи)!');
  return dbInstance;
}

// Функция для добавления лога
export async function addLog(userId: number | null, action: string, details: string) {
  try {
    const db = await getDB();
    await db.run(
      'INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)',
      [userId, action, details]
    );
  } catch (error) {
    console.error('Ошибка записи лога:', error);
  }
}

// Функция для получения доступа к базе из других файлов
export async function getDB() {
  if (!dbInstance) {
    return await initDB();
  }
  return dbInstance;
}

// Заполняем базу стартовыми данными (если она пустая)
async function seedInitialData() {
  if (!dbInstance) return;

  // 1. Дефолтные пользователи (согласно новым требованиям)
  const defaultUsers = [
    { user: 'admin', pass: 'admin2026', role: 'admin' },
    { user: 'kasa', pass: 'kasa2026', role: 'cashier' },
    { user: 'buhgalter', pass: 'buhgalter2026', role: 'financier' }
  ];

  for (const u of defaultUsers) {
    const exists = await dbInstance.get('SELECT id FROM users WHERE username = ?', [u.user]);
    if (!exists) {
      await dbInstance.run(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        [u.user, u.pass, u.role]
      );
      console.log(`⚠️ Создан стартовый профиль -> Логин: ${u.user}`);
    }
  }

  // 2. Дефолтная станция и 2 ручки для тестирования UI
  const stationExists = await dbInstance.get('SELECT id FROM stations LIMIT 1');
  if (!stationExists) {
    // Создаем станцию
    const result = await dbInstance.run(
      'INSERT INTO stations (name, serial_number, status) VALUES (?, ?, ?)',
      ['6-КОЛОНКА (1-Май)', 'GSCSY0824080272X0124', 'online']
    );
    const stationId = result.lastID;

    // Привязываем две ручки к этой станции
    await dbInstance.run(
      'INSERT INTO connectors (station_id, name, type, max_power_kw, status) VALUES (?, ?, ?, ?, ?)',
      [stationId, '1-ручка-А', 'GB_T_DC', 160, 'available']
    );
    await dbInstance.run(
      'INSERT INTO connectors (station_id, name, type, max_power_kw, status) VALUES (?, ?, ?, ?, ?)',
      [stationId, '2-Ручка-B', 'GB_T_DC', 160, 'available']
    );
  }
}