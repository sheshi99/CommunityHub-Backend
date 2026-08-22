# CommunityHub Backend

API REST de CommunityHub para autenticacion, usuarios, actividades,
inscripciones, favoritos, categorias, notificaciones y dashboards por rol.
El servicio utiliza Express.js, MongoDB y JWT, y se integra de forma asincrona
con una funcion AWS Lambda cuando una actividad alcanza su capacidad maxima.

## Tecnologias

Node.js, Express.js, MongoDB, Mongoose, JWT, bcryptjs y AWS SDK.

## Inicio rapido

```bash
git clone https://github.com/walbyn504/CommunityHub-Backend.git
cd CommunityHub-Backend
npm install
```

Crea `.env` a partir de `.env.example` y configura como minimo:

```env
PORT=3000
FRONTEND_URLS=http://localhost:3001
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
JWT_EXPIRES_IN=7d
```

Inicia el servidor:

```bash
npm run dev
```

La API estara disponible en `http://localhost:3000/api`.

## Comandos

| Comando | Descripcion |
| --- | --- |
| `npm run dev` | Inicia el servidor con recarga automatica. |
| `npm start` | Inicia el servidor con Node.js. |
| `npm run seed:categories` | Crea categorias iniciales. |
| `npm run seed:dashboard` | Genera datos de demostracion para dashboards. |

## Documentacion

- [Indice de documentacion](docs/README.md)
- [Instalacion y configuracion](docs/instalacion.md)
- [Arquitectura](docs/arquitectura.md)
- [Referencia de la API](docs/api.md)
- [Contrato con Lambda](docs/LAMBDA_CAPACITY_CONTRACT.md)

## Licencia

Distribuido bajo la [licencia MIT](LICENSE).
