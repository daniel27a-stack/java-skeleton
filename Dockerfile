FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY bin ./bin
COPY templates ./templates

# El proyecto se genera en el directorio de trabajo, que se monta con -v
WORKDIR /work
ENTRYPOINT ["node", "/app/bin/cli.js"]
