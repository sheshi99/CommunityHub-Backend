# Contrato de Lambda: evento con cupo completo

El backend invoca de forma asincrona la funcion indicada por
`AWS_LAMBDA_CAPACITY_FUNCTION_NAME` cuando una inscripcion confirmada ocupa el
ultimo cupo de una actividad o cuando una cancelacion vuelve a liberar espacio.

## Payload recibido por la Lambda

```json
{
  "type": "EVENT_CAPACITY_REACHED",
  "eventId": "66c000000000000000000001",
  "organizerId": "66c000000000000000000000001",
  "eventTitle": "Asamblea comunal",
  "maxCapacity": 50,
  "occurredAt": "2026-08-16T18:00:00.000Z"
}
```

## Resultado esperado

La Lambda externa debe crear en la coleccion `notifications` un documento para
el organizador:

```json
{
  "user": "ObjectId(organizerId)",
  "event": "ObjectId(eventId)",
  "type": "EVENT_CAPACITY_REACHED",
  "message": "La actividad \"Asamblea comunal\" alcanzo su capacidad maxima de 50 participantes.",
  "read": false,
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

AWS puede reintentar una invocacion asincrona. La Lambda debe ser idempotente:
antes de insertar, debe comprobar que no exista otra notificacion con el mismo
`user`, `event` y `type`.

## Liberacion de un cupo

Si una actividad estaba llena y un participante cancela, el backend envia el
mismo payload con `type: "EVENT_CAPACITY_AVAILABLE"`. La Lambda debe eliminar
la notificacion `EVENT_CAPACITY_REACHED` correspondiente al organizador y al
evento. Esto permite crear una nueva notificacion si la actividad vuelve a
llenarse posteriormente.

## Configuracion del backend

```env
AWS_REGION=us-east-1
AWS_LAMBDA_CAPACITY_FUNCTION_NAME=communityhub-capacity-notification
```

Las credenciales no se guardan en `.env.example`. En AWS se debe otorgar
`lambda:InvokeFunction` al rol que ejecuta el backend; para desarrollo local se
utiliza la cadena de credenciales estandar del SDK de AWS.

Si no se define `AWS_LAMBDA_CAPACITY_FUNCTION_NAME`, las inscripciones siguen
funcionando y la invocacion se omite. Si AWS falla despues de confirmar una
inscripcion, el backend registra el error sin revertir el cupo del usuario.
