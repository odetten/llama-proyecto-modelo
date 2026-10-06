import json
from pathlib import Path
from ollama import chat

# Pega aquí MUNICIPIOS, haversine_km y filtrar() de la sección 6 del archivo
# (o ponlos en filtros.py y haz: from filtros import filtrar)

SYSTEM_PROMPT = Path("system_prompt.txt").read_text(encoding="utf-8")
RESTAURANTES = json.loads(Path("restaurantes.json").read_text(encoding="utf-8"))


def construir_mensaje(form: dict, candidatos: list) -> str:
    return f"""FORMULARIO DEL USUARIO
- Municipio donde estoy: {form['municipio_origen']}
- Distancia máxima que quiero recorrer: {form['distancia_max_km']} km
- Gustos de comida: {', '.join(form['gustos'])}
- Alergias: {', '.join(form['alergias']) or 'ninguna'}
- Presupuesto por persona: {form['presupuesto_mxn']} MXN
- ¿Hago dieta / quiero pocas calorías?: {'sí' if form['dieta'] else 'no'}
- Nivel de hambre: {form['hambre']}
- Transporte: {form['transporte']}
- Ambiente: {form['ambiente']}

CANDIDATOS (ya filtrados, no recomiendes nada fuera de esta lista)
{json.dumps(candidatos, ensure_ascii=False, indent=2)}

Dame tus mejores 3 recomendaciones."""


def recomendar(form: dict) -> str:
    candidatos = filtrar(RESTAURANTES, form)

    # Si no hay candidatos, ni siquiera molestamos al modelo
    if not candidatos:
        return ("No encontré opciones con esos filtros. "
                "Prueba ampliando la distancia o el presupuesto.")

    response = chat(
        model="llama3.2:3b",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": construir_mensaje(form, candidatos)},
        ],
        options={
            "num_ctx": 8192,       # evita que se corte el contexto
            "temperature": 0.3,    # menos invenciones
            "top_p": 0.9,
            "repeat_penalty": 1.1,
        },
    )
    return response.message.content


if __name__ == "__main__":
    form = {
        "municipio_origen": "Monterrey",
        "distancia_max_km": 10,
        "gustos": ["tacos", "carne asada"],
        "alergias": ["mariscos"],
        "presupuesto_mxn": 250,
        "dieta": False,
        "hambre": "mucha",
        "transporte": "transporte_publico",
        "ambiente": "me_da_igual",
    }
    print(recomendar(form))