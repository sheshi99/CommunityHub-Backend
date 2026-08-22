# Arquitectura

El backend expone una API REST con Express.js y persiste la informacion en
MongoDB mediante Mongoose. El frontend nunca accede directamente a la base de
datos.

## Estructura

| Directorio | Responsabilidad |
| --- | --- |
| `src/config` | Conexion y configuracion de infraestructura. |
| `src/controllers` | Reglas de negocio y respuestas HTTP. |
| `src/middleware` | Autenticacion JWT y autorizacion por roles. |
| `src/models` | Esquemas e indices de MongoDB. |
| `src/routes` | Definicion de endpoints REST. |
| `src/services` | Integraciones externas, incluida AWS Lambda. |
| `src/utils` | Validaciones y funciones compartidas. |
| `scripts` | Seeders para preparar datos iniciales y de demostracion. |

## Autenticacion y autorizacion

El cliente envia `Authorization: Bearer <token>`. El middleware verifica la
firma del JWT y consulta el rol vigente del usuario en MongoDB. Las rutas usan
`authorize` para limitar operaciones a `ADMIN`, `ORGANIZER` o `USER`, mientras
que los controladores verifican propiedad cuando corresponde.

## Integridad de actividades

Las reservas de cupos se ejecutan mediante transacciones y serializan cambios
sobre cada actividad para impedir sobrecupos concurrentes. Una actividad con
inscripciones confirmadas no puede eliminarse. Si solo conserva inscripciones
canceladas, estas y los favoritos se limpian antes de eliminarla; las
notificaciones se conservan sin referencia a la actividad.

## Integracion serverless

Cuando se ocupa el ultimo cupo, el servicio invoca asincronamente una Lambda.
La inscripcion no se revierte si AWS falla, porque la operacion principal ya
fue confirmada. El contrato del evento esta en
[LAMBDA_CAPACITY_CONTRACT.md](LAMBDA_CAPACITY_CONTRACT.md).
