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

Los resultados incluyen hasta 12 restaurantes dentro de la distancia elegida,
alternando entre municipios cuando hay opciones disponibles. Los restaurantes
sin coordenadas no se incluyen porque no se puede verificar que estén dentro
del radio. Cuando no se conoce la ubicación exacta de un restaurante, se usa
un punto de referencia del municipio y la tarjeta lo identifica como ubicación
aproximada.

El modo **Tengo poco tiempo** pide únicamente el tiempo disponible.
`POST /recomendar-rapido` aplica los filtros actuales y ordena hasta 12
opciones por tiempo estimado de ida, comida (45 minutos fijos de referencia) y
regreso. La estimación usa la distancia en línea recta con un factor de ruta
aproximado, velocidades promedio de 25 km/h en auto o 15 km/h en transporte
público, más espera para transporte público. No consulta rutas ni tráfico en
tiempo real.
