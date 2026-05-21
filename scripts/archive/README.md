# Scripts archivados

Scripts one-shot ya ejecutados en su momento. Se conservan como referencia histórica de migraciones / cambios de infraestructura. **No correr en producción**.

| Script | Propósito original |
|--------|--------------------|
| `migrate-from-neon.ts` | Migración inicial de datos desde Neon Postgres a Railway. |
| `migrate-images-to-cloudinary.ts` | Subida de imágenes de Vercel Blob a Cloudinary durante la migración de proveedor. |
| `upload-seed-images.ts` | Carga inicial de imágenes del seed en Cloudinary (one-shot). |
| `update-n8n-workflow.ts`, `update-n8n-openrouter.ts`, `update-n8n-dynamic-context.ts` | Actualizadores puntuales del workflow de n8n. |
| `verify-migration.ts` | Validación post-migración de paridad de datos. |

Si necesitas re-ejecutar alguno, revisa primero las variables de entorno requeridas y considera adaptar el código antes de correr.
