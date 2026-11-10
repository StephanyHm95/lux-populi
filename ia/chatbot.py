from knowledge import consultar_fichas
from respuestas_directas import responder_directamente

RESPUESTA_SIN_DOCUMENTACION = (
    "No dispongo de información documental verificada para responder a esta consulta."
)

RESPUESTA_SIN_COINCIDENCIA = (
    "No dispongo de una respuesta documental verificada para esta pregunta."
)

def responder(pregunta, categoria, ambito, fecha_referencia):
    if not isinstance(pregunta, str) or not pregunta.strip():
        raise ValueError("La pregunta debe ser un texto no vacío.")

    fichas = consultar_fichas(categoria, ambito, fecha_referencia)

    if not fichas:
        return RESPUESTA_SIN_DOCUMENTACION

    respuesta = responder_directamente(pregunta, fichas)

    if respuesta is None:
        return RESPUESTA_SIN_COINCIDENCIA

    return respuesta
