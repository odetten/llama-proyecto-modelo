# Interfaz React

Este frontend independiente reemplaza el prototipo de Streamlit para que puedas
modificar la experiencia en React. Edita la pantalla en `src/App.jsx` y sus
estilos en `src/styles.css`.

## Ejecutar en desarrollo

Inicia la API desde la carpeta raíz del proyecto:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn api:app --reload
```

En otra terminal, instala dependencias y ejecuta Vite desde `frontend`:

```powershell
npm install
npm run dev
```

Abre `http://localhost:5173`. El formulario se comunica con el endpoint
`POST /recomendar` en la API (por defecto `http://localhost:8000`). Para usar
otra URL, crea un archivo `.env` en esta carpeta con `VITE_API_URL` y reinicia
Vite.
