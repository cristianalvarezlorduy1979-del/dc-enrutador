const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Detectar IP local de la red Wi-Fi / LAN (priorizando Ethernet y Wi-Fi)
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    // Si es adaptador virtual de VPN, dejarlo al final
    const isVpn = /radmin|hamachi|tailscale|zerotier|virtual|vbox/i.test(name);
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const isLan = iface.address.startsWith('192.168.') || iface.address.startsWith('10.') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(iface.address);
        candidates.push({
          address: iface.address,
          priority: isLan && !isVpn ? 1 : !isVpn ? 2 : 3,
        });
      }
    }
  }

  candidates.sort((a, b) => a.priority - b.priority);
  return candidates.length > 0 ? candidates[0].address : 'localhost';
}

const LOCAL_IP = getLocalIpAddress();

// Endpoint de información y conectividad
app.get('/api/info', (req, res) => {
  res.json({
    localIp: LOCAL_IP,
    port: PORT,
    dashboardUrl: `http://${LOCAL_IP}:${PORT}`,
    conductorUrl: `http://${LOCAL_IP}:${PORT}/conductor.html`,
  });
});

// ==================== RUTAS DE CLIENTES ====================
app.get('/api/clients', (req, res) => {
  const { search } = req.query;
  let clients = db.getClients();
  if (search && search.trim()) {
    const s = search.toLowerCase();
    clients = clients.filter(
      (c) =>
        (c.fullName && c.fullName.toLowerCase().includes(s)) ||
        (c.companyName && c.companyName.toLowerCase().includes(s)) ||
        (c.phone && c.phone.toLowerCase().includes(s)) ||
        (c.address && c.address.toLowerCase().includes(s)) ||
        (c.city && c.city.toLowerCase().includes(s))
    );
  }
  res.json(clients);
});

app.post('/api/clients', (req, res) => {
  const { fullName, companyName, phone, address, city, notes } = req.body;
  if (!fullName || !address) {
    return res.status(400).json({ error: 'Nombre y dirección son obligatorios' });
  }
  const created = db.addClient({ fullName, companyName, phone, address, city, notes });
  res.status(201).json(created);
});

app.put('/api/clients/:id', (req, res) => {
  const updated = db.updateClient(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json(updated);
});

app.delete('/api/clients/:id', (req, res) => {
  db.deleteClient(req.params.id);
  res.json({ success: true });
});

// ==================== RUTAS DE CONDUCTORES ====================
app.get('/api/drivers', (req, res) => {
  res.json(db.getDrivers());
});

app.post('/api/drivers', (req, res) => {
  const { name, phone, vehicle } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const created = db.addDriver({ name, phone, vehicle });
  res.status(201).json(created);
});

app.delete('/api/drivers/:id', (req, res) => {
  db.deleteDriver(req.params.id);
  res.json({ success: true });
});

// ==================== ENTREGAS Y ENRUTAMIENTO ====================
app.get('/api/deliveries', (req, res) => {
  const { date, driverId } = req.query;
  let list = db.getDeliveries(date);
  if (driverId) {
    list = list.filter((d) => d.driverId === driverId);
  }
  res.json(list);
});

app.post('/api/deliveries', (req, res) => {
  const { driverId, clientId, date, notes } = req.body;
  if (!driverId || !clientId) {
    return res.status(400).json({ error: 'Conductor y cliente son obligatorios' });
  }
  const assigned = db.assignDelivery({ driverId, clientId, date, notes });
  res.status(201).json(assigned);
});

app.put('/api/deliveries/:id/status', (req, res) => {
  const { status, notes, failureReason } = req.body;
  if (!['pending', 'in_transit', 'delivered', 'failed'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  const updated = db.updateDeliveryStatus(req.params.id, { status, notes, failureReason });
  if (!updated) return res.status(404).json({ error: 'Entrega no encontrada' });
  res.json(updated);
});

app.delete('/api/deliveries/:id', (req, res) => {
  db.deleteDelivery(req.params.id);
  res.json({ success: true });
});

app.post('/api/deliveries/reorder', (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'Formato inválido' });
  db.reorderDeliveries(orderedIds);
  res.json({ success: true });
});

// Rutas directas para el navegador
app.get('/conductor', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'conductor.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 SERVIDOR DE ENRUTADOR Y LOGÍSTICA ACTIVO`);
  console.log(`======================================================`);
  console.log(`💻 Panel del Jefe de Logística (PC):  http://localhost:${PORT}`);
  console.log(`📱 App del Conductor (Celular):       http://${LOCAL_IP}:${PORT}/conductor`);
  console.log(`🌐 Red local disponible en:          http://${LOCAL_IP}:${PORT}`);
  console.log(`======================================================\n`);
});
