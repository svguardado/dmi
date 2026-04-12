# ISP — Agregar Plugin / Módulo Nuevo

TRIGGER when: user wants to add a new feature, module, tab, section, or "plugin"
to the ISP Gestión de Actividades HTML application; user says "add plugin",
"nuevo módulo", "nueva pestaña", "add feature", or describes new functionality
to add to `isp_final.html`.

---

## Lo que hace este skill

Guía el proceso de agregar un módulo nuevo ("plugin") a la aplicación
ISP de un solo archivo HTML, siguiendo exactamente los patrones existentes.

**Regla de Karpathy:** Leer primero, entender la estructura, luego escribir
código mínimo que encaje sin romper nada.

---

## Paso 1 — Leer antes de tocar

Antes de escribir una sola línea, leer estas secciones de `isp_final.html`:

1. **Navegación** — líneas con `.nt` y `showPg(...)` (cerca de línea 1132)
2. **Páginas existentes** — `<div class="pg" id="pg-...">` (desde línea 1172)
3. **`loadMemory()` y `saveMemory()`** — cómo funciona la persistencia (cerca de línea 3774)
4. **Una función `render*` completa** — por ejemplo `renderPersonal()` (línea 2217)

Esto toma 5 minutos y evita errores de integración.

---

## Paso 2 — Anatomía de un módulo ISP

Cada módulo tiene exactamente estas 5 piezas. Todas son necesarias.

### A. Constante localStorage (al inicio del `<script>`)

```js
const LS_MIPLUGIN = 'isp_miplugin_v1';
let miPluginData = []; // array en memoria
```

### B. Entrada en navegación (en el `<nav>` principal, junto a los otros `.nt`)

```html
<div class="nt" onclick="showPg('miplugin', this)">
  <span>🔌</span>
  <span class="nt-label">Mi Plugin</span>
</div>
```

### C. Contenedor de página (después del último `<div class="pg">`)

```html
<div class="pg" id="pg-miplugin">
  <div class="pg-inner">
    <!-- contenido del módulo -->
  </div>
</div>
```

### D. Función `render` (en la sección de JS, junto a las otras funciones render)

```js
function renderMiPlugin() {
  const container = document.getElementById('pg-miplugin');
  // construir HTML y hacer container.innerHTML = ...
}
```

### E. Persistencia en `loadMemory()` y `saveMemory()`

En `loadMemory()`, agregar:
```js
const mp = localStorage.getItem(LS_MIPLUGIN);
if (mp) { const loaded = JSON.parse(mp); if (loaded.length) miPluginData = loaded; }
```

En `saveMemory()`, agregar:
```js
localStorage.setItem(LS_MIPLUGIN, JSON.stringify(miPluginData));
```

---

## Paso 3 — Reglas de diseño ISP (no negociables)

### Colores — solo variables CSS, nunca hex directo

```css
var(--primary)      /* #003F87 — azul ISP */
var(--primary-lt)   /* #E8EFF8 — azul claro */
var(--gold)         /* #C8A84B — dorado ISP */
var(--gold-lt)      /* #FBF5E6 — dorado claro */
var(--mint)         /* #1A7A4A — verde */
var(--mint-lt)      /* #E6F4ED — verde claro */
var(--coral)        /* #D62828 — rojo errores */
var(--coral-lt)     /* #FEE8E8 — rojo claro */
var(--canvas)       /* #F0F4F8 — fondo principal */
var(--t1)           /* texto principal */
var(--t3)           /* texto secundario/labels */
```

### Tipografía

- Cuerpo: `font-family: 'DM Sans', sans-serif` (ya heredado)
- KPIs / números grandes: agregar `font-family: 'DM Serif Display', serif`

### Clases reutilizables (no reinventar)

```
.card          → contenedor con sombra y borde redondeado
.btn           → botón base
.btn-primary   → botón azul ISP
.btn-ghost     → botón contorno
.btn-danger    → botón rojo
.modal         → overlay de modal
.modal.on      → modal visible
.chip          → badge de contador
.toast         → notificación (usar función toast())
```

### Feedback al usuario — siempre usar `toast()`

```js
toast('Guardado correctamente');        // verde (ok)
toast('Error al guardar', 'err');       // rojo
toast('¡Atención!', 'warn');            // naranja
```

---

## Paso 4 — Patrones CRUD estándar

Para operaciones de agregar/editar/eliminar, seguir este patrón:

```js
// Variable de control del modal
let editMiPluginId = null;

function openMiPluginModal(id) {
  editMiPluginId = id || null;
  if (id) {
    const item = miPluginData.find(x => x.id === id);
    // poblar campos del form
    document.getElementById('mMiPlugin-title').textContent = 'Editar';
  } else {
    // limpiar campos
    document.getElementById('mMiPlugin-title').textContent = 'Nuevo';
  }
  document.getElementById('mMiPlugin').classList.add('on');
}

function closeMiPluginModal() {
  document.getElementById('mMiPlugin').classList.remove('on');
  editMiPluginId = null;
}

function saveMiPlugin() {
  const nombre = document.getElementById('mpNombre').value.trim();
  if (!nombre) { toast('El nombre es requerido', 'warn'); return; }

  if (editMiPluginId) {
    const item = miPluginData.find(x => x.id === editMiPluginId);
    item.nombre = nombre;
    toast('Actualizado');
  } else {
    miPluginData.push({ id: Date.now(), nombre });
    toast('Agregado');
  }
  saveMemory();
  closeMiPluginModal();
  renderMiPlugin();
}

function delMiPlugin(id) {
  const item = miPluginData.find(x => x.id === id);
  if (!confirm(`¿Eliminar "${item.nombre}"?`)) return;
  miPluginData = miPluginData.filter(x => x.id !== id);
  saveMemory();
  renderMiPlugin();
  toast('Eliminado', 'warn');
}
```

---

## Paso 5 — Llamar `render` al inicio

En la función `init()` (al final del script, donde se llama a `renderPool()`,
`renderPersonal()`, etc.), agregar:

```js
renderMiPlugin();
```

---

## Paso 6 — Checklist antes de terminar

Verificar cada punto antes de declarar el trabajo completo:

- [ ] La pestaña aparece en el nav y funciona `showPg('miplugin', this)`
- [ ] Los datos persisten al recargar la página (probar en DevTools)
- [ ] Los colores usan solo variables CSS (`var(--...)`)
- [ ] Las acciones muestran `toast()` de confirmación
- [ ] La vista funciona en móvil (la nav inferior muestra la pestaña)
- [ ] El modal de edición abre, guarda y cierra correctamente
- [ ] El botón Eliminar pide confirmación con `confirm()`
- [ ] `saveMemory()` se llama después de cada mutación

---

## Ejemplo completo mínimo — módulo "Proveedores"

Si el usuario pide un módulo nuevo sin más detalles, mostrar este ejemplo
como referencia de lo que se va a construir:

```
Módulo: Proveedores
- Lista de proveedores con nombre, teléfono, especialidad
- Agregar / Editar / Eliminar
- Pestaña nueva "🏪 Proveedores" en la navegación
- Datos en localStorage bajo clave 'isp_proveedores_v1'
```

Luego implementarlo siguiendo los 5 pasos anteriores.
