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
    -- Таблица пользователей (сотрудников)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      pin_code TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'cashier', 'financier')) NOT NULL
    );

    -- Таблица зарядных станций
    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,         -- Например "Колонка 1"
      ip_address TEXT,            -- Локальный IP станции, если нужен
      status TEXT DEFAULT 'available' 
    );

    -- ОБНОВЛЕННАЯ: Таблица транзакций (с защитой от мошенничества)
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id INTEGER NOT NULL,
      cashier_id INTEGER NOT NULL,
      
      amount_tjs REAL NOT NULL,       -- Оплачено клиентом (в сомони)
      target_kwh REAL NOT NULL,       -- Лимит кВт/ч, который сервер не даст превысить
      consumed_kwh REAL DEFAULT 0,    -- Сколько реально залито на данный момент
      
      ocpp_transaction_id INTEGER,    -- Уникальный ID от самой железной станции
      status TEXT CHECK(status IN ('pending', 'charging', 'completed', 'stopped_by_user', 'error')) DEFAULT 'pending',
      
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME,
      
      FOREIGN KEY (station_id) REFERENCES stations(id),
      FOREIGN KEY (cashier_id) REFERENCES users(id)
    );

    -- НОВАЯ: Таблица логов безопасности для отслеживания махинаций
    CREATE TABLE IF NOT EXISTS security_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id INTEGER,
      event_type TEXT NOT NULL,       -- Например: 'UNAUTHORIZED_CHARGE_ATTEMPT'
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (station_id) REFERENCES stations(id)
    );
  `);

  // Автоматическое создание первого Админа, если таблица users пустая
  const adminExists = await dbInstance.get('SELECT id FROM users WHERE role = ?', ['admin']);
  
  if (!adminExists) {
    await dbInstance.run(
      'INSERT INTO users (username, pin_code, role) VALUES (?, ?, ?)',
      ['admin', '0000', 'admin'] // Логин: admin, Пин-код: 0000
    );
    console.log('⚠️ Создан стартовый администратор -> Логин: admin | Пин-код: 0000');
  }

  console.log('✅ База данных SQLite успешно инициализирована (Защита уровня PRO активна)!');
  return dbInstance;
}

// Функция для получения доступа к базе из других файлов
export async function getDB() {
  if (!dbInstance) {
    return await initDB();
  }
  return dbInstance;
}