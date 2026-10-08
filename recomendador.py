import json
from math import ceil, radians, sin, cos, asin, sqrt
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
TIEMPO_COMIDA_ESTIMADO_MINUTOS = 45


def haversine_km(a, b):
    lat1, lon1, lat2, lon2 = map(radians, (*a, *b))
    d = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371 * asin(sqrt(d))


def _puntaje_gustos(r, gustos):
    """Cuántos gustos del usuario coinciden con el tipo de cocina o platillos."""
    texto = " ".join(r["tipo_cocina"] + r["platillos_estrella"]).lower()
    return sum(1 for g in gustos if g.strip().lower() in texto)


def filtrar(restaurantes, form, max_candidatos=12):
    latitud = form.get("latitud")
    longitud = form.get("longitud")
    if (latitud is None) != (longitud is None):
        raise ValueError("La latitud y la longitud deben enviarse juntas.")
    origen = (
        (latitud, longitud)
        if latitud is not None and longitud is not None
        else MUNICIPIOS[form["municipio_origen"]]
    )
    out = []
    for r in restaurantes:
        if r["lat"] is None or r["lon"] is None:
            continue
        dist = haversine_km(origen, (r["lat"], r["lon"]))
        if dist > form["distancia_max_km"]:
            continue
        if r["precio_promedio_mxn"] is None or r["precio_promedio_mxn"] > form["presupuesto_mxn"]:
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

    # Alterna municipios para incluir opciones de toda el área dentro del radio.
    por_municipio = {}
    for restaurante in out:
        por_municipio.setdefault(restaurante["municipio"], []).append(restaurante)

    seleccionados = []
    while por_municipio and len(seleccionados) < max_candidatos:
        for municipio in list(por_municipio):
            seleccionados.append(por_municipio[municipio].pop(0))
            if not por_municipio[municipio]:
                del por_municipio[municipio]
            if len(seleccionados) == max_candidatos:
                break
    return seleccionados


def estimar_tiempo_total(distancia_km, transporte, tiempo_comida_minutos):
    """Estimate round-trip travel plus time to eat; this is not live traffic data."""
    velocidad_kmh = 25 if transporte == "auto" else 15
    minutos_espera = 0 if transporte == "auto" else 10
    distancia_ruta_km = distancia_km * 1.3
    tiempo_ida = ceil(distancia_ruta_km / velocidad_kmh * 60) + minutos_espera // 2
    tiempo_regreso = tiempo_ida
    return {
        "tiempo_ida_minutos": tiempo_ida,
        "tiempo_comida_minutos": tiempo_comida_minutos,
        "tiempo_regreso_minutos": tiempo_regreso,
        "tiempo_total_minutos": tiempo_ida + tiempo_comida_minutos + tiempo_regreso,
    }


def recomendar_por_tiempo(form, tiempo_disponible_minutos):
    candidatos = filtrar(RESTAURANTES, form, max_candidatos=len(RESTAURANTES))
    for restaurante in candidatos:
        restaurante.update(
            estimar_tiempo_total(
                restaurante["distancia_km"],
                form["transporte"],
                TIEMPO_COMIDA_ESTIMADO_MINUTOS,
            )
        )

    candidatos = [
        restaurante
        for restaurante in candidatos
        if restaurante["tiempo_total_minutos"] <= tiempo_disponible_minutos
    ]
    candidatos.sort(
        key=lambda restaurante: (
            restaurante["tiempo_total_minutos"],
            restaurante["distancia_km"],
            -_puntaje_gustos(restaurante, form["gustos"]),
        )
    )
    candidatos = candidatos[:12]

    if not candidatos:
        respuesta = (
            f"No encontré restaurantes que quepan en {tiempo_disponible_minutos} minutos "
            f"considerando {TIEMPO_COMIDA_ESTIMADO_MINUTOS} minutos para comer y tus filtros actuales. "
            "Prueba dando más tiempo o ampliando la distancia."
        )
    else:
        respuesta = (
            "Ordené estas opciones por el menor tiempo estimado de ida, comida y regreso. "
            "Los tiempos son aproximados y no consideran el tráfico en tiempo real."
        )
    return candidatos, respuesta


def construir_mensaje(form, candidatos):
    return f"""FORMULARIO DEL USUARIO
    - Municipio de referencia: {form['municipio_origen']}
    - Origen de distancia: {'ubicación compartida' if form.get('latitud') is not None else 'centro del municipio'}
- Distancia máxima que quiero recorrer: {form['distancia_max_km']} km
- Gustos de comida: {', '.join(form['gustos']) or 'sin preferencia'}
- Alergias: {', '.join(form['alergias']) or 'ninguna'}
- Presupuesto por persona: {form['presupuesto_mxn']} MXN
- Personas que van: {form.get('personas', 1)}
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
        model="llama3.1:8b",
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