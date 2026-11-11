import unicodedata
import re

def normalizar(texto):
    texto = unicodedata.normalize("NFD", texto.lower())
    return "".join(c for c in texto if unicodedata.category(c) != "Mn")

def responder_directamente(pregunta, fichas):
    if not fichas:
        return None

    pregunta = normalizar(pregunta)
    ficha = fichas[0]

    anios_pregunta = {
        int(anio) for anio in re.findall(r"(?<!\d)(?:19|20)\d{2}(?!\d)", pregunta)
    }
    anios_validos = set(
        ficha.get("vigencia", {}).get("ejercicios_aplicables", [])
    )

    if anios_pregunta and not anios_pregunta.issubset(anios_validos):
        return None

    calculo = ficha.get("calculo", {})
    fuente = ficha.get("fuente", {}).get("url_boe", "")

    if any(x in pregunta for x in (
        "porcentaje",
        "cuanto desgrava",
        "cuanto puedo deducir",
        "tipos de deduccion",
        "que deduccion",
        "que deducciones",
        "deduccion fiscal",
        "deducciones fiscales",
        "desgravacion fiscal",
        "puedo desgravar",
        "puedo deducir",
        "desgravar la instalacion",
    )):
        porcentajes = calculo.get("porcentajes_segun_modalidad", [])
        modalidades = ficha.get("modalidades", [])
        if not porcentajes or not modalidades:
            return None
        detalles = "\n".join(
            f"- {m['porcentaje']} %: {m['condicion']}"
            for m in modalidades
        )
        return f"Las modalidades documentadas son:\n{detalles}\nFuente: {fuente}"

    if any(x in pregunta for x in ("base maxima", "limite", "maximo deducible")):
        base = calculo.get("base_maxima_anual_euros")
        if base is None:
            return None
        return f"La base máxima anual documentada es de {base} euros.\nFuente: {fuente}"

    if any(x in pregunta for x in ("requisito", "condiciones fiscales", "condiciones para deducir")):
        requisitos = ficha.get("requisitos", [])
        if not requisitos:
            return None
        return "Requisitos documentados:\n" + "\n".join(
            f"- {r}" for r in requisitos
        ) + f"\nFuente: {fuente}"

    if any(x in pregunta for x in ("incompatible", "compatibilidad")):
        datos = ficha.get("incompatibilidades", [])
        if not datos:
            return None
        return "Incompatibilidades documentadas:\n" + "\n".join(
            f"- {r}" for r in datos
        ) + f"\nFuente: {fuente}"

    return None
