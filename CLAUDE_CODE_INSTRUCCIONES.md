# ISP — Instrucciones para Claude Code

## Qué hacer con este proyecto

Tengo una aplicación web completa en un solo archivo HTML (`isp_v16_claude_code.html`) para el **Instituto Salvadoreño de Pensiones**, Unidad de Mantenimiento. Necesito que la conviertas en una aplicación web full-stack moderna.

El archivo HTML ya contiene **comentarios de migración detallados** en cada sección. Léelos antes de escribir cualquier código.

---

## Stack objetivo

```
framework:    Next.js 14 (App Router, TypeScript)
estilos:      Tailwind CSS (mantener los colores institucionales del HTML)
base datos:   PostgreSQL + Prisma ORM
auth:         NextAuth.js (email/password + Google OAuth)
storage:      Vercel Blob (fotos de evidencia)
realtime:     Pusher Channels
email:        Resend
deployment:   Vercel
```

---

## Colores institucionales ISP (obligatorios en Tailwind config)

```js
// tailwind.config.js
colors: {
  isp: {
    primary:    '#003F87',  // Azul ISP institucional
    'primary-lt': '#E8EFF8',
    gold:       '#C8A84B',  // Dorado ISP
    'gold-lt':  '#FBF5E6',
    mint:       '#1A7A4A',  // Verde institucional
    'mint-lt':  '#E6F4ED',
    coral:      '#D62828',  // Rojo errores/pendientes
    'coral-lt': '#FEE8E8',
    canvas:     '#F0F4F8',  // Fondo principal
  }
}
```

---

## Modelos de base de datos (Prisma Schema)

Crea exactamente estos modelos (documentados en el HTML):

- `Personal` — colaboradores con especialidades y color
- `Asignacion` — actividad asignada a un colaborador por fecha
- `Proyecto` — proyectos con historial de actividades
- `ActividadFrecuente` — chips de acceso rápido por área
- `DiaCerrado` — snapshot JSONB de cada jornada cerrada
- `User` — usuarios con roles: `supervisor | jefe | personal`
- `DiaPersonal` — estado diario de cada persona (libre/compensatorio/incapacitado)

---

## Rutas de la aplicación

```
/                    → Página de asignación (página principal)
/informe             → Informe del día con KPIs
/proyectos           → Lista de proyectos
/proyectos/[id]      → Detalle de proyecto con historial
/personal            → Lista de colaboradores
/personal/[id]       → Detalle con historial y resumen
/historial           → Días cerrados con filtros
/historial/[fecha]   → Detalle de un día específico
/actfreq             → Gestión de actividades frecuentes
/resumen             → Analítica general
/login               → Autenticación
/admin               → Solo rol 'jefe': gestión de usuarios
```

---

## API Routes necesarias

```
GET  /api/personal              lista con filtros
POST /api/personal              crear
PATCH /api/personal/[id]        editar
DELETE /api/personal/[id]       eliminar

GET  /api/asignaciones?fecha=   asignaciones del día
POST /api/asignaciones          crear una
POST /api/asignaciones/batch    crear múltiples (mismo proyecto/actividad)
PATCH /api/asignaciones/[id]    marcar cumplimiento + fotos
DELETE /api/asignaciones/[id]   eliminar

GET  /api/proyectos             lista con filtro estado
POST /api/proyectos             crear
PATCH /api/proyectos/[id]       editar
DELETE /api/proyectos/[id]      eliminar

GET  /api/actfreq               lista
POST /api/actfreq               crear
PATCH /api/actfreq/[id]         editar
DELETE /api/actfreq/[id]        eliminar

GET  /api/historial             paginado con filtros
POST /api/historial             cerrar día (upsert por fecha)
GET  /api/historial/[fecha]     día específico

POST /api/upload                subir foto → Vercel Blob → retorna URL

GET  /api/export/excel?fecha=   generar Excel del día
GET  /api/export/pdf?fecha=&type=planificacion|informe
GET  /api/export/word?fecha=

GET  /api/analytics/general     resumen histórico completo
GET  /api/analytics/colaborador/[pid]
GET  /api/analytics/proyecto/[id]

GET  /api/config/nota?fecha=    nota del día
PUT  /api/config/nota           guardar nota
```

---

## Funcionalidades críticas a mantener

Lee el HTML — tiene comentario `/* MIGRATION:` en cada función. Las más importantes:

### 1. Asignación individual y múltiple
- Modo `single`: seleccionar 1 persona → formulario → asignar
- Modo `multi`: seleccionar N personas → misma actividad → `POST /api/asignaciones/batch`
- Al asignar en modo multi: limpiar selección pero mantener el formulario activo

### 2. Marcar cumplimiento con fotos
- Modal con: hora fin, estado (completada/parcial/no completada), observaciones
- Fotos: `File → POST /api/upload → URL → guardar en Asignacion.fotos[]`
- Actualmente son base64 en memoria → migrar a Vercel Blob

### 3. Cerrar el día
- Guarda snapshot JSONB completo en `DiaCerrado`
- Después: enviar email a jefes via Resend
- Emit Pusher event `'dia-cerrado'` para sync multi-usuario

### 4. Resúmenes analíticos
Tres tipos: general, por colaborador, por proyecto.
Actualmente calculados en frontend sobre `historial[]`.
Migrar a queries SQL con agregaciones en `/api/analytics/*`.

### 5. Exportaciones
- Excel: usa SheetJS (XLSX) — puede quedar en frontend
- PDF: migrar a Puppeteer en servidor (`/api/export/pdf`)
- Word: migrar a `docx` library en servidor
- Vista previa antes de descargar: mantener la lógica de preview HTML

---

## Datos de seed

El archivo HTML contiene los 23 colaboradores reales con sus especialidades.
Búscalos en la variable `personal[]` del `<script>` y crea un archivo `prisma/seed.ts`.

---

## Roles y permisos

```typescript
// Middleware de autenticación
supervisor: puede asignar, marcar cumplimiento, cerrar día, exportar
jefe:       todo lo de supervisor + gestión de usuarios + analítica completa
personal:   solo ver su asignación del día + marcar cumplimiento propio
```

---

## Tiempo real (Pusher)

Eventos a emitir:
```
'asig-created'   → cuando se asigna (individual o batch)
'asig-updated'   → cuando se marca cumplimiento
'asig-deleted'   → cuando se quita asignación
'dia-cerrado'    → cuando se cierra el día
'nota-updated'   → cuando se edita la nota del día
```

Todos los supervisores suscritos al canal `'isp-dia-'+fecha` reciben actualizaciones en tiempo real.

---

## Tipografías (Google Fonts — mantener)

```html
DM Sans (400, 500, 600, 700, 800) — cuerpo
DM Serif Display (400, 400i) — títulos y KPIs
```

---

## Cómo empezar

```bash
# 1. Crear proyecto Next.js
npx create-next-app@latest isp-gestion --typescript --tailwind --app

# 2. Instalar dependencias
npm install @prisma/client prisma next-auth @auth/prisma-adapter
npm install @vercel/blob pusher pusher-js resend
npm install xlsx jspdf jspdf-autotable
npm install @tanstack/react-query zustand

# 3. Inicializar Prisma
npx prisma init

# 4. Copiar los modelos del HTML al schema.prisma

# 5. Crear las migraciones
npx prisma migrate dev --name init

# 6. Seed con los 23 colaboradores
npx prisma db seed

# 7. Implementar API routes primero, luego componentes
```

---

## Archivo de referencia

El archivo `isp_v16_claude_code.html` es la fuente de verdad.
Cada sección tiene comentarios `<!-- MIGRATION →` que explican exactamente
qué componente Next.js crear y cómo mapear los datos.

Lee el HTML completamente antes de escribir código.
