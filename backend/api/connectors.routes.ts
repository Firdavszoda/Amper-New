import { Router } from 'express';
import { getDB } from '../database/db';
import { activeConnections, remoteStop } from '../ocpp';

const router = Router();

// ЭКСТРЕННОЕ ОТКЛЮЧЕНИЕ (Админская блокировка)
router.post('/:id/emergency-stop', async (req: any, res: any) => {
  const { id } = req.params;
  try {
    const db = await getDB();
    const conn = await db.get(`SELECT c.*, s.serial_number FROM connectors c JOIN stations s ON c.station_id = s.id WHERE c.id = ?`, [id]);
    
    if (!conn) return res.status(404).json({ error: 'Не найдено' });

    // 1. Стопаем зарядку
    const tx = await db.get('SELECT id FROM transactions WHERE connector_id = ? AND status = "charging"', [id]);
    if (tx) remoteStop(conn.serial_number, tx.id);

    // 2. Ставим статус "admin_locked" - это наш маркер, что включить может только админ
    await db.run('UPDATE connectors SET status = "admin_locked" WHERE id = ?', [id]);

    // 3. Отправляем OCPP команду на блокировку
    const ws = activeConnections.get(conn.serial_number);
    if (ws) {
      const physicalId = conn.connector_id || (conn.name.includes('1') ? 1 : conn.name.includes('2') ? 2 : 1);
      ws.send(JSON.stringify([
        2, Math.random().toString(36).substring(2, 9), "ChangeAvailability", 
        { connectorId: physicalId, type: "Inoperative" }
      ]));
    }
    
    if (req.io) req.io.emit('station_status_update');
    res.json({ success: true, message: 'Ручка заблокирована админом' });
  } catch (error) { res.status(500).json({ error: 'Ошибка' }); }
});

// ВКЛЮЧЕНИЕ РУЧКИ (Снимает админскую блокировку)
router.post('/:id/power-on', async (req: any, res: any) => {
  const { id } = req.params;
  try {
    const db = await getDB();
    const conn = await db.get(`SELECT c.*, s.serial_number FROM connectors c JOIN stations s ON c.station_id = s.id WHERE c.id = ?`, [id]);
    
    if (!conn) return res.status(404).json({ error: 'Не найдено' });

    // 1. Снимаем статус блокировки
    await db.run('UPDATE connectors SET status = "available" WHERE id = ?', [id]);

    // 2. Разрешаем работу через OCPP
    const ws = activeConnections.get(conn.serial_number);
    if (ws) {
      const physicalId = conn.connector_id || (conn.name.includes('1') ? 1 : conn.name.includes('2') ? 2 : 1);
      ws.send(JSON.stringify([
        2, Math.random().toString(36).substring(2, 9), "ChangeAvailability", 
        { connectorId: physicalId, type: "Operative" }
      ]));
    }
    
    if (req.io) req.io.emit('station_status_update');
    res.json({ success: true, message: 'Ручка разблокирована' });
  } catch (error) { res.status(500).json({ error: 'Ошибка' }); }
});

export default router;