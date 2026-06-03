import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initDB, getDB } from './database/db';
import authRoutes from './api/auth.routes'; 
import shiftRoutes from './api/shifts.routes';
import transactionRoutes from './api/transactions.routes';
import stationRoutes from './api/stations.routes';
import adminRoutes from './api/admin.routes';
import { setupOcppServer } from './ocpp';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // URL вашего фронтенда (Vite по умолчанию)
    methods: ["GET", "POST"]
  }
});
setupOcppServer(httpServer,io);

const PORT = 3000;
const KWH_RATE = 3.5;

app.use(cors()); 
app.use(express.json()); 

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: 'Бэкенд Ampere работает штатно!' });
});

app.use('/api/auth', authRoutes); 
app.use('/api/shifts', shiftRoutes);
app.use('/api/transactions', transactionRoutes); 
app.use('/api/stations', stationRoutes); 
app.use('/api/admin', adminRoutes); 

// --- СИМУЛЯТОР ЗАРЯДКИ (WebSockets) ---
setInterval(async () => {
  try {
    const db = await getDB();
    // Ищем все активные зарядки
    const activeTx = await db.all('SELECT * FROM transactions WHERE status = "charging"');

    for (const tx of activeTx) {
      // Имитируем потребление: +0.05 кВт за тик (каждые 2 сек)
      const increment = 0.05;
      const newKwh = tx.consumed_kwh + increment;
      const newAmount = newKwh * KWH_RATE;

      // Проверка на автостоп по лимиту (если не "полный бак")
      if (tx.is_full_tank === 0 && newKwh >= tx.target_kwh) {
        await db.run('BEGIN TRANSACTION');
        try {
          await db.run(
            'UPDATE transactions SET consumed_kwh = ?, amount_tjs = ?, status = "completed", finished_at = datetime("now") WHERE id = ?',
            [tx.target_kwh, tx.target_kwh * KWH_RATE, tx.id]
          );
          await db.run('UPDATE connectors SET status = "available" WHERE id = ?', [tx.connector_id]);
          await db.run('COMMIT');

          io.emit('charging_update', { 
            transaction_id: tx.id, 
            connector_id: tx.connector_id,
            consumed_kwh: tx.target_kwh, 
            amount_tjs: tx.target_kwh * KWH_RATE, 
            status: 'completed' 
          });
        } catch (e) {
          await db.run('ROLLBACK');
          throw e;
        }
      } else {
        // Обычное обновление прогресса
        await db.run('UPDATE transactions SET consumed_kwh = ?, amount_tjs = ? WHERE id = ?', [newKwh, newAmount, tx.id]);
        
        io.emit('charging_update', { 
          transaction_id: tx.id, 
          connector_id: tx.connector_id,
          consumed_kwh: newKwh, 
          amount_tjs: newAmount, 
          status: 'charging' 
        });
      }
    }
  } catch (error) {
    console.error('Ошибка симулятора зарядки:', error);
  }
}, 2000);

async function startServer() {
  try {
    await initDB();
    httpServer.listen(PORT, () => {
      console.log(`🚀 Сервер и WebSockets запущены на http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Критическая ошибка при запуске бэкенда:', error);
    process.exit(1); 
  }
}

startServer();
