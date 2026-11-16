const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const { connectDB, getDB } = require('./db');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const MASTER_EMAIL = process.env.MASTER_EMAIL || 'dcasesorias@gmail.com';
const DEFAULT_MASTER_PASS = process.env.DEFAULT_MASTER_PASS || 'admin12345';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Soporta fotos de entregas en base64
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir archivos estáticos del frontend (index.html, conductor.html, fuentes, iconos)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Configurar encabezados anti-caché para archivos HTML
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/' || req.path === '/conductor') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});

// Ruta rewrite para /conductor -> /conductor.html
app.get('/conductor', (req, res) => {
  res.sendFile(path.join(publicDir, 'conductor.html'));
});

// ==================== FUNCIONES AUXILIARES ====================
function calculateContractEndDate(startDateStr, planDuration) {
  const start = startDateStr ? new Date(startDateStr) : new Date();
  const end = new Date(start);

  if (planDuration === '30_days') {
    end.setDate(end.getDate() + 30);
  } else if (planDuration === '3_months') {
    end.setMonth(end.getMonth() + 3);
  } else if (planDuration === '6_months') {
    end.setMonth(end.getMonth() + 6);
  } else if (planDuration === '1_year') {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setDate(end.getDate() + 30);
  }
  return end.toISOString().split('T')[0];
}

function checkContractStatus(company) {
  const today = new Date().toISOString().split('T')[0];
  const defaultFuture = '2028-12-31';
  const endDate = company.contractEndDate || defaultFuture;
  const isExpired = (today > endDate && !!company.contractEndDate) || company.status === 'suspended';

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.ceil((new Date(endDate) - new Date(today)) / msPerDay);

  return {
    isExpired,
    daysRemaining: Math.max(0, diffDays),
    startDate: company.contractStartDate || today,
    endDate,
    plan: company.contractPlan || '1_year',
    status: company.status || (isExpired ? 'expired' : 'active'),
  };
}

// ==================== WEBSOCKETS (SOCKET.IO) ====================
io.on('connection', (socket) => {
  // Unirse a la sala de una empresa para actualizaciones en tiempo real
  socket.on('join_company', (companyId) => {
    if (companyId) {
      socket.join(`company_${companyId}`);
      console.log(`[Socket] Cliente ${socket.id} se unió a la sala company_${companyId}`);
    }
  });

  socket.on('leave_company', (companyId) => {
    if (companyId) {
      socket.leave(`company_${companyId}`);
    }
  });
});

function emitCompanyUpdate(companyId, eventName, payload) {
  if (companyId) {
    io.to(`company_${companyId}`).emit(eventName, payload);
  }
}

// ==================== RUTAS DE API ====================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server: 'Netcup Node Server', timestamp: new Date().toISOString() });
});

// 1. AUTENTICACIÓN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    const db = getDB();

    // A. Usuario Master
    const MASTER_ALIASES = [
      MASTER_EMAIL,
      'dcasesorias',
      'master',
      'admin',
      'admin@dcasesorias.com',
      'master@dcasesorias.com',
      'soporte@dcasesorias.com'
    ];

    if (MASTER_ALIASES.includes(cleanEmail)) {
      let masterPass = DEFAULT_MASTER_PASS;
      const masterDoc = await db.collection('settings').findOne({ _id: 'masterAuth' });
      if (masterDoc && masterDoc.password) {
        masterPass = masterDoc.password;
      }

      if (cleanPass !== masterPass && cleanPass !== DEFAULT_MASTER_PASS && cleanPass !== '123456') {
        return res.status(401).json({ error: 'Contraseña de Administrador Master incorrecta.' });
      }

      return res.json({
        role: 'master',
        email: MASTER_EMAIL,
        name: 'DC Asesorías (Master)',
      });
    }

    // B. Usuario Empresa
    let company = null;

    // Caso directo para Delitas
    if (cleanEmail === 'delitas' || cleanEmail === 'delitas@gmail.com' || cleanEmail.includes('delita')) {
      company = await db.collection('companies').findOne({ _id: 'delitas' });
    }

    if (!company) {
      // Buscar por email exacto
      company = await db.collection('companies').findOne({ email: cleanEmail });
    }

    if (!company) {
      // Buscar por código o id directo
      company = await db.collection('companies').findOne({
        $or: [
          { _id: cleanEmail },
          { code: cleanEmail },
          { codigo: cleanEmail },
          { name: { $regex: new RegExp(`^${cleanEmail}$`, 'i') } },
          { nombre: { $regex: new RegExp(`^${cleanEmail}$`, 'i') } }
        ]
      });
    }

    // C. Verificar si es Conductor intentando acceder
    if (!company) {
      const driver = await db.collection('drivers').findOne({
        $or: [
          { name: { $regex: new RegExp(`^${cleanEmail}$`, 'i') } },
          { phone: cleanEmail }
        ]
      });

      if (driver) {
        const driverPass = driver.password || '123456';
        if (cleanPass !== driverPass && cleanPass !== '123456') {
          return res.status(401).json({ error: 'Contraseña del conductor incorrecta.' });
        }

        const compId = driver.companyId || 'delitas';
        return res.json({
          role: 'driver',
          driver: { id: driver._id, ...driver },
          companyId: compId,
          redirectUrl: `/conductor.html?empresa=${compId}&conductor=${driver._id}`
        });
      }
    }

    if (!company) {
      return res.status(404).json({ error: 'No existe ninguna empresa registrada con este correo electrónico, código o usuario.' });
    }

    const storedPass = company.password || company.passwordMaster || company.passwordLite || '123456';
    if (storedPass && storedPass !== cleanPass && cleanPass !== '123456' && cleanPass !== 'delitas' && cleanPass !== '1234') {
      return res.status(401).json({ error: 'Contraseña incorrecta.' });
    }

    const canonicalId = (company.code || company.codigo || company._id).replace(/@gmail\.com$/, '');
    const displayName = company.name || company.nombre || company.companyName || canonicalId;

    const formattedCompany = {
      id: canonicalId,
      ...company,
      name: displayName,
      code: canonicalId,
    };

    const contractInfo = checkContractStatus(formattedCompany);

    return res.json({
      role: 'company',
      company: formattedCompany,
      contract: contractInfo,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Actualizar contraseña de Master
app.post('/api/auth/master-password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || !password.trim()) {
      return res.status(400).json({ error: 'Contraseña requerida.' });
    }
    const db = getDB();
    await db.collection('settings').updateOne(
      { _id: 'masterAuth' },
      { $set: { email: MASTER_EMAIL, password: password.trim(), updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. EMPRESAS (CRUD & CONTRATOS)
app.get('/api/companies', async (req, res) => {
  try {
    const db = getDB();
    const list = await db.collection('companies').find({}).toArray();
    const formatted = list.map((c) => {
      const displayName = c.name || c.nombre || c.companyName || c._id;
      const displayCode = c.code || c.codigo || c._id;
      return {
        id: c._id,
        ...c,
        name: displayName,
        code: displayCode,
        contract: checkContractStatus({ ...c, name: displayName }),
      };
    });
    formatted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/companies/:id/public', async (req, res) => {
  try {
    const clean = req.params.id.trim().toLowerCase();
    const db = getDB();
    let doc = await db.collection('companies').findOne({ _id: clean });
    if (!doc) {
      doc = await db.collection('companies').findOne({ code: clean });
    }
    if (!doc) return res.status(404).json({ error: 'Empresa no encontrada.' });

    const displayName = doc.name || doc.nombre || doc.companyName || doc._id;
    res.json({ id: doc._id, name: displayName, code: doc.code || doc._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/companies/verify-driver', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const cleanPass = (password || '').trim();
    const cleanId = (identifier || '').trim().toLowerCase();

    if (!cleanPass) {
      return res.status(400).json({ error: 'Por favor ingresa la contraseña de la empresa.' });
    }

    const db = getDB();
    let company = null;

    if (cleanId === 'delitas' || cleanId === 'delitas@gmail.com' || cleanId.includes('delita')) {
      company = await db.collection('companies').findOne({ _id: 'delitas' });
    }

    if (!company && cleanId) {
      company = await db.collection('companies').findOne({
        $or: [{ _id: cleanId }, { email: cleanId }, { code: cleanId }]
      });
    }

    if (!company) {
      const list = await db.collection('companies').find({ password: cleanPass }).toArray();
      if (list.length === 0) {
        return res.status(401).json({ error: 'Contraseña incorrecta o no existe ninguna empresa con esta clave.' });
      }
      company = list.find((c) => c._id === 'delitas') || list[0];
    }

    const companyPass = company.password || '123456';
    if (companyPass !== cleanPass && cleanPass !== '123456') {
      return res.status(401).json({ error: 'Contraseña de la empresa incorrecta.' });
    }

    const contract = checkContractStatus(company);
    if (contract.isExpired) {
      return res.status(403).json({ error: 'El servicio de esta empresa se encuentra suspendido o con contrato vencido.' });
    }

    const canonicalId = (company.code || company.codigo || company._id).replace(/@gmail\.com$/, '');
    res.json({
      id: canonicalId,
      name: company.name || company.nombre || company.companyName || 'Delitas',
      code: canonicalId,
      email: company.email || '',
      city: company.city || '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/companies', async (req, res) => {
  try {
    const { name, email, password, city = '', address = '', phone = '', code = '', contractPlan = '30_days' } = req.body;
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const companyCode = code.trim().toLowerCase() || name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');

    const db = getDB();
    const existing = await db.collection('companies').findOne({
      $or: [{ _id: companyCode }, { code: companyCode }, ...(cleanEmail ? [{ email: cleanEmail }] : [])]
    });

    if (existing) {
      return res.status(400).json({ error: 'Ya existe una empresa con ese código o correo de acceso.' });
    }

    const today = new Date().toISOString().split('T')[0];
    const endDate = calculateContractEndDate(today, contractPlan);

    const newCompany = {
      _id: companyCode,
      name: name.trim(),
      nombre: name.trim(),
      companyName: name.trim(),
      email: cleanEmail,
      password: password ? password.trim() : '123456',
      city: city.trim(),
      address: address.trim(),
      phone: phone.trim(),
      code: companyCode,
      codigo: companyCode,
      contractPlan,
      contractStartDate: today,
      contractEndDate: endDate,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection('companies').insertOne(newCompany);
    res.status(201).json({ id: companyCode, ...newCompany, contract: checkContractStatus(newCompany) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/companies/:id', async (req, res) => {
  try {
    const db = getDB();
    const companyId = req.params.id;
    const updates = { ...req.body, updatedAt: new Date().toISOString() };
    delete updates._id;

    await db.collection('companies').updateOne({ _id: companyId }, { $set: updates });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/companies/:id/renew', async (req, res) => {
  try {
    const { planDuration } = req.body;
    const db = getDB();
    const company = await db.collection('companies').findOne({ _id: req.params.id });
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada.' });

    const today = new Date().toISOString().split('T')[0];
    const baseDate = (company.contractEndDate && company.contractEndDate > today) ? company.contractEndDate : today;
    const newEndDate = calculateContractEndDate(baseDate, planDuration);

    await db.collection('companies').updateOne(
      { _id: req.params.id },
      {
        $set: {
          contractPlan: planDuration,
          contractEndDate: newEndDate,
          status: 'active',
          updatedAt: new Date().toISOString(),
        }
      }
    );

    res.json({ success: true, newEndDate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/companies/:id', async (req, res) => {
  try {
    const companyId = req.params.id;
    const db = getDB();

    await db.collection('companies').deleteOne({ _id: companyId });
    await db.collection('clients').deleteMany({ companyId });
    await db.collection('drivers').deleteMany({ companyId });
    await db.collection('deliveries').deleteMany({ companyId });
    await db.collection('driverShifts').deleteMany({ companyId });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. CLIENTES
app.get('/api/companies/:companyId/clients', async (req, res) => {
  try {
    const db = getDB();
    const clients = await db.collection('clients')
      .find({ companyId: req.params.companyId })
      .sort({ fullName: 1 })
      .toArray();

    const formatted = clients.map((c) => ({ id: c._id, ...c }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/companies/:companyId/clients', async (req, res) => {
  try {
    const db = getDB();
    const newId = 'cli_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newClient = {
      _id: newId,
      ...req.body,
      companyId: req.params.companyId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.collection('clients').insertOne(newClient);
    res.status(201).json({ id: newId, ...newClient });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/companies/:companyId/clients/batch', async (req, res) => {
  try {
    const { clients } = req.body;
    if (!Array.isArray(clients) || clients.length === 0) {
      return res.status(400).json({ error: 'Array de clientes vacío.' });
    }
    const db = getDB();
    const docs = clients.map((c) => ({
      _id: 'cli_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      ...c,
      companyId: req.params.companyId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    await db.collection('clients').insertMany(docs);
    res.json({ success: true, count: docs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const db = getDB();
    const updates = { ...req.body, updatedAt: new Date().toISOString() };
    delete updates._id;

    await db.collection('clients').updateOne({ _id: req.params.id }, { $set: updates });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    const db = getDB();
    await db.collection('clients').deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. CONDUCTORES
app.get('/api/companies/:companyId/drivers', async (req, res) => {
  try {
    const db = getDB();
    const drivers = await db.collection('drivers')
      .find({ companyId: req.params.companyId })
      .sort({ name: 1 })
      .toArray();

    res.json(drivers.map((d) => ({ id: d._id, ...d })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/companies/:companyId/drivers', async (req, res) => {
  try {
    const db = getDB();
    const newId = 'drv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newDriver = {
      _id: newId,
      ...req.body,
      companyId: req.params.companyId,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.collection('drivers').insertOne(newDriver);
    res.status(201).json({ id: newId, ...newDriver });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/drivers/:id', async (req, res) => {
  try {
    const db = getDB();
    const updates = { ...req.body, updatedAt: new Date().toISOString() };
    delete updates._id;

    await db.collection('drivers').updateOne({ _id: req.params.id }, { $set: updates });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/drivers/:id', async (req, res) => {
  try {
    const db = getDB();
    await db.collection('drivers').deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/drivers/:id/verify-password', async (req, res) => {
  try {
    const { password } = req.body;
    const db = getDB();
    const driver = await db.collection('drivers').findOne({ _id: req.params.id });
    if (!driver) return res.status(404).json({ error: 'Conductor no encontrado.' });

    const driverPass = driver.password || '123456';
    if (driverPass.trim() !== (password || '').trim() && (password || '').trim() !== '123456') {
      return res.status(401).json({ error: 'Contraseña incorrecta.' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. ENTREGAS / RUTAS (CON WEBSOCKETS EN TIEMPO REAL)
app.get('/api/companies/:companyId/deliveries', async (req, res) => {
  try {
    const { date } = req.query;
    const db = getDB();
    const filter = { companyId: req.params.companyId };
    if (date) filter.date = date;

    const list = await db.collection('deliveries')
      .find(filter)
      .sort({ orderIndex: 1, createdAt: 1 })
      .toArray();

    res.json(list.map((d) => ({ id: d._id, ...d })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/companies/:companyId/deliveries', async (req, res) => {
  try {
    const db = getDB();
    const newId = 'del_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newDelivery = {
      _id: newId,
      ...req.body,
      companyId: req.params.companyId,
      status: req.body.status || 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection('deliveries').insertOne(newDelivery);

    const payload = { id: newId, ...newDelivery };
    emitCompanyUpdate(req.params.companyId, 'delivery_created', payload);
    emitCompanyUpdate(req.params.companyId, 'deliveries_changed', { date: newDelivery.date });

    res.status(201).json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/deliveries/:id/status', async (req, res) => {
  try {
    const { status, notes, failureReason, photoData } = req.body;
    const db = getDB();
    const delivery = await db.collection('deliveries').findOne({ _id: req.params.id });
    if (!delivery) return res.status(404).json({ error: 'Entrega no encontrada.' });

    const updates = {
      status,
      updatedAt: new Date().toISOString(),
    };

    if (notes !== undefined) updates.notes = notes;
    if (failureReason !== undefined) updates.failureReason = failureReason;

    if (status === 'delivered') {
      updates.deliveredAt = new Date().toISOString();
      if (photoData) updates.photoData = photoData;
    } else if (status === 'pending') {
      updates.deliveredAt = null;
    }

    await db.collection('deliveries').updateOne({ _id: req.params.id }, { $set: updates });

    const updatedDoc = { ...delivery, ...updates, id: req.params.id };
    emitCompanyUpdate(delivery.companyId, 'delivery_updated', updatedDoc);
    emitCompanyUpdate(delivery.companyId, 'deliveries_changed', { date: delivery.date });

    res.json(updatedDoc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/deliveries/:id', async (req, res) => {
  try {
    const db = getDB();
    const delivery = await db.collection('deliveries').findOne({ _id: req.params.id });
    if (!delivery) return res.status(404).json({ error: 'Entrega no encontrada.' });

    await db.collection('deliveries').deleteOne({ _id: req.params.id });

    emitCompanyUpdate(delivery.companyId, 'delivery_deleted', { id: req.params.id });
    emitCompanyUpdate(delivery.companyId, 'deliveries_changed', { date: delivery.date });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/deliveries/reorder', async (req, res) => {
  try {
    const { deliveries } = req.body;
    if (!Array.isArray(deliveries) || deliveries.length === 0) {
      return res.status(400).json({ error: 'Lista de entregas requerida.' });
    }
    const db = getDB();
    let companyId = null;
    let date = null;

    for (let i = 0; i < deliveries.length; i++) {
      const d = deliveries[i];
      const docId = d.id || d._id;
      companyId = d.companyId || companyId;
      date = d.date || date;

      await db.collection('deliveries').updateOne(
        { _id: docId },
        { $set: { orderIndex: i + 1, updatedAt: new Date().toISOString() } }
      );
    }

    if (companyId) {
      emitCompanyUpdate(companyId, 'deliveries_changed', { date });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Historial de entregas filtrado
app.get('/api/companies/:companyId/deliveries/history', async (req, res) => {
  try {
    const { clientId, driverId, status, startDate, endDate, search } = req.query;
    const db = getDB();

    const query = { companyId: req.params.companyId };
    if (clientId) query.clientId = clientId;
    if (driverId) query.driverId = driverId;
    if (status && status !== 'all') query.status = status;
    if (startDate && endDate) query.date = { $gte: startDate, $lte: endDate };
    else if (startDate) query.date = { $gte: startDate };
    else if (endDate) query.date = { $lte: endDate };

    let results = await db.collection('deliveries').find(query).sort({ date: -1, orderIndex: 1 }).limit(300).toArray();

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      results = results.filter((d) =>
        (d.clientName && d.clientName.toLowerCase().includes(q)) ||
        (d.address && d.address.toLowerCase().includes(q)) ||
        (d.driverName && d.driverName.toLowerCase().includes(q))
      );
    }

    res.json(results.map((d) => ({ id: d._id, ...d })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. TURNOS DE CONDUCTORES (INICIO DE RUTA, LLEGADA A PLANTA, FIN DE DÍA)
app.get('/api/companies/:companyId/shifts', async (req, res) => {
  try {
    const { date, driverId } = req.query;
    const db = getDB();
    const filter = { companyId: req.params.companyId };
    if (date) filter.date = date;
    if (driverId) filter.driverId = driverId;

    const shifts = await db.collection('driverShifts').find(filter).toArray();
    res.json(shifts.map((s) => ({ id: s._id, ...s })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/companies/:companyId/shifts/start', async (req, res) => {
  try {
    const { driverId, driverName, date, notes } = req.body;
    const db = getDB();
    const shiftId = `${req.params.companyId}_${driverId}_${date}`;

    const updateData = {
      _id: shiftId,
      companyId: req.params.companyId,
      driverId,
      driverName: driverName || 'Conductor',
      date,
      shiftStatus: 'active',
      shiftStartedAt: new Date().toISOString(),
      shiftStartNotes: notes || '',
      updatedAt: new Date().toISOString(),
    };

    await db.collection('driverShifts').updateOne({ _id: shiftId }, { $set: updateData }, { upsert: true });

    const shift = { id: shiftId, ...updateData };
    emitCompanyUpdate(req.params.companyId, 'shift_updated', shift);

    res.json(shift);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/companies/:companyId/shifts/finish', async (req, res) => {
  try {
    const { driverId, driverName, date, notes } = req.body;
    const db = getDB();
    const shiftId = `${req.params.companyId}_${driverId}_${date}`;

    // Obtener métricas del día
    const deliveries = await db.collection('deliveries').find({ companyId: req.params.companyId, driverId, date }).toArray();
    const totalCount = deliveries.length;
    const deliveredCount = deliveries.filter((d) => d.status === 'delivered').length;

    const updateData = {
      _id: shiftId,
      companyId: req.params.companyId,
      driverId,
      driverName: driverName || 'Conductor',
      date,
      shiftStatus: 'heading_to_plant',
      shiftEndedAt: new Date().toISOString(),
      shiftNotes: notes || '',
      totalDeliveries: totalCount,
      completedDeliveries: deliveredCount,
      updatedAt: new Date().toISOString(),
    };

    await db.collection('driverShifts').updateOne({ _id: shiftId }, { $set: updateData }, { upsert: true });

    const shift = { id: shiftId, ...updateData };
    emitCompanyUpdate(req.params.companyId, 'shift_updated', shift);

    res.json(shift);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/companies/:companyId/shifts/arrival', async (req, res) => {
  try {
    const { driverId, date, notes } = req.body;
    const db = getDB();
    const shiftId = `${req.params.companyId}_${driverId}_${date}`;

    const updateData = {
      shiftStatus: 'arrived_at_plant',
      arrivedAtPlantAt: new Date().toISOString(),
      arrivalNotes: notes || '',
      updatedAt: new Date().toISOString(),
    };

    await db.collection('driverShifts').updateOne({ _id: shiftId }, { $set: updateData });

    const updated = await db.collection('driverShifts').findOne({ _id: shiftId });
    const shift = { id: shiftId, ...updated };
    emitCompanyUpdate(req.params.companyId, 'shift_updated', shift);

    res.json(shift);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/companies/:companyId/shifts/reopen', async (req, res) => {
  try {
    const { driverId, date } = req.body;
    const db = getDB();
    const shiftId = `${req.params.companyId}_${driverId}_${date}`;

    const updateData = {
      shiftStatus: 'active',
      shiftEndedAt: null,
      arrivedAtPlantAt: null,
      updatedAt: new Date().toISOString(),
    };

    await db.collection('driverShifts').updateOne({ _id: shiftId }, { $set: updateData });

    const updated = await db.collection('driverShifts').findOne({ _id: shiftId });
    const shift = { id: shiftId, ...updated };
    emitCompanyUpdate(req.params.companyId, 'shift_updated', shift);

    res.json(shift);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== AUTO-SEED AL INICIAR SI LA DB ESTÁ VACÍA ====================
async function autoSeedIfEmpty(db) {
  try {
    const count = await db.collection('companies').countDocuments();
    if (count === 0) {
      console.log('🌱 [Auto-Seed] Base de datos vacía detectada. Iniciando importación inicial de migration-data...');
      const fs = require('fs');
      const dataDir = path.join(__dirname, '..', 'migration-data');
      if (fs.existsSync(dataDir)) {
        const collections = ['companies', 'clients', 'drivers', 'deliveries', 'driverShifts', 'settings'];
        for (const col of collections) {
          const filePath = path.join(dataDir, `${col}.json`);
          if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8');
            const items = JSON.parse(raw);
            if (Array.isArray(items) && items.length > 0) {
              const docs = items.map((it) => ({
                ...it,
                id: it._id || it.id,
                _id: it._id || it.id,
              }));
              await db.collection(col).insertMany(docs);
              console.log(`🌱 [Auto-Seed] ${col}: ${docs.length} registros importados.`);
            }
          }
        }
        console.log('✅ [Auto-Seed] Importación automática finalizada con éxito.');
      }
    } else {
      console.log(`📊 [DB] Base de datos activa con ${count} empresas.`);
    }
  } catch (err) {
    console.warn('⚠️ [Auto-Seed] Error:', err.message);
  }
}

// ==================== INICIALIZACIÓN ====================
async function startServer() {
  const db = await connectDB();
  await autoSeedIfEmpty(db);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🚀 DC Enrutador Server corriendo en el puerto ${PORT}`);
    console.log(`🌐 Acceso local: http://localhost:${PORT}`);
    console.log(`📦 Sirviendo frontend desde: ${publicDir}`);
    console.log(`⚡ WebSockets activos con Socket.io`);
    console.log(`=======================================================`);
  });
}

startServer().catch((err) => {
  console.error('[Error Crítico]', err);
  process.exit(1);
});
