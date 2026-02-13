const crypto = require('crypto');

// Générer JWT_SECRET
const jwtSecret = crypto.randomBytes(64).toString('hex');
console.log('\n🔐 JWT_SECRET généré :');
console.log(jwtSecret);

// Générer REFRESH_TOKEN_SECRET
const refreshSecret = crypto.randomBytes(64).toString('hex');
console.log('\n🔄 REFRESH_TOKEN_SECRET généré :');
console.log(refreshSecret);

console.log('\n✅ Copiez ces secrets dans votre fichier .env');
