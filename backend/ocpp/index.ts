import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { getDB } from '../database/db'; 

export const chargingSpeeds = new Map<number, { lastWh: number }>();
export const activeConnections = new Map<string, WebSocket>();
export let globalPricePerKwh = 3.6;

export const loadGlobalPrice = async () => {
  try {
    const db = await getDB();
    const setting = await db.get(`SELECT value FROM settings WHERE key = 'price_per_kwh'`);
    if (setting) {
      globalPricePerKwh = parseFloat(setting.value);
    } else {
      await db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('price_per_kwh', '3.6')`);
    }
    console.log(`💰 Текущий тариф загружен: ${globalPricePerKwh} TJS/kWh`);
  } catch (e) { console.error('Ошибка загрузки тарифа', e); }
};

export function setupOcppServer(server: HttpServer, io: SocketIOServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    if (request.url?.startsWith('/ocpp/')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  console.log('⚡ OCPP Сервер инициализирован. Ждем подключения станций...');

  wss.on('connection', async (ws: WebSocket, req) => {
    const urlParts = req.url?.split('/') || [];
    const stationId = urlParts[urlParts.length - 1];

    console.log(`🔌 Станция подключена: [${stationId}]`);
    activeConnections.set(stationId, ws);

    try {
      const db = await getDB();
      await db.run('UPDATE stations SET status = "online" WHERE serial_number = ?', [stationId]);
      await db.run(`UPDATE connectors SET status = "available" WHERE station_id = (SELECT id FROM stations WHERE serial_number = ?)`, [stationId]);
      io.emit('station_status_update');
    } catch (e) { console.error('Ошибка ONLINE:', e); }

    ws.on('message', async (message: string) => {
      try {
        const parsed = JSON.parse(message.toString());
        
        if (Array.isArray(parsed) && parsed[0] === 2) {
          const [messageTypeId, messageId, action, payload] = parsed;
          console.log(`📥 Получено от [${stationId}]: ${action}`);

          if (action === 'BootNotification') {
            ws.send(JSON.stringify([3, messageId, { status: 'Accepted', currentTime: new Date().toISOString(), interval: 300 }]));
          }

          if (action === 'Heartbeat') {
            ws.send(JSON.stringify([3, messageId, { currentTime: new Date().toISOString() }]));
          }

          if (action === 'StatusNotification') {
            const { connectorId, status } = payload;
            ws.send(JSON.stringify([3, messageId, {}])); 

            try {
              const db = await getDB();
              const station = await db.get('SELECT id FROM stations WHERE serial_number = ?', [stationId]);
              if (station) {
                let appStatus = 'available';
                if (status === 'Charging' || status === 'Occupied') appStatus = 'charging';
                else if (status === 'Faulted') appStatus = 'faulted';
                else if (status === 'Preparing' || status === 'SuspendedEV' || status === 'SuspendedEVSE') appStatus = 'available';

                await db.run('UPDATE connectors SET status = ? WHERE station_id = ? AND name LIKE ?', [appStatus, station.id, `%${connectorId}%`]);
                io.emit('station_status_update');
              }
            } catch (e) { console.error('Ошибка БД в StatusNotification:', e); }
          }

          if (action === 'StartTransaction') {
            try {
              const db = await getDB();
              const { connectorId, idTag } = payload;
              
              // Переводим физический connectorId (1 или 2) в ID базы данных
              const station = await db.get('SELECT id FROM stations WHERE serial_number = ?', [stationId]);
              const dbConn = await db.get('SELECT id FROM connectors WHERE station_id = ? AND name LIKE ?', [station.id, `%${connectorId}%`]);
              const realDbConnectorId = dbConn?.id || connectorId;

              let tx = await db.get('SELECT id FROM transactions WHERE connector_id = ? AND status = "charging"', [realDbConnectorId]);

              if (!tx) {
                console.log(`⚡ Запуск напрямую со станции (ID Tag: ${idTag || 'Unknown'})`);
                const result = await db.run(
                  `INSERT INTO transactions (connector_id, start_time, status, is_full_tank, target_kwh, amount_tjs, consumed_kwh) 
                   VALUES (?, CURRENT_TIMESTAMP, 'charging', 1, 999, 0, 0)`,
                  [realDbConnectorId]
                );
                tx = { id: result.lastID };
                await db.run('UPDATE connectors SET status = "charging" WHERE id = ?', [realDbConnectorId]);
                
                io.emit('charging_update', {
                  transaction_id: tx.id, connector_id: realDbConnectorId, consumed_kwh: 0, amount_tjs: 0, status: 'charging', soc: 0, price_per_kwh: globalPricePerKwh
                });
                io.emit('station_status_update');
              }
              ws.send(JSON.stringify([3, messageId, { transactionId: tx.id, idTagInfo: { status: "Accepted" } }]));
            } catch (e) { console.error('Ошибка StartTransaction:', e); }
          }

          if (action === 'MeterValues') {
            ws.send(JSON.stringify([3, messageId, {}]));
            try {
              const db = await getDB();
              const tx = await db.get('SELECT * FROM transactions WHERE id = ?', [payload.transactionId]);
              
              if (tx && tx.status === 'charging') {
                let realKwh = tx.consumed_kwh;
                let currentSoc = 0;

                const meterValues = payload.meterValue || [];
                for (const mv of meterValues) {
                  const sampled = mv.sampledValue || [];
                  for (const sv of sampled) {
                    if (!sv.measurand || sv.measurand === 'Energy.Active.Import.Register') {
                      realKwh = (Number(sv.value) || 0) / 1000; 
                    }
                    if (sv.measurand === 'SoC') currentSoc = Number(sv.value) || 0;
                  }
                }

                const newAmount = realKwh * globalPricePerKwh;

                if (tx.is_full_tank === 0 && realKwh >= tx.target_kwh) {
                  console.log(`🛑 АВТОСТОП: Лимит достигнут для транзакции ${tx.id}`);
                  const msgId = Math.random().toString(36).substring(2, 10);
                  ws.send(JSON.stringify([2, msgId, "RemoteStopTransaction", { transactionId: tx.id }]));

                  await db.run('UPDATE transactions SET status = "completed", stop_time = CURRENT_TIMESTAMP WHERE id = ?', [tx.id]);
                  await db.run('UPDATE connectors SET status = "available" WHERE id = ?', [tx.connector_id]);
                  
                  io.emit('transaction_completed', { transactionId: tx.id, connectorId: tx.connector_id, final_kwh: realKwh, final_tjs: newAmount });
                  io.emit('station_status_update');
                } else {
                  await db.run('UPDATE transactions SET consumed_kwh = ?, amount_tjs = ? WHERE id = ?', [realKwh, newAmount, tx.id]);
                  io.emit('charging_update', { transaction_id: tx.id, connector_id: tx.connector_id, consumed_kwh: realKwh, amount_tjs: newAmount, status: 'charging', soc: currentSoc, price_per_kwh: globalPricePerKwh });
                }
              }
            } catch (e) { console.error('Ошибка MeterValues:', e); }
          }

          if (action === 'StopTransaction') {
            ws.send(JSON.stringify([3, messageId, { idTagInfo: { status: "Accepted" } }]));
            try {
              const db = await getDB();
              const tx = await db.get('SELECT consumed_kwh, amount_tjs, connector_id FROM transactions WHERE id = ?', [payload.transactionId]);
              if (tx) {
                await db.run('UPDATE transactions SET status = "completed", stop_time = CURRENT_TIMESTAMP WHERE id = ?', [payload.transactionId]);
                await db.run('UPDATE connectors SET status = "available" WHERE id = ?', [tx.connector_id]);

                io.emit('transaction_completed', { transactionId: payload.transactionId, connectorId: tx.connector_id, final_kwh: tx.consumed_kwh || 0, final_tjs: tx.amount_tjs || 0 });
                io.emit('station_status_update');
              }
            } catch (e) { console.error('Ошибка StopTransaction:', e); }
          }
        }
      } catch (error) { console.error(` Ошибка:`, error); }
    });

    const setOffline = async () => {
      activeConnections.delete(stationId);
      try {
        const db = await getDB();
        await db.run('UPDATE stations SET status = "offline" WHERE serial_number = ?', [stationId]);
        await db.run(`UPDATE connectors SET status = "faulted" WHERE station_id = (SELECT id FROM stations WHERE serial_number = ?)`, [stationId]);
        io.emit('station_status_update');
      } catch (e) { console.error('Ошибка OFFLINE:', e); }
    };

    ws.on('close', setOffline);
    ws.on('error', setOffline);
  });
}

// Отправка команды старта. Переводим DB_ID в физический (1 или 2) для симулятора
export async function remoteStart(stationId: string, dbConnectorId: number, idTag: string = "KASSA", transactionId?: number) {
  const ws = activeConnections.get(stationId);
  if (!ws) return false;
  
  const db = await getDB();
  const conn = await db.get('SELECT name FROM connectors WHERE id = ?', [dbConnectorId]);
  let physicalId = 1;
  if (conn) {
    const match = conn.name.match(/\d+/);
    if (match) physicalId = parseInt(match[0], 10);
  }

  const messageId = Math.random().toString(36).substring(2, 9);
  const payload: any = { connectorId: physicalId, idTag };
  if (transactionId) payload.transactionId = transactionId;
  ws.send(JSON.stringify([2, messageId, "RemoteStartTransaction", payload]));
  return true;
}

export function remoteStop(stationId: string, transactionId: number) {
  const ws = activeConnections.get(stationId);
  if (!ws) return false;
  const messageId = Math.random().toString(36).substring(2, 9);
  // RemoteStopTransaction по стандарту OCPP берет только transactionId
  ws.send(JSON.stringify([2, messageId, "RemoteStopTransaction", { transactionId }]));
  return true;
}