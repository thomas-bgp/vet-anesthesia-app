# Stage 1: Build frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ .
RUN npm run build

# Stage 2: Build backend + serve everything
FROM node:20-slim
RUN apt-get update && apt-get install -y python3 make g++ wget nginx --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Backend
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install --omit=dev
COPY backend/ .
RUN mkdir -p /data

# Frontend static files
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/sites-enabled/default

# Startup script
COPY deploy/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80

CMD ["/start.sh"]
