# RagUT — Plataforma Educativa con IA

Plataforma SaaS educativa multi-tenant para la Universidad Tecnológica de Cancún. Permite subir PDFs, hacer preguntas en lenguaje natural y generar exámenes con IA.

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | FastAPI (Python) |
| Base de datos | Supabase (PostgreSQL) |
| Vectores | pgvector en PostgreSQL (via embeddings JSON) |
| Embeddings | HuggingFace Inference API (gratis) |
| LLM | Cerebras Cloud (`llama3.1-70b`) |
| Storage PDFs | Supabase Storage |
| Frontend | React + Vite + TypeScript |
| Deploy backend | Railway o Render |
| Deploy frontend | Vercel |

---

## 1. Configuración de Supabase

1. Ve a https://supabase.com y crea un proyecto
2. En **SQL Editor**, ejecuta:

```sql
-- Habilitar pgvector (ya viene en Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- Crear bucket para PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('edurag-pdfs', 'edurag-pdfs', false);
```

3. Ve a **Settings → API** y copia:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_KEY`

4. Ve a **Settings → Database → Connection string** y copia la URL → `DATABASE_URL`

---

## 2. Instalación local

### Backend

```bash
cd backend
python -m venv venv

# Mac/Linux
source venv/bin/activate
# Windows
venv\Scripts\activate

pip install -r requirements.txt
cp .env.example .env
# Edita .env con tus credenciales
```

Crear las tablas:
```bash
python -c "
from app.core.database import Base, engine
from app.models.models import *
Base.metadata.create_all(bind=engine)
print('Tablas creadas')
"
```

Arrancar:
```bash
uvicorn app.main:app --reload --port 8000
```

El admin se crea automáticamente con las credenciales de `.env`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_URL=http://localhost:8000
npm run dev
```

Abre http://localhost:5173

---

## 3. Subir a GitHub

```bash
# En la raíz del proyecto
git init
git add .
git commit -m "feat: initial RagUT project"

# Crear repo en github.com, luego:
git remote add origin https://github.com/TU_USUARIO/ragut.git
git branch -M main
git push -u origin main
```

---

## 4. Deploy en producción

### Backend → Railway

```bash
npm install -g @railway/cli
railway login
cd backend
railway init
railway up
```

En el dashboard de Railway, agrega estas variables de entorno:
```
DATABASE_URL=...
SECRET_KEY=...
CEREBRAS_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
STORAGE_BUCKET=edurag-pdfs
EMBEDDING_PROVIDER=huggingface
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
FRONTEND_URL=https://ragut.vercel.app
FIRST_ADMIN_EMAIL=admin@tuinstitucion.edu
FIRST_ADMIN_PASSWORD=TuPasswordSegura
```

Railway detecta el `Procfile` automáticamente:
```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Frontend → Vercel

```bash
npm install -g vercel
cd frontend
vercel --prod
```

En el dashboard de Vercel → Settings → Environment Variables:
```
VITE_API_URL=https://tu-backend.railway.app
```

### Backend → Render (alternativa gratuita)

1. Ve a https://render.com
2. Nuevo **Web Service** → conecta tu repo de GitHub
3. Selecciona la carpeta `backend`
4. **Build command:** `pip install -r requirements.txt`
5. **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Agrega las variables de entorno desde el dashboard

---

## 5. Primer uso

1. Entra al frontend
2. Login con el email y contraseña de `FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD`
3. Panel Admin → Crear usuario (profesor)
4. Login como profesor → Crear clase → Compartir código
5. Login como alumno → Unirse con código → Subir PDFs → Chat

---

## 6. Solución de problemas

**Error de CORS:**
Verifica que `FRONTEND_URL` en el backend apunte exactamente a la URL del frontend (sin barra al final).

**PDF queda en "Procesando":**
Verifica que la HuggingFace API esté respondiendo. El modelo `all-MiniLM-L6-v2` puede tardar en iniciar la primera vez (cold start). Espera 30 segundos y sube de nuevo.

**Error 422 al generar examen:**
El documento necesita estar en estado "Listo" y tener texto extraíble. Los PDFs escaneados sin OCR no funcionan.

**Error de conexión a Supabase:**
Verifica que `DATABASE_URL` use la connection string de **Transaction pooler** en Supabase (puerto 6543), no la directa.
