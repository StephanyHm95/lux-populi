# Despliegue de LuxPopuli

## Instalación automática

En Ubuntu, Debian o Linux Mint, desde la raíz del repositorio:

```bash
chmod +x despliegue.sh
./despliegue.sh
```

El script actualiza los paquetes, instala Docker y Docker Compose si hacen falta, crea `.env` solo si no existe, construye la imagen de la aplicación y levanta los servicios con Docker Compose.

Si se ejecuta desde la raíz del repositorio, utiliza esa copia. Si se ejecuta como copia independiente, descarga el repositorio de GitHub en `\\\~/LuxPopuli`. Si esa carpeta ya contiene el repositorio, la reutiliza sin descargar actualizaciones.

## Dirección

Por defecto, la aplicación se publica en el puerto 3000:

* En la máquina del despliegue: `http://localhost:3000`
* En la red local: `http://IP-DE-LA-MAQUINA:3000`

Puedes cambiar el puerto publicado en el equipo anfitrión modificando `PUERTO\\\_PUBLICO` en `.env`.

## Base de datos y secretos

* `.env` contiene secretos y no debe subirse a GitHub.
* `.env.example` es una plantilla sin credenciales reales.
* `database/luxpopuli.sql` se importa automáticamente cuando MySQL inicializa un volumen vacío.
* En arranques posteriores, MySQL conserva los datos y no vuelve a importar el SQL.
* No ejecutes `docker compose down -v` si quieres conservar la base de datos.

## Comandos útiles

```bash
docker compose ps
docker compose logs -f
docker compose stop
docker compose start
```

En algunos equipos puede ser necesario anteponer `sudo` a los comandos Docker.


## Servicios incluidos

El despliegue utiliza tres contenedores:

- app: servidor Node.js, Express y frontend Vue.
- db: base de datos MySQL 8.
- ia: servicio FastAPI del chatbot documental.

El chatbot funciona con respuestas predefinidas y fichas documentales.
Actualmente no ejecuta un modelo de lenguaje generativo.

## Integración del chatbot

La interfaz utiliza POST /api/chat.

El archivo integraciones/chat.js se incorpora durante la construcción
de la imagen Docker, sin modificar los archivos originales del backend
ni del frontend.

El servicio IA se comunica internamente con Node.js.
Su puerto 8000 no se publica al exterior.

## Instalación independiente de evaluación

Para ejecutar otra instancia sin compartir contenedores ni datos:

    COMPOSE_PROJECT_NAME=luxpopuli-evaluacion bash despliegue.sh

El puerto público se configura en .env mediante PUERTO_PUBLICO.
Si ya existe un despliegue en el puerto 3000, debe elegirse otro.
