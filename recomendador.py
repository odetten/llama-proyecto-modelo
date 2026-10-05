import json
from math import radians, sin, cos, asin, sqrt
from pathlib import Path

from ollama import chat

BASE = Path(__file__).parent
SYSTEM_PROMPT = (BASE / "system_prompt.txt").read_text(encoding="utf-8")
RESTAURANTES = json.loads((BASE / "restaurantes.json").read_text(encoding="utf-8"))

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
    d = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371 * asin(sqrt(d))


def _puntaje_gustos(r, gustos):
    """Cuántos gustos del usuario coinciden con el tipo de cocina o platillos."""
    texto = " ".join(r["tipo_cocina"] + r["platillos_estrella"]).lower()
    return sum(1 for g in gustos if g.strip().lower() in texto)


def filtrar(restaurantes, form, max_candidatos=6):
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
        if form["ambiente"] == "tranquilo" and r["tematico"]:
            continue
        out.append({**r, "distancia_km": round(dist, 1)})

    # primero los que coinciden con los gustos, luego los más cercanos
    out.sort(key=lambda x: (-_puntaje_gustos(x, form["gustos"]), x["distancia_km"]))
    return out[:max_candidatos]


def construir_mensaje(form, candidatos):
    return f"""FORMULARIO DEL USUARIO
- Municipio donde estoy: {form['municipio_origen']}
- Distancia máxima que quiero recorrer: {form['distancia_max_km']} km
- Gustos de comida: {', '.join(form['gustos']) or 'sin preferencia'}
- Alergias: {', '.join(form['alergias']) or 'ninguna'}
- Presupuesto por persona: {form['presupuesto_mxn']} MXN
- ¿Hago dieta / quiero pocas calorías?: {'sí' if form['dieta'] else 'no'}
- Nivel de hambre: {form['hambre']}
- Transporte: {'auto' if form['transporte'] == 'auto' else 'transporte público'}
- Ambiente: {form['ambiente']}

CANDIDATOS (ya filtrados, no recomiendes nada fuera de esta lista)
{json.dumps(candidatos, ensure_ascii=False, indent=2)}

Dame tus mejores 3 recomendaciones."""


def recomendar(form):
    """Devuelve (candidatos, respuesta_del_modelo)."""
    candidatos = filtrar(RESTAURANTES, form)

    if not candidatos:
        return [], ("No encontré opciones con esos filtros. "
                    "Prueba ampliando la distancia o el presupuesto.")

    response = chat(
        model="llama3.2:3b",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": construir_mensaje(form, candidatos)},
        ],
        options={
            "num_ctx": 8192,
            "temperature": 0.3,
            "top_p": 0.9,
            "repeat_penalty": 1.1,
        },
    )
    return candidatos, response.message.content