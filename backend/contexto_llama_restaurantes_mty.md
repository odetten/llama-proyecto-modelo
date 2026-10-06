# Contexto para Llama 3.2 3B: recomendador de restaurantes en el AMM

## 0. Notas de uso (leer antes)

- **Llama 3.2 3B no conoce bien los restaurantes de Monterrey** y va a inventar nombres, precios y direcciones. La solución es no confiar en su memoria: tú le das una lista de restaurantes verificados (sección 5) y él solo elige, ordena y explica.
- **Filtra en código, no en el prompt.** Distancia, presupuesto, alergias y transporte se calculan con Python/JS (ejemplo en la sección 6). Al modelo solo le pasas de 3 a 6 candidatos ya filtrados. Un modelo de 3B falla mucho con reglas numéricas.
- **Ventana de contexto:** en Ollama el valor por defecto de `num_ctx` es pequeño. Súbelo (`"num_ctx": 8192`) y mantén todo el contexto por debajo de ~3000 tokens.
- **Parámetros sugeridos:** `temperature` 0.3, `top_p` 0.9, `repeat_penalty` 1.1. Con temperatura alta inventa más.
- El prompt de sistema va en el rol `system`; el formulario y los candidatos van en el mensaje `user`.

---

## 1. PROMPT DE SISTEMA (copiar tal cual)

```
Eres "Chef Regio", un asistente que recomienda dónde comer en el Área Metropolitana de Monterrey (AMM), Nuevo León, México. Hablas en español mexicano, con tono amable y breve.

REGLAS OBLIGATORIAS
1. Solo puedes recomendar restaurantes que aparezcan en la sección CANDIDATOS del mensaje. NUNCA inventes nombres, direcciones, precios, horarios ni platillos.
2. Si CANDIDATOS está vacío, di que no encontraste opciones con esos filtros y sugiere ampliar la distancia o el presupuesto. No propongas lugares por tu cuenta.
3. ALERGIAS: nunca afirmes que un platillo es 100% seguro. Si el usuario tiene alergias, recomienda solo candidatos que no tengan ese alérgeno marcado y cierra siempre con: "Confirma con el restaurante sobre tu alergia antes de pedir."
4. DIETA: si el usuario cuida calorías, prioriza opciones ligeras (a la parrilla, caldos, ensaladas, mariscos). No des cifras exactas de calorías ni consejos médicos.
5. HAMBRE: poca = botana o platillo ligero; media = platillo normal; mucha = platillo fuerte o para compartir.
6. TRANSPORTE: si el usuario NO tiene auto, prioriza lugares con "acceso_transporte_publico" alto y menciona cómo llegar (Metrorrey, Ecovía, camión o Uber/DiDi). Si tiene auto, menciona si hay estacionamiento.
7. AMBIENTE: si pide temático, prioriza candidatos con tematico=true. Si quiere tranquilidad, prioriza tematico=false y ambiente "tranquilo".
8. DISTANCIA: respeta el campo distancia_km de cada candidato. No digas que algo está "cerca" si distancia_km es mayor a 12.

FORMATO DE RESPUESTA
- Máximo 3 recomendaciones, ordenadas de mejor a peor opción.
- Para cada una escribe: **Nombre** (municipio) · por qué encaja · platillo sugerido (solo de los listados) · rango de precio · cómo llegar.
- Máximo 60 palabras por recomendación.
- Termina con una frase corta y amable. Nada más.
```

---

## 2. CONTEXTO GEOGRÁFICO (puedes anexarlo al prompt de sistema o usarlo en tu código)

El AMM tiene 18 municipios. Los que más se usan para salir a comer:

| Municipio | Lat | Lon | Perfil general (orientativo, verifícalo) | Transporte |
|---|---|---|---|---|
| Monterrey | 25.6866 | -100.3161 | Centro, Barrio Antiguo, Fundidora, Cumbres, Tec/Contry. Mucha variedad, desde taquerías hasta restaurantes de autor. | Metrorrey, Transmetro, Ecovía, camiones |
| San Pedro Garza García | 25.6573 | -100.4020 | Valle Oriente y Calzada del Valle. Precios medios-altos y altos, cocina internacional. | Poco servicio de Metro; mejor auto o Uber/DiDi |
| San Nicolás de los Garza | 25.7500 | -100.2833 | Zona universitaria (UANL). Taquerías y comida económica. | Metrorrey Línea 2, camiones |
| Guadalupe | 25.6769 | -100.2561 | Restaurantes familiares, parrilladas, comida casual. | Metrorrey Línea 1 (parte), camiones |
| General Escobedo | 25.7970 | -100.3200 | Zona en crecimiento, plazas y comida casual. | Metrorrey Línea 2 (Sendero), camiones |
| Apodaca | 25.7817 | -100.1883 | Zona industrial y residencial, comida casual. | Principalmente camión y auto |
| Santa Catarina | 25.6733 | -100.4583 | Residencial, cerca de San Pedro y el poniente. | Camión y auto |
| Juárez | 25.6492 | -100.0950 | Sureste del AMM, mayormente residencial. | Camión y auto |
| García | 25.8133 | -100.5900 | Noroeste, zona de las Grutas. | Auto o camión |
| Santiago | 25.4236 | -100.1514 | Pueblo Mágico, Carretera Nacional, restaurantes campestres. | Casi siempre auto |

Las coordenadas son aproximadas, del centro de cada municipio.

**Rangos de distancia (para traducir distancia_km a lenguaje natural):**
- 0–5 km: "muy cerca"
- 5–12 km: "cerca"
- 12–25 km: "a media distancia"
- más de 25 km: "lejos"

**Tráfico:** en hora pico (7–9 am y 6–8 pm) el tiempo de traslado puede subir 50% o más. Considera sumar 1.5x al tiempo estimado en esos horarios.

---

## 3. CULTURA GASTRONÓMICA REGIA (contexto breve para el modelo)

Platillos típicos de Nuevo León: cabrito (al pastor o en su sangre), machacado con huevo, carne asada, discada, asado de puerco, frijoles charros, tacos de trompo, tacos de barbacoa (sobre todo fin de semana), glorias y empanadas de cajeta, tortillas de harina. Los regios suelen salir a comer en familia los domingos y las carnes asadas son parte de la vida social.

---

## 4. PLANTILLA DEL MENSAJE DE USUARIO (formulario → prompt)

```
FORMULARIO DEL USUARIO
- Municipio donde estoy: {municipio_origen}
- Distancia máxima que quiero recorrer: {distancia_max_km} km
- Gustos de comida: {gustos}
- Alergias: {alergias o "ninguna"}
- Presupuesto por persona: {presupuesto_mxn} MXN
- ¿Hago dieta / quiero pocas calorías?: {si|no}
- Nivel de hambre: {poca|media|mucha}
- Transporte: {auto|transporte_publico}
- Ambiente: {tematico|tranquilo|me_da_igual}

CANDIDATOS (ya filtrados, no recomiendes nada fuera de esta lista)
{lista_json_de_3_a_6_restaurantes}

Dame tus mejores 3 recomendaciones.
```

---

## 5. ESQUEMA DE RESTAURANTE

Cada restaurante de tu base de datos debería tener esta forma:

```json
{
  "id": 1,
  "nombre": "EJEMPLO - Taquería El Trompo",
  "municipio": "San Nicolás de los Garza",
  "lat": 25.7260,
  "lon": -100.3090,
  "tipo_cocina": ["tacos", "mexicana"],
  "platillos_estrella": ["tacos al pastor", "gringas"],
  "precio_nivel": "$",
  "precio_promedio_mxn": 120,
  "alergenos": ["gluten", "lacteos"],
  "opcion_ligera": false,
  "tematico": false,
  "ambiente": "casual",
  "estacionamiento": true,
  "acceso_transporte_publico": "alto",
  "como_llegar_publico": "Metrorrey Línea 2, estación Universidad",
  "horario": "13:00-23:00",
  "verificado_en": "2026-10"
}
```

Niveles de precio sugeridos (por persona): `$` menos de 150 MXN · `$$` 150–350 · `$$$` 350–700 · `$$$$` más de 700.

Los datos de este ejemplo son ficticios. Llena la base con lugares reales y verificados, y actualiza `verificado_en` periódicamente porque los restaurantes cierran o cambian de precio.

---

## 6. FILTRADO EN CÓDIGO (Python, ejemplo)

```python
from math import radians, sin, cos, asin, sqrt

MUNICIPIOS = {
    "Monterrey": (25.6866, -100.3161),
    "San Pedro Garza García": (25.6573, -100.4020),
    "San Nicolás de los Garza": (25.7500, -100.2833),
    "Guadalupe": (25.6769, -100.2561),
    "General Escobedo": (25.7970, -100.3200),
    "Apodaca": (25.7817, -100.1883),
    "Santa Catarina": (25.6733, -100.4583),
    "Juárez": (25.6492, -100.0950),
    "García": (25.8133, -100.5900),
    "Santiago": (25.4236, -100.1514),
}

def haversine_km(a, b):
    lat1, lon1, lat2, lon2 = map(radians, (*a, *b))
    d = sin((lat2-lat1)/2)**2 + cos(lat1)*cos(lat2)*sin((lon2-lon1)/2)**2
    return 2 * 6371 * asin(sqrt(d))

def filtrar(restaurantes, form):
    origen = MUNICIPIOS[form["municipio_origen"]]
    out = []
    for r in restaurantes:
        dist = haversine_km(origen, (r["lat"], r["lon"]))
        if dist > form["distancia_max_km"]:
            continue
        if r["precio_promedio_mxn"] > form["presupuesto_mxn"]:
            continue
        if set(form["alergias"]) & set(r["alergenos"]):
            continue
        if form["dieta"] and not r["opcion_ligera"]:
            continue
        if form["transporte"] == "transporte_publico" and r["acceso_transporte_publico"] == "bajo":
            continue
        if form["ambiente"] == "tematico" and not r["tematico"]:
            continue
        out.append({**r, "distancia_km": round(dist, 1)})
    # los más cercanos primero, máximo 6 candidatos
    return sorted(out, key=lambda x: x["distancia_km"])[:6]
```

La distancia en línea recta subestima el recorrido real (multiplícala por ~1.3 si quieres una estimación más realista). Si alguna vez quieres precisión, usa una API de rutas.

---

## 7. Checklist de pruebas

Prueba estos casos antes de usarlo en serio:
1. Candidatos vacíos → debe decir que no hay opciones, sin inventar.
2. Usuario alérgico a mariscos → no debe recomendar nada con ese alérgeno y debe incluir la advertencia final.
3. Sin auto y lejos → debe mencionar Metrorrey/Uber/DiDi.
4. Pregúntale por un restaurante que no esté en la lista → debe negarse a recomendarlo.
