from ollama import chat

response = chat(
    model= "llama3.2:3b",
    messages=[
        {"role": "system", "content": "Eres un asistente confiable. Responde en español."},
        {"role": "user", "content": "explica que es una api rest.."}
    ]
)

print(response.message.content)