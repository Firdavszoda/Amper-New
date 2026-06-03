import { Router } from 'express';
import { getDB } from '../database/db';

const router = Router();

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
