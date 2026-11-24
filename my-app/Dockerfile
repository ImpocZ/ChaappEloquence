FROM node:24-bookworm-slim AS frontend-build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM node:24-bookworm-slim AS runtime

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node server/ ./server/
COPY --chown=node:node ChattingApp.sql ./database/00_initial.sql
COPY --chown=node:node migrations/ ./database/
COPY --from=frontend-build --chown=node:node /app/dist ./dist/

USER node

EXPOSE 3001
CMD ["node", "server/server.js"]