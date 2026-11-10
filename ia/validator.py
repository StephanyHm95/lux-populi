def validar_estructura(ficha):
    if not isinstance(ficha, dict):
        return False

    campos_obligatorios = [
        "id",
        "titulo",
        "categoria",
        "ambito",
        "fuente",
        "estado"
    ]

    for campo in campos_obligatorios:
        if campo not in ficha:
            return False

    for campo in ("id", "titulo", "categoria", "ambito"):
        valor = ficha[campo]
        if not isinstance(valor, str) or not valor.strip():
            return False

    if ficha["estado"] not in ("pendiente_validacion", "validado"):
        return False

    if not isinstance(ficha["fuente"], dict):
        return False

    if not ficha["fuente"].get("url_boe"):
        return False

    normativa = ficha["fuente"].get("normativa")
    if not isinstance(normativa, str) or not normativa.strip():
        return False

    return True


def validar_publicacion_deduccion_fiscal(ficha):
    from datetime import date

    if not validar_estructura(ficha):
        return False

    if ficha.get("estado") != "validado":
        return False

    if not validar_modalidades(ficha):
        return False

    vigencia = ficha.get("vigencia")
    if not isinstance(vigencia, dict):
        return False

    if vigencia.get("pendiente_verificacion") is not False:
        return False

    try:
        inicio = vigencia["inicio_periodo_instalaciones_pagos"]
        fin = vigencia["fin_periodo_instalaciones_pagos"]

        if not isinstance(inicio, str) or not isinstance(fin, str):
            return False

        fecha_inicio = date.fromisoformat(inicio)
        fecha_fin = date.fromisoformat(fin)

        if inicio != fecha_inicio.isoformat() or fin != fecha_fin.isoformat():
            return False

        return fecha_inicio <= fecha_fin

    except (KeyError, TypeError, ValueError):
        return False



def ficha_publicable(ficha):
    if not validar_estructura(ficha):
        return False

    validadores = {
        "deduccion_fiscal": validar_publicacion_deduccion_fiscal
    }

    validador = validadores.get(ficha["categoria"])
    if validador is None:
        return False

    return validador(ficha)


def validar_modalidades(ficha):
    from decimal import Decimal, InvalidOperation

    if not isinstance(ficha, dict):
        return False

    modalidades = ficha.get("modalidades")
    calculo = ficha.get("calculo")

    if not isinstance(modalidades, list) or not modalidades:
        return False

    if not isinstance(calculo, dict):
        return False

    porcentajes_calculo = calculo.get("porcentajes_segun_modalidad")

    if not isinstance(porcentajes_calculo, list) or not porcentajes_calculo:
        return False

    def convertir_porcentaje(valor):
        if type(valor) not in (int, float):
            return None

        try:
            numero = Decimal(str(valor))
        except InvalidOperation:
            return None

        if not numero.is_finite() or not (0 < numero <= 100):
            return None

        return numero

    porcentajes_modalidades = []

    for modalidad in modalidades:
        if not isinstance(modalidad, dict):
            return False

        porcentaje = convertir_porcentaje(modalidad.get("porcentaje"))
        condicion = modalidad.get("condicion")

        if porcentaje is None:
            return False

        if not isinstance(condicion, str) or not condicion.strip():
            return False

        porcentajes_modalidades.append(porcentaje)

    porcentajes_calculo_normalizados = [
        convertir_porcentaje(valor)
        for valor in porcentajes_calculo
    ]

    if None in porcentajes_calculo_normalizados:
        return False

    if len(set(porcentajes_modalidades)) != len(porcentajes_modalidades):
        return False

    if len(set(porcentajes_calculo_normalizados)) != len(porcentajes_calculo_normalizados):
        return False

    return set(porcentajes_modalidades) == set(porcentajes_calculo_normalizados)


def validar_modalidades(ficha):
    from decimal import Decimal, InvalidOperation

    if not isinstance(ficha, dict):
        return False

    modalidades = ficha.get("modalidades")
    calculo = ficha.get("calculo")

    if not isinstance(modalidades, list) or not modalidades:
        return False

    if not isinstance(calculo, dict):
        return False

    porcentajes_calculo = calculo.get("porcentajes_segun_modalidad")

    if not isinstance(porcentajes_calculo, list) or not porcentajes_calculo:
        return False

    def convertir_porcentaje(valor):
        if type(valor) not in (int, float):
            return None

        try:
            numero = Decimal(str(valor))
        except InvalidOperation:
            return None

        if not numero.is_finite() or not (0 < numero <= 100):
            return None

        return numero

    porcentajes_modalidades = []

    for modalidad in modalidades:
        if not isinstance(modalidad, dict):
            return False

        porcentaje = convertir_porcentaje(modalidad.get("porcentaje"))
        condicion = modalidad.get("condicion")

        if porcentaje is None:
            return False

        if not isinstance(condicion, str) or not condicion.strip():
            return False

        porcentajes_modalidades.append(porcentaje)

    porcentajes_calculo_normalizados = [
        convertir_porcentaje(valor)
        for valor in porcentajes_calculo
    ]

    if None in porcentajes_calculo_normalizados:
        return False

    if len(set(porcentajes_modalidades)) != len(porcentajes_modalidades):
        return False

    if len(set(porcentajes_calculo_normalizados)) != len(porcentajes_calculo_normalizados):
        return False

    return set(porcentajes_modalidades) == set(porcentajes_calculo_normalizados)
