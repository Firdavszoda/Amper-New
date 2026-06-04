import { Router } from 'express';
import { getDB } from '../database/db';
import { loadGlobalPrice, globalPricePerKwh } from '../ocpp';

const router = Router();

// Получить текущие настройки
router.get('/all', (req, res) => {
  res.json({ 
    price_per_kwh: globalPricePerKwh
  });
});

// Роут для совместимости с фронтом (старый)
router.get('/price', (req, res) => {
  res.json({ price_per_kwh: globalPricePerKwh });
});

// Обновить цену
router.post('/price', async (req, res) => {
  const { price_per_kwh } = req.body;
  const price = typeof price_per_kwh === 'string' ? parseFloat(price_per_kwh) : price_per_kwh;

  if (typeof price !== 'number' || isNaN(price) || price <= 0) {
    return res.status(400).json({ error: 'Неверное значение цены' });
  }

  try {
    const db = await getDB();
    await db.run(
      `INSERT INTO settings (key, value) VALUES ('price_per_kwh', ?) 
       ON CONFLICT(key) DO UPDATE SET value = ?`,
      [price.toString(), price.toString()]
    );
    await loadGlobalPrice();
    if (req.io) {
      req.io.emit('price_updated', { price_per_kwh: globalPricePerKwh });
    }
    res.json({ success: true, new_price: globalPricePerKwh });
  } catch (error) {
    console.error('Ошибка сохранения тарифа:', error);
    res.status(500).json({ error: 'Ошибка БД' });
  }
});

export default router;