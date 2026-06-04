import { Router } from 'express';
import { getDB } from '../database/db';

const router = Router();

// --- 1. УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ---

// Получить всех пользователей
router.get('/users', async (req, res) => {
  try {
    const db = await getDB();
    const users = await db.all('SELECT id, username, role FROM users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
});

// Добавить пользователя
router.post('/users', async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const db = await getDB();
    const result = await db.run(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, password, role]
    );
    res.json({ id: result.lastID, username, role });
  } catch (error) {
    res.status(400).json({ error: 'Пользователь уже существует или данные неверны' });
  }
});

// Удалить пользователя
router.delete('/users/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при удалении' });
  }
});

// --- 2. УПРАВЛЕНИЕ СТАНЦИЯМИ ---

// Изменить статус станции (принудительно)
router.patch('/stations/:id/status', async (req: any, res) => {
  const { status } = req.body; // online, offline, faulted
  try {
    const db = await getDB();
    await db.run('BEGIN TRANSACTION');
    
    // 1. Обновляем статус самой колонки
    await db.run('UPDATE stations SET status = ? WHERE id = ?', [status, req.params.id]);
    
    // 2. Синхронно обновляем все ручки этой колонки
    // Если колонка offline/faulted - ручки тоже становятся faulted (недоступны для зарядки)
    // Если колонка online - ручки становятся available
    const connectorStatus = status === 'online' ? 'available' : 'faulted';
    await db.run('UPDATE connectors SET status = ? WHERE station_id = ?', [connectorStatus, req.params.id]);
    
    await db.run('COMMIT');
    
    if (req.io) {
      req.io.emit('station_status_update');
    }
    
    res.json({ success: true });
  } catch (error) {
    const db = await getDB();
    await db.run('ROLLBACK');
    res.status(500).json({ error: 'Не удалось обновить статус' });
  }
});

// --- 3. АНАЛИТИКА И ЛОГИ ---

router.get('/dashboard', async (req, res) => {
  try {
    const db = await getDB();
    
    // Общая выручка и сессии (за всё время или месяц, по ТЗ: "всех завершенных транзакций")
    const stats = await db.get(`
      SELECT SUM(amount_tjs) as totalRevenue, COUNT(id) as totalSessions 
      FROM transactions 
      WHERE status = "completed"
    `);

    // Последние 20 логов с именами пользователей
    const recentLogs = await db.all(`
      SELECT l.id, u.username, l.action, l.details, l.created_at
      FROM logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
      LIMIT 20
    `);

    // Данные для графика (выручка по дням за последние 7 дней)
    // Используем DATE() для группировки
    const chartDataRaw = await db.all(`
      SELECT DATE(created_at) as date, SUM(amount_tjs) as revenue
      FROM transactions
      WHERE status = 'completed' AND created_at >= date('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // Формируем красивый массив для Recharts/CSS Bar Chart
    const chartData = chartDataRaw.map(row => ({
      name: new Date(row.date).toLocaleDateString('ru-RU', { weekday: 'short' }), // Пн, Вт, Ср
      total: row.revenue || 0
    }));

    // Статистика по каждой станции (для Финансиста)
    const stationStats = await db.all(`
      SELECT 
        s.id, 
        s.name, 
        s.status,
        COALESCE(SUM(t.amount_tjs), 0) as revenue, 
        COALESCE(SUM(t.consumed_kwh), 0) as energy
      FROM stations s
      LEFT JOIN connectors c ON s.id = c.station_id
      LEFT JOIN transactions t ON c.id = t.connector_id AND t.status = 'completed'
      GROUP BY s.id
    `);

    res.json({
      totalRevenue: stats?.totalRevenue || 0,
      totalSessions: stats?.totalSessions || 0,
      recentLogs: recentLogs,
      chartData: chartData,
      stationStats: stationStats
    });
  } catch (error) {
    console.error('Dashboard Analytics error:', error);
    res.status(500).json({ error: 'Ошибка получения аналитики дашборда' });
  }
});

// Старый роут оставляем для совместимости или удаляем, если он больше не нужен
// router.get('/analytics', ... )

export default router;
