FROM node:20-alpine

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files first for better layer caching
COPY package.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .

# Create data directory for SQLite database
RUN mkdir -p /data

EXPOSE 3001

CMD ["node", "server.js"]
