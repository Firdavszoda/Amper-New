import { Router } from 'express';
import { getDB } from '../database/db';

const router = Router();

// POST-запрос на http://localhost:3000/api/auth/login
router.post('/login', async (req, res) => {
  const { pinCode } = req.body; // Получаем пин-код от React

  if (!pinCode) {
    return res.status(400).json({ error: 'Пин-код обязателен' });
  }

  try {
    const db = await getDB();
    
    // Ищем сотрудника в базе по пин-коду
    const user = await db.get(
      'SELECT id, username, role FROM users WHERE pin_code = ?', 
      [pinCode]
    );

    if (!user) {
      return res.status(401).json({ error: 'Неверный пин-код' });
    }

    // Если нашли, отдаем данные (без самого пин-кода в целях безопасности)
    res.json({ 
      message: 'Успешный вход', 
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Ошибка при входе:', error);
    res.status(500).json({ error: 'Ошибка сервера при авторизации' });
  }
});

export default router;