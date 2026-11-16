const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/enrutador';
const DB_NAME = process.env.DB_NAME || 'enrutador';

let client = null;
let db = null;

async function connectDB() {
  if (db) return db;
  try {
    client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 50,
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
    db = client.db(DB_NAME);
    console.log(`[MongoDB] Conectado exitosamente a la base de datos "${DB_NAME}"`);

    // Crear índices clave para optimizar búsquedas y ordenamientos
    await db.collection('companies').createIndex({ email: 1 });
    await db.collection('companies').createIndex({ code: 1 });
    await db.collection('clients').createIndex({ companyId: 1 });
    await db.collection('drivers').createIndex({ companyId: 1 });
    await db.collection('deliveries').createIndex({ companyId: 1, date: 1, driverId: 1 });
    await db.collection('driverShifts').createIndex({ companyId: 1, driverId: 1, date: 1 });

    return db;
  } catch (err) {
    console.error('[MongoDB] Error conectando a la base de datos:', err.message);
    throw err;
  }
}

function getDB() {
  if (!db) {
    throw new Error('Base de datos no inicializada. Llama a connectDB primero.');
  }
  return db;
}

module.exports = {
  connectDB,
  getDB,
};
