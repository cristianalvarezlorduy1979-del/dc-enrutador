#!/bin/bash
# ==============================================================================
# SCRIPT DE INSTALACIÓN Y CONFIGURACIÓN AUTOMÁTICA EN NETCUP VPS (UBUNTU / DEBIAN)
# Proyecto: DC Enrutador (Node.js + MongoDB + WebSockets + Nginx)
# ==============================================================================

set -e

echo "=========================================================="
echo "🚀 Iniciando instalación de DC Enrutador en Netcup VPS"
echo "=========================================================="

# 1. Actualizar sistema
echo "[1/6] Actualizando paquetes del sistema..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw nginx certbot python3-certbot-nginx

# 2. Instalar Docker y Docker Compose
echo "[2/6] Verificando e instalando Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "Docker instalado exitosamente."
else
    echo "Docker ya se encuentra instalado."
fi

# Instalar docker compose plugin si no existe
sudo apt install -y docker-compose-plugin

# 3. Configurar Firewall (UFW)
echo "[3/6] Configurando Firewall UFW (SSH, HTTP, HTTPS)..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# 4. Configurar Nginx Reverse Proxy
echo "[4/6] Configurando Nginx..."
sudo cp deploy/nginx.conf /etc/nginx/sites-available/enrutador
sudo ln -sf /etc/nginx/sites-available/enrutador /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# 5. Iniciar contenedores Docker (MongoDB + Node Server)
echo "[5/6] Levantando contenedores con Docker Compose..."
docker compose build --no-cache
docker compose up -d

# 6. Sembrar / Migrar datos exportados a MongoDB
echo "[6/6] Migrando datos históricos de Firebase a MongoDB..."
sleep 5
docker compose exec app node seed.js

echo "=========================================================="
echo "✅ ¡INSTALACIÓN COMPLETADA EXITOSAMENTE EN NETCUP!"
echo "🌐 Abre en tu navegador la IP de tu servidor Netcup o tu dominio."
echo "🔒 Para habilitar SSL gratuito con Let's Encrypt ejecuta:"
echo "   sudo certbot --nginx -d tu-dominio.com"
echo "=========================================================="
