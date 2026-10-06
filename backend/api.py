from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from ollama import chat

from backend.recomendador import MUNICIPIOS, recomendar

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
    distancia_max_km: int = Field(default=10, ge=1, le=40)
    gustos: list[str] = Field(default_factory=list)
    alergias: list[str] = Field(default_factory=list)
    presupuesto_mxn: int = Field(default=250, ge=50, le=2000)
    personas: int = Field(default=2, ge=1, le=20)
    dieta: bool = False
    hambre: Literal["poca", "media", "mucha"] = "media"
    transporte: Literal["auto", "transporte_publico"] = "auto"
    ambiente: Literal["me_da_igual", "tematico", "tranquilo"] = "me_da_igual"


@app.get("/")
def home():
    return {
        "message": "Bienvenido a la API de Llama3.1:8b. Envía un POST a /ask con un JSON que contenga el campo 'prompt' para obtener una respuesta."
    }


@app.post("/recomendar")
def recommend_restaurants(request: RecommendationRequest):
    if request.municipio_origen not in MUNICIPIOS:
        raise HTTPException(status_code=422, detail="El municipio no es válido.")

    candidatos, respuesta = recomendar(request.model_dump())
    return {"candidatos": candidatos, "respuesta": respuesta}


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