FROM node:20-alpine

WORKDIR /app

# Copiar dependencias del servidor
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --production

WORKDIR /app

# Copiar código del servidor y archivos estáticos
COPY server/ ./server/
COPY public/ ./public/
COPY migration-data/ ./migration-data/

WORKDIR /app/server

EXPOSE 3000

CMD ["node", "index.js"]
