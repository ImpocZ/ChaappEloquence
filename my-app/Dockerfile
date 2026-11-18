FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node server/ ./server/

USER node

EXPOSE 3001
CMD ["node", "server/server.js"]