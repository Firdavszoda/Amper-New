import { Router } from 'express';
import { getDB } from '../database/db';
import { loadGlobalPrice, globalPricePerKwh, activeConnections, sendOcppCommandAndWait } from '../ocpp';

const router = Router();

// Получить текущие настройки
router.get('/all', async (req, res) => {
  try {
    const db = await getDB();
    const settings = await db.all('SELECT key, value FROM settings');
    const settingsObj = settings.reduce((acc: any, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    res.json({ 
      price_per_kwh: globalPricePerKwh,
      stop_reserve_wh: settingsObj.stop_reserve_wh || 50
    });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка БД' });
  }
});

// Роут для совместимости с фронтом (старый)
router.get('/price', (req, res) => {
  res.json({ price_per_kwh: globalPricePerKwh });
});

// Обновить цену
router.post('/price', async (req: any, res: any) => {
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

    // РАССЫЛКА НОВОГО ТАРИФА НА ВСЕ СТАНЦИИ
    if (activeConnections.size > 0) {
      console.log(`📢 Рассылка нового тарифа (${globalPricePerKwh}) на ${activeConnections.size} станций...`);
      for (const [serial, ws] of activeConnections.entries()) {
        sendOcppCommandAndWait(ws, "ChangeConfiguration", { 
          key: "TariffPrice", 
          value: String(globalPricePerKwh) 
        }).catch(err => console.error(`❌ Ошибка обновления тарифа на ${serial}:`, err.message));
      }
    }

    if (req.io) {
      req.io.emit('price_updated', { price_per_kwh: globalPricePerKwh });
    }
    res.json({ success: true, new_price: globalPricePerKwh });
  } catch (error) {
    console.error('Ошибка сохранения тарифа:', error);
    res.status(500).json({ error: 'Ошибка БД' });
  }
});

// Обновить резерв
router.post('/reserve', async (req: any, res: any) => {
  const { stop_reserve_wh } = req.body;
  const reserve = typeof stop_reserve_wh === 'string' ? parseFloat(stop_reserve_wh) : stop_reserve_wh;

  if (typeof reserve !== 'number' || isNaN(reserve) || reserve < 0) {
    return res.status(400).json({ error: 'Неверное значение резерва' });
  }

  try {
    const db = await getDB();
    await db.run(
      `INSERT INTO settings (key, value) VALUES ('stop_reserve_wh', ?) 
       ON CONFLICT(key) DO UPDATE SET value = ?`,
      [reserve.toString(), reserve.toString()]
    );
    await loadGlobalPrice();

    // РАССЫЛКА НОВОГО РЕЗЕРВА НА ВСЕ СТАНЦИИ
    if (activeConnections.size > 0) {
      console.log(`📢 Рассылка нового резерва (${reserve} Wh) на ${activeConnections.size} станций...`);
      for (const [serial, ws] of activeConnections.entries()) {
        sendOcppCommandAndWait(ws, "ChangeConfiguration", { 
          key: "StopReserveWh", 
          value: String(reserve) 
        }).catch(err => console.error(`❌ Ошибка обновления резерва на ${serial}:`, err.message));
      }
    }

    res.json({ success: true, new_reserve: reserve });
  } catch (error) {
    console.error('Ошибка сохранения резерва:', error);
    res.status(500).json({ error: 'Ошибка БД' });
  }
});

export default router;