const fs = require('fs');
const path = require('path');
const { connectDB } = require('./db');

async function seed() {
  console.log('=== Iniciando importación de datos migrados de Firebase a MongoDB ===');
  const db = await connectDB();
  const dataDir = path.join(__dirname, '..', 'migration-data');

  if (!fs.existsSync(dataDir)) {
    console.error(`[Error] Directorio de datos no encontrado: ${dataDir}`);
    process.exit(1);
  }

  const collections = ['companies', 'clients', 'drivers', 'deliveries', 'driverShifts', 'settings'];

  for (const colName of collections) {
    const filePath = path.join(dataDir, `${colName}.json`);
    if (!fs.existsSync(filePath)) {
      console.warn(`[Aviso] Archivo ${filePath} no existe, omitiendo.`);
      continue;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const items = JSON.parse(raw);

    if (!Array.isArray(items) || items.length === 0) {
      console.log(`[${colName}] 0 registros para importar.`);
      continue;
    }

    const col = db.collection(colName);

    // Upsert de cada documento usando _id
    let inserted = 0;
    let updated = 0;

    for (const item of items) {
      const docId = item._id || item.id;
      if (!docId) continue;

      const cleanItem = { ...item, id: docId, _id: docId };

      const res = await col.updateOne(
        { _id: docId },
        { $set: cleanItem },
        { upsert: true }
      );

      if (res.upsertedCount > 0) inserted++;
      else updated++;
    }

    console.log(`[${colName}] Completado: ${inserted} insertados, ${updated} actualizados.`);
  }

  console.log('=== Migración de datos completada exitosamente en MongoDB ===');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Error en Seeder]:', err);
  process.exit(1);
});
