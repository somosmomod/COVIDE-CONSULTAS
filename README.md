# COVIDE · Consultas

App instalable (PWA) para consultar el Reglamento de Convivencia, el Estatuto y las actas de la cooperativa.

## 1. Publicar en GitHub Pages
1. Subí el contenido de esta carpeta (con `icons/`) a un repositorio público.
2. Settings → Pages → Deploy from a branch → `main` / root → Save.
3. Queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.
Sin más pasos ya funciona la búsqueda por palabras (sin IA).

## 2. Activar la IA que interpreta y cita (Worker de Cloudflare)
La IA lee la consulta, interpreta los documentos y responde con citas. La clave queda guardada en el Worker, nunca en la página.
1. Cloudflare (cuenta gratis) → Workers & Pages → Create → Worker → pegá `worker/worker.js` → Deploy.
2. Workers & Pages → KV → Create namespace (ej. `covide-docs`). En el Worker: Settings → Bindings → Add → KV namespace → nombre de variable: `DOCS`.
3. En el Worker: Settings → Variables and Secrets:
   - `ANTHROPIC_API_KEY` (Secret): tu clave de console.anthropic.com (poné un tope mensual de gasto allí).
   - `ACCESS_CODE`: código para los socios (se pide una vez por teléfono).
   - `ADMIN_CODE`: código distinto, solo para quienes cargan documentos.
   - `ALLOWED_ORIGIN`: `https://TU-USUARIO.github.io`
   - `SITE_URL`: `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO`
4. Pegá la URL del Worker (`https://....workers.dev`) en `config.js` → `AI_ENDPOINT`. Subí el cambio a GitHub.

## 3. Agregar actas y otros documentos
En la app: Documentos → Actas y más → "+ Agregar documento". Pedirá el código de administración. Subí el PDF o fotos de las hojas, tocá "Leer con IA", revisá el texto y publicá. Todos los socios los ven al instante y la IA los usa en sus respuestas. Eliminar también se hace ahí.

## 4. Actualizaciones
- Reglamento y Estatuto: editá `data.json` en GitHub. La app y la IA toman el cambio solos (la IA puede tardar unos 5 minutos).
- Cambios de la app: al subirlos, los teléfonos se actualizan solos al abrirla.

## Si no te deja instalar
- Abrilo en Chrome o Safari (no desde WhatsApp/Facebook/Instagram).
- Verificá que estén `manifest.webmanifest`, `sw.js` y la carpeta `icons/`.
- iPhone: Compartir → "Agregar a inicio". Android: ⋮ → "Instalar app".
