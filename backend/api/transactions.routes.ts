import { Router } from 'express';
import { getDB, addLog } from '../database/db';
import { remoteStart, remoteStop, globalPricePerKwh, activeConnections, sendOcppCommandAndWait } from '../ocpp';

const router = Router();

// 1. Начать зарядку
router.post('/start', async (req: any, res: any) => {
  const { shift_id, connector_id, amount_tjs, is_full_tank } = req.body;
  
  if (!is_full_tank && (!amount_tjs || amount_tjs <= 0)) {
    return res.status(400).json({ error: 'Укажите сумму для зарядки' });
  }
  
  try {
    const db = await getDB();

    // ПРОВЕРКА СТАТУСА: Можно ли вообще заряжать?
    const connectorStatus = await db.get('SELECT status FROM connectors WHERE id = ?', [connector_id]);
    if (!connectorStatus || connectorStatus.status !== 'available') {
      return res.status(400).json({ error: 'Коннектор недоступен (уже занят или отключен в админке)' });
    }

    // Находим серийник станции и имя коннектора для OCPP
    const stationData = await db.get(
      'SELECT s.serial_number, c.name FROM stations s JOIN connectors c ON s.id = c.station_id WHERE c.id = ?',
      [connector_id]
    );

    if (!stationData) return res.status(404).json({ error: 'Станция не найдена' });
    
    const ws = activeConnections.get(stationData.serial_number);
    if (!ws) return res.status(404).json({ error: 'Станция оффлайн' });

    const physicalConnectorId = parseInt(stationData.name.match(/\d+/)?.[0] || '1');
    const target_kwh = is_full_tank ? 999 : (amount_tjs / globalPricePerKwh);

    // === 1. СНАЧАЛА СОЗДАЕМ ТРАНЗАКЦИЮ В БД ===
    await db.run('BEGIN TRANSACTION');
    
    const result = await db.run(
      `INSERT INTO transactions (shift_id, connector_id, amount_tjs, target_kwh, consumed_kwh, status, is_full_tank, start_time, id_tag)
       VALUES (?, ?, ?, ?, 0, 'pending', ?, CURRENT_TIMESTAMP, 'TEMP')`,
      [shift_id, connector_id, amount_tjs, target_kwh, is_full_tank ? 1 : 0]
    );
    
    const transactionId = result.lastID;
    const dynamicIdTag = `KASSA-${transactionId}`; // Идеальный тег: KASSA-69

    // Обновляем временный тег на правильный
    await db.run('UPDATE transactions SET id_tag = ? WHERE id = ?', [dynamicIdTag, transactionId]);
    await db.run('COMMIT');

    // === 2. ОТПРАВЛЯЕМ КОМАНДУ В OCPP ===
    try {
      const response = await sendOcppCommandAndWait(ws, "RemoteStartTransaction", {
        connectorId: physicalConnectorId,
        idTag: dynamicIdTag
      });

      if (response.status !== 'Accepted') {
        // Если станция отказала - помечаем транзакцию как ошибку
        await getDB().then(d => d.run('UPDATE transactions SET status = "faulted" WHERE id = ?', [transactionId]));
        return res.status(400).json({ error: `Станция отклонила запуск: ${response.status}` });
      }
    } catch (e: any) {
      console.error('Ошибка OCPP RemoteStart:', e);
      // Если тайм-аут или ошибка сети - отменяем транзакцию
      await getDB().then(d => d.run('UPDATE transactions SET status = "faulted" WHERE id = ?', [transactionId]));
      return res.status(504).json({ error: `Ошибка связи со станцией: ${e.message}` });
    }

    // === 3. УСПЕХ ===
    await getDB().then(d => d.run('UPDATE connectors SET status = "preparing" WHERE id = ?', [connector_id]));

    // Логирование
    try {
      const shift = await db.get('SELECT user_id FROM shifts WHERE id = ?', [shift_id]);
      if (shift) {
        await addLog(shift.user_id, 'START_CHARGE', `Запущена зарядка на коннекторе ${connector_id}. Тег: ${dynamicIdTag}`);
      }
    } catch (e) { console.error(e); }

    req.io.emit('station_status_update');
    res.json({ transaction_id: transactionId, message: 'Зарядка запускается...' });
  } catch (error) {
    console.error('Error starting transaction:', error);
    const db = await getDB();
    await db.run('ROLLBACK');
    res.status(500).json({ error: 'Failed to start transaction' });
  }
});

// 2. Остановить зарядку (БРОНЕБОЙНЫЙ МЕТОД)
router.post('/stop', async (req: any, res: any) => {
  const { transaction_id, connector_id } = req.body;

  try {
    const db = await getDB();
    await db.run('BEGIN TRANSACTION');

    // ИЩЕМ РЕАЛЬНО АКТИВНУЮ ТРАНЗАКЦИЮ НА ЭТОМ КОННЕКТОРЕ
    const activeTx = await db.get(
      'SELECT id, consumed_kwh, amount_tjs FROM transactions WHERE connector_id = ? AND status = "charging" ORDER BY id DESC LIMIT 1',
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

    req.io.emit('station_status_update');
    // Если станция не ответит на RemoteStop, мы все равно должны показать чек кассиру:
    req.io.emit('transaction_completed', { 
      transactionId: targetTxId, 
      connectorId: connector_id,
      final_kwh: activeTx?.consumed_kwh || 0,
      final_tjs: activeTx?.amount_tjs || 0
    });

    // Находим серийник станции для OCPP
    const stationData = await db.get(
      'SELECT s.serial_number FROM stations s JOIN connectors c ON s.id = c.station_id WHERE c.id = ?', 
      [connector_id]
    );

    if (stationData) {
      // ИСПРАВЛЕНИЕ: Вызываем remoteStop строго с 2 аргументами (без physicalConnectorId)
      remoteStop(stationData.serial_number, targetTxId);
      res.json({ success: true, stopped_transaction_id: targetTxId });
    } else {
      res.status(404).json({ error: 'Станция не найдена' });
    }
  } catch (error) {
    console.error('Ошибка при остановке:', error);
    const db = await getDB();
    try {
      await db.run('ROLLBACK');
    } catch (rollbackError) {
      // Игнорируем: транзакция не была начата
    }
    res.status(500).json({ error: 'Failed to stop' });
  }
});

// 3. Список активных транзакций
router.get('/active', async (req, res) => {
  try {
    const db = await getDB();
    const active = await db.all('SELECT * FROM transactions WHERE status IN ("charging", "pending")');
    res.json(active);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;