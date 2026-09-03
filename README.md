# routines

Registro de rutinas diarias. Una acción a la vez, un tap por acción.

Qué resuelve (de `docs/idea.md`):

- Dejar de decidir cuál es el siguiente paso: la app siempre propone la acción
  que toca.
- Compartir el cumplimiento con el psicólogo sin escribirlo a mano cada día: la
  lectura es pública, basta con enviar la URL.
- Medir: cuánto tarda cada acción, y cuánto se desvía cada Round de su plan.
- Hacer una sola cosa a la vez: la pantalla de registro tiene un solo botón
  grande.

## Conceptos

| Entidad | Qué es |
| --- | --- |
| **Routine** | Un propósito ("Mañanas"). Agrupa todos los planes que ha tenido. |
| **Plan** | Cómo era esa rutina en un periodo: hora de inicio y lista ordenada de acciones con su duración. Dos planes de una misma rutina nunca se solapan. |
| **PlannedAction** | Una acción de la rutina ("Ducha"). Su id es lo que une un Round de marzo con uno de octubre en los gráficos. |
| **Round** | Lo registrado un día concreto para una rutina. Como mucho uno por rutina y día, así que la fecha decide el plan. Tiene principio y fin explícitos: se abre con «Empezar» y se cierra con «Terminar el Round», y hasta que se cierra sigue en curso. |
| **PerformedAction** | Un paso registrado. Solo guarda **cuándo terminó**: las duraciones se derivan encadenando esos instantes desde el inicio del Round. |

## Stack

- **Frontend:** React + Vite + shadcn/ui (registro `base`) + Recharts, en `src/`.
- **Backend:** cuatro funciones serverless de Vercel en `api/`.
- **Base de datos:** Postgres en Supabase, esquema en `db/schema/` (Drizzle).
- **Auth:** Supabase Auth, un solo usuario, sin registro público. Los `GET` no
  requieren sesión; todo lo demás sí.
- **Fechas y horas:** [Temporal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal),
  vía `temporal-polyfill`. `src/lib/temporal.ts` es el único sitio que lo
  importa, y Biome marca como error cualquier uso del global `Date` dentro de
  `src/`.

Todo el cálculo temporal vive en `src/lib/schedule.ts`, sin React y sin fetch,
con tests que lo comprueban contra las tablas de `docs/idea.md`.

## Puesta en marcha

1. **Crear el proyecto en Supabase** (supabase.com/dashboard). Anota la URL, la
   `anon key` y la `service_role key` (Project Settings → API), y la connection
   string del **pooler** (Project Settings → Database).

   Usa el pooler para las dos variables, cambiando solo el puerto: `6543` para
   `DATABASE_URL` (modo *transaction*, lo que usa la app) y `5432` para
   `DIRECT_URL` (modo *session*, lo que necesita drizzle-kit para el DDL).

   No uses el host "directo" (`db.<ref>.supabase.co`): solo publica registro
   AAAA, así que en una red sin IPv6 —la mayoría de conexiones domésticas, y
   las funciones de Vercel— falla con `ENETUNREACH`. El modo *session* del
   pooler es su sustituto. Ojo también con el usuario: el pooler exige
   `postgres.<project-ref>`, no `postgres` a secas.
2. **Crear el único usuario** en Authentication → Users, y desactivar "Allow new
   users to sign up" en Authentication → Settings.
3. **Variables de entorno:** copia `.env.example` a `.env` y rellénalo.
4. **Dependencias y esquema:**
   ```
   pnpm install
   pnpm db:migrate   # aplica db/migrations contra Supabase
   pnpm db:seed      # crea "Mañanas" y "After work" con sus acciones
   ```
   La migración inicial instala `btree_gist` y crea la constraint `EXCLUDE` que
   impide que dos planes de una rutina se solapen.
5. **Arrancar:** `pnpm dev` para el frontend. Las funciones de `api/` necesitan
   `pnpm dlx vercel dev` con el proyecto enlazado y el mismo `.env`.
6. **Desplegar:** `vercel link` y configura las mismas variables en Vercel.

## Comandos

| | |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Typecheck + build de producción |
| `pnpm test` | Tests de `src/lib/schedule.ts` |
| `pnpm lint` / `pnpm format` | Biome |
| `pnpm db:generate` | Genera una migración a partir del esquema |
| `pnpm db:migrate` | Aplica las migraciones |
| `pnpm db:studio` | Explorador de la base de datos |
| `pnpm db:seed` | Siembra las rutinas de `docs/idea.md` (idempotente) |
| `pnpm db:verify` | Comprueba las constraints contra una base de datos de usar y tirar |

`pnpm dev` sólo levanta el frontend (Vite, en el 5173): las funciones de `api/`
son serverless de Vercel y Vite no las ejecuta, así que todo lo que pase por
`apiClient` responde 404. `pnpm dlx vercel dev` (en el 3000) sirve las dos cosas
a la vez y aplica los rewrites de `vercel.json`, que son los que convierten
`/api/rounds/:id` en `/api/rounds?id=:id`. Necesita `vercel link` hecho y el
mismo `.env`.

`pnpm build` falla si faltan `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY`: sin
ellas el bundle se queda vacío y el despliegue serviría una página en blanco sin
avisar.

`pnpm db:verify` comprueba lo que vive en Postgres y no en TypeScript (la
constraint de no solapamiento, un Round por rutina y día, una acción registrada
como mucho una vez por Round, y qué arrastra cada borrado). Escribe filas, así
que se niega a arrancar si la base de datos ya tiene rutinas:

```
podman run -d --rm --name pg -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=routines -p 55432:5432 postgres:16-alpine
DIRECT_URL=postgresql://postgres:test@127.0.0.1:55432/routines pnpm db:migrate
DATABASE_URL=postgresql://postgres:test@127.0.0.1:55432/routines pnpm db:verify
```
