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
app.use('/api/admin', adminRoutes); 
app.use('/api/settings', settingsRoutes); 

const authMiddleware = (req: any, res: any, next: any) => {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  if (userId) req.user = { id: parseInt(userId as string), role: userRole };
  next();
};

app.use('/api/reports', authMiddleware, reportsRoutes); 

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