# Instalacion y configuracion

## Requisitos

- Node.js 22 o una version LTS compatible.
- npm.
- MongoDB Atlas o un replica set compatible con transacciones.
- El frontend de CommunityHub para probar la integracion completa.

## Instalacion

```bash
npm install
```

Copia `.env.example` como `.env`. El archivo `.env` contiene datos privados y
no debe agregarse a Git.

## Variables de entorno

| Variable | Proposito |
| --- | --- |
| `PORT` | Puerto HTTP del backend. |
| `FRONTEND_URLS` | Origenes CORS permitidos, separados por comas. |
| `EVENT_TIMEZONE_OFFSET` | Offset ISO 8601 usado para fecha y hora de actividades. |
| `MONGODB_URI` | Cadena de conexion a MongoDB. |
| `JWT_SECRET` | Secreto utilizado para firmar los JWT. |
| `JWT_EXPIRES_IN` | Duracion de los JWT, por ejemplo `7d`. |
| `AWS_REGION` | Region de la funcion Lambda. |
| `AWS_LAMBDA_CAPACITY_FUNCTION_NAME` | Nombre de la Lambda de capacidad. |

Las credenciales de AWS pueden configurarse mediante el proveedor de
credenciales estandar del AWS SDK. En produccion se recomienda utilizar un rol
IAM en lugar de claves almacenadas en archivos.

## Ejecucion

Desarrollo:

```bash
npm run dev
```

Ejecucion normal:

```bash
npm start
```

Para permitir varios frontends:

```env
FRONTEND_URLS=http://localhost:3001,https://communityhub.example.com
```
