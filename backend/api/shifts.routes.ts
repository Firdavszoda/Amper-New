import { Router } from 'express';
import { getDB } from '../database/db';

const router = Router();

// 1. Получить текущую смену пользователя
router.get('/current/:userId', async (req, res) => {
  try {
    const db = await getDB();
    const shift = await db.get(
      'SELECT * FROM shifts WHERE user_id = ? AND status = "open" ORDER BY id DESC LIMIT 1',
      [req.params.userId]
    );
    res.json(shift || null);
  } catch (error) {
    console.error('Error fetching current shift:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 2. Открыть смену
router.post('/open', async (req, res) => {
  const { userId } = req.body;
  try {
    const db = await getDB();
    
    // Проверяем, нет ли уже открытой смены
    const existing = await db.get('SELECT id FROM shifts WHERE user_id = ? AND status = "open"', [userId]);
    if (existing) {
      return res.status(400).json({ error: 'Shift already open' });
    }

    const result = await db.run(
      'INSERT INTO shifts (user_id, start_time, status) VALUES (?, datetime("now"), "open")',
      [userId]
    );
    
    const newShift = await db.get('SELECT * FROM shifts WHERE id = ?', [result.lastID]);
    res.json(newShift);
  } catch (error) {
    console.error('Error opening shift:', error);
    res.status(500).json({ error: 'Failed to open shift' });
  }
});

// 3. Закрыть смену
router.post('/close', async (req, res) => {
  const { shiftId } = req.body;
  try {
    const db = await getDB();
    
    // Считаем выручку из завершенных транзакций этой смены
    const revenueData = await db.get(
      'SELECT SUM(amount_tjs) as total FROM transactions WHERE shift_id = ? AND status = "completed"',
      [shiftId]
    );

    const totalRevenue = revenueData?.total || 0;

    await db.run(
      `UPDATE shifts 
       SET status = "closed", 
           end_time = datetime("now"), 
           total_revenue = ? 
       WHERE id = ?`,
      [totalRevenue, shiftId]
    );

    res.json({ success: true, revenue: totalRevenue });
  } catch (error) {
    console.error('Error closing shift:', error);
    res.status(500).json({ error: 'Failed to close shift' });
  }
});

export default router;
