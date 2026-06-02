import express from 'express';
import cors from 'cors';
import { initDB } from './database/db';
import authRoutes from './api/auth.routes'; // <-- ДОБАВЛЕНО: импортируем логику авторизации

const app = express();
const PORT = 3000;

app.use(cors()); // Разрешаем запросы от React
app.use(express.json()); // Учим сервер понимать данные в формате JSON (например, когда кассир шлет { "amount": 50 })

// Базовый маршрут для проверки
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: 'Бэкенд Ampere работает штатно!' });
});

// <-- ДОБАВЛЕНО: Подключаем маршрут входа в систему. 
// Теперь все POST-запросы на http://localhost:3000/api/auth/login будут идти в файл auth.routes.ts
app.use('/api/auth', authRoutes); 

async function startServer() {
  try {
    await initDB();

    app.listen(PORT, () => {
      console.log(`🚀 Сервер успешно запущен на http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Критическая ошибка при запуске бэкенда:', error);
    process.exit(1); // Останавливаем процесс, если база сломалась
  }
}

startServer();