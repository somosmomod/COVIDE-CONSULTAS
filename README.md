# COVIDE · Consultas

App instalable (PWA) para consultar el Reglamento de Convivencia y el Estatuto de la cooperativa.
Funciona sin servidor: la búsqueda corre en el teléfono y anda sin internet. Las respuestas redactadas con IA son opcionales.

## 1. Publicar en GitHub Pages (gratis)
1. Creá un repositorio nuevo y subí todo el contenido de esta carpeta (menos `worker/` si querés).
2. En el repositorio: Settings → Pages → Source: "Deploy from a branch" → Branch: `main` / carpeta `/ (root)` → Save.
3. En 1 o 2 minutos queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`. Compartí ese enlace con los socios.
4. Para instalarla: en Android, el botón "Instalar" o menú del navegador → "Instalar app". En iPhone: Compartir → "Agregar a inicio".

Con esto ya funciona la búsqueda local. Si querés respuestas redactadas, seguí el paso 2.

## 2. Respuestas con IA (opcional, con un Worker de Cloudflare)
La clave de Anthropic nunca va en la página: la guarda el Worker.
1. Cuenta gratuita en Cloudflare → Workers & Pages → Create → Hello World → pegá el contenido de `worker/worker.js` → Deploy.
2. En el Worker: Settings → Variables and Secrets:
   - `ANTHROPIC_API_KEY` (tipo Secret): tu clave de console.anthropic.com. Poné un límite de gasto mensual allí.
   - `ACCESS_CODE`: un código para los socios (se pide una sola vez en cada teléfono).
   - `ALLOWED_ORIGIN`: `https://TU-USUARIO.github.io` (sin barra final ni ruta).
3. Copiá la URL del Worker (`https://....workers.dev`) y pegala en `config.js`: `AI_ENDPOINT: "https://..."`. Subí el cambio.

## 3. Actualizar los documentos
Los textos están en `data.json` (una entrada por artículo: `doc`, `num`, `title`, `text`). Editá, subí el cambio a GitHub y los socios ven la versión nueva al abrir la app.

Nota: los textos fueron resumidos a partir de escaneos. Conviene revisarlos contra el papel antes de difundir.
