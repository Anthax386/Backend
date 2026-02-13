require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialiser la base de données
const db = new Database('database.db');

// Créer les tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    time TEXT,
    format TEXT,
    max_players INTEGER,
    discord_link TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Créer un utilisateur admin par défaut si n'existe pas
const createDefaultAdmin = () => {
  const checkAdmin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  
  if (!checkAdmin) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', hashedPassword);
    console.log('✅ Utilisateur admin créé (username: admin, password: admin123)');
    console.log('⚠️  CHANGEZ LE MOT DE PASSE IMMÉDIATEMENT !');
  }
};

createDefaultAdmin();

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
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

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
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(
    user.id, 
    refreshToken, 
    expiresAt
  );

  res.json({ 
    accessToken, 
    refreshToken,
    username: user.username,
    expiresIn: 3600 // 1 heure en secondes
  });
});

// Routes événements (publiques)
app.get('/api/events', (req, res) => {
  try {
    const events = db.prepare('SELECT * FROM events ORDER BY date ASC').all();
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/events/:id', (req, res) => {
  try {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Événement non trouvé' });
    }
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Routes événements (protégées - admin seulement)
app.post('/api/events', authenticateToken, (req, res) => {
  try {
    const { title, description, date, time, format, max_players, discord_link } = req.body;

    const result = db.prepare(`
      INSERT INTO events (title, description, date, time, format, max_players, discord_link)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(title, description, date, time, format, max_players, discord_link);

    const newEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newEvent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/events/:id', authenticateToken, (req, res) => {
  try {
    const { title, description, date, time, format, max_players, discord_link } = req.body;

    db.prepare(`
      UPDATE events 
      SET title = ?, description = ?, date = ?, time = ?, format = ?, max_players = ?, discord_link = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, description, date, time, format, max_players, discord_link, req.params.id);

    const updatedEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    res.json(updatedEvent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/events/:id', authenticateToken, (req, res) => {
  try {
    db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
    res.json({ message: 'Événement supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route pour rafraîchir l'access token
app.post('/api/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token manquant' });
  }

  // Vérifier si le refresh token existe en base de données
  const storedToken = db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(refreshToken);

  if (!storedToken) {
    return res.status(403).json({ error: 'Refresh token invalide' });
  }

  // Vérifier si le token a expiré
  if (new Date(storedToken.expires_at) < new Date()) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
    return res.status(403).json({ error: 'Refresh token expiré' });
  }

  // Vérifier la signature du refresh token
  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    // Générer un nouveau access token
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
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

// Route pour se déconnecter (révoquer le refresh token)
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
  }

  res.json({ message: 'Déconnexion réussie' });
});

// Route pour changer le mot de passe
app.put('/api/auth/change-password', authenticateToken, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mots de passe manquants' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
    }

    // Récupérer l'utilisateur actuel
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    // Vérifier l'ancien mot de passe
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }

    // Hasher et sauvegarder le nouveau mot de passe
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);

    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend La Tour du Reliquaire' });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur backend démarré sur http://localhost:${PORT}`);
  console.log(`📊 Base de données : database.db`);
  console.log(`🔐 Admin par défaut : username=admin, password=admin123`);
});
