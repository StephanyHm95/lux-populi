FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /opt/luxpopuli

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY backend/ ./backend/
# Conserva pages/ y assets/ en la ruta frontend que sirve backend/server.js.
COPY frontend/ ./frontend/

# Sustituye la ruta vacía del chatbot únicamente dentro de la imagen.
COPY integraciones/chat.js ./backend/rutas/chat.js

EXPOSE 3000
CMD ["node", "backend/server.js"]
