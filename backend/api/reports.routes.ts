import { Router } from 'express';
import { getDB } from '../database/db';

const router = Router();

const buildWhere = (user: any, q: any) => {
  const conditions = [];
  const params: any[] = [];

  // Изоляция: Кассир видит только свои транзакции. Админ/Бухгалтер (Financier) - все.
  if (user && user.role === 'cashier') {
    conditions.push('sh.user_id = ?');
    params.push(user.id);
  } else if (q.cashierId && q.cashierId !== 'all') {
    // В зависимости от того, передаем ID или Username
    if (isNaN(parseInt(q.cashierId))) {
      conditions.push('u.username = ?');
    } else {
      conditions.push('sh.user_id = ?');
    }
    params.push(q.cashierId);
  } else if (q.cashier && q.cashier !== 'all') {
    conditions.push('u.username = ?');
    params.push(q.cashier);
  }

  if (q.station_id && q.station_id !== 'all') {
    conditions.push('c.station_id = ?');
    params.push(q.station_id);
  } else if (q.stationId && q.stationId !== 'all') {
    conditions.push('c.station_id = ?');
    params.push(q.stationId);
  }

  if (q.startDate && q.endDate) {
    conditions.push('t.created_at >= datetime(? || " 00:00:00") AND t.created_at <= datetime(? || " 23:59:59")');
    params.push(q.startDate, q.endDate);
  } else if (q.startDate) {
    conditions.push('t.created_at >= datetime(? || " 00:00:00")');
    params.push(q.startDate);
  } else if (q.endDate) {
    conditions.push('t.created_at <= datetime(? || " 23:59:59")');
    params.push(q.endDate);
  }

  const whereStr = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  return { whereStr, params };
};

// 1. ЖУРНАЛ ЗАРЯДОВ (С пагинацией)
router.get('/transactions', async (req: any, res) => {
  try {
    const db = await getDB();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const { whereStr, params } = buildWhere(req.user, req.query);

    const query = `
      SELECT t.*, s.name as station_name, c.name as connector_name, u.username as cashier_name
      FROM transactions t
      JOIN shifts sh ON t.shift_id = sh.id
      LEFT JOIN connectors c ON t.connector_id = c.id
      LEFT JOIN stations s ON c.station_id = s.id
      LEFT JOIN users u ON sh.user_id = u.id
      ${whereStr} ORDER BY t.created_at DESC LIMIT ? OFFSET ?
    `;
    const data = await db.all(query, [...params, limit, offset]);
    
    const countQuery = `
      SELECT COUNT(t.id) as total 
      FROM transactions t 
      JOIN shifts sh ON t.shift_id = sh.id
      LEFT JOIN connectors c ON t.connector_id = c.id 
      ${whereStr}
    `;
    const countRes = await db.get(countQuery, params);

    res.json({ 
      data, 
      pagination: { 
        total: countRes.total, 
        page, 
        limit, 
        totalPages: Math.ceil(countRes.total / limit) 
      } 
    });
  } catch (error) { 
    console.error('Reports Error:', error);
    res.status(500).json({ error: 'Ошибка БД' }); 
  }
});

// 2. СВОДКА (Суммы по станциям и кассирам)
router.get('/summary', async (req: any, res) => {
  try {
    const db = await getDB();
    const { whereStr, params } = buildWhere(req.user, req.query);
    const summary = await db.get(`
      SELECT COUNT(t.id) as total_sessions, SUM(t.consumed_kwh) as total_kwh, SUM(t.amount_tjs) as total_tjs
      FROM transactions t 
      JOIN shifts sh ON t.shift_id = sh.id
      LEFT JOIN connectors c ON t.connector_id = c.id 
      ${whereStr}
    `, params);
    res.json({
      total_sessions: summary.total_sessions || 0,
      total_kwh: summary.total_kwh || 0,
      total_tjs: summary.total_tjs || 0
    });
  } catch (error) { 
    console.error('Summary Error:', error);
    res.status(500).json({ error: 'Ошибка БД' }); 
  }
});

// 3. ЭКСПОРТ В CSV
router.get('/export', async (req: any, res) => {
  try {
    const db = await getDB();
    const { whereStr, params } = buildWhere(req.user, req.query);
    const data = await db.all(`
      SELECT t.id, s.name as station, c.name as connector, u.username as cashier, t.amount_tjs, t.consumed_kwh, t.created_at
      FROM transactions t 
      JOIN shifts sh ON t.shift_id = sh.id
      LEFT JOIN connectors c ON t.connector_id = c.id 
      LEFT JOIN stations s ON c.station_id = s.id 
      LEFT JOIN users u ON sh.user_id = u.id
      ${whereStr} ORDER BY t.created_at DESC
    `, params);

    const csvHeaders = 'ID,Станция,Коннектор,Кассир,Сумма(TJS),Энергия(kWh),Дата\n';
    const csvRows = data.map(row => `${row.id},"${row.station}","${row.connector}","${row.cashier}",${row.amount_tjs},${row.consumed_kwh},"${row.created_at}"`).join('\n');
    
    res.header('Content-Type', 'text/csv');
    res.attachment(`report_${new Date().getTime()}.csv`);
    res.send(csvHeaders + csvRows);
  } catch (error) { 
    console.error('Export Error:', error);
    res.status(500).json({ error: 'Ошибка экспорта' }); 
  }
});

// 4. ГЛУБОКАЯ АНАЛИТИКА (Для Бухгалтера и Админа)
router.get('/analytics', async (req: any, res) => {
  try {
    if (req.user && req.user.role === 'cashier') return res.status(403).json({ error: 'Нет доступа' });
    
    const db = await getDB();
    const { whereStr, params } = buildWhere(req.user, req.query);

    // Доход по месяцам
    const byMonth = await db.all(`
      SELECT strftime('%Y-%m', created_at) as period, SUM(amount_tjs) as revenue, SUM(consumed_kwh) as kwh, COUNT(id) as sessions
      FROM transactions ${whereStr} GROUP BY period ORDER BY period DESC LIMIT 12
    `, params);

    // Доход по кассирам
    const byCashier = await db.all(`
      SELECT u.username as name, SUM(t.amount_tjs) as revenue, COUNT(t.id) as sessions
      FROM transactions t JOIN shifts sh ON t.shift_id = sh.id LEFT JOIN users u ON sh.user_id = u.id
      ${whereStr} GROUP BY u.id ORDER BY revenue DESC
    `, params);

    // Доход по станциям
    const byStation = await db.all(`
      SELECT s.name as name, SUM(t.amount_tjs) as revenue, SUM(t.consumed_kwh) as kwh
      FROM transactions t LEFT JOIN connectors c ON t.connector_id = c.id LEFT JOIN stations s ON c.station_id = s.id
      ${whereStr} GROUP BY s.id ORDER BY revenue DESC
    `, params);

    res.json({ byMonth, byCashier, byStation });
  } catch (error) { 
    console.error('Deep Analytics Error:', error);
    res.status(500).json({ error: 'Analytics Error' }); 
  }
});

// 5. ОТЧЕТ ПО СМЕНАМ (Для старого компонента ShiftReport)
router.get('/shifts', async (req: any, res) => {
  try {
    const db = await getDB();
    const { date, cashier_id } = req.query;
    
    let whereStr = "WHERE t.status = 'completed'";
    const params: any[] = [];
    
    if (date) {
      whereStr += " AND date(t.created_at) = ?";
      params.push(date);
    }
    
    if (cashier_id) {
      whereStr += " AND sh.user_id = ?";
      params.push(cashier_id);
    }

    const summaryQuery = `
      SELECT SUM(t.amount_tjs) as total_revenue, SUM(t.consumed_kwh) as total_kwh, COUNT(t.id) as operations_count
      FROM transactions t
      LEFT JOIN shifts sh ON t.shift_id = sh.id
      ${whereStr}
    `;
    const summaryRes = await db.get(summaryQuery, params);

    const txQuery = `
      SELECT t.id, t.created_at as time, s.name as station, c.name as connector, t.consumed_kwh, t.amount_tjs
      FROM transactions t
      LEFT JOIN shifts sh ON t.shift_id = sh.id
      LEFT JOIN connectors c ON t.connector_id = c.id
      LEFT JOIN stations s ON c.station_id = s.id
      ${whereStr}
      ORDER BY t.created_at DESC
    `;
    const transactions = await db.all(txQuery, params);

    res.json({
      total_revenue: summaryRes.total_revenue || 0,
      total_kwh: summaryRes.total_kwh || 0,
      operations_count: summaryRes.operations_count || 0,
      transactions
    });
  } catch (error) {
    console.error('Shifts Report Error:', error);
    res.status(500).json({ error: 'Ошибка БД' });
  }
});

// НОВЫЙ ОТЧЕТ КАССИРОВ (с фильтрами)
router.get('/cashiers', async (req: any, res) => {
  console.log('✅ ЗАПРОС ДОШЕЛ ДО ОТЧЕТОВ:', req.query); 
  const { startDate, endDate, stationId, cashier } = req.query;
  try {
    const db = await getDB();
    
    let query = `
      SELECT t.*, c.name as connector_name, s.name as station_name, u.username as cashier_name 
      FROM transactions t
      LEFT JOIN connectors c ON t.connector_id = c.id
      LEFT JOIN stations s ON c.station_id = s.id
      LEFT JOIN shifts sh ON t.shift_id = sh.id
      LEFT JOIN users u ON sh.user_id = u.id
      WHERE t.status = 'completed'
    `;
    const params: any[] = [];

    // RBAC: Кассир видит только себя
    if (req.user && req.user.role === 'cashier') {
      query += ` AND sh.user_id = ?`;
      params.push(req.user.id);
    } else if (cashier && cashier !== 'all') { 
      // Фильтр по кассиру (для Админа/Финансиста)
      query += ` AND u.username = ?`; 
      params.push(cashier); 
    }

    // Фильтр по диапазону дат
    if (startDate && endDate) {
      query += ` AND t.created_at >= datetime(? || ' 00:00:00') AND t.created_at <= datetime(? || ' 23:59:59')`;
      params.push(startDate, endDate);
    } else if (startDate) {
      query += ` AND t.created_at >= datetime(? || ' 00:00:00')`;
      params.push(startDate);
    }
    
    // Фильтр по станции
    if (stationId && stationId !== 'all') {
      query += ` AND s.id = ?`;
      params.push(stationId);
    }

    query += ` ORDER BY t.created_at DESC`;
    
    const transactions = await db.all(query, params);

    // Считаем агрегацию
    const total_revenue = transactions.reduce((sum, tx) => sum + (tx.amount_tjs || 0), 0);
    const total_kwh = transactions.reduce((sum, tx) => sum + (tx.consumed_kwh || 0), 0);

    res.json({
      total_revenue,
      total_kwh,
      operations_count: transactions.length,
      transactions
    });
  } catch (error) {
    console.error('Ошибка отчета:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение списка кассиров для фильтра
router.get('/cashiers-list', async (req, res) => {
  try {
    const db = await getDB();
    const cashiers = await db.all('SELECT id, username FROM users WHERE role = "cashier"');
    res.json(cashiers);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка БД' });
  }
});

// 6. СПИСОК СМЕН С АГРЕГАЦИЕЙ
router.get('/shifts-list', async (req: any, res) => {
  try {
    const db = await getDB();
    const { startDate, endDate, cashier } = req.query;
    
    let query = `
      SELECT 
        sh.id, 
        u.username as cashier_name, 
        sh.start_time, 
        sh.end_time, 
        sh.status,
        SUM(t.consumed_kwh) as total_kwh, 
        SUM(t.amount_tjs) as total_tjs
      FROM shifts sh
      JOIN users u ON sh.user_id = u.id
      LEFT JOIN transactions t ON t.shift_id = sh.id
      WHERE sh.status = 'closed'
    `;
    const params: any[] = [];

    if (cashier && cashier !== 'all') {
      query += ` AND u.username = ?`;
      params.push(cashier);
    }

    if (startDate && endDate) {
      query += ` AND sh.start_time >= datetime(? || ' 00:00:00') AND sh.start_time <= datetime(? || ' 23:59:59')`;
      params.push(startDate, endDate);
    } else if (startDate) {
      query += ` AND sh.start_time >= datetime(? || ' 00:00:00')`;
      params.push(startDate);
    }

    query += ` GROUP BY sh.id ORDER BY sh.start_time DESC`;
    
    const shifts = await db.all(query, params);
    res.json(shifts);
  } catch (error) {
    console.error('Shifts List Error:', error);
    res.status(500).json({ error: 'Ошибка БД' });
  }
});

export default router;