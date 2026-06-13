FROM node:20-alpine

# openssl: required by Prisma. python3/make/g++: build toolchain for the native
# `bcrypt` addon (no musl/Alpine prebuilt binaries — it compiles from source).
RUN apk add --no-cache openssl python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma/
RUN npx prisma generate

COPY src ./src/
# uploads/ poate să nu existe în dev — creem directorul gol
RUN mkdir -p uploads

EXPOSE 3000

CMD ["node", "src/index.js"]
