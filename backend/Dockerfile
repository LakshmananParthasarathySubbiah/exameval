# ExamEval backend (API + bundled BullMQ worker).
# Debian slim (not alpine) so bcrypt + prisma engines work without musl pain.
FROM node:20-slim

WORKDIR /app

# Prisma needs openssl at runtime; ca-certificates for outbound TLS (Groq/Cloudinary).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install deps first for layer caching. Keep dev deps: the prisma CLI is needed
# at container start for `prisma migrate deploy`.
COPY package*.json ./
RUN npm ci

# App source + generated Prisma client.
COPY . .
RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 5000

# Apply pending migrations, then start. (Compose overrides this if needed.)
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
