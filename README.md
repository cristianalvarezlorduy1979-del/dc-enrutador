# 🚚 Enrutador Pro (Nube Firebase & Multi-Empresa)

Aplicación web progresiva (PWA) e independiente desplegada en **Google Firebase**, con base de datos en tiempo real en **Cloud Firestore**. Permite administrar múltiples empresas independientes, organizar rutas de entrega del día y que los conductores abran rutas en **Google Maps** y confirmen entregas desde cualquier celular.

---

## 🌐 Enlaces Públicos en la Nube (24/7)

- 💻 **Panel de Logística & Multi-Empresas (PC / Tablet)**:  
  👉 **[https://enrutador-col.web.app](https://enrutador-col.web.app)**

- 📱 **App del Conductor (Celular Android / iOS)**:  
  👉 **[https://enrutador-col.web.app/conductor.html](https://enrutador-col.web.app/conductor.html)**

---

## 🏢 Arquitectura Multi-Empresa (Multi-Tenant)

Puedes crear y gestionar tantas empresas como necesites:
1. En la pestaña **"Mis Empresas"** (o en el selector superior) puedes hacer clic en **"+ Nueva Empresa"**.
2. Cada empresa cuenta con:
   - Su propia base de clientes.
   - Su propio equipo de conductores.
   - Sus propias rutas diarias y estadísticas de entrega.
3. El enlace de cada empresa genera un código QR específico para que los conductores de esa empresa abran su ruta directamente.

---

## 🗺️ Funcionalidades para el Conductor

- **Instalable en Android (PWA)**: Al abrir `https://enrutador-col.web.app/conductor.html` en Chrome, el conductor puede tocar los 3 puntos de Chrome y seleccionar *"Instalar aplicación"* para que quede con icono en su pantalla de inicio como cualquier app de la Play Store.
- **Ruta en Google Maps**: Al tocar el botón verde *"Abrir Ruta en Google Maps"*, el celular abre directamente la aplicación nativa de Google Maps con la mejor ruta en tiempo real.
- **Llamadas & WhatsApp**: Botones directos para comunicarse con el cliente.
- **Confirmación en Tiempo Real**: Al pulsar *"ENTREGADO"* o *"Reportar Novedad"*, el cambio se refleja en menos de un segundo en la pantalla del jefe de logística gracias a Cloud Firestore.
