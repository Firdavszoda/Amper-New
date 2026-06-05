import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { getDB } from '../database/db'; 

export const activeConnections = new Map<string, WebSocket>();
export let globalPricePerKwh = 3.6;
export let globalReserveWh = 50; 

export const loadGlobalPrice = async () => {
  try {
    const db = await getDB();
    const priceSetting = await db.get(`SELECT value FROM settings WHERE key = 'price_per_kwh'`);
    if (priceSetting) globalPricePerKwh = parseFloat(priceSetting.value);
    
    const reserveSetting = await db.get(`SELECT value FROM settings WHERE key = 'stop_reserve_wh'`);
    if (reserveSetting) globalReserveWh = parseFloat(reserveSetting.value);
    
    console.log(`💰 Тариф: ${globalPricePerKwh} | 🛡 Резерв: ${globalReserveWh} Wh`);
  } catch (e) { console.error('Ошибка загрузки настроек', e); }
};

export function setupOcppServer(server: HttpServer, io: SocketIOServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    if (request.url?.startsWith('/ocpp/')) {
      wss.handleUpgrade(request, socket, head, (ws) => { wss.emit('connection', ws, request); });
    }
  });

  wss.on('connection', async (ws: WebSocket, req) => {
    const urlParts = req.url?.split('/') || [];
    const stationId = urlParts[urlParts.length - 1];
    activeConnections.set(stationId, ws);

    try {
      const db = await getDB();
      await db.run('UPDATE stations SET status = "online" WHERE serial_number = ?', [stationId]);
      await db.run('UPDATE connectors SET status = "available" WHERE station_id = (SELECT id FROM stations WHERE serial_number = ?)', [stationId]);
      io.emit('station_status_update');
    } catch(e) {}

    ws.on('message', async (message: string) => {
      try {
        const parsed = JSON.parse(message.toString());
        if (Array.isArray(parsed) && parsed[0] === 2) {
          const [messageTypeId, messageId, action, payload] = parsed;

          if (action === 'BootNotification' || action === 'Heartbeat') {
            ws.send(JSON.stringify([3, messageId, { status: 'Accepted', currentTime: new Date().toISOString(), interval: 300 }]));
          }

          if (action === 'StatusNotification') {
            ws.send(JSON.stringify([3, messageId, {}]));
            try {
              const db = await getDB();
              const station = await db.get('SELECT id FROM stations WHERE serial_number = ?', [stationId]);
              if (station) {
                const exactStatus = payload.status.toLowerCase();
                await db.run('UPDATE connectors SET status = ? WHERE station_id = ? AND name LIKE ?', [exactStatus, station.id, `%${payload.connectorId}%`]);
                io.emit('station_status_update');
              }
            } catch (e) {}
          }

          if (action === 'StartTransaction') {
            const db = await getDB();
            const station = await db.get('SELECT id FROM stations WHERE serial_number = ?', [stationId]);
            const dbConn = await db.get('SELECT id FROM connectors WHERE station_id = ? AND name LIKE ?', [station.id, `%${payload.connectorId}%`]);
            const realDbConnectorId = dbConn?.id || payload.connectorId;

            let tx = await db.get('SELECT id FROM transactions WHERE connector_id = ? AND status = "charging"', [realDbConnectorId]);

            if (!tx) {
              const res = await db.run(`INSERT INTO transactions (connector_id, status, is_full_tank, target_kwh) VALUES (?, 'charging', 1, 999)`, [realDbConnectorId]);
              tx = { id: res.lastID };
              await db.run('UPDATE connectors SET status = "charging" WHERE id = ?', [realDbConnectorId]);
              io.emit('charging_update', { transaction_id: tx.id, connector_id: realDbConnectorId, consumed_kwh: 0, amount_tjs: 0, status: 'charging', soc: 0, price_per_kwh: globalPricePerKwh });
              io.emit('station_status_update');
            }
            ws.send(JSON.stringify([3, messageId, { transactionId: tx.id, idTagInfo: { status: "Accepted" } }]));
          }

          if (action === 'MeterValues') {
            ws.send(JSON.stringify([3, messageId, {}]));
            try {
              const db = await getDB();
              const tx = await db.get('SELECT * FROM transactions WHERE id = ?', [payload.transactionId]);
              
              if (tx && tx.status === 'charging') {
                let realKwh = tx.consumed_kwh || 0;
                let currentSoc = 0;

                // Бронебойный рекурсивный поиск любых значений в любой структуре OCPP
                const searchValues = (obj: any) => {
                  if (!obj || typeof obj !== 'object') return;
                  if (obj.value !== undefined) {
                    const m = (obj.measurand || 'energy.active.import.register').toLowerCase();
                    if (m === 'energy.active.import.register') realKwh = Number(obj.value) / 1000;
                    if (m === 'soc' || m === 'stateofcharge') currentSoc = Math.round(Number(obj.value));
                  }
                  Object.values(obj).forEach(searchValues);
                };
                searchValues(payload);

                const newAmount = realKwh * globalPricePerKwh;
                const projectedKwh = realKwh + (globalReserveWh / 1000);

                if (tx.is_full_tank === 0 && projectedKwh >= tx.target_kwh) {
                  // АВТОСТОП
                  await db.run('UPDATE transactions SET status = "completed", stop_time = CURRENT_TIMESTAMP WHERE id = ?', [tx.id]);
                  await db.run('UPDATE connectors SET status = "available" WHERE id = ?', [tx.connector_id]);
                  ws.send(JSON.stringify([2, Math.random().toString(36).substring(2, 10), "RemoteStopTransaction", { transactionId: tx.id }]));
                  io.emit('transaction_completed', { transactionId: tx.id, connectorId: tx.connector_id, final_kwh: realKwh, final_tjs: newAmount });
                  io.emit('station_status_update');
                } else {
                  // ОБНОВЛЕНИЕ
                  await db.run('UPDATE transactions SET consumed_kwh = ?, amount_tjs = ? WHERE id = ?', [realKwh, newAmount, tx.id]);
                  io.emit('charging_update', { transaction_id: tx.id, connector_id: tx.connector_id, consumed_kwh: realKwh, amount_tjs: newAmount, status: 'charging', soc: currentSoc, price_per_kwh: globalPricePerKwh });
                }
              }
            } catch (e) { console.error('Ошибка MeterValues:', e); }
          }

          if (action === 'StopTransaction') {
            ws.send(JSON.stringify([3, messageId, { idTagInfo: { status: "Accepted" } }]));
            const db = await getDB();
            const tx = await db.get('SELECT connector_id, consumed_kwh, amount_tjs FROM transactions WHERE id = ?', [payload.transactionId]);
            if (tx) {
              await db.run('UPDATE transactions SET status = "completed", stop_time = CURRENT_TIMESTAMP WHERE id = ?', [payload.transactionId]);
              await db.run('UPDATE connectors SET status = "available" WHERE id = ?', [tx.connector_id]);
              io.emit('transaction_completed', { transactionId: payload.transactionId, connectorId: tx.connector_id, final_kwh: tx.consumed_kwh, final_tjs: tx.amount_tjs });
              io.emit('station_status_update');
            }
          }
        }
      } catch (err) {}
    });

    ws.on('close', async () => {
      activeConnections.delete(stationId);
      const db = await getDB();
      await db.run('UPDATE stations SET status = "offline" WHERE serial_number = ?', [stationId]);
      await db.run('UPDATE connectors SET status = "faulted" WHERE station_id = (SELECT id FROM stations WHERE serial_number = ?)', [stationId]);
      io.emit('station_status_update');
    });
  });
}

export async function remoteStart(stationId: string, dbConnectorId: number, idTag: string = "KASSA", transactionId?: number) {
  const ws = activeConnections.get(stationId);
  if (!ws) return false;
  const db = await getDB();
  const conn = await db.get('SELECT name FROM connectors WHERE id = ?', [dbConnectorId]);
  const physicalId = conn?.name?.match(/\d+/)?.[0] || 1;
  ws.send(JSON.stringify([2, Math.random().toString(36).substring(2, 9), "RemoteStartTransaction", { connectorId: parseInt(physicalId as string), idTag, transactionId }]));
  return true;
}

export function remoteStop(stationId: string, transactionId: number) {
  const ws = activeConnections.get(stationId);
  if (!ws) return false;
  ws.send(JSON.stringify([2, Math.random().toString(36).substring(2, 9), "RemoteStopTransaction", { transactionId }]));
  return true;
}