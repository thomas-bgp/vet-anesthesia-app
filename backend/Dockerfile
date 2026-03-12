FROM node:20-slim

RUN apt-get update && apt-get install -y python3 make g++ wget --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /data

EXPOSE 3001

CMD ["node", "server.js"]
