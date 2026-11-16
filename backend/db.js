const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

// Cargar o inicializar la base de datos
function loadData() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const initial = { clients: [], drivers: [], deliveries: [] };
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error al leer base de datos:', error);
    return { clients: [], drivers: [], deliveries: [] };
  }
}

// Guardar de forma segura (atómica)
function saveData(data) {
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const tempPath = `${DB_PATH}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, DB_PATH);
    return true;
  } catch (error) {
    console.error('Error al guardar base de datos:', error);
    return false;
  }
}

module.exports = {
  // CLIENTES
  getClients() {
    return loadData().clients || [];
  },
  getClientById(id) {
    const clients = loadData().clients || [];
    return clients.find((c) => c.id === id) || null;
  },
  addClient(client) {
    const data = loadData();
    const newClient = {
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      fullName: client.fullName || '',
      companyName: client.companyName || '',
      phone: client.phone || '',
      address: client.address || '',
      city: client.city || '',
      notes: client.notes || '',
      createdAt: new Date().toISOString(),
    };
    data.clients.unshift(newClient);
    saveData(data);
    return newClient;
  },
  updateClient(id, updates) {
    const data = loadData();
    const index = data.clients.findIndex((c) => c.id === id);
    if (index === -1) return null;
    data.clients[index] = {
      ...data.clients[index],
      fullName: updates.fullName !== undefined ? updates.fullName : data.clients[index].fullName,
      companyName: updates.companyName !== undefined ? updates.companyName : data.clients[index].companyName,
      phone: updates.phone !== undefined ? updates.phone : data.clients[index].phone,
      address: updates.address !== undefined ? updates.address : data.clients[index].address,
      city: updates.city !== undefined ? updates.city : data.clients[index].city,
      notes: updates.notes !== undefined ? updates.notes : data.clients[index].notes,
    };
    saveData(data);
    return data.clients[index];
  },
  deleteClient(id) {
    const data = loadData();
    data.clients = data.clients.filter((c) => c.id !== id);
    // Eliminar también entregas vinculadas a este cliente
    data.deliveries = data.deliveries.filter((d) => d.clientId !== id);
    saveData(data);
    return true;
  },

  // CONDUCTORES
  getDrivers() {
    return loadData().drivers || [];
  },
  getDriverById(id) {
    return (loadData().drivers || []).find((d) => d.id === id) || null;
  },
  addDriver(driver) {
    const data = loadData();
    const newDriver = {
      id: 'd_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: driver.name || '',
      phone: driver.phone || '',
      vehicle: driver.vehicle || '',
      active: true,
      createdAt: new Date().toISOString(),
    };
    data.drivers.push(newDriver);
    saveData(data);
    return newDriver;
  },
  deleteDriver(id) {
    const data = loadData();
    data.drivers = data.drivers.filter((d) => d.id !== id);
    saveData(data);
    return true;
  },

  // ENTREGAS / ENRUTAMIENTO DEL DÍA
  getDeliveries(date) {
    const data = loadData();
    let list = data.deliveries || [];
    if (date) {
      list = list.filter((d) => d.date === date);
    }
    // Enriquecer con datos del cliente y conductor
    return list.map((del) => {
      const client = (data.clients || []).find((c) => c.id === del.clientId) || null;
      const driver = (data.drivers || []).find((dr) => dr.id === del.driverId) || null;
      return {
        ...del,
        client,
        driver,
      };
    }).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  },
  getDriverDeliveries(driverId, date) {
    const all = this.getDeliveries(date);
    return all.filter((d) => d.driverId === driverId);
  },
  assignDelivery(item) {
    const data = loadData();
    // Calcular el siguiente orden de parada para este conductor en esta fecha
    const existing = data.deliveries.filter(
      (d) => d.driverId === item.driverId && d.date === item.date
    );
    const nextOrder = existing.length > 0 ? Math.max(...existing.map((e) => e.orderIndex || 0)) + 1 : 1;

    const newDelivery = {
      id: 'del_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      date: item.date || new Date().toISOString().split('T')[0],
      driverId: item.driverId,
      clientId: item.clientId,
      orderIndex: item.orderIndex || nextOrder,
      status: 'pending', // 'pending' | 'in_transit' | 'delivered' | 'failed'
      notes: item.notes || '',
      deliveredAt: null,
      failureReason: null,
      createdAt: new Date().toISOString(),
    };
    data.deliveries.push(newDelivery);
    saveData(data);
    return this.getDeliveries(item.date).find((d) => d.id === newDelivery.id);
  },
  updateDeliveryStatus(id, { status, notes, failureReason }) {
    const data = loadData();
    const index = data.deliveries.findIndex((d) => d.id === id);
    if (index === -1) return null;

    const current = data.deliveries[index];
    current.status = status;
    if (notes !== undefined) current.notes = notes;
    if (failureReason !== undefined) current.failureReason = failureReason;

    if (status === 'delivered') {
      current.deliveredAt = new Date().toISOString();
    } else if (status === 'pending' || status === 'in_transit') {
      current.deliveredAt = null;
    }

    saveData(data);
    return current;
  },
  deleteDelivery(id) {
    const data = loadData();
    data.deliveries = data.deliveries.filter((d) => d.id !== id);
    saveData(data);
    return true;
  },
  reorderDeliveries(orderedIds) {
    const data = loadData();
    orderedIds.forEach((id, idx) => {
      const item = data.deliveries.find((d) => d.id === id);
      if (item) item.orderIndex = idx + 1;
    });
    saveData(data);
    return true;
  },
};
