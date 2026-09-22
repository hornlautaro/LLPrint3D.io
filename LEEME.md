# LL Print 3D — Sitio web

Página de ventas con catálogo, pedidos personalizados y panel de administración.
Es un sitio estático: se publica gratis en **GitHub Pages** y no necesita servidor.

## Archivos
| Archivo | Para qué sirve |
|---|---|
| `index.html` | La página principal |
| `admin.html` | Panel de administración (cargar / editar / borrar productos) |
| `data/productos.json` | **La base de datos de productos** (la escribe el panel) |
| `img/productos/` | Fotos de los productos (las sube el panel) |
| `js/config.js` | WhatsApp, email para pedidos, Instagram, repositorio |

---

## 1. Subir la página a GitHub (una sola vez)

1. Creá una cuenta en **github.com** (si no tenés).
2. Arriba a la derecha: **+ → New repository**.
   - Repository name: por ejemplo `ll-print-3d`
   - Tiene que ser **Public** (GitHub Pages gratis funciona con repositorios públicos).
   - Tocá **Create repository**.
3. En el repositorio nuevo: **uploading an existing file** (o *Add file → Upload files*).
   Arrastrá **todo el contenido** de la carpeta `LL-Print-3D` (los archivos y las carpetas `css`, `data`, `img`, `js`) y tocá **Commit changes**.
4. Andá a **Settings → Pages**:
   - Source: **Deploy from a branch**
   - Branch: **main** y carpeta **/ (root)** → **Save**.
5. Esperá 1–2 minutos. La página queda en:
   `https://TU-USUARIO.github.io/ll-print-3d/`

## 2. Crear tu clave de acceso para el panel (una sola vez)

El panel usa una “clave de acceso” de GitHub (token) que **solo vos** tenés. Sin esa clave nadie puede modificar nada.

1. Entrá a <https://github.com/settings/personal-access-tokens/new>
2. **Token name:** `Admin LL Print 3D`
3. **Expiration:** elegí una fecha (por ejemplo 1 año). Cuando venza, creás otra igual.
4. **Repository access:** *Only select repositories* → elegí `ll-print-3d`.
5. **Permissions → Repository permissions → Contents:** **Read and write**.
6. **Generate token** y copiá la clave (empieza con `github_pat_…`).
   GitHub la muestra **una sola vez**: guardala en un lugar seguro (por ejemplo, en las notas del celular o en tu gestor de contraseñas).

## 3. Entrar al panel

1. Abrí `https://TU-USUARIO.github.io/ll-print-3d/admin.html`
   (guardalo en favoritos; no hay link visible en la página para que los clientes no lo vean).
2. Pegá la clave y tocá **Entrar**. Con “Recordarme en este dispositivo” no te la vuelve a pedir.
3. Desde ahí podés:
   - **+ Nuevo producto:** nombre, categoría, precio (0 = “Consultar”), descripción, medidas, material, disponibilidad y hasta 8 fotos (se achican y optimizan solas).
   - **Editar**, **Ocultar/Mostrar** (lo saca de la página sin borrarlo) y **Borrar** (también borra sus fotos).
   - Cambiar el **orden** con ▲ ▼ y tocar **Guardar orden**.
4. Cada vez que guardás, los cambios quedan en GitHub y la página se actualiza sola en **1–2 minutos**.
   El panel te avisa cuando ya están visibles.

Funciona también desde el celular (podés sacar la foto y subirla directo).

## 4. Pedidos personalizados por email

Los pedidos del formulario llegan a **leoagustin.2005@gmail.com** (con la imagen adjunta) y además se abre WhatsApp con el pedido.

- La **primera vez** que alguien envíe el formulario (hacé vos una prueba apenas publiques la página), FormSubmit manda un mail de **activación** a ese correo: abrilo y confirmá. Revisá también la carpeta de spam.
- Después de activarlo, FormSubmit te da un código (tipo `a1b2c3d4e5...`). Si lo ponés en `js/config.js` en lugar del email, tu correo deja de verse en el código de la página.

## Cambiar teléfono, email o Instagram
Editá `js/config.js` directamente en GitHub (abrís el archivo → ícono del lápiz → cambiás → *Commit changes*).

## Si algo sale mal
- **“La clave no es válida o ya venció”** → generá una nueva (paso 2) y volvé a entrar.
- **“La clave no tiene permiso…”** → en la clave, revisá que esté elegido el repositorio y que *Contents* diga *Read and write*.
- **Me equivoqué y borré algo** → en GitHub, cada cambio queda guardado en el historial (*commits*); se puede volver atrás.
- **Ver la página en la compu sin publicarla**: abrir `index.html` con doble click no carga el catálogo (el navegador bloquea leer `productos.json`); hay que verla desde GitHub Pages o con un servidor local (`python -m http.server` dentro de la carpeta y abrir `http://localhost:8000`).
