from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ollama import chat

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

@app.get("/")
def home():
    return {
        "message": "Bienvenido a la API de Llama3.2:3b. Envía un POST a /ask con un JSON que contenga el campo 'prompt' para obtener una respuesta."
    }


@app.post("/ask")
def ask_llama(request: PromptRequest):
    try:
        response = chat(
            model="llama3.2:3b",
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