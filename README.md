# Backend - La Tour du Reliquaire

Backend Node.js + Express + SQLite pour gérer les événements de la communauté.

## 🚀 Démarrage Rapide

### Installation
```bash
npm install
```

### Démarrage en développement
```bash
npm run dev
```

### Démarrage en production
```bash
npm start
```

Le serveur démarre sur **http://localhost:5000**

## 🔐 Authentification

### Identifiants par défaut
- **Username:** `admin`
- **Password:** `admin123`

⚠️ **CHANGEZ LE MOT DE PASSE IMMÉDIATEMENT !**

### Connexion
```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

Réponse :
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "username": "admin"
}
```

## 📡 API Endpoints

### Routes Publiques

#### GET /api/health
Vérifier l'état du serveur
```bash
GET http://localhost:5000/api/health
```

#### GET /api/events
Récupérer tous les événements
```bash
GET http://localhost:5000/api/events
```

#### GET /api/events/:id
Récupérer un événement spécifique
```bash
GET http://localhost:5000/api/events/1
```

### Routes Protégées (Authentification requise)

Ajoutez le header :
```
Authorization: Bearer VOTRE_TOKEN_JWT
```

#### POST /api/events
Créer un nouvel événement
```bash
POST http://localhost:5000/api/events
Authorization: Bearer VOTRE_TOKEN
Content-Type: application/json

{
  "title": "Soirée Commander",
  "description": "Parties casual Commander sur TTS",
  "date": "2026-02-20",
  "time": "20:00",
  "format": "Commander",
  "max_players": 4,
  "discord_link": "https://discord.gg/fBmg7XMVrj"
}
```

#### PUT /api/events/:id
Modifier un événement
```bash
PUT http://localhost:5000/api/events/1
Authorization: Bearer VOTRE_TOKEN
Content-Type: application/json

{
  "title": "Soirée Commander (Modifié)",
  "description": "...",
  ...
}
```

#### DELETE /api/events/:id
Supprimer un événement
```bash
DELETE http://localhost:5000/api/events/1
Authorization: Bearer VOTRE_TOKEN
```

## 📊 Base de Données

SQLite - Fichier : `database.db`

### Tables

#### users
- `id` : INTEGER PRIMARY KEY
- `username` : TEXT UNIQUE
- `password` : TEXT (hashé avec bcrypt)
- `created_at` : DATETIME

#### events
- `id` : INTEGER PRIMARY KEY
- `title` : TEXT
- `description` : TEXT
- `date` : TEXT (format: YYYY-MM-DD)
- `time` : TEXT (format: HH:MM)
- `format` : TEXT (Commander, Treachery, etc.)
- `max_players` : INTEGER
- `discord_link` : TEXT
- `created_at` : DATETIME
- `updated_at` : DATETIME

## 🔧 Configuration

Fichier `.env` :
```env
PORT=5000
JWT_SECRET=votre_secret_jwt_super_securise
ADMIN_USERNAME=admin
ADMIN_PASSWORD=votre_mot_de_passe_securise
NODE_ENV=development
```

## 🛡️ Sécurité

- ✅ Mots de passe hashés avec bcrypt
- ✅ Authentification JWT
- ✅ CORS activé
- ✅ Variables d'environnement pour les secrets
- ⚠️ Changez le JWT_SECRET en production !
- ⚠️ Changez le mot de passe admin !

## 📦 Dépendances

- **express** : Framework web
- **cors** : Gestion CORS
- **better-sqlite3** : Base de données SQLite
- **bcryptjs** : Hash des mots de passe
- **jsonwebtoken** : Authentification JWT
- **dotenv** : Variables d'environnement
- **nodemon** : Auto-reload en développement

## 🚀 Déploiement

Pour déployer en production, vous pouvez utiliser :
- **Heroku**
- **Railway**
- **Render**
- **VPS** (DigitalOcean, etc.)

N'oubliez pas de :
1. Changer le JWT_SECRET
2. Changer le mot de passe admin
3. Configurer les variables d'environnement
4. Utiliser HTTPS en production
