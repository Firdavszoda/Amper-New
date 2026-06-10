import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initDB, getDB } from './database/db';
import authRoutes from './api/auth.routes'; 
import shiftRoutes from './api/shifts.routes';
import transactionRoutes from './api/transactions.routes';
import stationRoutes from './api/stations.routes';
import connectorRoutes from './api/connectors.routes';
import adminRoutes from './api/admin.routes';
import settingsRoutes from './api/settings.routes';
import reportsRoutes from './api/reports.routes';
import { setupOcppServer, loadGlobalPrice, globalPricePerKwh } from './ocpp';

const app = express();
const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", 
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT"]
  }
});
setupOcppServer(httpServer,io);

const PORT = 3000;

app.use(cors()); 
app.use(express.json()); 

app.use((req: any, res, next) => {
  req.io = io;
  next();
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: 'Бэкенд Ampere работает штатно!' });
});

app.use('/api/auth', authRoutes); 
app.use('/api/shifts', shiftRoutes);
app.use('/api/transactions', transactionRoutes); 
app.use('/api/stations', stationRoutes); 
app.use('/api/connectors', connectorRoutes);
app.use('/api/admin', adminRoutes); 
app.use('/api/settings', settingsRoutes); 
app.use('/api/reports', reportsRoutes);

async function startServer() {
  try {
    await initDB();
    const db = await getDB();
    await db.run(`UPDATE stations SET status = 'offline'`);
    await db.run(`UPDATE connectors SET status = 'faulted'`);
    console.log('🔄 Все станции переведены в Offline (ожидание подключений)...');

    await loadGlobalPrice();
    httpServer.listen(PORT, () => {
      console.log(`🚀 Сервер и WebSockets запущены на http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Критическая ошибка при запуске бэкенда:', error);
    process.exit(1); 
  }
}

startServer();