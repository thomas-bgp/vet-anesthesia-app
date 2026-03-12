# Stage 1: Build
FROM node:20-alpine AS builder

# libc6-compat needed for Tailwind CSS v4 native bindings (Rust/musl)
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json ./
RUN npm install --prefer-offline 2>&1

# Copy source files and build
COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy build output from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
