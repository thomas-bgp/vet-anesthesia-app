FROM node:20-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
RUN npm ci --only=production

# Copy application source
COPY . .

# Create data directory for SQLite database
RUN mkdir -p /data

EXPOSE 3001

CMD ["node", "server.js"]
