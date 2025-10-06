# syntax=docker/dockerfile:1

FROM node:20-bullseye AS builder
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm install
COPY frontend ./frontend
RUN cd frontend && npm run build

FROM node:20-bullseye AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-tk python-is-python3 \
  && rm -rf /var/lib/apt/lists/*

COPY backend ./backend
RUN pip3 install --no-cache-dir -r backend/requirements.txt

COPY --from=builder /app/frontend/.next ./frontend/.next
COPY --from=builder /app/frontend/public ./frontend/public
COPY --from=builder /app/frontend/package.json ./frontend/package.json
COPY --from=builder /app/frontend/node_modules ./frontend/node_modules
COPY --from=builder /app/frontend/next.config.js ./frontend/next.config.js
COPY --from=builder /app/frontend/postcss.config.js ./frontend/postcss.config.js
COPY --from=builder /app/frontend/tailwind.config.ts ./frontend/tailwind.config.ts
COPY --from=builder /app/frontend/tsconfig.json ./frontend/tsconfig.json
COPY --from=builder /app/frontend/next-env.d.ts ./frontend/next-env.d.ts

RUN mkdir -p backend/tmp

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "run", "start", "--prefix", "frontend"]
