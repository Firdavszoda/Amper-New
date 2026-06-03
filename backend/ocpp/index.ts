import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { getDB } from '../database/db'; 

export const activeConnections = new Map<string, WebSocket>();

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

  wss.on('connection', (ws: WebSocket, req) => {
    const urlParts = req.url?.split('/') || [];
    const stationId = urlParts[urlParts.length - 1];

    console.log(`🔌 Станция подключена: [${stationId}]`);
    activeConnections.set(stationId, ws);

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
                
                // СТРОГОЕ РАЗДЕЛЕНИЕ СТАТУСОВ
                if (status === 'Charging') {
                  appStatus = 'charging';
                } else if (status === 'Preparing' || status === 'SuspendedEV' || status === 'SuspendedEVSE') {
                  appStatus = 'available'; // Кабель вставлен или пауза, но зарядка не идет
                } else if (status === 'Faulted') {
                  appStatus = 'faulted';
                } else if (status === 'Occupied') {
                  appStatus = 'charging'; // Оставляем для совместимости
                }

                await db.run('UPDATE connectors SET status = ? WHERE station_id = ? AND name LIKE ?', 
                  [appStatus, station.id, `%${connectorId}%`]);
                
                io.emit('station_status_update');
              }
            } catch (e) { console.error('Ошибка БД в StatusNotification:', e); }
          }

          // НОВЫЙ БЛОК: ОБРАБОТКА STOP TRANSACTION
          if (action === 'StopTransaction') {
            ws.send(JSON.stringify([3, messageId, { idTagInfo: { status: "Accepted" } }]));
            console.log(`✅ Эмулятор подтвердил остановку транзакции ${payload.transactionId}`);
            
            try {
              const db = await getDB();
              // Принудительно сбрасываем статус коннектора в доступный
              await db.run('UPDATE connectors SET status = "available" WHERE id IN (SELECT connector_id FROM transactions WHERE id = ?)', [payload.transactionId]);
              io.emit('station_status_update');
            } catch (e) { console.error('Ошибка сброса статуса:', e); }
          }

          if (action === 'StartTransaction') {
            try {
              const db = await getDB();
              const station = await db.get('SELECT id FROM stations WHERE serial_number = ?', [stationId]);
              let correctTransactionId = payload.transactionId;

              if (!correctTransactionId && station) {
                // Ищем последнюю транзакцию для этого коннектора, которую создал фронтенд (со статусом charging)
                const tx = await db.get(`
                  SELECT t.id 
                  FROM transactions t
                  JOIN connectors c ON t.connector_id = c.id
                  WHERE c.station_id = ? AND c.name LIKE ? AND t.status = 'charging'
                  ORDER BY t.id DESC LIMIT 1
                `, [station.id, `%${payload.connectorId}%`]);
                
                if (tx) {
                  correctTransactionId = tx.id;
                } else {
                  correctTransactionId = Math.floor(Math.random() * 100000); // Резервный вариант
                }
              }

              // Шаг 2: Запись начального значения счетчика (СТРОГОЕ приведение к числу)
              const startMeter = Number(payload.meterStart) || 0;
              await db.run('UPDATE transactions SET meter_start = ? WHERE id = ?', [startMeter, correctTransactionId]);

              ws.send(JSON.stringify([3, messageId, { 
                idTagInfo: { status: "Accepted" }, 
                transactionId: correctTransactionId 
              }]));
              console.log(`✅ StartTransaction подтвержден: ID ${correctTransactionId} для коннектора ${payload.connectorId}`);
            } catch (e) {
              console.error('Ошибка в StartTransaction:', e);
            }
          }

          if (action === 'MeterValues') {
            const { connectorId, transactionId, meterValue } = payload;
            
            // НАДЕЖНЫЙ ПАРСИНГ: Ищем именно энергию, а не напряжение (Voltage), которое может идти первым на некоторых ручках
            let currentMeterWh = 0;
            const sampledValues = meterValue[0]?.sampledValue || [];
            for (const sv of sampledValues) {
              if (!sv.measurand || sv.measurand === 'Energy.Active.Import.Register') {
                currentMeterWh = Number(sv.value) || 0;
                break;
              }
            }

            ws.send(JSON.stringify([3, messageId, {}])); 

            try {
              const db = await getDB();
              // Достаем транзакцию ВМЕСТЕ с meter_start
              const tx = await db.get('SELECT id, status, target_kwh, meter_start FROM transactions WHERE id = ?', [transactionId]);
              
              // 1. УБИЙЦА ЗОМБИ (оставляем как есть)
              if (!tx || tx.status === 'completed') {
                console.log(`🧟 Зомби-сессия обнаружена! Принудительная остановка транзакции ${transactionId}`);
                remoteStop(stationId, transactionId, connectorId);
                return;
              }

              // 2. ВЫЧИСЛЯЕМ ЧИСТУЮ РАЗНИЦУ (Дельту) С НАЧАЛА СЕССИИ
              // СТРОГОЕ приведение к числу. SQLite может вернуть "0", тогда "0" === 0 будет FALSE!
              let startMeterWh = Number(tx.meter_start) || 0;

              // САМОИСЦЕЛЕНИЕ СЧЕТЧИКА: 
              // Если станция не прислала meterStart при запуске (он остался 0), 
              // то самое первое полученное значение киловатт в сессии мы записываем как стартовое!
              if (startMeterWh === 0 && currentMeterWh > 0) {
                startMeterWh = currentMeterWh;
                console.log(`🔧 [Коннектор ${connectorId}] Самоисцеление счетчика: установлен meter_start = ${startMeterWh} для транзакции ${transactionId}`);
                // Сохраняем это стартовое значение в БД, чтобы следующие такты вычитались правильно
                await db.run('UPDATE transactions SET meter_start = ? WHERE id = ?', [startMeterWh, transactionId]);
              }

              // Защита от отрицательных значений (на случай сброса счетчика)
              let sessionEnergyWh = currentMeterWh - startMeterWh;
              if (sessionEnergyWh < 0) sessionEnergyWh = 0; 
              
              // 3. СЧИТАЕМ кВт и Деньги С НУЛЯ
              const consumedKwh = sessionEnergyWh / 1000;
              const amountTjs = consumedKwh * 3.5; 

              // 4. Отправляем ЧИСТЫЕ данные на фронтенд
              io.emit('charging_update', { 
                transaction_id: transactionId, 
                connector_id: connectorId, 
                consumed_kwh: consumedKwh, 
                amount_tjs: amountTjs, 
                status: 'charging' 
              });

              // 5. Сохраняем актуальные данные в БД
              await db.run('UPDATE transactions SET consumed_kwh = ?, amount_tjs = ? WHERE id = ?', [consumedKwh, amountTjs, transactionId]);

              // Авто-стоп по лимиту (оставляем как есть)
              if (tx.target_kwh && consumedKwh >= tx.target_kwh) {
                console.log(`🛑 Лимит кВт достигнут. Авто-стоп транзакции ${transactionId}`);
                remoteStop(stationId, transactionId, connectorId);
              }
            } catch (e) { console.error('Ошибка обработки MeterValues:', e); }
          }
        }
      } catch (error) {
        console.error(`❌ Ошибка:`, error);
      }
    });

    ws.on('close', () => {
      activeConnections.delete(stationId);
    });
  });
}

export function remoteStart(stationId: string, connectorId: number, idTag: string = "KASSA", transactionId?: number) {
  const ws = activeConnections.get(stationId);
  if (!ws) return false;
  const messageId = Math.random().toString(36).substring(2, 9);
  const payload: any = { connectorId, idTag };
  if (transactionId) payload.transactionId = transactionId;
  ws.send(JSON.stringify([2, messageId, "RemoteStartTransaction", payload]));
  return true;
}

// ИСПРАВЛЕННАЯ ФУНКЦИЯ В index.ts
export function remoteStop(stationId: string, transactionId: number, connectorId: number) {
  const ws = activeConnections.get(stationId);
  if (!ws) return false;

  const messageId = Math.random().toString(36).substring(2, 9);
  // Передаем и ID транзакции, и ID коннектора
  ws.send(JSON.stringify([2, messageId, "RemoteStopTransaction", { transactionId, connectorId }]));
  console.log(`🛑 Отправлен RemoteStop: ${stationId}, tx: ${transactionId}, conn: ${connectorId}`);
  return true;
}