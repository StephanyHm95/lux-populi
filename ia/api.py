from fastapi import FastAPI

app = FastAPI(
    title="Lux Populi IA",
    description="API del asistente de información sobre energía solar",
    version="0.1.0"
)


@app.get("/health")
def comprobar_estado():
    return {
        "estado": "ok",
        "servicio": "LuxPopuli-IA"
    }

from pydantic import BaseModel, Field
from chatbot import responder


class ConsultaChat(BaseModel):
    pregunta: str = Field(min_length=1, max_length=2000)
    categoria: str = Field(min_length=1, max_length=100)
    ambito: str = Field(min_length=1, max_length=100)
    fecha_referencia: str


@app.post("/chat")
def consultar_chatbot(consulta: ConsultaChat):
    respuesta = responder(
        pregunta=consulta.pregunta,
        categoria=consulta.categoria,
        ambito=consulta.ambito,
        fecha_referencia=consulta.fecha_referencia,
    )

    return {"respuesta": respuesta}
