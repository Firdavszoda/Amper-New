import { Router } from 'express';
import { getDB } from '../database/db';
import { activeConnections, remoteStop, sendOcppCommandAndWait } from '../ocpp';

const router = Router();

// Вспомогательная функция для генерации ответа
const handleOcppResponse = (res: any, response: any, successMessage: string) => {
  const status = response.status; // Accepted, Rejected, NotSupported...
  if (status === 'Accepted' || status === 'Scheduled') {
    return res.json({ success: true, message: successMessage });
  } else if (status === 'Rejected') {
    return res.status(400).json({ error: 'Станция отклонила команду (Rejected)' });
  } else if (status === 'NotSupported') {
    return res.status(400).json({ error: 'Команда не поддерживается станцией (NotSupported)' });
  } else {
    return res.status(400).json({ error: `Неизвестный ответ: ${status}` });
  }
};

// Получить все станции со вложенными коннекторами
router.get('/', async (req, res) => {
  try {
    const db = await getDB();
    
    const stations = await db.all('SELECT * FROM stations');
    
    const stationsWithConnectors = await Promise.all(
      stations.map(async (station) => {
        const connectors = await db.all(
          'SELECT * FROM connectors WHERE station_id = ?',
          [station.id]
        );
        return { ...station, connectors };
      })
    );
    
    res.json(stationsWithConnectors);
  } catch (error) {
    console.error('Error fetching stations:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 1. УПРАВЛЕНИЕ ЛОКАЛЬНОЙ АВТОРИЗАЦИЕЙ (ChangeConfiguration)
router.post('/:serial/local-auth', async (req: any, res: any) => {
  const { serial } = req.params;
  const { enabled } = req.body; // true = Включить, false = Отключить
  
  const ws = activeConnections.get(serial);
  if (!ws) return res.status(404).json({ error: 'Станция оффлайн' });

  const value = enabled ? "true" : "false";
  
  try {
    // Отправляем основной ключ LocalAuth (как просил заказчик)
    const response = await sendOcppCommandAndWait(ws, "ChangeConfiguration", { key: "LocalAuth", value });
    
    // Дополнительно можно отправить стандартные ключи для надежности
    await sendOcppCommandAndWait(ws, "ChangeConfiguration", { key: "LocalPreAuthorize", value }).catch(() => {});
    
    handleOcppResponse(res, response, `Локальная авторизация ${enabled ? 'ВКЛЮЧЕНА' : 'ОТКЛЮЧЕНА'}`);
  } catch (err: any) { 
    res.status(504).json({ error: err.message }); 
  }
});

// 2. ИЗМЕНЕНИЕ ТАРИФА НА СТАНЦИИ
router.post('/:serial/tariff', async (req: any, res: any) => {
  const { serial } = req.params;
  const { price } = req.body;
  
  const ws = activeConnections.get(serial);
  if (!ws) return res.status(404).json({ error: 'Станция оффлайн' });

  try {
    const response = await sendOcppCommandAndWait(ws, "ChangeConfiguration", { 
      key: "TariffPrice", 
      value: String(price) 
    });
    handleOcppResponse(res, response, `Тариф на станции обновлен до ${price}`);
  } catch (err: any) {
    res.status(504).json({ error: err.message });
  }
});

// 3. БРОНИРОВАНИЕ (ReserveNow)
router.post('/:serial/reserve', async (req: any, res: any) => {
  const { serial } = req.params;
  const { connectorId, expiryDate, userIdTag, reservationId } = req.body;

  const ws = activeConnections.get(serial);
  if (!ws) return res.status(404).json({ error: 'Станция оффлайн' });

  try {
    const response = await sendOcppCommandAndWait(ws, "ReserveNow", {
      connectorId: parseInt(connectorId),
      expiryDate, // ISO 8601
      idTag: userIdTag,
      reservationId: parseInt(reservationId)
    });
    handleOcppResponse(res, response, 'Бронирование успешно создано');
  } catch (err: any) {
    res.status(504).json({ error: err.message });
  }
});

// 4. ПЕРЕЗАГРУЗКА (Soft / Hard Reset)
router.post('/:serial/reset', async (req: any, res: any) => {
  const { serial } = req.params;
  const { type } = req.body; // "Soft" или "Hard"
  const ws = activeConnections.get(serial);
  
  if (!ws) return res.status(404).json({ error: 'Станция оффлайн' });
  
  try {
    const response = await sendOcppCommandAndWait(ws, "Reset", { type });
    handleOcppResponse(res, response, `Команда ${type} Reset успешно принята`);
  } catch (err: any) { 
    res.status(504).json({ error: err.message }); 
  }
});

// 5. ОЧИСТКА КЭША (ClearCache)
router.post('/:serial/clear-cache', async (req: any, res: any) => {
  const serial = req.params.serial;
  const ws = activeConnections.get(serial);
  
  if (!ws) return res.status(404).json({ error: 'Станция оффлайн' });
  
  try {
    const response = await sendOcppCommandAndWait(ws, "ClearCache", {});
    handleOcppResponse(res, response, 'Кэш успешно очищен');
  } catch (err: any) { 
    res.status(504).json({ error: err.message }); 
  }
});

// Добавить новую станцию (вместе с коннекторами)
router.post('/', async (req, res) => {
  const { name, serial_number, connectors } = req.body;

  try {
    const db = await getDB();
    await db.run('BEGIN TRANSACTION');

    try {
      const result = await db.run(
        'INSERT INTO stations (name, serial_number, status) VALUES (?, ?, ?)',
        [name, serial_number, 'online']
      );
      const stationId = result.lastID;

      if (connectors && Array.isArray(connectors)) {
        for (const conn of connectors) {
          await db.run(
            'INSERT INTO connectors (station_id, name, type, max_power_kw, status) VALUES (?, ?, ?, ?, ?)',
            [stationId, conn.name, conn.type || 'GB_T_DC', conn.max_power_kw || 120, 'available']
          );
        }
      }

      await db.run('COMMIT');
      res.json({ id: stationId, name, serial_number, status: 'online' });
    } catch (e) {
      await db.run('ROLLBACK');
      throw e;
    }
  } catch (error) {
    console.error('Error creating station:', error);
    res.status(500).json({ error: 'Failed to create station' });
  }
});

// Изменить станцию (имя или статус)
router.put('/:id', async (req, res) => {
  const { name, status } = req.body;
  const { id } = req.params;

  try {
    const db = await getDB();
    
    let query = 'UPDATE stations SET ';
    const params = [];
    
    if (name) {
      query += 'name = ?, ';
      params.push(name);
    }
    if (status) {
      query += 'status = ?, ';
      params.push(status);
    }
    
    // Удаляем последнюю запятую и пробел
    query = query.slice(0, -2);
    query += ' WHERE id = ?';
    params.push(id);

    if (params.length > 1) {
      await db.run(query, params);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating station:', error);
    res.status(500).json({ error: 'Failed to update station' });
  }
});

// Удалить станцию
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDB();
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Сначала удаляем все коннекторы этой станции
      await db.run('DELETE FROM connectors WHERE station_id = ?', [id]);
      // Затем саму станцию
      await db.run('DELETE FROM stations WHERE id = ?', [id]);
      
      await db.run('COMMIT');
      res.json({ success: true });
    } catch (e) {
      await db.run('ROLLBACK');
      throw e;
    }
  } catch (error) {
    console.error('Error deleting station:', error);
    res.status(500).json({ error: 'Failed to delete station' });
  }
});

export default router;
