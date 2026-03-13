#!/bin/bash
# Start backend
cd /app/backend
NODE_ENV=production \
JWT_SECRET="${JWT_SECRET:-vet-anesthesia-super-secret-key-change-in-production}" \
DB_PATH="${DB_PATH:-/data/vetanesthesia.db}" \
PORT=3001 \
CORS_ORIGINS="${CORS_ORIGINS:-*}" \
node server.js &

# Wait for backend to be ready
for i in $(seq 1 30); do
  wget -q --spider http://127.0.0.1:3001/health 2>/dev/null && break
  sleep 1
done

# Start nginx in foreground
nginx -g 'daemon off;'
