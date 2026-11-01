#!/usr/bin/env bash
set -Eeuo pipefail

# Despliegue inicial de LuxPopuli en Ubuntu, Debian o Linux Mint.
REPO_URL="https://github.com/StephanyHm95/lux-populi.git"
DEPLOY_DIR="${LUXPOPULI_DIR:-$HOME/LuxPopuli}"

say() { printf '\n[LuxPopuli] %s\n' "$*"; }
fail() { printf '\n[ERROR] %s\n' "$*" >&2; exit 1; }

if [[ $EUID -eq 0 ]]; then SUDO=(); else
  command -v sudo >/dev/null 2>&1 || fail "Necesito sudo para instalar paquetes y configurar Docker."
  SUDO=(sudo)
fi
command -v apt-get >/dev/null 2>&1 || fail "Este instalador está preparado para Ubuntu, Debian y Linux Mint."

say "Actualizando paquetes e instalando herramientas básicas..."
"${SUDO[@]}" apt-get update
"${SUDO[@]}" apt-get install -y ca-certificates curl git openssl

install_docker() {
  . /etc/os-release
  case "${ID:-}" in
    ubuntu) DOCKER_DISTRO=ubuntu; DOCKER_CODENAME="${VERSION_CODENAME:-}" ;;
    debian) DOCKER_DISTRO=debian; DOCKER_CODENAME="${VERSION_CODENAME:-}" ;;
    linuxmint) DOCKER_DISTRO=ubuntu; DOCKER_CODENAME="${UBUNTU_CODENAME:-}" ;;
    *)
      if [[ " ${ID_LIKE:-} " == *" ubuntu "* ]]; then
        DOCKER_DISTRO=ubuntu
        DOCKER_CODENAME="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
      else
        fail "Distribución no compatible automáticamente: ${PRETTY_NAME:-desconocida}."
      fi ;;
  esac
  [[ -n "$DOCKER_CODENAME" ]] || fail "No pude detectar la distribución base para instalar Docker."

  say "Añadiendo el repositorio oficial de Docker..."
  "${SUDO[@]}" install -m 0755 -d /etc/apt/keyrings
  "${SUDO[@]}" curl -fsSL "https://download.docker.com/linux/${DOCKER_DISTRO}/gpg" -o /etc/apt/keyrings/docker.asc
  "${SUDO[@]}" chmod a+r /etc/apt/keyrings/docker.asc
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' \
    "$(dpkg --print-architecture)" "$DOCKER_DISTRO" "$DOCKER_CODENAME" \
    | "${SUDO[@]}" tee /etc/apt/sources.list.d/docker.list >/dev/null

  say "Instalando Docker Engine y Docker Compose..."
  "${SUDO[@]}" apt-get update
  "${SUDO[@]}" apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  "${SUDO[@]}" systemctl enable --now docker
}

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  install_docker
else
  say "Docker y Docker Compose ya están instalados."
  "${SUDO[@]}" systemctl enable --now docker
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/compose.yaml" && -f "$SCRIPT_DIR/backend/server.js" && -f "$SCRIPT_DIR/database/luxpopuli.sql" ]]; then
  PROJECT_DIR="$SCRIPT_DIR"
else
  PROJECT_DIR="$DEPLOY_DIR"
  if [[ ! -d "$PROJECT_DIR/.git" ]]; then
    [[ ! -e "$PROJECT_DIR" ]] || fail "Ya existe $PROJECT_DIR pero no parece el repositorio. Muévelo o define LUXPOPULI_DIR con otra ruta."
    say "Descargando el repositorio desde GitHub en $PROJECT_DIR..."
    git clone "$REPO_URL" "$PROJECT_DIR"
  else
    [[ -f "$PROJECT_DIR/backend/server.js" && -f "$PROJECT_DIR/database/luxpopuli.sql" ]] || fail "El directorio $PROJECT_DIR no contiene la estructura esperada."
    say "Se usará el repositorio existente sin descargar actualizaciones."
  fi
fi

cd "$PROJECT_DIR"
[[ -f package.json && -f package-lock.json ]] || fail "Faltan package.json o package-lock.json en la raíz del proyecto."
[[ -f database/luxpopuli.sql ]] || fail "No se encuentra database/luxpopuli.sql."

if [[ ! -f .env ]]; then
  say "Creando .env con credenciales aleatorias..."
  umask 077
  cat > .env <<ENVEOF
DB_HOST=db
DB_PUERTO=3306
DB_USER=luxpopuli_app
DB_CONTRASENA=$(openssl rand -hex 24)
DB_NOMBRE=luxpopuli
SESION_SECRETO=$(openssl rand -hex 32)
PUERTO=3000
PUERTO_PUBLICO=3000
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 24)
ENVEOF
  chmod 600 .env
else
  say "Se conservará el .env existente."
fi

# Leer el puerto público configurado para mostrar la dirección correcta.
PUERTO_PUBLICO="$(sed -n 's/^PUERTO_PUBLICO=//p' .env | tail -n 1)"
PUERTO_PUBLICO="${PUERTO_PUBLICO:-3000}"

# Si el usuario no tiene acceso directo al socket de Docker, usar sudo.
if docker info >/dev/null 2>&1; then
  DOCKER=(docker)
else
  DOCKER=(sudo docker)
fi
"${DOCKER[@]}" compose up -d --build --wait --wait-timeout 300

say "Comprobando que la aplicación responde..."
for intento in {1..30}; do
  if curl --fail --silent --show-error \
      "http://127.0.0.1:${PUERTO_PUBLICO}/" \
      --output /dev/null 2>/dev/null; then
    break
  fi
  if [[ "$intento" -eq 30 ]]; then
    say "La aplicación no respondió. Estos son los registros:"
    "${DOCKER[@]}" compose ps -a
    "${DOCKER[@]}" compose logs --tail=100 app db
    fail "El despliegue no se ha completado correctamente."
  fi
  sleep 2
done

say "Estado de los servicios:"
"${DOCKER[@]}" compose ps

printf '\nDespliegue finalizado.\n'
printf 'En esta máquina: http://localhost:%s\n' "$PUERTO_PUBLICO"

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [[ -n "${LAN_IP:-}" ]]; then
  printf 'En la red local: http://%s:%s\n' "$LAN_IP" "$PUERTO_PUBLICO"
fi

printf 'Registros: cd "%s" && %s compose logs -f\n' \
  "$PROJECT_DIR" "$( [[ ${DOCKER[0]} == sudo ]] && printf 'sudo docker' || printf 'docker' )"
printf 'La base de datos persiste en el volumen Docker datos_mysql.\n'
