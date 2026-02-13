# Migration vers PostgreSQL

## ✅ Fichiers Créés

- `database.js` - Gestion de la connexion PostgreSQL
- `server-postgres.js` - Serveur avec PostgreSQL
- Les anciens fichiers SQLite sont conservés (`server.js`)

## 🚀 Déploiement sur Render

### Étape 1 : Créer la Base de Données PostgreSQL

1. Dashboard Render → **New +** → **PostgreSQL**
2. Configuration :
   ```
   Name: latour-database
   Database: latour_db
   User: latour_user
   Region: Frankfurt
   Plan: Free
   ```
3. Cliquez sur **"Create Database"**
4. Copiez l'**Internal Database URL**

### Étape 2 : Configurer le Web Service

1. Allez dans votre Web Service Render
2. **Environment** → **Add Environment Variable**
3. Ajoutez :
   ```
   DATABASE_URL = [COLLEZ L'URL POSTGRESQL ICI]
   ```
4. Le service va redémarrer automatiquement

### Étape 3 : Vérifier

1. Attendez 2-3 minutes
2. Testez : `https://backend-teo7.onrender.com/api/health`
3. Vous devriez voir :
   ```json
   {
     "status": "OK",
     "message": "Backend La Tour du Reliquaire (PostgreSQL)"
   }
   ```

## 🧪 Test en Local

### Avec PostgreSQL :
```bash
# Ajoutez DATABASE_URL dans votre .env
DATABASE_URL=postgresql://user:password@localhost:5432/latour_db

# Démarrez
npm run dev
```

### Avec SQLite (ancien) :
```bash
npm run dev:sqlite
```

## 📊 Différences SQLite vs PostgreSQL

| Fonctionnalité | SQLite | PostgreSQL |
|----------------|--------|------------|
| **Persistance** | ❌ Perdue au redémarrage | ✅ Persistante |
| **Performance** | ⭐⭐ Bon pour petit volume | ⭐⭐⭐ Excellent |
| **Concurrent** | ❌ 1 écriture à la fois | ✅ Multiples connexions |
| **Production** | ❌ Non recommandé | ✅ Recommandé |

## 🔄 Migration des Données

Si vous avez déjà des données dans SQLite et voulez les migrer :

1. Exportez depuis SQLite
2. Importez dans PostgreSQL

(Script de migration disponible sur demande)

## ⚠️ Important

- Les **ID** sont maintenant de type `SERIAL` (auto-increment PostgreSQL)
- Les **timestamps** utilisent le type `TIMESTAMP` natif
- Les requêtes utilisent `$1, $2` au lieu de `?` (paramètres nommés)

## ✅ Avantages PostgreSQL

- ✅ **Données persistantes** (ne sont pas perdues)
- ✅ **Gratuit sur Render** (256 MB)
- ✅ **Backups automatiques** (7 jours)
- ✅ **Meilleure performance**
- ✅ **Scalabilité**
