# 🚀 Despliegue en Netcup VPS usando Coolify
**Dominio Configurado:** `https://enrutador.dcasesoriaslatam.com`  
**IP del Servidor Netcup:** `159.195.210.174`  
**Panel Coolify:** `http://159.195.210.174:8000`

---

## ✨ Ventajas de Coolify en tu Netcup
Detectamos que tu servidor Netcup ya tiene **Coolify** y Traefik instalados y funcionando. Esto simplifica el proceso:
* **SSL Automático:** Coolify genera y renueva los certificados HTTPS de Let's Encrypt con un clic.
* **WebSockets Nativos:** Traefik maneja las conexiones en tiempo real de Socket.io sin configuraciones manuales complejas.
* **Auto-Seed de Datos:** Al iniciar, el contenedor detecta que MongoDB está vacío e **importa automáticamente tus 8 empresas, 12 clientes, 2 conductores y 13 pedidos** desde `migration-data/`.

---

## 📋 Pasos para Desplegar en Coolify (Menos de 3 minutos)

### Método A: Usando Docker Compose en Coolify (Recomendado)

1. **Ingresa a tu panel de Coolify:**
   Abre en tu navegador:
   👉 **http://159.195.210.174:8000** (o el dominio asignado a tu panel de Coolify).

2. **Crear el recurso:**
   * Haz clic en **Projects** -> Selecciona tu proyecto (o crea uno nuevo llamado `DC Logistica`).
   * Haz clic en **+ New Resource** -> Selecciona **Docker Compose**.

3. **Pegar la configuración de Docker Compose:**
   Pega el siguiente contenido:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    restart: always
    environment:
      MONGO_INITDB_DATABASE: enrutador
    volumes:
      - mongo_data:/data/db

  app:
    build:
      context: https://github.com/TU_USUARIO/TU_REPOSITORIO.git#main
      dockerfile: server/Dockerfile
    restart: always
    depends_on:
      - mongodb
    environment:
      PORT: 3000
      MONGODB_URI: mongodb://mongodb:27017/enrutador
      DB_NAME: enrutador
      MASTER_EMAIL: dcasesorias@gmail.com
      DEFAULT_MASTER_PASS: admin12345
      NODE_ENV: production
    expose:
      - "3000"

volumes:
  mongo_data:
```
*(Si prefieres subir los archivos directamente al servidor por SSH/Git, también puedes vincularlo como repositorio Git).*

4. **Asignar el Dominio:**
   * En el campo **Domains (FQDN)** del servicio `app`, ingresa:
     `https://enrutador.dcasesoriaslatam.com`

5. **Hacer clic en "Deploy":**
   Coolify compilará la imagen, levantará MongoDB y el servidor Node.js, configurará el certificado SSL y dejará tu plataforma activa.

---

### Método B: Despliegue Directo por Terminal SSH (Línea de Comandos)

Si prefieres desplegarlo directamente por consola SSH en tu servidor:

1. **Conéctate por SSH:**
   ```bash
   ssh root@159.195.210.174
   ```

2. **Crea el directorio del proyecto:**
   ```bash
   mkdir -p /var/www/enrutador
   cd /var/www/enrutador
   ```

3. **Sube los archivos y ejecuta:**
   ```bash
   docker compose up -d --build
   ```

4. Los contenedores quedarán corriendo y tus datos se importarán automáticamente en el primer inicio.
