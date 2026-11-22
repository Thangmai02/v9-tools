FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL="file:/app/data/app.db"

RUN mkdir -p /app/data/uploads

EXPOSE 3000

CMD ["node", "scripts/start-online.mjs"]
