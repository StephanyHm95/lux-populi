FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /opt/luxpopuli

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY backend/ ./backend/
COPY frontend/pages/ ./backend/public/
COPY frontend/assets/ ./backend/public/assets/

EXPOSE 3000
CMD ["node", "backend/server.js"]
