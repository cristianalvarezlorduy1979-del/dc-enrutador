import { Platform } from 'react-native';

let dbInstance = null;
const IS_WEB = Platform.OS === 'web';
const WEB_STORAGE_KEY = '@enrutador_clientes_v1';

// Clientes de demostración para pruebas rápidas
export const SAMPLE_CLIENTS = [
  {
    fullName: 'Carlos Alberto Rodríguez',
    companyName: 'Ferretería El Progreso',
    phone: '+57 310 456 7890',
    address: 'Carrera 7 # 32-16',
    city: 'Bogotá',
    notes: 'Recepción en el 2do piso. Preguntar por doña Marta.',
    isFavorite: 1,
  },
  {
    fullName: 'María Fernanda Gómez',
    companyName: 'Distribuidora Nova S.A.S.',
    phone: '+57 315 889 0123',
    address: 'Calle 100 # 19-61',
    city: 'Bogotá',
    notes: 'Entrada por el sótano para cargue y descargue.',
    isFavorite: 0,
  },
  {
    fullName: 'Andrés Felipe Martínez',
    companyName: 'Tecnología & Redes del Norte',
    phone: '+57 320 112 3344',
    address: 'Avenida El Dorado # 68C-61',
    city: 'Bogotá',
    notes: 'Llamar 10 minutos antes de llegar a la portería.',
    isFavorite: 1,
  },
  {
    fullName: 'Diana Marcela Castro',
    companyName: 'Restaurante Sabor Criollo',
    phone: '+57 301 776 5432',
    address: 'Calle 45 # 13-22',
    city: 'Bogotá',
    notes: 'Horario de entrega: antes de las 11:30 AM.',
    isFavorite: 0,
  },
];

/**
 * Inicializa la base de datos (SQLite en Android/iOS o almacenamiento local en Web).
 */
export const initDatabase = async () => {
  if (IS_WEB) {
    if (typeof window !== 'undefined' && !localStorage.getItem(WEB_STORAGE_KEY)) {
      // Sembrar datos de ejemplo en web la primera vez
      localStorage.setItem(
        WEB_STORAGE_KEY,
        JSON.stringify(
          SAMPLE_CLIENTS.map((c, i) => ({
            id: i + 1,
            ...c,
            createdAt: new Date().toISOString(),
          }))
        )
      );
    }
    return true;
  }

  try {
    const SQLite = await import('expo-sqlite');
    dbInstance = await SQLite.openDatabaseAsync('clientes.db');

    await dbInstance.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullName TEXT NOT NULL,
        companyName TEXT,
        phone TEXT,
        address TEXT NOT NULL,
        city TEXT,
        notes TEXT,
        isFavorite INTEGER DEFAULT 0,
        createdAt TEXT
      );
    `);

    // Comprobar si está vacía para precargar clientes de ejemplo
    const countResult = await dbInstance.getFirstAsync('SELECT COUNT(*) as count FROM clients');
    if (countResult && countResult.count === 0) {
      for (const client of SAMPLE_CLIENTS) {
        await dbInstance.runAsync(
          `INSERT INTO clients (fullName, companyName, phone, address, city, notes, isFavorite, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            client.fullName,
            client.companyName || '',
            client.phone || '',
            client.address,
            client.city || '',
            client.notes || '',
            client.isFavorite || 0,
            new Date().toISOString(),
          ]
        );
      }
    }

    return true;
  } catch (error) {
    console.error('Error al inicializar la base de datos SQLite:', error);
    throw error;
  }
};

/**
 * Obtiene todos los clientes filtrados por término de búsqueda y categoría opcional.
 */
export const getClients = async (searchTerm = '', category = 'all') => {
  const term = searchTerm.trim().toLowerCase();

  if (IS_WEB) {
    const raw = localStorage.getItem(WEB_STORAGE_KEY) || '[]';
    let list = JSON.parse(raw);

    if (term) {
      list = list.filter((c) => {
        const nameMatch = (c.fullName || '').toLowerCase().includes(term);
        const companyMatch = (c.companyName || '').toLowerCase().includes(term);
        const phoneMatch = (c.phone || '').toLowerCase().includes(term);
        const addressMatch = (c.address || '').toLowerCase().includes(term) || (c.city || '').toLowerCase().includes(term);

        if (category === 'name') return nameMatch;
        if (category === 'company') return companyMatch;
        if (category === 'phone') return phoneMatch;
        if (category === 'address') return addressMatch;
        return nameMatch || companyMatch || phoneMatch || addressMatch;
      });
    }

    return list.sort((a, b) => (b.isFavorite || 0) - (a.isFavorite || 0) || a.fullName.localeCompare(b.fullName));
  }

  if (!dbInstance) await initDatabase();

  if (!term) {
    return await dbInstance.getAllAsync(
      'SELECT * FROM clients ORDER BY isFavorite DESC, fullName ASC'
    );
  }

  const queryPattern = `%${term}%`;

  if (category === 'name') {
    return await dbInstance.getAllAsync(
      'SELECT * FROM clients WHERE fullName LIKE ? ORDER BY isFavorite DESC, fullName ASC',
      [queryPattern]
    );
  }
  if (category === 'company') {
    return await dbInstance.getAllAsync(
      'SELECT * FROM clients WHERE companyName LIKE ? ORDER BY isFavorite DESC, fullName ASC',
      [queryPattern]
    );
  }
  if (category === 'phone') {
    return await dbInstance.getAllAsync(
      'SELECT * FROM clients WHERE phone LIKE ? ORDER BY isFavorite DESC, fullName ASC',
      [queryPattern]
    );
  }
  if (category === 'address') {
    return await dbInstance.getAllAsync(
      'SELECT * FROM clients WHERE address LIKE ? OR city LIKE ? ORDER BY isFavorite DESC, fullName ASC',
      [queryPattern, queryPattern]
    );
  }

  // Búsqueda general en todos los campos requeridos
  return await dbInstance.getAllAsync(
    `SELECT * FROM clients 
     WHERE fullName LIKE ? 
        OR companyName LIKE ? 
        OR phone LIKE ? 
        OR address LIKE ? 
        OR city LIKE ?
     ORDER BY isFavorite DESC, fullName ASC`,
    [queryPattern, queryPattern, queryPattern, queryPattern, queryPattern]
  );
};

/**
 * Agrega un nuevo cliente.
 */
export const addClient = async (clientData) => {
  const { fullName, companyName = '', phone = '', address, city = '', notes = '', isFavorite = 0 } = clientData;
  const createdAt = new Date().toISOString();

  if (IS_WEB) {
    const raw = localStorage.getItem(WEB_STORAGE_KEY) || '[]';
    const list = JSON.parse(raw);
    const newId = list.length > 0 ? Math.max(...list.map((c) => c.id || 0)) + 1 : 1;
    const newClient = {
      id: newId,
      fullName,
      companyName,
      phone,
      address,
      city,
      notes,
      isFavorite: isFavorite ? 1 : 0,
      createdAt,
    };
    list.unshift(newClient);
    localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(list));
    return newClient;
  }

  if (!dbInstance) await initDatabase();

  const result = await dbInstance.runAsync(
    `INSERT INTO clients (fullName, companyName, phone, address, city, notes, isFavorite, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [fullName, companyName, phone, address, city, notes, isFavorite ? 1 : 0, createdAt]
  );

  return { id: result.lastInsertRowId, ...clientData, createdAt };
};

/**
 * Actualiza la información de un cliente existente.
 */
export const updateClient = async (id, clientData) => {
  const { fullName, companyName = '', phone = '', address, city = '', notes = '' } = clientData;

  if (IS_WEB) {
    const raw = localStorage.getItem(WEB_STORAGE_KEY) || '[]';
    let list = JSON.parse(raw);
    list = list.map((c) => (c.id === id ? { ...c, fullName, companyName, phone, address, city, notes } : c));
    localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(list));
    return true;
  }

  if (!dbInstance) await initDatabase();

  await dbInstance.runAsync(
    `UPDATE clients 
     SET fullName = ?, companyName = ?, phone = ?, address = ?, city = ?, notes = ?
     WHERE id = ?`,
    [fullName, companyName, phone, address, city, notes, id]
  );

  return true;
};

/**
 * Alterna el estado de favorito de un cliente.
 */
export const toggleFavorite = async (id, currentVal) => {
  const newVal = currentVal ? 0 : 1;

  if (IS_WEB) {
    const raw = localStorage.getItem(WEB_STORAGE_KEY) || '[]';
    let list = JSON.parse(raw);
    list = list.map((c) => (c.id === id ? { ...c, isFavorite: newVal } : c));
    localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(list));
    return newVal;
  }

  if (!dbInstance) await initDatabase();

  await dbInstance.runAsync('UPDATE clients SET isFavorite = ? WHERE id = ?', [newVal, id]);
  return newVal;
};

/**
 * Elimina un cliente por su ID.
 */
export const deleteClient = async (id) => {
  if (IS_WEB) {
    const raw = localStorage.getItem(WEB_STORAGE_KEY) || '[]';
    let list = JSON.parse(raw);
    list = list.filter((c) => c.id !== id);
    localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(list));
    return true;
  }

  if (!dbInstance) await initDatabase();

  await dbInstance.runAsync('DELETE FROM clients WHERE id = ?', [id]);
  return true;
};
