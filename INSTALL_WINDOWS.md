# ══════════════════════════════════════════════════
#   RagUT — Instalación en Windows (PowerShell)
# ══════════════════════════════════════════════════

# ── PASO 1: Entrar a la carpeta del backend ────────
cd backend

# ── PASO 2: Crear entorno virtual ─────────────────
python -m venv venv

# ── PASO 3: Activar el entorno virtual ────────────
#   (en PowerShell se usa esto, NO source)
.\venv\Scripts\Activate.ps1

#   Si da error de permisos, ejecuta esto primero:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
#   Luego vuelve a ejecutar el Activate

# ── PASO 4: Instalar dependencias ─────────────────
pip install -r requirements.txt

# ── PASO 5: Copiar el archivo de entorno ──────────
copy .env.example .env
#   Luego abre .env con el bloc de notas y edita tus credenciales:
notepad .env

# ── PASO 6: Crear las tablas en la base de datos ──
python -c "from app.core.database import Base, engine; from app.models.models import *; Base.metadata.create_all(bind=engine); print('Tablas creadas correctamente')"

# ── PASO 7: Arrancar el backend ───────────────────
uvicorn app.main:app --reload --port 8000

# ══════════════════════════════════════════════════
#   FRONTEND (abre una segunda ventana de PowerShell)
# ══════════════════════════════════════════════════

# Vuelve a la raíz del proyecto
cd ..
cd frontend

# Instalar dependencias
npm install

# Copiar variables de entorno
copy .env.example .env

# Arrancar el frontend
npm run dev

# Abre el navegador en: http://localhost:5173
