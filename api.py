from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from ollama import chat

from recomendador import (
    MUNICIPIOS,
    RESTAURANTES,
    recomendar,
    recomendar_por_tiempo,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

class PromptRequest(BaseModel):
    prompt: str


class RecommendationRequest(BaseModel):
    municipio_origen: str
    latitud: float | None = Field(default=None, ge=-90, le=90)
    longitud: float | None = Field(default=None, ge=-180, le=180)
    distancia_max_km: int = Field(default=10, ge=1, le=40)
    gustos: list[str] = Field(default_factory=list)
    alergias: list[str] = Field(default_factory=list)
    presupuesto_mxn: int = Field(default=250, ge=50, le=2000)
    personas: int = Field(default=2, ge=1, le=20)
    dieta: bool = False
    hambre: Literal["poca", "media", "mucha"] = "media"
    transporte: Literal["auto", "transporte_publico"] = "auto"
    ambiente: Literal["me_da_igual", "tematico", "tranquilo"] = "me_da_igual"


class QuickRecommendationRequest(RecommendationRequest):
    tiempo_disponible_minutos: int = Field(ge=30, le=240)


class RestaurantChatRequest(BaseModel):
    restaurant_id: int
    question: str = Field(min_length=1, max_length=500)
    history: list[dict[str, str]] = Field(default_factory=list, max_length=20)


@app.get("/")
def home():
    return {
        "message": "Bienvenido a la API de Llama3.1:8b. Envía un POST a /ask con un JSON que contenga el campo 'prompt' para obtener una respuesta."
    }


@app.post("/recomendar")
def recommend_restaurants(request: RecommendationRequest):
    if request.municipio_origen not in MUNICIPIOS:
        raise HTTPException(status_code=422, detail="El municipio no es válido.")
    if (request.latitud is None) != (request.longitud is None):
        raise HTTPException(
            status_code=422,
            detail="La latitud y la longitud deben enviarse juntas.",
        )

    candidatos, respuesta = recomendar(request.model_dump())
    return {"candidatos": candidatos, "respuesta": respuesta}


@app.post("/recomendar-rapido")
def recommend_quick_restaurants(request: QuickRecommendationRequest):
    if request.municipio_origen not in MUNICIPIOS:
        raise HTTPException(status_code=422, detail="El municipio no es válido.")
    if (request.latitud is None) != (request.longitud is None):
        raise HTTPException(
            status_code=422,
            detail="La latitud y la longitud deben enviarse juntas.",
        )

    form = request.model_dump(
        exclude={"tiempo_disponible_minutos"}
    )
    candidatos, respuesta = recomendar_por_tiempo(
        form,
        request.tiempo_disponible_minutos,
    )
    return {
        "candidatos": candidatos,
        "respuesta": respuesta,
        "modo": "rapido",
        "tiempo_disponible_minutos": request.tiempo_disponible_minutos,
        "tiempo_comida_minutos": 45,
    }


@app.post("/restaurantes/chat")
def chat_about_restaurant(request: RestaurantChatRequest):
    restaurant = next(
        (item for item in RESTAURANTES if item["id"] == request.restaurant_id),
        None,
    )
    if restaurant is None:
        raise HTTPException(status_code=404, detail="No encontramos ese restaurante.")
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Escribe una pregunta.")

    try:
        response = chat(
            model="llama3.1:8b",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Eres Chef Regio, un asistente amable que responde en español "
                        "sobre un restaurante del Área Metropolitana de Monterrey. "
                        "Usa únicamente los datos del restaurante incluidos aquí. "
                        "No inventes direcciones, servicios, precios, disponibilidad, "
                        "ingredientes ni rutas. Para llegar en transporte público, "
                        "puedes explicar la orientación que aparece en el campo "
                        "como_llegar_publico, aclarando que es una referencia. "
                        "Si un dato no aparece, dilo claramente y sugiere confirmarlo "
                        "directamente con el restaurante. Mantén la respuesta breve.\n"
                        f"Datos del restaurante: {restaurant}"
                    ),
                },
                *[
                    {
                        "role": item["role"],
                        "content": item["content"][:500],
                    }
                    for item in request.history
                    if item.get("role") in {"user", "assistant"}
                    and item.get("content", "").strip()
                ],
                {"role": "user", "content": question},
            ],
            options={"temperature": 0.3},
        )
        return {"answer": response.message.content}
    except Exception as error:
        print(f"Error al responder sobre restaurante {request.restaurant_id}: {error}")
        raise HTTPException(
            status_code=503,
            detail="El asistente no está disponible por el momento. Inténtalo de nuevo.",
        ) from error


@app.post("/ask")
def ask_llama(request: PromptRequest):
    try:
        response = chat(
            model="llama3.1:8b",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Eres un asistente confiable. Responde en español. "
                        "Responde siempre en español."
                    ),
                },
                {
                    "role": "user",
                    "content": request.prompt,
                },
            ],
        )
        return {
            "answer": response.message.content,
        }
    except Exception as error:
        print(f"Error al procesar la solicitud: {error}")

        raise HTTPException(
            status_code=500,
            detail="error",
        )