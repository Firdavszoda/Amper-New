import { Router } from 'express';
import { getDB } from '../database/db';

const router = Router();

// POST-запрос на http://localhost:3000/api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body; 

  if (!username || !password) {
    return res.status(400).json({ error: 'Логин и пароль обязательны' });
  }

  try {
    const db = await getDB();
    
    // Ищем сотрудника в базе по логину и паролю
    const user = await db.get(
      'SELECT id, username, role FROM users WHERE username = ? AND password = ?', 
      [username, password]
    );

    if (!user) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    // Если нашли, отдаем данные (без самого пароля в целях безопасности)
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