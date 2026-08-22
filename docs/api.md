# Referencia de la API

URL base local: `http://localhost:3000/api`.

Las rutas protegidas requieren:

```http
Authorization: Bearer <token>
```

Los errores utilizan estados HTTP apropiados y el formato general:

```json
{
  "success": false,
  "message": "Descripcion del error"
}
```

## Autenticacion

| Metodo | Ruta | Acceso | Descripcion |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Publico | Registra un usuario. |
| `POST` | `/auth/login` | Publico | Autentica y devuelve un JWT. |
| `GET` | `/auth/me` | Autenticado | Devuelve el usuario actual. |
| `POST` | `/auth/logout` | Autenticado | Confirma el cierre de sesion. |

## Usuarios

| Metodo | Ruta | Acceso | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/users` | Administrador | Lista usuarios; admite `role`. |
| `GET` | `/users/:id` | Propietario o administrador | Consulta un usuario. |
| `PUT` | `/users/:id` | Propietario o administrador | Actualiza perfil, clave o rol permitido. |
| `DELETE` | `/users/:id` | Administrador | Elimina un usuario sin relaciones. |
| `GET` | `/users/me/registrations` | Autenticado | Lista inscripciones propias. |
| `GET` | `/users/me/favorites` | Autenticado | Lista favoritos propios. |

## Actividades

| Metodo | Ruta | Acceso | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/events` | Publico | Lista y filtra actividades. |
| `GET` | `/events/:id` | Publico | Consulta una actividad. |
| `POST` | `/events` | Organizador o administrador | Crea una actividad. |
| `PUT` | `/events/:id` | Propietario o administrador | Actualiza una actividad. |
| `DELETE` | `/events/:id` | Propietario o administrador | Elimina una actividad sin inscripciones activas. |
| `GET` | `/events/:id/participants` | Propietario o administrador | Lista participantes con inscripcion confirmada. |

`GET /events` admite `search`, `category`, `date`, `location`, `available`,
`organizer` y `status` como parametros de consulta.

## Inscripciones y favoritos

| Metodo | Ruta | Acceso | Descripcion |
| --- | --- | --- | --- |
| `POST` | `/events/:id/register` | Autenticado | Confirma una inscripcion si existe cupo. |
| `DELETE` | `/events/:id/register` | Autenticado | Cancela una inscripcion. |
| `POST` | `/events/:id/favorite` | Autenticado | Agrega un favorito. |
| `DELETE` | `/events/:id/favorite` | Autenticado | Elimina un favorito. |

## Categorias

| Metodo | Ruta | Acceso | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/categories` | Publico | Lista categorias. |
| `POST` | `/categories` | Administrador | Crea una categoria. |
| `PUT` | `/categories/:id` | Administrador | Actualiza una categoria. |
| `DELETE` | `/categories/:id` | Administrador | Elimina una categoria sin actividades. |

## Notificaciones y dashboard

| Metodo | Ruta | Acceso | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/notifications` | Autenticado | Lista notificaciones propias. |
| `GET` | `/notifications/unread-count` | Autenticado | Cuenta notificaciones sin leer. |
| `PUT` | `/notifications/read-all` | Autenticado | Marca todas como leidas. |
| `PUT` | `/notifications/:id/read` | Autenticado | Marca una notificacion como leida. |
| `GET` | `/dashboard` | Autenticado | Devuelve el dashboard correspondiente al rol. |
