# 🚀 Guía de Despliegue y Migración a Netcup VPS (100% Independiente de Firebase)

Esta guía te permite migrar el sistema **DC Enrutador** desde Firebase hacia tu nuevo servidor **VPS en Netcup**, reemplazando Firebase Hosting y Firestore por:
* **Frontend Web & PWA:** Servido directamente desde tu VPS con Nginx y compresión HTTP/2.
* **Backend API REST:** Node.js + Express con manejo optimizado de rutas, pedidos, empresas y turnos.
* **Base de Datos:** MongoDB Community 7.0 (datos exportados y listos para importar).
* **Tiempo Real (Monitoreo en Vivo):** WebSockets con **Socket.io** (reemplazo de `onSnapshot` de Firestore).
* **Certificado SSL:** HTTPS Gratuito y automático con Let's Encrypt (Certbot).

---

## 📦 Contenido Preparado en este Proyecto
1. **`migration-data/`**: Copia de seguridad 100% exacta de tus colecciones en Firestore (`companies.json`, `clients.json`, `drivers.json`, `deliveries.json`, `driverShifts.json`, `settings.json`).
2. **`server/`**: Código completo del servidor Node.js + WebSockets + MongoDB (`index.js`, `db.js`, `seed.js`).
3. **`public/api-service.js`**: Cliente web que conecta la interfaz con tu servidor de Netcup sin depender de Firebase.
4. **`docker-compose.yml`**: Configuración para iniciar MongoDB y la aplicación con un solo comando.
5. **`deploy/setup-netcup.sh`**: Script automatizado que instala y configura todo en Ubuntu.
6. **`deploy/nginx.conf`**: Configuración de Nginx como proxy inverso y soporte de WebSockets.

---

## 🛠️ Pasos de Instalación en tu Servidor Netcup

### Paso 1: Conectarte por SSH a tu VPS de Netcup
Abre una terminal (PowerShell, CMD o Git Bash) en tu computador y conéctate con la IP y contraseña que te dio Netcup:
```bash
ssh root@TU_IP_DE_NETCUP
```

---

### Paso 2: Subir los Archivos al Servidor
Puedes subir la carpeta del proyecto a tu servidor mediante **SCP** (desde tu computador):
```bash
# Ejecutar desde tu computador en d:\Proyectos\Enrutador:
scp -r * root@TU_IP_DE_NETCUP:/var/www/enrutador/
```
*(O si prefieres, puedes comprimir en zip y subirlo por SFTP / FileZilla a `/var/www/enrutador`).*

---

### Paso 3: Ejecutar el Instalador Automático
Una vez dentro de tu servidor Netcup por SSH:
```bash
cd /var/www/enrutador

# Dar permisos de ejecución al script instalador
chmod +x deploy/setup-netcup.sh

# Ejecutar la instalación completa
./deploy/setup-netcup.sh
```

El script se encargará automáticamente de:
1. Actualizar Ubuntu.
2. Instalar Docker, Docker Compose, Nginx y Certbot.
3. Habilitar el Firewall UFW (puertos 22, 80 y 443).
4. Levantar los contenedores de **MongoDB** y el **Servidor Node.js**.
5. **Migrar todos tus datos** (empresas, clientes, conductores, pedidos e historial) a MongoDB.
6. Configurar Nginx para que responda en el puerto 80 (HTTP).

---

### Paso 4: Configurar tu Dominio y Certificado SSL (HTTPS)
Si tienes un dominio (por ejemplo `enrutador.tudominio.com` o `logistica.dcasesorias.com`):

1. En tu panel de DNS (Cloudflare, GoDaddy, Namecheap, etc.), crea un registro **Tipo A**:
   * **Nombre:** `enrutador` (o `@` si es el dominio principal)
   * **Valor:** `TU_IP_DE_NETCUP`

2. En el servidor Netcup, edita `/etc/nginx/sites-available/enrutador`:
   ```bash
   sudo nano /etc/nginx/sites-available/enrutador
   ```
   Cambia `server_name _;` por tu dominio:
   ```nginx
   server_name enrutador.tudominio.com;
   ```
   Guarda con `Ctrl + O`, presiona `Enter` y sal con `Ctrl + X`.

3. Recarga Nginx y genera el certificado SSL gratis con Certbot:
   ```bash
   sudo systemctl reload nginx
   sudo certbot --nginx -d enrutador.tudominio.com
   ```
   Certbot configurará automáticamente la renovación periódica y el candado verde HTTPS.

---

## 🔍 Comandos Útiles de Mantenimiento en Netcup

* **Ver estado de los contenedores:**
  ```bash
  docker compose ps
  ```
* **Ver logs del servidor en tiempo real:**
  ```bash
  docker compose logs -f app
  ```
* **Reiniciar el servicio:**
  ```bash
  docker compose restart
  ```
* **Re-ejecutar importación de datos si fuera necesario:**
  ```bash
  docker compose exec app node seed.js
  ```
* **Crear un respaldo manual de MongoDB:**
  ```bash
  docker compose exec mongodb mongodump --db enrutador --out /data/db/backup_$(date +%Y%m%d)
  ```
