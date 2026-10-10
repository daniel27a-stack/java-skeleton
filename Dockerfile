FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY bin ./bin
COPY templates ./templates

# The project is generated in the working directory, mounted with -v
WORKDIR /work
ENTRYPOINT ["node", "/app/bin/cli.js"]
