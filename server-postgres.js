require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware CORS
const allowedOrigins = [
  'http://localhost:3000',  // Frontend dev
  'http://localhost:3002',  // Admin Panel dev
  'http://localhost:3003',  // Admin Panel dev (port alternatif)
  'https://latourdureliquaire.netlify.app',  // Frontend production
  'https://latour-admin.netlify.app'  // Admin Panel production
];

app.use(cors({
  origin: function(origin, callback) {
    // Autoriser les requêtes sans origin (comme Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('Origin non autorisée:', origin);
      callback(null, true); // En dev, on autorise tout
    }
  },
  credentials: true
}));

app.use(express.json());

// Initialiser la base de données
initDatabase().then(async () => {
  // Créer un utilisateur admin par défaut si n'existe pas
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    
    if (result.rows.length === 0) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', ['admin', hashedPassword]);
      console.log('✅ Utilisateur admin créé (username: admin, password: admin123)');
      console.log('⚠️  CHANGEZ LE MOT DE PASSE IMMÉDIATEMENT !');
    }
  } catch (error) {
    console.error('Erreur lors de la création de l\'admin:', error);
  }
}).catch(err => {
  console.error('Erreur lors de l\'initialisation de la base de données:', err);
  process.exit(1);
});

// Middleware d'authentification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide' });
    }
    req.user = user;
    next();
  });
};

// Routes d'authentification
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Générer Access Token (1 heure)
    const accessToken = jwt.sign(
      { id: user.id, username: user.username }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1h' }
    );

    // Générer Refresh Token (7 jours)
    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' }, 
      process.env.REFRESH_TOKEN_SECRET, 
      { expiresIn: '7d' }
    );

    // Sauvegarder le refresh token en base de données
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    res.json({ 
      accessToken, 
      refreshToken,
      username: user.username,
      expiresIn: 3600
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route pour rafraîchir l'access token
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token manquant' });
    }

    // Vérifier si le refresh token existe en base de données
    const result = await pool.query('SELECT * FROM refresh_tokens WHERE token = $1', [refreshToken]);
    const storedToken = result.rows[0];

    if (!storedToken) {
      return res.status(403).json({ error: 'Refresh token invalide' });
    }

    // Vérifier si le token a expiré
    if (new Date(storedToken.expires_at) < new Date()) {
      await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
      return res.status(403).json({ error: 'Refresh token expiré' });
    }

    // Vérifier la signature du refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    // Générer un nouveau access token
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    const user = userResult.rows[0];
    
    const newAccessToken = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ 
      accessToken: newAccessToken,
      expiresIn: 3600
    });
  } catch (error) {
    return res.status(403).json({ error: 'Refresh token invalide' });
  }
});

// Route pour se déconnecter
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }

    res.json({ message: 'Déconnexion réussie' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route pour changer le mot de passe
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mots de passe manquants' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
    }

    // Récupérer l'utilisateur actuel
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    // Vérifier l'ancien mot de passe
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }

    // Hasher et sauvegarder le nouveau mot de passe
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.id]);

    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Routes événements (publiques)
app.get('/api/events', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM events ORDER BY date ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/events/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Événement non trouvé' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Routes événements (protégées)
app.post('/api/events', authenticateToken, async (req, res) => {
  try {
    const { title, description, date, time, format, max_players, discord_link } = req.body;

    const result = await pool.query(
      `INSERT INTO events (title, description, date, time, format, max_players, discord_link)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, description, date, time, format, max_players, discord_link]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, date, time, format, max_players, discord_link } = req.body;

    const result = await pool.query(
      `UPDATE events 
       SET title = $1, description = $2, date = $3, time = $4, format = $5, 
           max_players = $6, discord_link = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 RETURNING *`,
      [title, description, date, time, format, max_players, discord_link, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Événement non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM events WHERE id = $1', [req.params.id]);
    res.json({ message: 'Événement supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend La Tour du Reliquaire (PostgreSQL)' });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur backend démarré sur http://localhost:${PORT}`);
  console.log(`🗄️  Base de données : PostgreSQL`);
  console.log(`🔐 Admin par défaut : username=admin, password=admin123`);
});
