// =========================================================================
// API SERVICE (NETCUP NODE.JS + MONGODB + WEBSOCKETS ADAPTER)
// Drop-in replacement para window.FirebaseService en DC Enrutador
// =========================================================================

const APP_VERSION = '1.0';
window.APP_VERSION = APP_VERSION;
const MASTER_EMAIL = 'dcasesorias@gmail.com';
const RECAPTCHA_SITE_KEY = window.RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

// Socket.io client reference
let socket = null;
function getSocket() {
  if (!socket && typeof io !== 'undefined') {
    socket = io();
    socket.on('connect', () => {
      console.log('[Socket.io] Conectado en tiempo real al servidor Netcup');
    });
  }
  return socket;
}

// Helper para peticiones HTTP
async function apiRequest(endpoint, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const res = await fetch(endpoint, config);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Error en la solicitud (${res.status})`);
  }

  return data;
}

// Servicio compatible 1:1 con FirebaseService
window.ApiService = {
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
      if (hour < 6) colTime.setUTCDate(colTime.getUTCDate() - 1);
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
    return await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email, password, recaptchaToken },
    });
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
      endDate,
      plan: company.contractPlan || '1_year',
      status: company.status || (isExpired ? 'expired' : 'active'),
    };
  },

  async updateMasterPassword(newPassword) {
    return await apiRequest('/api/auth/master-password', {
      method: 'POST',
      body: { password: newPassword },
    });
  },

  // EMPRESAS
  async getCompanyPublicInfo(companyIdOrCode) {
    if (!companyIdOrCode) return null;
    try {
      return await apiRequest(`/api/companies/${encodeURIComponent(companyIdOrCode)}/public`);
    } catch (e) {
      return null;
    }
  },

  async verifyCompanyForDriver(companyIdOrCode, password) {
    return await apiRequest('/api/companies/verify-driver', {
      method: 'POST',
      body: { identifier: companyIdOrCode, password },
    });
  },

  async getCompanies() {
    return await apiRequest('/api/companies');
  },

  async createCompany(payload) {
    return await apiRequest('/api/companies', {
      method: 'POST',
      body: payload,
    });
  },

  async updateCompany(companyId, updates) {
    return await apiRequest(`/api/companies/${encodeURIComponent(companyId)}`, {
      method: 'PUT',
      body: updates,
    });
  },

  async renewContract(companyId, planDuration) {
    return await apiRequest(`/api/companies/${encodeURIComponent(companyId)}/renew`, {
      method: 'POST',
      body: { planDuration },
    });
  },

  async toggleCompanyStatus(companyId, currentStatus) {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    return await this.updateCompany(companyId, { status: newStatus });
  },

  async deleteCompany(companyId) {
    return await apiRequest(`/api/companies/${encodeURIComponent(companyId)}`, {
      method: 'DELETE',
    });
  },

  // CLIENTES
  async getClients(companyId) {
    if (!companyId) return [];
    return await apiRequest(`/api/companies/${encodeURIComponent(companyId)}/clients`);
  },

  async addClient(companyId, clientData) {
    return await apiRequest(`/api/companies/${encodeURIComponent(companyId)}/clients`, {
      method: 'POST',
      body: clientData,
    });
  },

  async importClientsBatch(companyId, clientsArray) {
    return await apiRequest(`/api/companies/${encodeURIComponent(companyId)}/clients/batch`, {
      method: 'POST',
      body: { clients: clientsArray },
    });
  },

  async updateClient(clientId, clientData) {
    return await apiRequest(`/api/clients/${encodeURIComponent(clientId)}`, {
      method: 'PUT',
      body: clientData,
    });
  },

  async deleteClient(clientId) {
    return await apiRequest(`/api/clients/${encodeURIComponent(clientId)}`, {
      method: 'DELETE',
    });
  },

  // CONDUCTORES
  async getDrivers(companyId) {
    if (!companyId) return [];
    return await apiRequest(`/api/companies/${encodeURIComponent(companyId)}/drivers`);
  },

  async addDriver(companyId, driverData) {
    return await apiRequest(`/api/companies/${encodeURIComponent(companyId)}/drivers`, {
      method: 'POST',
      body: driverData,
    });
  },

  async updateDriver(driverId, driverData) {
    return await apiRequest(`/api/drivers/${encodeURIComponent(driverId)}`, {
      method: 'PUT',
      body: driverData,
    });
  },

  async deleteDriver(driverId) {
    return await apiRequest(`/api/drivers/${encodeURIComponent(driverId)}`, {
      method: 'DELETE',
    });
  },

  async verifyDriverPassword(driverId, inputPassword) {
    return await apiRequest(`/api/drivers/${encodeURIComponent(driverId)}/verify-password`, {
      method: 'POST',
      body: { password: inputPassword },
    });
  },

  // ==================== ENTREGAS & TIEMPO REAL (WEBSOCKETS) ====================
  subscribeDeliveries(companyId, date, callback) {
    if (!companyId || !date) {
      callback([]);
      return () => {};
    }

    const s = getSocket();
    if (s) {
      s.emit('join_company', companyId);
    }

    // Carga inicial
    const fetchLatest = async () => {
      try {
        const list = await apiRequest(`/api/companies/${encodeURIComponent(companyId)}/deliveries?date=${encodeURIComponent(date)}`);
        callback(list);
      } catch (err) {
        console.warn('Error fetching deliveries:', err);
      }
    };
    fetchLatest();

    // Escuchar eventos en vivo de Socket.io
    const onDeliveriesChanged = (payload) => {
      if (!payload || !payload.date || payload.date === date) {
        fetchLatest();
      }
    };

    if (s) {
      s.on('deliveries_changed', onDeliveriesChanged);
    }

    // Intervalo de respaldo cada 15 segundos
    const interval = setInterval(fetchLatest, 15000);

    return () => {
      clearInterval(interval);
      if (s) {
        s.off('deliveries_changed', onDeliveriesChanged);
      }
    };
  },

  async assignDelivery(companyId, { driverId, driverName, clientId, clientData, date, orderIndex, notes = '' }) {
    const payload = {
      driverId,
      driverName: driverName || 'Conductor',
      clientId,
      clientName: clientData.fullName || clientData.nombre || 'Cliente',
      companyName: clientData.companyName || clientData.empresa || '',
      address: clientData.address || clientData.direccion || '',
      neighborhood: clientData.neighborhood || clientData.barrio || '',
      receiptTime: clientData.receiptTime || clientData.horario || '',
      phone: clientData.phone || clientData.telefono || '',
      city: clientData.city || clientData.ciudad || 'Cali',
      notes,
      date,
      orderIndex: orderIndex || 1,
      status: 'pending',
    };

    return await apiRequest(`/api/companies/${encodeURIComponent(companyId)}/deliveries`, {
      method: 'POST',
      body: payload,
    });
  },

  async updateDeliveryStatus(deliveryId, status, notes = '', failureReason = null, photoData = null) {
    return await apiRequest(`/api/deliveries/${encodeURIComponent(deliveryId)}/status`, {
      method: 'PUT',
      body: { status, notes, failureReason, photoData },
    });
  },

  compressImageFile(file, maxWidth = 1024, maxHeight = 1024, quality = 0.75) {
    return new Promise((resolve) => {
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
        img.onerror = () => resolve(null);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  },

  async deleteDelivery(deliveryId) {
    return await apiRequest(`/api/deliveries/${encodeURIComponent(deliveryId)}`, {
      method: 'DELETE',
    });
  },

  async reorderDeliveries(deliveriesList) {
    return await apiRequest('/api/deliveries/reorder', {
      method: 'POST',
      body: { deliveries: deliveriesList },
    });
  },

  async getDeliveryHistory(companyId, filters = {}) {
    const params = new URLSearchParams();
    if (filters.clientId) params.append('clientId', filters.clientId);
    if (filters.driverId) params.append('driverId', filters.driverId);
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.search) params.append('search', filters.search);

    return await apiRequest(`/api/companies/${encodeURIComponent(companyId)}/deliveries/history?${params.toString()}`);
  },

  // ==================== TURNOS & JORNADA ====================
  async startDriverRoute(companyId, driverId, driverName, date, notes = '') {
    return await apiRequest(`/api/companies/${encodeURIComponent(companyId)}/shifts/start`, {
      method: 'POST',
      body: { driverId, driverName, date, notes },
    });
  },

  async finishDriverDay(companyId, driverId, driverName, date, notes = '') {
    return await apiRequest(`/api/companies/${encodeURIComponent(companyId)}/shifts/finish`, {
      method: 'POST',
      body: { driverId, driverName, date, notes },
    });
  },

  async confirmArrivalAtPlant(companyId, driverId, date, notes = '') {
    return await apiRequest(`/api/companies/${encodeURIComponent(companyId)}/shifts/arrival`, {
      method: 'POST',
      body: { driverId, date, notes },
    });
  },

  async reopenDriverDay(companyId, driverId, date) {
    return await apiRequest(`/api/companies/${encodeURIComponent(companyId)}/shifts/reopen`, {
      method: 'POST',
      body: { driverId, date },
    });
  },

  subscribeDriverShifts(companyId, date, callback) {
    if (!companyId || !date) {
      callback([]);
      return () => {};
    }

    const s = getSocket();
    if (s) s.emit('join_company', companyId);

    const fetchShifts = async () => {
      try {
        const shifts = await apiRequest(`/api/companies/${encodeURIComponent(companyId)}/shifts?date=${encodeURIComponent(date)}`);
        callback(shifts);
      } catch (err) {
        console.warn('Error fetching shifts:', err);
      }
    };
    fetchShifts();

    const onShiftUpdated = () => fetchShifts();
    if (s) s.on('shift_updated', onShiftUpdated);

    const interval = setInterval(fetchShifts, 15000);
    return () => {
      clearInterval(interval);
      if (s) s.off('shift_updated', onShiftUpdated);
    };
  },

  subscribeSingleDriverShift(companyId, driverId, date, callback) {
    if (!companyId || !driverId || !date) {
      callback(null);
      return () => {};
    }

    const s = getSocket();
    if (s) s.emit('join_company', companyId);

    const fetchShift = async () => {
      try {
        const shifts = await apiRequest(`/api/companies/${encodeURIComponent(companyId)}/shifts?date=${encodeURIComponent(date)}&driverId=${encodeURIComponent(driverId)}`);
        callback(shifts.length > 0 ? shifts[0] : null);
      } catch (err) {
        console.warn('Error fetching single shift:', err);
      }
    };
    fetchShift();

    const onShiftUpdated = () => fetchShift();
    if (s) s.on('shift_updated', onShiftUpdated);

    const interval = setInterval(fetchShift, 15000);
    return () => {
      clearInterval(interval);
      if (s) s.off('shift_updated', onShiftUpdated);
    };
  },

  // ==================== RUTAS, GEOGRAFÍA Y ALGORITMOS DE OPTIMIZACIÓN ====================
  COLOMBIAN_CITIES: {
    cali: { lat: 3.4516, lng: -76.5320, name: 'Cali' },
    jamundi: { lat: 3.2608, lng: -76.5414, name: 'Jamundí' },
    yumbo: { lat: 3.5819, lng: -76.4947, name: 'Yumbo' },
    palmira: { lat: 3.5394, lng: -76.3036, name: 'Palmira' },
    bogota: { lat: 4.7110, lng: -74.0721, name: 'Bogotá' },
    medellin: { lat: 6.2442, lng: -75.5812, name: 'Medellín' },
    barranquilla: { lat: 10.9685, lng: -74.7813, name: 'Barranquilla' }
  },

  parseColombianAddress(rawAddress) {
    if (!rawAddress) return null;
    let clean = rawAddress.trim().toLowerCase().replace(/\s+/g, ' ');
    clean = clean.replace(/\bcll\b|\bcl\b/gi, 'calle')
                 .replace(/\bcr\b|\bcra\b|\bkr\b/gi, 'carrera')
                 .replace(/\bav\b|\bav\.\b/gi, 'avenida')
                 .replace(/\bdg\b|\bdiag\b/gi, 'diagonal')
                 .replace(/\btv\b|\btrans\b/gi, 'transversal')
                 .replace(/\baut\b/gi, 'autopista');

    const regex = /^(calle|carrera|avenida|diagonal|transversal|autopista)\s+([0-9]+[a-z]?(\s+oeste|\s+norte|\s+sur)?)\s*(?:#|no\.?|nro\.?|\s+)\s*([0-9]+[a-z]?)\s*-\s*([0-9]+)/i;
    const match = clean.match(regex);
    if (match) {
      return {
        viaTipo: match[1],
        viaPrincipalNum: match[2].trim(),
        viaCruceNum: match[4].trim(),
        placa: match[5].trim(),
        viaPrincipal: `${match[1]} ${match[2]}`.trim(),
        viaCruce: `${/calle|diagonal/i.test(match[1]) ? 'carrera' : 'calle'} ${match[4]}`.trim()
      };
    }
    return null;
  },

  async geocodeAddress(address, neighborhood = '', city = '') {
    if (!address) return null;
    const cleanCity = city ? city.trim().toLowerCase() : 'cali';
    const cityCoords = this.COLOMBIAN_CITIES[cleanCity] || this.COLOMBIAN_CITIES['cali'];
    try {
      const q = encodeURIComponent(`${address}, ${neighborhood ? neighborhood + ', ' : ''}${city || 'Cali'}, Colombia`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1&countrycodes=co`);
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          displayName: data[0].display_name
        };
      }
    } catch (e) {
      console.warn('Geocoding error:', e);
    }
    return { lat: cityCoords.lat, lng: cityCoords.lng, displayName: address };
  },

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  },

  async optimizeDeliveriesByProximity(deliveries, startingCoords = null) {
    if (!deliveries || deliveries.length <= 1) return deliveries;
    const list = [...deliveries];
    const optimized = [];
    let current = startingCoords || { lat: 3.4516, lng: -76.5320 }; // Cali centro por defecto

    const unvisited = [...list];
    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const item = unvisited[i];
        const lat = item.lat || (item.clientData && item.clientData.lat) || 0;
        const lng = item.lng || (item.clientData && item.clientData.lng) || 0;
        if (lat && lng) {
          const d = this.calculateDistance(current.lat, current.lng, lat, lng);
          if (d < minDistance) {
            minDistance = d;
            nearestIdx = i;
          }
        }
      }

      const next = unvisited.splice(nearestIdx, 1)[0];
      optimized.push(next);
      const nextLat = next.lat || (next.clientData && next.clientData.lat);
      const nextLng = next.lng || (next.clientData && next.clientData.lng);
      if (nextLat && nextLng) {
        current = { lat: nextLat, lng: nextLng };
      }
    }

    // Persistir nuevo orden
    await this.reorderDeliveries(optimized);
    return optimized;
  },

  async sortDeliveriesBySchedule(deliveries) {
    if (!deliveries || deliveries.length <= 1) return deliveries;
    const sorted = [...deliveries].sort((a, b) => {
      const getMinutes = (item) => {
        const t = (item.receiptTime || (item.clientData && item.clientData.receiptTime) || '').toLowerCase();
        if (!t) return 9999;
        const match = t.match(/(\d+)(?::(\d+))?\s*(am|pm)?/);
        if (!match) return 9999;
        let hours = parseInt(match[1], 10);
        const mins = match[2] ? parseInt(match[2], 10) : 0;
        const ampm = match[3];
        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
        return hours * 60 + mins;
      };
      return getMinutes(a) - getMinutes(b);
    });

    await this.reorderDeliveries(sorted);
    return sorted;
  },

  async sortDeliveriesByNeighborhood(deliveries) {
    if (!deliveries || deliveries.length <= 1) return deliveries;
    const sorted = [...deliveries].sort((a, b) => {
      const hoodA = (a.neighborhood || (a.clientData && a.clientData.neighborhood) || '').toLowerCase();
      const hoodB = (b.neighborhood || (b.clientData && b.clientData.neighborhood) || '').toLowerCase();
      return hoodA.localeCompare(hoodB);
    });

    await this.reorderDeliveries(sorted);
    return sorted;
  }
};

// Asignar alias global idéntico a FirebaseService para compatibilidad absoluta
window.FirebaseService = window.ApiService;
console.log('✅ ApiService (Netcup Node.js + MongoDB) inicializado como proveedor principal.');
