import { Router } from 'express';
import { getDB, addLog } from '../database/db';
import { remoteStart, remoteStop, globalPricePerKwh } from '../ocpp';

const router = Router();

// 1. Начать зарядку
router.post('/start', async (req, res) => {
  const { shift_id, connector_id, amount_tjs, is_full_tank } = req.body;
  
  try {
    const db = await getDB();

    // ПРОВЕРКА СТАТУСА: Можно ли вообще заряжать?
    const connectorStatus = await db.get('SELECT status FROM connectors WHERE id = ?', [connector_id]);
    if (!connectorStatus || connectorStatus.status !== 'available') {
      return res.status(400).json({ error: 'Коннектор недоступен (уже занят или отключен в админке)' });
    }

    const target_kwh = is_full_tank ? 999 : (amount_tjs / globalPricePerKwh);
    await db.run('BEGIN TRANSACTION');

    const result = await db.run(
      `INSERT INTO transactions (shift_id, connector_id, amount_tjs, target_kwh, consumed_kwh, status, created_at) 
       VALUES (?, ?, ?, ?, 0, 'charging', datetime("now"))`,
      [shift_id, connector_id, amount_tjs, target_kwh]
    );

    const transactionId = result.lastID;

    await db.run('UPDATE connectors SET status = "charging" WHERE id = ?', [connector_id]);
    await db.run('COMMIT');

    // === ИНТЕГРАЦИЯ С OCPP ===
    try {
      const station = await db.get(
        'SELECT s.serial_number, c.name FROM stations s JOIN connectors c ON s.id = c.station_id WHERE c.id = ?',
        [connector_id]
      );

      if (station) {
        const match = station.name?.match(/\d+/);
        const physicalConnectorId = match ? parseInt(match[0], 10) : 1;

        console.log(`🚀 Запуск транзакции #${transactionId} на станции ${station.serial_number}`);
        remoteStart(station.serial_number, physicalConnectorId, "KASSA", transactionId);
      }
    } catch (e) {
      console.error('Ошибка отправки RemoteStart в OCPP:', e);
    }

    // Логирование
    try {
      const shift = await db.get('SELECT user_id FROM shifts WHERE id = ?', [shift_id]);
      if (shift) {
        await addLog(shift.user_id, 'START_CHARGE', `Запущена зарядка на коннекторе ${connector_id}. Сумма: ${is_full_tank ? 'До полного' : amount_tjs + ' TJS'}`);
      }
    } catch (e) { console.error(e) }

    res.json({ transaction_id: transactionId });
  } catch (error) {
    console.error('Error starting transaction:', error);
    const db = await getDB();
    await db.run('ROLLBACK');
    res.status(500).json({ error: 'Failed to start transaction' });
  }
});

// 2. Остановить зарядку (БРОНЕБОЙНЫЙ МЕТОД)
router.post('/stop', async (req, res) => {
  const { transaction_id, connector_id } = req.body;

  try {
    const db = await getDB();
    await db.run('BEGIN TRANSACTION');

    // ИЩЕМ РЕАЛЬНО АКТИВНУЮ ТРАНЗАКЦИЮ НА ЭТОМ КОННЕКТОРЕ
    const activeTx = await db.get(
      'SELECT id FROM transactions WHERE connector_id = ? AND status = "charging" ORDER BY id DESC LIMIT 1',
      [connector_id]
    );

    // Если нашли активную - берем её ID. Иначе пытаемся использовать тот, что прислал фронт (как fallback)
    const targetTxId = activeTx ? activeTx.id : transaction_id;

    if (!targetTxId) {
      await db.run('ROLLBACK');
      return res.status(404).json({ error: 'Нет активной транзакции для остановки' });
    }

    // Закрываем транзакцию в БД
    await db.run('UPDATE transactions SET status = "completed", finished_at = datetime("now") WHERE id = ?', [targetTxId]);
    await db.run('UPDATE connectors SET status = "available" WHERE id = ?', [connector_id]);
    await db.run('COMMIT');

    // Находим серийник станции для OCPP
    const stationData = await db.get(
      'SELECT s.serial_number, c.name FROM stations s JOIN connectors c ON s.id = c.station_id WHERE c.id = ?', 
      [connector_id]
    );

    if (stationData) {
      const match = stationData.name?.match(/\d+/);
      const physicalConnectorId = match ? parseInt(match[0], 10) : 1;
      // Отправляем точный, железобетонный ID в эмулятор
      remoteStop(stationData.serial_number, targetTxId, physicalConnectorId);
      res.json({ success: true, stopped_transaction_id: targetTxId });
    } else {
      res.status(404).json({ error: 'Станция не найдена' });
    }
  } catch (error) {
    console.error('Ошибка при остановке:', error);
    const db = await getDB();
    await db.run('ROLLBACK');
    res.status(500).json({ error: 'Failed to stop' });
  }
});

// 3. Список активных транзакций
router.get('/active', async (req, res) => {
  try {
    const db = await getDB();
    const active = await db.all('SELECT * FROM transactions WHERE status = "charging"');
    res.json(active);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;