import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { getDB } from '../database/db'; 

export const chargingSpeeds = new Map<number, { lastWh: number }>();
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
      // Ставим станцию в online
      await db.run('UPDATE stations SET status = "online" WHERE serial_number = ?', [stationId]);
      // Разблокируем ручки
      await db.run('UPDATE connectors SET status = "available" WHERE station_id = (SELECT id FROM stations WHERE serial_number = ?)', [stationId]);
      
      console.log(`📡 Станция ${stationId} В СЕТИ. Отправляю апдейт на фронт.`);
      io.emit('station_status_update'); // <-- КРИТИЧЕСКИ ВАЖНО ДЛЯ РЕАЛТАЙМА
    } catch (e) { console.error('Ошибка ONLINE:', e); }

    ws.on('message', async (message: string) => {
      try {
        const parsed = JSON.parse(message.toString());
        if (Array.isArray(parsed) && parsed[0] === 2) {
          const [messageTypeId, messageId, action, payload] = parsed;

          if (action === 'StatusNotification') {
            const { connectorId, status } = payload;
            ws.send(JSON.stringify([3, messageId, {}])); 
            try {
              const db = await getDB();
              const station = await db.get('SELECT id FROM stations WHERE serial_number = ?', [stationId]);
              if (station) {
                const exactStatus = status.toLowerCase(); 
                await db.run('UPDATE connectors SET status = ? WHERE station_id = ? AND name LIKE ?', [exactStatus, station.id, `%${connectorId}%`]);
                io.emit('station_status_update');
              }
            } catch (e) { console.error('Ошибка БД в StatusNotification:', e); }
          }

          if (action === 'StartTransaction') {
            const db = await getDB();
            const { connectorId } = payload;
            
            // Находим реальный DB ID
            const station = await db.get('SELECT id FROM stations WHERE serial_number = ?', [stationId]);
            const dbConn = await db.get('SELECT id FROM connectors WHERE station_id = ? AND name LIKE ?', [station.id, `%${connectorId}%`]);
            const realDbConnectorId = dbConn?.id || connectorId;

            let tx = await db.get('SELECT id FROM transactions WHERE connector_id = ? AND status = "charging"', [realDbConnectorId]);

            if (!tx) {
              const res = await db.run(`INSERT INTO transactions (connector_id, status, is_full_tank, target_kwh) VALUES (?, 'charging', 1, 999)`, [realDbConnectorId]);
              tx = { id: res.lastID };
              await db.run('UPDATE connectors SET status = "charging" WHERE id = ?', [realDbConnectorId]);
              
              // КРИТИЧЕСКИ ВАЖНО ДЛЯ РЕАЛТАЙМА:
              io.emit('charging_update', {
                transaction_id: tx.id, connector_id: realDbConnectorId, consumed_kwh: 0, amount_tjs: 0, status: 'charging', soc: 0, price_per_kwh: globalPricePerKwh
              });
              io.emit('station_status_update');
            }
            ws.send(JSON.stringify([3, messageId, { transactionId: tx.id, idTagInfo: { status: "Accepted" } }]));
          }

          if (action === 'MeterValues') {
            ws.send(JSON.stringify([3, messageId, {}]));
            
            // ДИАГНОСТИКА: Увидишь в консоли, что присылает симулятор
            // console.log("DEBUG PAYLOAD:", JSON.stringify(payload, null, 2));

            try {
              const db = await getDB();
              const tx = await db.get('SELECT * FROM transactions WHERE id = ?', [payload.transactionId]);
              
              if (tx) {
                let realKwh = tx.consumed_kwh || 0;
                let currentSoc = 0;

                // Универсальный парсинг для любого симулятора
                const meterValues = Array.isArray(payload.meterValue) ? payload.meterValue : [payload.meterValue];
                for (const mv of meterValues.filter(Boolean)) {
                  const sampled = Array.isArray(mv.sampledValue) ? mv.sampledValue : [mv.sampledValue];
                  for (const sv of sampled.filter(Boolean)) {
                    const measurand = sv.measurand || 'Energy.Active.Import.Register';
                    if (measurand === 'Energy.Active.Import.Register') {
                      realKwh = (Number(sv.value) || 0) / 1000; 
                    }
                    if (measurand === 'SoC' || measurand === 'StateOfCharge') {
                      currentSoc = Number(sv.value) || 0;
                    }
                  }
                }

                // Логика с резервом
                const projectedKwh = realKwh + (globalReserveWh / 1000);

                if (tx.is_full_tank === 0 && projectedKwh >= tx.target_kwh) {
                  ws.send(JSON.stringify([2, Math.random().toString(36).substring(2), "RemoteStopTransaction", { transactionId: tx.id }]));
                  await db.run('UPDATE transactions SET status = "completed", stop_time = CURRENT_TIMESTAMP WHERE id = ?', [tx.id]);
                  await db.run('UPDATE connectors SET status = "available" WHERE id = ?', [tx.connector_id]);
                  io.emit('transaction_completed', { transactionId: tx.id, connectorId: tx.connector_id, final_kwh: realKwh, final_tjs: realKwh * globalPricePerKwh });
                } else {
                  await db.run('UPDATE transactions SET consumed_kwh = ?, amount_tjs = ? WHERE id = ?', [realKwh, realKwh * globalPricePerKwh, tx.id]);
                  io.emit('charging_update', { transaction_id: tx.id, connector_id: tx.connector_id, consumed_kwh: realKwh, amount_tjs: realKwh * globalPricePerKwh, status: 'charging', soc: currentSoc });
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
            }
          }
        }
      } catch (err) { console.error('Ошибка обработки OCPP:', err); }
    });
  });
}

export async function remoteStart(stationId: string, dbConnectorId: number, idTag: string = "KASSA", transactionId?: number) {
  const ws = activeConnections.get(stationId);
  if (!ws) return false;
  const db = await getDB();
  const conn = await db.get('SELECT name FROM connectors WHERE id = ?', [dbConnectorId]);
  const physicalId = conn?.name?.match(/\d+/)?.[0] || 1;
  ws.send(JSON.stringify([2, Math.random().toString(36).substring(2, 9), "RemoteStartTransaction", { connectorId: parseInt(physicalId), idTag, transactionId }]));
  return true;
}

export function remoteStop(stationId: string, transactionId: number) {
  const ws = activeConnections.get(stationId);
  if (!ws) return false;
  ws.send(JSON.stringify([2, Math.random().toString(36).substring(2, 9), "RemoteStopTransaction", { transactionId }]));
  return true;
}