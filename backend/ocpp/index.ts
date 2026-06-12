import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { getDB } from '../database/db'; 

export const activeConnections = new Map<string, WebSocket>();
export let globalPricePerKwh = 3.6;
export let globalReserveTjs = 0.20; 

export const loadGlobalPrice = async () => {
  try {
    const db = await getDB();
    const priceSetting = await db.get(`SELECT value FROM settings WHERE key = 'price_per_kwh'`);
    if (priceSetting) globalPricePerKwh = parseFloat(priceSetting.value);
    
    const reserveSetting = await db.get(`SELECT value FROM settings WHERE key = 'global_reserve_tjs'`);
    if (reserveSetting) globalReserveTjs = parseFloat(reserveSetting.value);
    
    console.log(`💰 Тариф: ${globalPricePerKwh} | 🛡 Резерв: ${globalReserveTjs} TJS`);
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
        if (!Array.isArray(parsed)) return;

        const messageTypeId = parsed[0];
        const messageId = parsed[1];

        // 1. ОБРАБОТКА CALL (ЗАПРОС ОТ СТАНЦИИ)
        if (messageTypeId === 2) {
          const action = parsed[2];
          const payload = parsed[3];

          if (action === 'BootNotification' || action === 'Heartbeat') {
            ws.send(JSON.stringify([3, messageId, { status: 'Accepted', currentTime: new Date().toISOString(), interval: 300 }]));
            
            if (action === 'BootNotification') {
              // Гарантированная отправка тарифа и настроек через 2 секунды
              setTimeout(async () => {
                try {
                  const db = await getDB();
                  const priceSetting = await db.get(`SELECT value FROM settings WHERE key = 'price_per_kwh'`);
                  const currentTariff = priceSetting ? priceSetting.value : String(globalPricePerKwh);

                  const intervalSetting = await db.get('SELECT value FROM settings WHERE key = "meter_interval_sec"');
                  const intervalValue = intervalSetting ? intervalSetting.value : "2";

                  ws.send(JSON.stringify([2, `config-boot-tariff-${Date.now()}`, "ChangeConfiguration", { 
                    key: "TariffPrice", 
                    value: String(currentTariff) 
                  }]));

                  ws.send(JSON.stringify([2, `config-boot-interval-${Date.now()}`, "ChangeConfiguration", { 
                    key: "MeterValueSampleInterval", 
                    value: String(intervalValue) 
                  }]));
                  
                  ws.send(JSON.stringify([2, `config-boot-data-${Date.now()}`, "ChangeConfiguration", { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,SoC" }]));
                  
                  console.log(`⚙️ Станция ${stationId} синхронизирована. Тариф: ${currentTariff}, Интервал: ${intervalValue}с`);
                } catch(e) {
                  console.error("Ошибка при отправке настроек на Boot:", e);
                }
              }, 2000);
            }
          }

          if (action === 'StatusNotification') {
            ws.send(JSON.stringify([3, messageId, {}]));
            try {
              const db = await getDB();
              const station = await db.get('SELECT id FROM stations WHERE serial_number = ?', [stationId]);
              if (station) {
                const exactStatus = payload.status.toLowerCase();
                const dbConn = await db.get('SELECT id, status FROM connectors WHERE station_id = ? AND name LIKE ?', [station.id, `%${payload.connectorId}%`]);
                
                if (dbConn && dbConn.status === 'admin_locked') {
                  console.log(`🛡 Игнорируем статус ${exactStatus} от станции ${stationId}, так как ручка заблокирована админом.`);
                } else if (dbConn) {
                  await db.run('UPDATE connectors SET status = ? WHERE id = ?', [exactStatus, dbConn.id]);
                  io.emit('station_status_update', { connector_id: dbConn.id, status: exactStatus });
                } else {
                  await db.run('UPDATE connectors SET status = ? WHERE station_id = ? AND name LIKE ?', [exactStatus, station.id, `%${payload.connectorId}%`]);
                  io.emit('station_status_update');
                }
              }
            } catch (e) {}
          }

          if (action === 'Authorize') {
            const { idTag } = payload;
            const db = await getDB();
            let isAuthorized = false;

            if (idTag.startsWith('KASSA-')) {
              const pendingTx = await db.get('SELECT id FROM transactions WHERE id_tag = ? AND status = "pending"', [idTag]);
              if (pendingTx) isAuthorized = true;
            } else {
              isAuthorized = true;
            }

            ws.send(JSON.stringify([3, messageId, { idTagInfo: { status: isAuthorized ? "Accepted" : "Invalid" } }]));
          }

          if (action === 'StartTransaction') {
            const db = await getDB();
            const { idTag, connectorId, meterStart, timestamp } = payload;
            const station = await db.get('SELECT id, status FROM stations WHERE serial_number = ?', [stationId]);
            
            if (station && station.status === 'admin_locked') {
              ws.send(JSON.stringify([3, messageId, { idTagInfo: { status: "Rejected" } }]));
              return;
            }

            const dbConn = await db.get('SELECT id, status FROM connectors WHERE station_id = ? AND name LIKE ?', [station?.id, `%${connectorId}%`]);
            if (dbConn && dbConn.status === 'admin_locked') {
              ws.send(JSON.stringify([3, messageId, { idTagInfo: { status: "Rejected" } }]));
              return;
            }

            const realDbConnectorId = dbConn?.id || connectorId;
            let transactionId = 0;

            if (idTag.startsWith('KASSA-')) {
              const pendingTx = await db.get('SELECT id FROM transactions WHERE id_tag = ? AND status = "pending"', [idTag]);
              if (pendingTx) {
                transactionId = pendingTx.id;
                await db.run('UPDATE transactions SET status = "charging", meter_start = ?, start_time = ? WHERE id = ?', [meterStart, timestamp, transactionId]);
              }
            } else {
              const lastShift = await db.get('SELECT id FROM shifts WHERE status = "open" ORDER BY id DESC LIMIT 1');
              const shiftId = lastShift ? lastShift.id : 0;
              
              const result = await db.run(
                `INSERT INTO transactions (shift_id, connector_id, amount_tjs, target_kwh, consumed_kwh, status, is_full_tank, start_time, meter_start, id_tag)
                 VALUES (?, ?, 0, 999, 0, 'charging', 1, ?, ?, ?)`,
                [shiftId, realDbConnectorId, timestamp, meterStart, idTag]
              );
              transactionId = result.lastID;
            }

            if (transactionId > 0) {
              await db.run('UPDATE connectors SET status = "charging" WHERE id = ?', [realDbConnectorId]);
              ws.send(JSON.stringify([3, messageId, { transactionId, idTagInfo: { status: "Accepted" } }]));
              
              io.emit('transaction_started', {
                stationId: stationId,
                connectorId: realDbConnectorId,
                transactionId: transactionId,
                idTag: idTag,
                meterStart: meterStart
              });

              io.emit('charging_update', { 
                transaction_id: transactionId, 
                connector_id: realDbConnectorId, 
                consumed_kwh: 0, 
                amount_tjs: 0, 
                status: 'charging', 
                soc: 0, 
                price_per_kwh: globalPricePerKwh 
              });
              io.emit('station_status_update', { connector_id: realDbConnectorId, status: 'charging' });
            } else {
              ws.send(JSON.stringify([3, messageId, { transactionId: 0, idTagInfo: { status: "Invalid" } }]));
            }
          }

          if (action === 'MeterValues') {
            ws.send(JSON.stringify([3, messageId, {}]));
            const { connectorId, transactionId, meterValue } = payload;
            let currentMeter = 0; 
            let currentPower = 0; // В Ваттах
            let soc = null;
            
            if (Array.isArray(meterValue)) {
                for (const mv of meterValue) {
                    for (const sv of mv.sampledValue) {
                        const measurand = sv.measurand || 'Energy.Active.Import.Register';
                        if (measurand === 'Energy.Active.Import.Register') currentMeter = parseFloat(sv.value);
                        if (measurand === 'Power.Active.Import') currentPower = parseFloat(sv.value);
                        if (measurand === 'SoC') soc = parseInt(sv.value, 10);
                    }
                }
            }

            const db = await getDB();
            const tx_info = await db.get('SELECT meter_start FROM transactions WHERE id = ?', [transactionId]);
            const current_kwh = tx_info ? Math.max(0, (currentMeter - (tx_info.meter_start || 0)) / 1000) : 0;
            const current_tjs = current_kwh * globalPricePerKwh;

            try {
                // 1. Получаем транзакцию
                const tx = await db.get('SELECT target_amount FROM transactions WHERE id = ?', [transactionId]);
                // 2. Получаем резерв в TJS (дефолт 0, если не найдено)
                const reserveSetting = await db.get('SELECT value FROM settings WHERE key = "global_reserve_tjs"');
                const reserve_tjs = reserveSetting ? parseFloat(reserveSetting.value) : 0;

                // 3. Строгая проверка с учетом резерва
                if (tx && tx.target_amount > 0 && current_tjs >= (tx.target_amount - reserve_tjs)) {
                    console.log(`🛑 СТОП: Достигнут лимит с учетом резерва. (Текущая сумма: ${current_tjs}, Лимит: ${tx.target_amount}, Резерв: ${reserve_tjs})`);
                    sendOcppCommandAndWait(ws, "RemoteStopTransaction", { transactionId }).catch(() => {});
                } else {
                    await db.run('UPDATE transactions SET consumed_kwh = ?, amount_tjs = ? WHERE id = ?', 
                                 [current_kwh, current_tjs, transactionId]);
                }
            } catch (e) {
                console.error("Ошибка проверки лимита:", e);
            }

            // Рассылаем данные в UI
            io.emit('charging_update', { 
              connectorId, 
              transactionId, 
              kwh: Number(current_kwh.toFixed(3)), 
              tjs: Number(current_tjs.toFixed(2)), 
              soc 
            });
          }

          if (action === 'StopTransaction') {
            const { transactionId, meterStop } = payload;
            ws.send(JSON.stringify([3, messageId, { idTagInfo: { status: "Accepted" } }]));
            
            const db = await getDB();
            const tx = await db.get('SELECT meter_start, connector_id FROM transactions WHERE id = ?', [transactionId]);
            
            // СЧИТАЕМ ТОЛЬКО ПО ИТОГОВОМУ СЧЕТЧИКУ
            const final_kwh = (meterStop - (tx?.meter_start || 0)) / 1000;
            const final_tjs = final_kwh * globalPricePerKwh;

            await db.run('UPDATE transactions SET status = "completed", consumed_kwh = ?, amount_tjs = ? WHERE id = ?', 
                         [final_kwh, final_tjs, transactionId]);

            io.emit('transaction_stopped', { transactionId, connectorId: tx?.connector_id || 1, final_kwh, final_tjs });
          }
        } 
        else if (messageTypeId === 3) {
          console.log(`✅ Станция ${stationId} приняла команду [${messageId}]:`, parsed[2]);
        }
        else if (messageTypeId === 4) {
          console.log(`❌ Станция ${stationId} отклонила команду [${messageId}]:`, parsed[2], parsed[3]);
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
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  const db = await getDB();
  const conn = await db.get('SELECT name FROM connectors WHERE id = ?', [dbConnectorId]);
  const physicalId = conn?.name?.match(/\d+/)?.[0] || 1;
  ws.send(JSON.stringify([2, `remstart-${Date.now()}`, "RemoteStartTransaction", { connectorId: parseInt(physicalId as string), idTag, transactionId }]));
  return true;
}

export function remoteStop(stationId: string, transactionId: number) {
  const ws = activeConnections.get(stationId);
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify([2, `remstop-${Date.now()}`, "RemoteStopTransaction", { transactionId }]));
  return true;
}

export const sendOcppCommandAndWait = (ws: any, action: string, payload: any, timeoutMs = 15000): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return reject(new Error('Соединение закрыто'));
    
    const messageId = Math.random().toString(36).substring(2, 9);
    const command = JSON.stringify([2, messageId, action, payload]);

    const listener = (data: string) => {
      try {
        const parsed = JSON.parse(data.toString());
        const messageTypeId = parsed[0];
        const msgId = parsed[1];

        if (msgId === messageId) {
          clearTimeout(timeout);
          ws.off('message', listener);

          if (messageTypeId === 3) {
            resolve(parsed[2]); 
          } else if (messageTypeId === 4) {
            reject(new Error(`Ошибка станции (${parsed[2]}): ${parsed[3]}`));
          }
        }
      } catch (e) {}
    };

    ws.on('message', listener);
    const timeout = setTimeout(() => {
      ws.off('message', listener);
      reject(new Error('Тайм-аут: Станция не ответила'));
    }, timeoutMs);

    ws.send(command);
  });
};