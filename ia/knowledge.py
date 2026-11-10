import json
from pathlib import Path
from validator import ficha_publicable


KNOWLEDGE_DIR = (Path(__file__).parent / "knowledge_validated").resolve()


def cargar_ficha(nombre_archivo):
    if (
        Path(nombre_archivo).name != nombre_archivo
        or not nombre_archivo.endswith(".json")
    ):
        raise ValueError("Nombre de archivo no permitido")

    ruta = KNOWLEDGE_DIR / nombre_archivo

    if ruta.is_symlink() or ruta.resolve().parent != KNOWLEDGE_DIR:
        raise ValueError("Acceso a archivo no permitido")

    try:
        with ruta.open("r", encoding="utf-8") as archivo:
            ficha = json.load(archivo)
    except FileNotFoundError:
        return None

    if not ficha_publicable(ficha):
        return None

    return ficha


def listar_fichas():
    fichas = []

    for ruta in sorted(KNOWLEDGE_DIR.glob("*.json")):
        ficha = cargar_ficha(ruta.name)

        if ficha is not None:
            fichas.append(ficha)

    return fichas


def buscar_por_categoria(categoria):
    if not isinstance(categoria, str) or not categoria.strip():
        return []

    categoria = categoria.strip().casefold()

    return [
        ficha
        for ficha in listar_fichas()
        if ficha["categoria"].casefold() == categoria
    ]


def buscar_por_ambito(ambito):
    if not isinstance(ambito, str) or not ambito.strip():
        return []

    ambito = ambito.strip().casefold()

    return [
        ficha
        for ficha in listar_fichas()
        if ficha["ambito"].strip().casefold() in ("españa", ambito)
    ]


def buscar_fichas(categoria, ambito):
    if not isinstance(categoria, str) or not categoria.strip():
        return []

    if not isinstance(ambito, str) or not ambito.strip():
        return []

    categoria = categoria.strip().casefold()
    ambito = ambito.strip().casefold()

    return [
        ficha
        for ficha in listar_fichas()
        if ficha["categoria"].strip().casefold() == categoria
        and ficha["ambito"].strip().casefold() in ("españa", ambito)
    ]


def filtrar_por_fecha(fichas, fecha_consulta):
    from datetime import date

    try:
        fecha = date.fromisoformat(fecha_consulta)
    except (TypeError, ValueError):
        return []

    resultado = []

    for ficha in fichas:
        vigencia = ficha.get("vigencia", {})

        if not isinstance(vigencia, dict):
            continue

        try:
            inicio = date.fromisoformat(
                vigencia["inicio_periodo_instalaciones_pagos"]
            )
            fin = date.fromisoformat(
                vigencia["fin_periodo_instalaciones_pagos"]
            )
        except (KeyError, TypeError, ValueError):
            continue

        if inicio <= fecha <= fin:
            resultado.append(ficha)

    return resultado


def consultar_fichas(categoria, ambito, fecha_referencia):
    fichas = buscar_fichas(categoria, ambito)
    return filtrar_por_fecha(fichas, fecha_referencia)
