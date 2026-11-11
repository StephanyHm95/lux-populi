from knowledge import consultar_fichas
from respuestas_directas import responder_directamente, normalizar

RESPUESTA_SIN_DOCUMENTACION = (
    "No dispongo de información documental verificada para responder a esta consulta."
)

RESPUESTA_SIN_COINCIDENCIA = (
    "No dispongo de una respuesta documental verificada para esta pregunta."
)

def responder(pregunta, categoria, ambito, fecha_referencia, historial=None):
    if not isinstance(pregunta, str) or not pregunta.strip():
        raise ValueError("La pregunta debe ser un texto no vacío.")

    fichas = consultar_fichas(categoria, ambito, fecha_referencia)

    if not fichas:
        return RESPUESTA_SIN_DOCUMENTACION

    pregunta_normalizada = normalizar(pregunta)

    consultas_fuente = (
        "de donde has sacado",
        "cual es la fuente",
        "cuales son las fuentes",
        "de donde sale esa informacion",
        "en que fuente te basas",
    )

    if any(expresion in pregunta_normalizada for expresion in consultas_fuente):
        ultimo_mensaje = next(
            (
                mensaje["texto"]
                for mensaje in reversed(historial or [])
                if mensaje.get("rol") == "asistente"
            ),
            None
        )

        if ultimo_mensaje:
            for ficha in fichas:
                fuente = ficha.get("fuente", {})
                url = fuente.get("url_boe", "")
                if url and url in ultimo_mensaje:
                    organismo = fuente.get("organismo", "Fuente oficial")
                    return f"Fuente documental: {organismo}.\n{url}"

        return RESPUESTA_SIN_COINCIDENCIA

    respuesta = responder_directamente(pregunta, fichas)

    if respuesta is None:
        return RESPUESTA_SIN_COINCIDENCIA

    return respuesta
