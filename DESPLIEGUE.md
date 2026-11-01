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

