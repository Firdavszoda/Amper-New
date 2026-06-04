import { Router } from 'express';
import { getDB } from '../database/db';

const router = Router();

const buildWhere = (user: any, q: any) => {
  const conditions = [];
  const params: any[] = [];

  // Изоляция: Кассир видит только свои транзакции. Админ/Бухгалтер - все.
  // user.role из БД: 'admin', 'cashier', 'financier'
  if (user && user.role === 'cashier') {
    conditions.push('sh.user_id = ?');
    params.push(user.id);
  } else if (q.cashier_id) {
    conditions.push('sh.user_id = ?');
    params.push(q.cashier_id);
  }

  if (q.station_id) {
    conditions.push('c.station_id = ?');
    params.push(q.station_id);
  }
  if (q.startDate) {
    conditions.push('t.created_at >= ?');
    params.push(q.startDate);
  }
  if (q.endDate) {
    conditions.push('t.created_at <= ?');
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

export default router;