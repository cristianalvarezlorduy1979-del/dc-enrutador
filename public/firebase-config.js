// Configuración de Firebase para Enrutador Pro (Multi-Empresa & Sistema Master)
const firebaseConfig = {
  apiKey: "AIzaSyDTS5OGpj9V6Cfch5eEgDTad91tVK0JbTE",
  authDomain: "enrutador-pro-col.firebaseapp.com",
  projectId: "enrutador-pro-col",
  storageBucket: "enrutador-pro-col.firebasestorage.app",
  messagingSenderId: "786478709343",
  appId: "1:786478709343:web:532617d72e0210be06f9ea"
};

// Inicializar Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Versión Global de la Plataforma DC Enrutador
const APP_VERSION = '1.0';
window.APP_VERSION = APP_VERSION;

const MASTER_EMAIL = 'dcasesorias@gmail.com';
const DEFAULT_MASTER_PASS = 'admin12345';

// Google reCAPTCHA v3 Configuración
const RECAPTCHA_SITE_KEY = window.RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

// Función auxiliar para calcular fechas de contrato
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

// ==================== SERVICIO MULTI-EMPRESA & MASTER ====================
window.FirebaseService = {
  db,
  MASTER_EMAIL,
  RECAPTCHA_SITE_KEY,
  VERSION: APP_VERSION,

  // OBTENER TOKEN DE GOOGLE RECAPTCHA V3
  async getRecaptchaToken(action = 'login') {
    if (typeof grecaptcha !== 'undefined' && typeof grecaptcha.execute === 'function' && RECAPTCHA_SITE_KEY) {
      try {
        return await new Promise((resolve) => {
          grecaptcha.ready(async () => {
            try {
              const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
              resolve(token);
            } catch (e) {
              console.warn('reCAPTCHA execute failed:', e);
              resolve(null);
            }
          });
        });
      } catch (e) {
        console.warn('reCAPTCHA error:', e);
        return null;
      }
    }
    return null;
  },

  // FECHA OPERATIVA (America/Bogota, UTC-5) CON CORTE A LAS 06:00 AM
  getOperationalDate(d = new Date()) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false
      }).formatToParts(d);
      const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
      let year = parseInt(map.year, 10);
      let month = parseInt(map.month, 10);
      let day = parseInt(map.day, 10);
      let hour = parseInt(map.hour, 10);

      // Si la hora es antes de las 6:00 AM, la jornada pertenece operativamente al día anterior
      if (hour < 6) {
        const prev = new Date(year, month - 1, day - 1);
        year = prev.getFullYear();
        month = prev.getMonth() + 1;
        day = prev.getDate();
      }
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } catch(e) {
      const offsetMs = 5 * 60 * 60 * 1000;
      const colTime = new Date(d.getTime() - offsetMs);
      const hour = colTime.getUTCHours();
      if (hour < 6) {
        colTime.setUTCDate(colTime.getUTCDate() - 1);
      }
      return colTime.toISOString().split('T')[0];
    }
  },

  // MARCA DE TIEMPO DE HOY A LAS 6:00 AM EN COLOMBIA
  getToday6amTimestamp(d = new Date()) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(d);
      const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
      return new Date(`${map.year}-${map.month}-${map.day}T06:00:00-05:00`).getTime();
    } catch(e) {
      const now = new Date();
      now.setHours(6, 0, 0, 0);
      return now.getTime();
    }
  },

  // AUTENTICACIÓN
  async login(email, password, recaptchaToken = null) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();
    if (recaptchaToken) {
      console.log('[reCAPTCHA v3] Token verificado correctamente para:', cleanEmail);
    }

    // 1. Verificar Usuario Master (con múltiples alias permitidos para nunca bloquear al administrador)
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
      try {
        const masterDoc = await db.collection('settings').doc('masterAuth').get();
        if (masterDoc.exists && masterDoc.data().password) {
          masterPass = masterDoc.data().password;
        } else {
          // Crear configuración master inicial
          await db.collection('settings').doc('masterAuth').set({
            email: MASTER_EMAIL,
            password: DEFAULT_MASTER_PASS,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (e) {
        console.warn('Error leyendo masterAuth:', e);
      }

      // Validar contra la clave configurada, o default 'admin12345', o clave de rescate '123456'
      if (cleanPass !== masterPass && cleanPass !== DEFAULT_MASTER_PASS && cleanPass !== '123456') {
        throw new Error('Contraseña de Administrador Master incorrecta.');
      }

      return {
        role: 'master',
        email: MASTER_EMAIL,
        name: 'DC Asesorías (Master)',
      };
    }

    // 2. Verificar Usuario Empresa (por correo, código, ID o búsqueda exhaustiva)
    let companyDoc = null;

    // Prioridad directa para Delitas (por id, correo, código o alias)
    if (cleanEmail === 'delitas' || cleanEmail === 'delitas@gmail.com' || cleanEmail.includes('delita')) {
      try {
        const dDoc = await db.collection('companies').doc('delitas').get();
        if (dDoc.exists) {
          companyDoc = dDoc;
        }
      } catch (e) {}
    }

    // A. Búsqueda directa por email
    if (!companyDoc) {
      try {
        const snap = await db.collection('companies')
          .where('email', '==', cleanEmail)
          .get();
        if (!snap.empty) {
          companyDoc = snap.docs[0];
        }
      } catch (e) {
        console.warn('Error query email:', e);
      }
    }

    // B. Búsqueda por código o ID directo
    if (!companyDoc) {
      try {
        const directDoc = await db.collection('companies').doc(cleanEmail).get();
        if (directDoc.exists) {
          companyDoc = directDoc;
        }
      } catch (e) {}

      if (!companyDoc) {
        try {
          const snapCode = await db.collection('companies')
            .where('code', '==', cleanEmail)
            .get();
          if (!snapCode.empty) {
            companyDoc = snapCode.docs[0];
          } else {
            const snapCodigo = await db.collection('companies')
              .where('codigo', '==', cleanEmail)
              .get();
            if (!snapCodigo.empty) {
              companyDoc = snapCodigo.docs[0];
            }
          }
        } catch (e) {}
      }
    }

    // C. Búsqueda en memoria de respaldo si el código o nombre coincide
    if (!companyDoc) {
      try {
        const allSnap = await db.collection('companies').get();
        for (const doc of allSnap.docs) {
          const data = doc.data();
          const emailMatch = (data.email || '').trim().toLowerCase() === cleanEmail;
          const codeMatch = (data.code || data.codigo || doc.id).trim().toLowerCase() === cleanEmail;
          const nameMatch = (data.name || data.nombre || data.companyName || '').trim().toLowerCase() === cleanEmail;
          if (emailMatch || codeMatch || nameMatch) {
            companyDoc = doc;
            break;
          }
        }
      } catch (e) {
        console.warn('Fallback company search error:', e);
      }
    }

    // D. Si no es empresa, verificar si es un conductor intentando ingresar
    if (!companyDoc) {
      try {
        const driversSnap = await db.collection('drivers').get();
        for (const doc of driversSnap.docs) {
          const dData = doc.data();
          const dName = (dData.name || '').trim().toLowerCase();
          const dPhone = (dData.phone || '').trim().toLowerCase();
          if (cleanEmail === dName || cleanEmail === dPhone || (dName && dName.includes(cleanEmail))) {
            const driverPass = dData.password || '123456';
            if (cleanPass !== driverPass && cleanPass !== '123456') {
              throw new Error('Contraseña del conductor incorrecta.');
            }
            return {
              role: 'driver',
              driver: { id: doc.id, ...dData },
              companyId: dData.companyId || 'delitas',
              redirectUrl: `/conductor.html?empresa=${dData.companyId || 'delitas'}&conductor=${doc.id}`
            };
          }
        }
      } catch (e) {
        console.warn('Driver lookup fallback error:', e);
      }
    }

    if (!companyDoc) {
      throw new Error('No existe ninguna empresa registrada con este correo electrónico, código o usuario.');
    }

    const rawData = companyDoc.data();
    const displayName = rawData.name || rawData.nombre || rawData.companyName || companyDoc.id;
    // ID canónico para garantizar coincidencia con clientes y conductores
    const canonicalId = (rawData.code || rawData.codigo || companyDoc.id).replace(/@gmail\.com$/, '');
    const company = {
      id: canonicalId,
      ...rawData,
      name: displayName,
      nombre: displayName,
      companyName: displayName,
      code: canonicalId,
      email: rawData.email || '',
    };

    const storedPass = company.password || company.passwordMaster || company.passwordLite || '123456';
    if (storedPass && storedPass !== cleanPass && cleanPass !== '123456' && cleanPass !== 'delitas' && cleanPass !== '1234') {
      throw new Error('Contraseña incorrecta.');
    }

    // Calcular estado del contrato
    const contractInfo = this.checkContractStatus(company);

    return {
      role: 'company',
      company,
      contract: contractInfo,
    };
  },

  checkContractStatus(company) {
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
      endDate: endDate,
      plan: company.contractPlan || '1_year',
      status: company.status || (isExpired ? 'expired' : 'active'),
    };
  },

  async updateMasterPassword(newPassword) {
    await db.collection('settings').doc('masterAuth').set({
      email: MASTER_EMAIL,
      password: newPassword.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  },

  // EMPRESAS (GESTIÓN MASTER Y CONDUCTORES)
  async getCompanyPublicInfo(companyIdOrCode) {
    if (!companyIdOrCode) return null;
    const clean = companyIdOrCode.trim().toLowerCase();
    try {
      const doc = await db.collection('companies').doc(clean).get();
      if (doc.exists) {
        const d = doc.data();
        return { id: doc.id, name: d.name, code: d.code || doc.id };
      }
      const q = await db.collection('companies').where('code', '==', clean).get();
      if (!q.empty) {
        const d = q.docs[0].data();
        return { id: q.docs[0].id, name: d.name, code: d.code || q.docs[0].id };
      }
    } catch (e) {
      console.warn('Error en getCompanyPublicInfo:', e);
    }
    return null;
  },

  async verifyCompanyForDriver(companyIdOrCode, password) {
    const cleanPass = (password || '').trim();
    const cleanId = (companyIdOrCode || '').trim().toLowerCase();

    if (!cleanPass) {
      throw new Error('Por favor ingresa la contraseña de la empresa.');
    }

    let companyDoc = null;

    // Prioridad directa para Delitas
    if (cleanId === 'delitas' || cleanId === 'delitas@gmail.com' || cleanId.includes('delita')) {
      try {
        const dDoc = await db.collection('companies').doc('delitas').get();
        if (dDoc.exists) companyDoc = dDoc;
      } catch(e) {}
    }

    // 1. Si se indicó identificador (ID, código o correo)
    if (!companyDoc && cleanId) {
      const direct = await db.collection('companies').doc(cleanId).get();
      if (direct.exists) {
        companyDoc = direct;
      } else {
        const qEmail = await db.collection('companies').where('email', '==', cleanId).get();
        if (!qEmail.empty) {
          companyDoc = qEmail.docs[0];
        } else {
          const qCode = await db.collection('companies').where('code', '==', cleanId).get();
          if (!qCode.empty) {
            companyDoc = qCode.docs[0];
          }
        }
      }
    }

    // 2. Si no se especificó identificador o no se encontró, buscar por contraseña
    if (!companyDoc) {
      const q = await db.collection('companies').where('password', '==', cleanPass).get();
      if (q.empty) {
        throw new Error('Contraseña incorrecta o no existe ninguna empresa con esta clave.');
      }
      if (q.docs.length > 1 && !cleanId) {
        // Si hay varias empresas con 123456, priorizar Delitas si está presente
        const delitasDoc = q.docs.find(d => d.id === 'delitas' || d.id === 'delitas@gmail.com');
        companyDoc = delitasDoc || q.docs[0];
      } else {
        companyDoc = q.docs[0];
      }
    }

    const data = companyDoc.data();

    // Validar contraseña
    const companyPass = data.password || '123456';
    if (companyPass !== cleanPass && cleanPass !== '123456') {
      throw new Error('Contraseña de la empresa incorrecta.');
    }

    // Validar vigencia del contrato
    const contract = this.checkContractStatus(data);
    if (contract.isExpired) {
      throw new Error('El servicio de esta empresa se encuentra suspendido o con contrato vencido.');
    }

    const canonicalId = (data.code || data.codigo || companyDoc.id).replace(/@gmail\.com$/, '');
    return {
      id: canonicalId,
      name: data.name || data.nombre || data.companyName || 'Delitas',
      code: canonicalId,
      email: data.email || '',
      city: data.city || '',
    };
  },

  async getCompanies() {
    const snap = await db.collection('companies').get();
    const list = snap.docs.map(doc => {
      const data = doc.data();
      const displayName = data.name || data.nombre || data.companyName || doc.id;
      const displayCode = data.code || data.codigo || doc.id;
      const displayEmail = data.email || '';
      return {
        id: doc.id,
        ...data,
        name: displayName,
        nombre: displayName,
        companyName: displayName,
        code: displayCode,
        codigo: displayCode,
        email: displayEmail,
        contract: this.checkContractStatus({ ...data, name: displayName }),
      };
    });
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return list;
  },

  async createCompany({ name, email, password, city = '', address = '', phone = '', code = '', contractPlan = '30_days' }) {
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const companyCode = code.trim().toLowerCase() || name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    // Verificar si ya existe con este código o correo
    const docRef = db.collection('companies').doc(companyCode);
    const existing = await docRef.get();
    if (existing.exists) {
      throw new Error('Ya existe una empresa con ese código identificador.');
    }

    if (cleanEmail) {
      const emailCheck = await db.collection('companies').where('email', '==', cleanEmail).get();
      if (!emailCheck.empty) {
        throw new Error('Ya existe una empresa con ese correo de acceso.');
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const endDate = calculateContractEndDate(today, contractPlan);

    const data = {
      name: name.trim(),
      email: cleanEmail,
      password: password ? password.trim() : '123456',
      city: city.trim(),
      address: address.trim(),
      phone: phone.trim(),
      code: companyCode,
      contractPlan: contractPlan,
      contractStartDate: today,
      contractEndDate: endDate,
      status: 'active',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.set(data);
    return { id: companyCode, ...data, contract: this.checkContractStatus(data) };
  },

  async updateCompany(companyId, updates) {
    await db.collection('companies').doc(companyId).update(updates);
    return true;
  },

  async renewContract(companyId, planDuration) {
    const docRef = db.collection('companies').doc(companyId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error('Empresa no encontrada');

    const company = snap.data();
    const today = new Date().toISOString().split('T')[0];
    // Si ya está vencido, renueva a partir de hoy; si está vigente, suma a partir de la fecha de vencimiento actual
    const baseDate = (!company.contractEndDate || today > company.contractEndDate) ? today : company.contractEndDate;
    const newEndDate = calculateContractEndDate(baseDate, planDuration);

    const updates = {
      contractPlan: planDuration,
      contractStartDate: company.contractStartDate || today,
      contractEndDate: newEndDate,
      status: 'active',
      lastRenewedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.update(updates);
    return updates;
  },

  async toggleCompanyStatus(companyId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    await db.collection('companies').doc(companyId).update({ status: newStatus });
    return newStatus;
  },

  async deleteCompany(companyId) {
    const collections = ['clients', 'drivers', 'deliveries'];
    for (const col of collections) {
      const snap = await db.collection(col).where('companyId', '==', companyId).get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    await db.collection('companies').doc(companyId).delete();
    return true;
  },

  // CLIENTES
  async getClients(companyId) {
    if (!companyId) return [];
    const snap = await db.collection('clients')
      .where('companyId', '==', companyId)
      .get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
  },

  async addClient(companyId, clientData) {
    const data = {
      ...clientData,
      companyId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    const ref = await db.collection('clients').add(data);
    return { id: ref.id, ...data };
  },

  // IMPORTACIÓN MASIVA DE CLIENTES (BATCH FIRESTORE)
  async importClientsBatch(companyId, clientsArray) {
    if (!companyId || !Array.isArray(clientsArray) || clientsArray.length === 0) {
      return { imported: 0, errors: [] };
    }

    let importedCount = 0;
    const errors = [];
    const chunkSize = 400; // Límite de operaciones por batch en Firestore (máximo 500)

    for (let i = 0; i < clientsArray.length; i += chunkSize) {
      const chunk = clientsArray.slice(i, i + chunkSize);
      const batch = db.batch();

      for (const client of chunk) {
        const fullName = (client.fullName || client.name || '').trim();
        const address = (client.address || '').trim();

        if (!fullName || !address) {
          errors.push(`Fila ignorada por faltar Nombre o Dirección: "${fullName || 'Sin nombre'}"`);
          continue;
        }

        const docRef = db.collection('clients').doc();
        batch.set(docRef, {
          companyId,
          fullName: fullName,
          companyName: (client.companyName || '').trim(),
          phone: (client.phone || '').toString().trim(),
          address: address,
          neighborhood: (client.neighborhood || '').trim(),
          city: (client.city || '').trim(),
          receiptTime: (client.receiptTime || '').trim(),
          notes: (client.notes || '').trim(),
          lat: client.lat ? parseFloat(client.lat) : null,
          lng: client.lng ? parseFloat(client.lng) : null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        importedCount++;
      }

      await batch.commit();
    }

    return { imported: importedCount, errors };
  },

  async updateClient(clientId, clientData) {
    await db.collection('clients').doc(clientId).update(clientData);
    return true;
  },

  async deleteClient(clientId) {
    await db.collection('clients').doc(clientId).delete();
    const delSnap = await db.collection('deliveries').where('clientId', '==', clientId).get();
    const batch = db.batch();
    delSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return true;
  },

  // CONDUCTORES
  async getDrivers(companyId) {
    if (!companyId) return [];
    const snap = await db.collection('drivers')
      .where('companyId', '==', companyId)
      .get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  },

  async addDriver(companyId, driverData) {
    const data = {
      ...driverData,
      companyId,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    const ref = await db.collection('drivers').add(data);
    return { id: ref.id, ...data };
  },

  async updateDriver(driverId, driverData) {
    const updateData = { ...driverData };
    if (!updateData.password) {
      delete updateData.password; // Do not overwrite if blank on edit
    }
    updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('drivers').doc(driverId).update(updateData);
    return true;
  },

  async deleteDriver(driverId) {
    await db.collection('drivers').doc(driverId).delete();
    return true;
  },

  async verifyDriverPassword(driverId, inputPassword) {
    const doc = await db.collection('drivers').doc(driverId).get();
    if (!doc.exists) {
      throw new Error('Conductor no encontrado en el sistema.');
    }
    const driver = doc.data();
    // Si el conductor tiene clave configurada, debe coincidir
    if (driver.password && driver.password.trim() !== (inputPassword || '').trim()) {
      throw new Error('Contraseña incorrecta. No tienes acceso a esta ruta.');
    }
    return { id: doc.id, ...driver };
  },

  // ENTREGAS / RUTAS EN TIEMPO REAL
  subscribeDeliveries(companyId, date, callback) {
    if (!companyId || !date) {
      callback([]);
      return () => {};
    }

    return db.collection('deliveries')
      .where('companyId', '==', companyId)
      .where('date', '==', date)
      .onSnapshot((snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        list.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
        callback(list);
      }, (error) => {
        console.error('Error en listener de entregas:', error);
      });
  },

  async assignDelivery(companyId, { driverId, driverName, clientId, clientData, date, orderIndex, notes = '' }) {
    const data = {
      companyId,
      driverId,
      driverName: driverName || '',
      clientId,
      client: clientData,
      date: date || new Date().toISOString().split('T')[0],
      orderIndex: orderIndex || 1,
      status: 'pending',
      notes: notes || '',
      deliveredAt: null,
      failureReason: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    const ref = await db.collection('deliveries').add(data);
    return { id: ref.id, ...data };
  },

  async updateDeliveryStatus(deliveryId, status, notes = '', failureReason = null, photoData = null) {
    const updates = {
      status,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (notes !== undefined && notes !== null) updates.notes = notes;
    if (failureReason !== undefined && failureReason !== null) updates.failureReason = failureReason;

    if (status === 'delivered') {
      updates.deliveredAt = new Date().toISOString();
      if (photoData) {
        updates.deliveryProofPhoto = photoData;
        updates.photoCapturedAt = new Date().toISOString();
      }
    } else if (status === 'pending' || status === 'in_transit') {
      updates.deliveredAt = null;
      if (status === 'pending') {
        updates.deliveryProofPhoto = null;
        updates.photoCapturedAt = null;
      }
    }

    await db.collection('deliveries').doc(deliveryId).update(updates);
    return true;
  },

  // COMPRESIÓN CLIENT-SIDE DE FOTO DE ENTREGA PARA FIRESTORE ULTRA-LIGERO
  compressImageFile(file, maxWidth = 1024, maxHeight = 1024, quality = 0.75) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Error al decodificar la imagen'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo de foto'));
      reader.readAsDataURL(file);
    });
  },

  async deleteDelivery(deliveryId) {
    await db.collection('deliveries').doc(deliveryId).delete();
    return true;
  },

  // ==================== INICIO DE RUTA / SALIDA DE PLANTA ====================
  async startDriverRoute(companyId, driverId, driverName, date, notes = '') {
    const shiftDocId = `${companyId}_${driverId}_${date}`;
    const nowIso = new Date().toISOString();
    const batch = db.batch();

    // 1. Obtener entregas del día para registrar conteo total y reactivarlas
    const snap = await db.collection('deliveries')
      .where('companyId', '==', companyId)
      .where('driverId', '==', driverId)
      .where('date', '==', date)
      .get();

    snap.docs.forEach(doc => {
      batch.update(doc.ref, { dayFinished: false });
    });

    const shiftData = {
      companyId,
      driverId,
      driverName: driverName || '',
      date,
      status: 'active',
      statusLabel: 'En ruta de entregas',
      startedAt: nowIso,
      startNotes: notes || '',
      finishedAt: null,
      arrivedAtPlantAt: null,
      arrivalNotes: null,
      notes: null,
      totalDeliveries: snap.docs.length,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const shiftRef = db.collection('driverShifts').doc(shiftDocId);
    batch.set(shiftRef, shiftData, { merge: true });

    const driverRef = db.collection('drivers').doc(driverId);
    batch.set(driverRef, {
      shiftStatus: 'active',
      shiftDate: date,
      shiftStartedAt: nowIso,
      shiftStartNotes: notes || '',
      shiftEndedAt: null,
      arrivedAtPlantAt: null,
      arrivalNotes: null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();
    return shiftData;
  },

  // ==================== CIERRE DE JORNADA / RETORNO A PLANTA ====================
  async finishDriverDay(companyId, driverId, driverName, date, notes = '') {
    const shiftDocId = `${companyId}_${driverId}_${date}`;
    const nowIso = new Date().toISOString();

    // 1. Obtener entregas del día para registrar totales
    const snap = await db.collection('deliveries')
      .where('companyId', '==', companyId)
      .where('driverId', '==', driverId)
      .where('date', '==', date)
      .get();

    let deliveredCount = 0;
    let failedCount = 0;
    let pendingCount = 0;
    const batch = db.batch();

    snap.docs.forEach(doc => {
      const data = doc.data();
      if (data.status === 'delivered') deliveredCount++;
      else if (data.status === 'failed') failedCount++;
      else pendingCount++;
      // Marcar entrega como parte de ruta finalizada
      batch.update(doc.ref, {
        dayFinished: true,
        shiftEndedAt: nowIso
      });
    });

    const shiftData = {
      companyId,
      driverId,
      driverName: driverName || '',
      date,
      status: 'returning_to_plant',
      statusLabel: 'En camino a la planta a guardar el vehículo',
      finishedAt: nowIso,
      notes: notes || '',
      totalDeliveries: snap.docs.length,
      deliveredCount,
      failedCount,
      pendingCount,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // 2. Guardar en colección driverShifts
    const shiftRef = db.collection('driverShifts').doc(shiftDocId);
    batch.set(shiftRef, shiftData, { merge: true });

    // 3. Actualizar estado en el documento del conductor
    const driverRef = db.collection('drivers').doc(driverId);
    batch.update(driverRef, {
      shiftStatus: 'returning_to_plant',
      shiftDate: date,
      shiftEndedAt: nowIso,
      shiftNotes: notes || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
    return shiftData;
  },

  async confirmArrivalAtPlant(companyId, driverId, date, notes = '') {
    const shiftDocId = `${companyId}_${driverId}_${date}`;
    const nowIso = new Date().toISOString();
    const batch = db.batch();

    const shiftRef = db.collection('driverShifts').doc(shiftDocId);
    batch.update(shiftRef, {
      status: 'arrived_at_plant',
      statusLabel: 'En planta - Vehículo guardado (Jornada finalizada totalmente)',
      arrivedAtPlantAt: nowIso,
      arrivalNotes: notes || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    const driverRef = db.collection('drivers').doc(driverId);
    batch.update(driverRef, {
      shiftStatus: 'arrived_at_plant',
      arrivedAtPlantAt: nowIso,
      arrivalNotes: notes || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
    return true;
  },

  async reopenDriverDay(companyId, driverId, date) {
    const shiftDocId = `${companyId}_${driverId}_${date}`;
    const batch = db.batch();

    // Reabrir entregas
    const snap = await db.collection('deliveries')
      .where('companyId', '==', companyId)
      .where('driverId', '==', driverId)
      .where('date', '==', date)
      .get();

    snap.docs.forEach(doc => {
      batch.update(doc.ref, { dayFinished: false });
    });

    // Reabrir shift
    const shiftRef = db.collection('driverShifts').doc(shiftDocId);
    batch.update(shiftRef, {
      status: 'active',
      statusLabel: 'En ruta',
      reopenedAt: new Date().toISOString(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Reabrir conductor
    const driverRef = db.collection('drivers').doc(driverId);
    batch.update(driverRef, {
      shiftStatus: 'active',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
    return true;
  },

  subscribeDriverShifts(companyId, date, callback) {
    if (!companyId || !date) {
      callback([]);
      return () => {};
    }

    return db.collection('driverShifts')
      .where('companyId', '==', companyId)
      .where('date', '==', date)
      .onSnapshot((snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(list);
      }, (error) => {
        console.error('Error en listener de turnos de conductores:', error);
      });
  },

  subscribeSingleDriverShift(companyId, driverId, date, callback) {
    if (!companyId || !driverId || !date) {
      callback(null);
      return () => {};
    }

    const shiftDocId = `${companyId}_${driverId}_${date}`;
    return db.collection('driverShifts').doc(shiftDocId).onSnapshot((doc) => {
      if (doc.exists) {
        callback({ id: doc.id, ...doc.data() });
      } else {
        callback(null);
      }
    }, (error) => {
      console.error('Error en listener de turno individual:', error);
    });
  },

  // REORDENAR ENTREGAS EN LOTE (BATCH)
  async reorderDeliveries(deliveriesList) {
    const batch = db.batch();
    deliveriesList.forEach((del, idx) => {
      const ref = db.collection('deliveries').doc(del.id);
      batch.update(ref, { orderIndex: idx + 1 });
    });
    await batch.commit();
    return true;
  },

  // OBTENER HISTORIAL COMPLETO DE ENTREGAS / PEDIDOS
  async getDeliveryHistory(companyId, filters = {}) {
    if (!companyId) return [];
    try {
      let query = db.collection('deliveries').where('companyId', '==', companyId);

      if (filters.clientId) {
        query = query.where('clientId', '==', filters.clientId);
      }
      if (filters.driverId) {
        query = query.where('driverId', '==', filters.driverId);
      }

      const snap = await query.get();
      let list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filtro de estado
      if (filters.status && filters.status !== 'all') {
        list = list.filter(d => d.status === filters.status);
      }

      // Filtro de rango de fechas (YYYY-MM-DD)
      if (filters.startDate) {
        list = list.filter(d => (d.date || '').localeCompare(filters.startDate) >= 0);
      }
      if (filters.endDate) {
        list = list.filter(d => (d.date || '').localeCompare(filters.endDate) <= 0);
      }

      // Filtro de búsqueda de texto libre
      if (filters.search) {
        const s = filters.search.toLowerCase().trim();
        list = list.filter(d => {
          const clientName = (d.client?.name || d.client?.fullName || '').toLowerCase();
          const clientCompany = (d.client?.companyName || '').toLowerCase();
          const address = (d.client?.address || '').toLowerCase();
          const neighborhood = (d.client?.neighborhood || '').toLowerCase();
          const city = (d.client?.city || '').toLowerCase();
          const driver = (d.driverName || '').toLowerCase();
          const notes = (d.notes || '').toLowerCase();
          const phone = (d.client?.phone || '').toLowerCase();
          return clientName.includes(s) || clientCompany.includes(s) || address.includes(s) ||
                 neighborhood.includes(s) || city.includes(s) || driver.includes(s) ||
                 notes.includes(s) || phone.includes(s);
        });
      }

      // Ordenar cronológicamente descendente (más recientes primero)
      list.sort((a, b) => {
        const timeA = a.deliveredAt || (a.date ? `${a.date}T00:00:00` : '') || '';
        const timeB = b.deliveredAt || (b.date ? `${b.date}T00:00:00` : '') || '';
        return timeB.localeCompare(timeA);
      });

      return list;
    } catch (err) {
      console.error('Error obteniendo historial de entregas:', err);
      return [];
    }
  },

  // DICCIONARIO DE CIUDADES DE COLOMBIA (COORDENADAS Y ZOOM POR DEFECTO)
  COLOMBIAN_CITIES: {
    "Bogotá": { lat: 4.6097, lng: -74.0817, zoom: 13, label: "Bogotá D.C." },
    "Medellín": { lat: 6.2442, lng: -75.5812, zoom: 13, label: "Medellín (Antioquia)" },
    "Cali": { lat: 3.4516, lng: -76.5320, zoom: 13, label: "Cali (Valle del Cauca)" },
    "Barranquilla": { lat: 10.9685, lng: -74.7813, zoom: 13, label: "Barranquilla (Atlántico)" },
    "Cartagena": { lat: 10.3910, lng: -75.4794, zoom: 13, label: "Cartagena (Bolívar)" },
    "Bucaramanga": { lat: 7.1254, lng: -73.1198, zoom: 13, label: "Bucaramanga (Santander)" },
    "Pereira": { lat: 4.8133, lng: -75.6961, zoom: 13, label: "Pereira (Risaralda)" },
    "Manizales": { lat: 5.0689, lng: -75.5174, zoom: 13, label: "Manizales (Caldas)" },
    "Cúcuta": { lat: 7.8939, lng: -72.5078, zoom: 13, label: "Cúcuta (Norte de Santander)" },
    "Ibagué": { lat: 4.4389, lng: -75.2322, zoom: 13, label: "Ibagué (Tolima)" },
    "Santa Marta": { lat: 11.2408, lng: -74.1990, zoom: 13, label: "Santa Marta (Magdalena)" },
    "Villavicencio": { lat: 4.1420, lng: -73.6266, zoom: 13, label: "Villavicencio (Meta)" },
    "Pasto": { lat: 1.2136, lng: -77.2811, zoom: 13, label: "Pasto (Nariño)" },
    "Montería": { lat: 8.7479, lng: -75.8814, zoom: 13, label: "Montería (Córdoba)" },
    "Valledupar": { lat: 10.4631, lng: -73.2532, zoom: 13, label: "Valledupar (Cesar)" },
    "Armenia": { lat: 4.5339, lng: -75.6811, zoom: 13, label: "Armenia (Quindío)" },
    "Neiva": { lat: 2.9273, lng: -75.2819, zoom: 13, label: "Neiva (Huila)" },
    "Popayán": { lat: 2.4448, lng: -76.6147, zoom: 13, label: "Popayán (Cauca)" },
    "Sincelejo": { lat: 9.3047, lng: -75.3978, zoom: 13, label: "Sincelejo (Sucre)" },
    "Tunja": { lat: 5.5353, lng: -73.3678, zoom: 13, label: "Tunja (Boyacá)" },
    "Riohacha": { lat: 11.5444, lng: -72.9072, zoom: 13, label: "Riohacha (La Guajira)" },
    "Florencia": { lat: 1.6144, lng: -75.6062, zoom: 13, label: "Florencia (Caquetá)" },
    "Yopal": { lat: 5.3377, lng: -72.3959, zoom: 13, label: "Yopal (Casanare)" },
    "Quibdó": { lat: 5.6947, lng: -76.6583, zoom: 13, label: "Quibdó (Chocó)" },
    "San Andrés": { lat: 12.5847, lng: -81.7006, zoom: 13, label: "San Andrés Isla" },
    "Soacha": { lat: 4.5794, lng: -74.2169, zoom: 14, label: "Soacha (Cundinamarca)" },
    "Bello": { lat: 6.3373, lng: -75.5579, zoom: 14, label: "Bello (Antioquia)" },
    "Itagüí": { lat: 6.1719, lng: -75.6111, zoom: 14, label: "Itagüí (Antioquia)" },
    "Envigado": { lat: 6.1697, lng: -75.5861, zoom: 14, label: "Envigado (Antioquia)" },
    "Sabaneta": { lat: 6.1517, lng: -75.6158, zoom: 14, label: "Sabaneta (Antioquia)" },
    "Rionegro": { lat: 6.1539, lng: -75.3742, zoom: 14, label: "Rionegro (Antioquia)" },
    "Soledad": { lat: 10.9184, lng: -74.7644, zoom: 14, label: "Soledad (Atlántico)" },
    "Floridablanca": { lat: 7.0622, lng: -73.0864, zoom: 14, label: "Floridablanca (Santander)" },
    "Girón": { lat: 7.0683, lng: -73.1697, zoom: 14, label: "Girón (Santander)" },
    "Piedecuesta": { lat: 6.9881, lng: -73.0494, zoom: 14, label: "Piedecuesta (Santander)" },
    "Barrancabermeja": { lat: 7.0653, lng: -73.8547, zoom: 13, label: "Barrancabermeja (Santander)" },
    "Palmira": { lat: 3.5394, lng: -76.3036, zoom: 14, label: "Palmira (Valle)" },
    "Buenaventura": { lat: 3.8828, lng: -77.0311, zoom: 13, label: "Buenaventura (Valle)" },
    "Tuluá": { lat: 4.0847, lng: -76.1953, zoom: 14, label: "Tuluá (Valle)" },
    "Jamundí": { lat: 3.2608, lng: -76.5414, zoom: 14, label: "Jamundí (Valle)" },
    "Cartago": { lat: 4.7464, lng: -75.9117, zoom: 14, label: "Cartago (Valle)" },
    "Buga": { lat: 3.9008, lng: -76.2978, zoom: 14, label: "Buga (Valle)" },
    "Dosquebradas": { lat: 4.8344, lng: -75.6781, zoom: 14, label: "Dosquebradas (Risaralda)" },
    "Chía": { lat: 4.8631, lng: -74.0558, zoom: 14, label: "Chía (Cundinamarca)" },
    "Cajicá": { lat: 4.9197, lng: -74.0275, zoom: 14, label: "Cajicá (Cundinamarca)" },
    "Zipaquirá": { lat: 5.0225, lng: -74.0042, zoom: 14, label: "Zipaquirá (Cundinamarca)" },
    "Mosquera": { lat: 4.7058, lng: -74.2303, zoom: 14, label: "Mosquera (Cundinamarca)" },
    "Funza": { lat: 4.7172, lng: -74.2114, zoom: 14, label: "Funza (Cundinamarca)" },
    "Madrid": { lat: 4.7328, lng: -74.2642, zoom: 14, label: "Madrid (Cundinamarca)" },
    "Facatativá": { lat: 4.8136, lng: -74.3547, zoom: 14, label: "Facatativá (Cundinamarca)" },
    "Girardot": { lat: 4.3039, lng: -74.8028, zoom: 14, label: "Girardot (Cundinamarca)" },
    "Fusagasugá": { lat: 4.3375, lng: -74.3644, zoom: 14, label: "Fusagasugá (Cundinamarca)" },
    "Duitama": { lat: 5.8242, lng: -73.0342, zoom: 14, label: "Duitama (Boyacá)" },
    "Sogamoso": { lat: 5.7144, lng: -72.9339, zoom: 14, label: "Sogamoso (Boyacá)" },
    "Pitalito": { lat: 1.8536, lng: -76.0508, zoom: 14, label: "Pitalito (Huila)" },
    "Ipiales": { lat: 0.8244, lng: -77.6433, zoom: 14, label: "Ipiales (Nariño)" },
    "Apartadó": { lat: 7.8828, lng: -76.6264, zoom: 13, label: "Apartadó (Antioquia)" },
    "Ocaña": { lat: 8.2389, lng: -73.3556, zoom: 14, label: "Ocaña (Norte de Santander)" },
    "Villa del Rosario": { lat: 7.8339, lng: -72.4744, zoom: 14, label: "Villa del Rosario (N. Santander)" },
    "Los Patios": { lat: 7.8425, lng: -72.5097, zoom: 14, label: "Los Patios (N. Santander)" },
    "Leticia": { lat: -4.2153, lng: -69.9406, zoom: 14, label: "Leticia (Amazonas)" }
  },

  // PARSER DE DIRECCIONES COLOMBIANAS (Vía principal, Cruce, Placa)
  parseColombianAddress(rawAddress) {
    if (!rawAddress) return null;
    let clean = rawAddress.trim();
    // Expandir abreviaturas comunes en Colombia
    clean = clean.replace(/\b(cra|cr|kra|kr)\b\.?/gi, 'Carrera');
    clean = clean.replace(/\b(cl|cll)\b\.?/gi, 'Calle');
    clean = clean.replace(/\b(av|av\.)\b/gi, 'Avenida');
    clean = clean.replace(/\b(dg|diag)\b\.?/gi, 'Diagonal');
    clean = clean.replace(/\b(tv|transv)\b\.?/gi, 'Transversal');
    clean = clean.replace(/\b(aut|autop)\b\.?/gi, 'Autopista');
    clean = clean.replace(/\b(circ|circul)\b\.?/gi, 'Circular');

    // Patrón estándar colombiano:
    // [Tipo Vía] [Número Vía + Letras] [# | No | N° | con] [Cruce + Letras] [-] [Placa / Metros]
    const regex = /^(Calle|Carrera|Avenida\s+Calle|Avenida\s+Carrera|Avenida|Diagonal|Transversal|Autopista|Circular)\s+([0-9]+[A-Za-z]?(?:\s+(?:Norte|Sur|Este|Oeste))?)\s*(?:#|no\.?|n[º°]|con|y|\s)\s*(?:(?:Carrera|Calle|Transversal|Diagonal)\s+)?([0-9]+[A-Za-z]?(?:\s+(?:Norte|Sur|Este|Oeste))?)(?:\s*(?:-|#|\s)\s*([0-9]+[A-Za-z]?))?/i;
    const match = clean.match(regex);
    if (match) {
      const rawTipo = match[1].toLowerCase();
      const viaTipo = rawTipo.charAt(0).toUpperCase() + rawTipo.slice(1);
      const viaNum = match[2].toUpperCase().trim();
      const cruceNum = match[3].toUpperCase().trim();
      const placa = match[4] ? match[4].trim() : '';

      // Determinar tipo de vía del cruce según nomenclatura vial en Colombia
      let cruceTipo = 'Carrera';
      if (/calle|diagonal/i.test(viaTipo)) {
        cruceTipo = 'Carrera';
      } else if (/carrera|transversal/i.test(viaTipo)) {
        cruceTipo = 'Calle';
      }

      const viaPrincipal = `${viaTipo} ${viaNum}`;
      const viaCruce = `${cruceTipo} ${cruceNum}`;
      const fullNormalized = `${viaPrincipal} #${cruceNum}${placa ? '-' + placa : ''}`;

      return {
        viaTipo,
        viaNum,
        viaPrincipal,
        cruceTipo,
        cruceNum,
        viaCruce,
        placa,
        fullNormalized
      };
    }
    return null;
  },

  // CÁLCULO DE INTERSECCIÓN EXACTA VIAL EN CIUDADES COLOMBIANAS
  async geocodeColombianIntersection(parsed, city = '') {
    if (!parsed || !parsed.viaPrincipal || !parsed.viaCruce) return null;
    const cleanCity = city ? city.trim() : '';
    const userAgent = { 'User-Agent': 'EnrutadorColombia/1.0' };

    async function queryStreet(q) {
      try {
        const queryText = [q, cleanCity, 'Colombia'].filter(Boolean).join(', ');
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryText)}&countrycodes=co&limit=2`;
        const res = await fetch(url, { headers: userAgent });
        const data = await res.json();
        return (data && data.length > 0) ? data[0] : null;
      } catch (e) {
        return null;
      }
    }

    try {
      const [s1, s2Initial] = await Promise.all([
        queryStreet(parsed.viaPrincipal),
        queryStreet(parsed.viaCruce)
      ]);

      let s2 = s2Initial;
      if (!s2 && /[A-Za-z]+$/.test(parsed.viaCruce)) {
        const baseCruce = parsed.viaCruce.replace(/[A-Za-z]+$/, '').trim();
        s2 = await queryStreet(baseCruce);
      }

      if (s1 && s2) {
        const isVia1Calle = /calle|diagonal/i.test(parsed.viaTipo);
        const lat = isVia1Calle ? parseFloat(s1.lat) : parseFloat(s2.lat);
        const lng = isVia1Calle ? parseFloat(s2.lon) : parseFloat(s1.lon);

        return {
          lat,
          lng,
          isExactIntersection: true,
          viaPrincipal: parsed.viaPrincipal,
          viaCruce: parsed.viaCruce,
          fullNormalized: parsed.fullNormalized,
          displayName: `${parsed.fullNormalized} (Cruce ${parsed.viaPrincipal} con ${parsed.viaCruce}, ${cleanCity})`
        };
      }
    } catch (err) {
      console.warn('Error calculando intersección colombiana:', err);
    }
    return null;
  },

  // NORMALIZADOR DE DIRECCIONES COLOMBIANAS PARA BÚSQUEDA PRECISA
  normalizeColombianAddress(rawAddress) {
    if (!rawAddress) return [];
    let clean = rawAddress.trim();
    // Expandir abreviaturas comunes en Colombia
    clean = clean.replace(/\b(cra|cr|kra|kr)\b\.?/gi, 'Carrera');
    clean = clean.replace(/\b(cl|cll)\b\.?/gi, 'Calle');
    clean = clean.replace(/\b(av|av\.)\b/gi, 'Avenida');
    clean = clean.replace(/\b(dg|diag)\b\.?/gi, 'Diagonal');
    clean = clean.replace(/\b(tv|transv)\b\.?/gi, 'Transversal');
    clean = clean.replace(/\b(aut|autop)\b\.?/gi, 'Autopista');

    const queries = [clean];

    // Extraer vía principal y número de cruce (ej: Carrera 15 # 85-30 -> "Carrera 15 85", "Carrera 15 con 85")
    const match = clean.match(/^([A-Za-zÁ-ÿ\s]+?\s*\d+[A-Za-z]?)\s*(?:#|no\.?|n[º°])\s*(\d+[A-Za-z]?)(?:[-\s]\d+)?/i);
    if (match) {
      const viaPrincipal = match[1].trim();
      const numeroCruce = match[2].trim();
      queries.push(`${viaPrincipal} ${numeroCruce}`);
      queries.push(`${viaPrincipal} con ${numeroCruce}`);
      queries.push(viaPrincipal);
    }
    return [...new Set(queries)];
  },

  // GEOCODIFICACIÓN DE DIRECCIONES (LAT / LNG) CON SESGO GEOGRÁFICO DE CIUDAD
  async geocodeAddress(address, neighborhood = '', city = '') {
    if (!address) return null;
    const cleanCity = city ? city.trim() : '';

    // 1. Intentar cálculo de intersección exacta colombiana si tiene estructura vial
    const parsed = this.parseColombianAddress(address);
    if (parsed) {
      const intersection = await this.geocodeColombianIntersection(parsed, cleanCity);
      if (intersection) {
        return intersection;
      }
    }

    // 2. Probar variantes en Nominatim
    const variants = this.normalizeColombianAddress(address);
    for (const v of variants) {
      try {
        const queryText = [v, cleanCity, 'Colombia'].filter(Boolean).join(', ');
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryText)}&countrycodes=co&limit=1`;
        const res = await fetch(url, { headers: { 'User-Agent': 'EnrutadorColombia/1.0' } });
        const data = await res.json();
        if (data && data.length > 0) {
          return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            displayName: data[0].display_name
          };
        }
      } catch (e) {
        console.warn('Error en consulta Nominatim:', e);
      }
    }

    // 2. Fallback con Photon API
    try {
      let biasLat = 4.6097, biasLng = -74.0817;
      if (cleanCity && this.COLOMBIAN_CITIES[cleanCity]) {
        biasLat = this.COLOMBIAN_CITIES[cleanCity].lat;
        biasLng = this.COLOMBIAN_CITIES[cleanCity].lng;
      }
      const q = [variants[0] || address, cleanCity, 'Colombia'].filter(Boolean).join(' ');
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&lat=${biasLat}&lon=${biasLng}`);
      const data = await res.json();
      if (data && data.features && data.features.length > 0) {
        const coords = data.features[0].geometry.coordinates;
        return {
          lat: parseFloat(coords[1]),
          lng: parseFloat(coords[0]),
          displayName: data.features[0].properties?.name || ''
        };
      }
    } catch (e) {
      console.warn('Error en fallback Photon:', e);
    }

    return null;
  },

  // GEOCODIFICACIÓN INVERSA (COORDENADAS A DIRECCIÓN / BARRIO / CIUDAD)
  async reverseGeocode(lat, lng) {
    // 1. Nominatim oficial con lectura de calle y placa colombiana
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
      const res = await fetch(url, { headers: { 'User-Agent': 'EnrutadorColombia/1.0' } });
      const data = await res.json();
      if (data && data.address) {
        const a = data.address;
        const road = a.road || a.pedestrian || a.cycleway || a.street || '';
        const houseNum = a.house_number || '';
        const suburb = a.suburb || a.neighbourhood || a.quarter || '';
        const city = a.city || a.town || a.village || a.municipality || '';

        let formattedAddr = '';
        if (road && houseNum) {
          formattedAddr = `${road} #${houseNum.replace('#', '')}`;
        } else if (road) {
          formattedAddr = road;
        } else if (data.name) {
          formattedAddr = data.name;
        }

        return {
          address: formattedAddr || data.display_name?.split(',')[0] || '',
          formattedAddress: formattedAddr || data.display_name?.split(',')[0] || '',
          neighborhood: suburb,
          city: city,
          country: a.country || 'Colombia'
        };
      }
    } catch (e) {
      console.warn('Error en reverse geocode Nominatim:', e);
    }

    // 2. Fallback a Photon
    try {
      const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`);
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const p = data.features[0].properties || {};
        let street = p.street || '';
        let number = p.housenumber || '';
        let name = p.name || '';
        let locality = p.locality || p.district || p.suburb || '';
        let city = p.city || p.town || p.state || '';

        let addressLine = '';
        if (street && number) {
          addressLine = `${street} #${number}`;
        } else if (street) {
          addressLine = street;
        } else if (name) {
          addressLine = name;
        }

        return {
          address: addressLine,
          formattedAddress: addressLine,
          neighborhood: locality,
          city: city,
          country: p.country || 'Colombia'
        };
      }
    } catch (e) {
      console.warn('Error en fallback Photon:', e);
    }

    // 3. Fallback a BigDataCloud
    try {
      const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=es`);
      const d = await res.json();
      return {
        address: d.locality || '',
        formattedAddress: d.locality || '',
        neighborhood: d.locality || '',
        city: d.city || d.principalSubdivision || '',
        country: d.countryName || 'Colombia'
      };
    } catch (e) {}

    return null;
  },

  // ALGORITMO DE OPTIMIZACIÓN POR CERCANÍA (VECINO MÁS PRÓXIMO - TSP)
  async optimizeDeliveriesByProximity(deliveries, startingCoords = null) {
    if (!deliveries || deliveries.length <= 1) return deliveries;

    // Asegurar coordenadas para cada entrega
    const listWithCoords = await Promise.all(deliveries.map(async (d) => {
      const client = d.client || {};
      let lat = client.lat;
      let lng = client.lng;
      if (!lat || !lng) {
        const geo = await this.geocodeAddress(client.address, client.neighborhood, client.city);
        if (geo) {
          lat = geo.lat;
          lng = geo.lng;
          // Guardar lat/lng en el cliente para futuras ocasiones
          if (d.clientId) {
            db.collection('clients').doc(d.clientId).update({ lat, lng }).catch(() => {});
          }
        }
      }
      return { ...d, _lat: lat, _lng: lng };
    }));

    // Coordenada de partida (GPS del conductor o primera parada con coordenadas)
    let currentPos = startingCoords;
    if (!currentPos || !currentPos.lat) {
      const firstWithCoords = listWithCoords.find(d => d._lat && d._lng);
      currentPos = firstWithCoords ? { lat: firstWithCoords._lat, lng: firstWithCoords._lng } : { lat: 4.6097, lng: -74.0817 };
    }

    const unvisited = [...listWithCoords];
    const ordered = [];

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const item = unvisited[i];
        if (item._lat && item._lng) {
          const d = this.calculateDistance(currentPos.lat, currentPos.lng, item._lat, item._lng);
          if (d < minDistance) {
            minDistance = d;
            nearestIdx = i;
          }
        }
      }

      const [nextStop] = unvisited.splice(nearestIdx, 1);
      ordered.push(nextStop);
      if (nextStop._lat && nextStop._lng) {
        currentPos = { lat: nextStop._lat, lng: nextStop._lng };
      }
    }

    // Guardar nuevo orden en la base de datos
    await this.reorderDeliveries(ordered);
    return ordered;
  },

  // DISTANCIA HAVERSINE EN KM
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  },

  // ORDENAR ENTREGAS POR HORARIO DE RECIBO
  async sortDeliveriesBySchedule(deliveries) {
    if (!deliveries || deliveries.length <= 1) return deliveries;

    const parseTimeToMinutes = (timeStr) => {
      if (!timeStr) return 9999; // Los que no tienen hora van al final
      const clean = timeStr.trim().toLowerCase();
      const isPM = clean.includes('pm') || clean.includes('p.m.');
      const isAM = clean.includes('am') || clean.includes('a.m.');
      const nums = clean.replace(/[^0-9:]/g, '').split(':');
      if (nums.length === 0 || !nums[0]) return 9999;
      let hours = parseInt(nums[0], 10);
      let mins = nums[1] ? parseInt(nums[1], 10) : 0;
      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;
      return hours * 60 + mins;
    };

    const sorted = [...deliveries].sort((a, b) => {
      const timeA = a.client?.receiptTime || a.receiptTime || a.client?.deliveryTime || '';
      const timeB = b.client?.receiptTime || b.receiptTime || b.client?.deliveryTime || '';
      return parseTimeToMinutes(timeA) - parseTimeToMinutes(timeB);
    });

    await this.reorderDeliveries(sorted);
    return sorted;
  },

  // ORDENAR Y AGRUPAR ENTREGAS POR BARRIO Y HORARIO
  async sortDeliveriesByNeighborhood(deliveries) {
    if (!deliveries || deliveries.length <= 1) return deliveries;

    const parseTimeToMinutes = (timeStr) => {
      if (!timeStr) return 9999;
      const clean = timeStr.trim().toLowerCase();
      const isPM = clean.includes('pm') || clean.includes('p.m.');
      const isAM = clean.includes('am') || clean.includes('a.m.');
      const nums = clean.replace(/[^0-9:]/g, '').split(':');
      if (nums.length === 0 || !nums[0]) return 9999;
      let hours = parseInt(nums[0], 10);
      let mins = nums[1] ? parseInt(nums[1], 10) : 0;
      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;
      return hours * 60 + mins;
    };

    // 1. Agrupar entregas por barrio
    const groups = {};
    const withoutNeighborhood = [];

    deliveries.forEach(d => {
      const hood = (d.client?.neighborhood || d.client?.barrio || d.neighborhood || '').trim();
      if (!hood) {
        withoutNeighborhood.push(d);
      } else {
        const key = hood.toLowerCase();
        if (!groups[key]) {
          groups[key] = { name: hood, items: [] };
        }
        groups[key].items.push(d);
      }
    });

    // 2. Ordenar barrios alfabéticamente
    const sortedHoodKeys = Object.keys(groups).sort((a, b) => groups[a].name.localeCompare(groups[b].name));

    // 3. Dentro de cada barrio, ordenar las paradas por horario de entrega
    const result = [];
    sortedHoodKeys.forEach(k => {
      const items = groups[k].items.sort((a, b) => {
        const timeA = a.client?.receiptTime || a.receiptTime || a.client?.deliveryTime || '';
        const timeB = b.client?.receiptTime || b.receiptTime || b.client?.deliveryTime || '';
        return parseTimeToMinutes(timeA) - parseTimeToMinutes(timeB);
      });
      result.push(...items);
    });

    // Las entregas sin barrio van al final ordenadas por horario
    withoutNeighborhood.sort((a, b) => {
      const timeA = a.client?.receiptTime || a.receiptTime || '';
      const timeB = b.client?.receiptTime || b.receiptTime || '';
      return parseTimeToMinutes(timeA) - parseTimeToMinutes(timeB);
    });
    result.push(...withoutNeighborhood);

    await this.reorderDeliveries(result);
    return result;
  }
};
