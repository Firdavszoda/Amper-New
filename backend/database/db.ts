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
      shift_id INTEGER NOT NULL,
      connector_id INTEGER NOT NULL,
      
      amount_tjs REAL NOT NULL,       -- Оплачено клиентом (в сомони)
      target_kwh REAL NOT NULL,       -- Лимит кВт/ч
      consumed_kwh REAL DEFAULT 0,    -- Сколько реально залито
      is_full_tank BOOLEAN DEFAULT 0, -- 1 если заряжаем до полного (без лимита)
      
      meter_start INTEGER DEFAULT 0,  -- НОВАЯ КОЛОНКА: Начальные показания счетчика станции
      
      ocpp_transaction_id INTEGER,    -- Уникальный ID от самой железной станции
      status TEXT CHECK(status IN ('pending', 'charging', 'completed', 'stopped_by_user', 'error')) DEFAULT 'pending',
      
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME,
      
      FOREIGN KEY (shift_id) REFERENCES shifts(id),
      FOREIGN KEY (connector_id) REFERENCES connectors(id)
    );

    -- 6. Таблица логов безопасности для отслеживания махинаций
    CREATE TABLE IF NOT EXISTS security_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id INTEGER,
      event_type TEXT NOT NULL,       -- Например: 'UNAUTHORIZED_CHARGE_ATTEMPT'
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (station_id) REFERENCES stations(id)
    );

    -- 7. НОВАЯ: Общая таблица логов действий пользователей
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  try {
    // Безопасное добавление колонки в существующую таблицу
    await dbInstance.exec('ALTER TABLE transactions ADD COLUMN meter_start INTEGER DEFAULT 0;');
    console.log('⚡ Колонка meter_start добавлена в transactions.');
  } catch (e: any) {
    // Игнорируем ошибку, если колонка уже существует (ошибка 'duplicate column name' или аналогичная)
    if (!e.message.includes('duplicate column')) {
      console.log('Информация: колонка meter_start уже существует или произошла некритичная ошибка.');
    }
  }

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