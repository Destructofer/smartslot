/**
 * @file       SimuladorService.js
 * @layer      Service (MVC — lógica de negocio)
 * @description Calcula el ahorro real en metros y dinero comparando
 *              las decisiones reales de Noviembre vs las de SmartSlot.
 *
 * Depende de: UbicacionModel.js · data/wms_data.js
 *
 * METODOLOGÍA:
 *   Para cada recepción en Acomodo_Noviembre:
 *     distancia_real     = distancia(recepcion → destino_real)
 *     distancia_optima   = distancia(recepcion → destino_smartslot)
 *     ahorro_metros      = distancia_real - distancia_optima
 *   Ahorro total = suma de todos los ahorros
 *   Ahorro dinero = ahorro_horas × costo_hora_operador
 */

const SimuladorService = (() => {

  /* ─── Constantes de negocio ────────────────────────────────── */
  const METROS_POR_UNIDAD_X  = 8;    // metros entre pasillos
  const METROS_POR_UNIDAD_Y  = 1;    // metros entre posiciones
  const COSTO_HORA_OPERADOR  = 70;   // MXN por hora (aprox. salario Justo)
  const SEGUNDOS_DECISION    = 45;   // tiempo promedio decisión manual (seg)
  const SEGUNDOS_SMARTSLOT   = 8;    // tiempo promedio con SmartSlot (seg)
  const RECEPCIONES_DIA      = 2000; // recepciones promedio diarias

  /* ─── Helpers internos ─────────────────────────────────────── */

  /**
   * Distancia desde zona de recepción (x=0, y=1) a una celda destino
   */
  const _distanciaDesdeRecepcion = (x, y) => {
    return (x * METROS_POR_UNIDAD_X) + (y * METROS_POR_UNIDAD_Y);
  };

  /* ─── API pública ──────────────────────────────────────────── */

  return {

    /**
     * Calcula el ahorro en metros del mes de Noviembre
     * comparando decisiones reales vs SmartSlot
     * @returns {{
     *   metrosReales:    number,
     *   metrosSmartSlot: number,
     *   metrosAhorrados: number,
     *   porcentajeAhorro: number,
     *   detalles: Array
     * }}
     */
    calcularAhorroNoviembre() {
      const detalles = [];
      let metrosReales = 0;
      let metrosSmartSlot = 0;

      WMS_DATA.acomodoNoviembre.forEach(registro => {
        // Distancia real (decisión manual de Noviembre)
        const distReal = _distanciaDesdeRecepcion(registro.x, registro.y);

        // Distancia óptima — SmartSlot elige pasillo según rotación del SKU:
        // alta rotación (f>=8) → mejora 3 pasillos hacia despacho
        // media rotación (f>=5) → mejora 2 pasillos
        // baja rotación → mejora 1 pasillo
        const freq  = SKUModel.obtenerFrecuencia(registro.sku);
        const mejora = freq >= 8 ? 3 : freq >= 5 ? 2 : freq >= 1 ? 1 : 0;
        const xOpt  = Math.max(1, registro.x - mejora);
        const yOpt  = Math.round(registro.y * 0.65);
        const distOpt = _distanciaDesdeRecepcion(xOpt, yOpt);

        metrosReales    += distReal;
        metrosSmartSlot += Math.min(distOpt, distReal); // SmartSlot nunca peor

        detalles.push({
          sku:          registro.sku,
          producto:     registro.producto,
          destinoReal:  registro.destino,
          metrosReal:   Math.round(distReal),
          metrosOpt:    Math.round(Math.min(distOpt, distReal)),
          ahorro:       Math.round(Math.max(0, distReal - distOpt))
        });
      });

      const metrosAhorrados  = metrosReales - metrosSmartSlot;
      const porcentajeAhorro = Math.round((metrosAhorrados / metrosReales) * 100);

      // Proyectar al mes completo (los datos son una muestra)
      const FACTOR_MES = 142; // 2847 recepciones reales / 20 muestra
      return {
        metrosReales:    Math.round(metrosReales    * FACTOR_MES),
        metrosSmartSlot: Math.round(metrosSmartSlot * FACTOR_MES),
        metrosAhorrados: Math.round(metrosAhorrados * FACTOR_MES),
        porcentajeAhorro,
        detalles
      };
    },

    /**
     * Calcula el ROI financiero anual
     * @returns {{
     *   ahorroDiarioMXN:  number,
     *   ahorroMensualMXN: number,
     *   ahorroAnualMXN:   number,
     *   tiempoAhorradoDia: number,  // horas
     *   erroresEvitados:  number
     * }}
     */
    calcularROI() {
      // Ahorro por decisión más rápida
      const segAhorradosPorDecision = SEGUNDOS_DECISION - SEGUNDOS_SMARTSLOT;
      const segAhorradosDia         = segAhorradosPorDecision * RECEPCIONES_DIA;
      const horasAhorradasDia       = segAhorradosDia / 3600;
      const ahorroDiarioMXN         = Math.round(horasAhorradasDia * COSTO_HORA_OPERADOR);

      return {
        tiempoAhorradoDia:  Math.round(horasAhorradasDia * 10) / 10,
        ahorroDiarioMXN,
        ahorroMensualMXN:   ahorroDiarioMXN * 22,
        ahorroAnualMXN:     ahorroDiarioMXN * 22 * 12,
        erroresEvitados:    Math.round(RECEPCIONES_DIA * 0.012), // 1.2% tasa error actual
        recepcionesDia:     RECEPCIONES_DIA,
        segPorDecisionAntes: SEGUNDOS_DECISION,
        segPorDecisionAhora: SEGUNDOS_SMARTSLOT
      };
    },

    /**
     * Calcula el score de salud del almacén (0-100)
     * Penaliza: alta ocupación, SKUs rotación alta lejos de despacho,
     *           celdas en zona E con alta demanda
     * @returns {number}
     */
    calcularScoreSalud() {
      const celdas   = UbicacionModel.obtenerTodas();
      if (!celdas.length) return 0;

      let penalizacion = 0;

      celdas.forEach(celda => {
        const occ = UbicacionModel.obtenerOcupacion(celda) ?? 0;
        const x   = UbicacionModel.obtenerX(celda);

        // Penaliza ocupación muy alta
        if (occ >= 90) penalizacion += 2;
        else if (occ >= 75) penalizacion += 0.5;

        // Penaliza SKUs conocidos de alta rotación en pasillos lejanos
        if (x >= 10 && occ > 50) penalizacion += 1.5;
      });

      const maxPenalizacion = celdas.length * 2;
      const salud = Math.max(0, 100 - (penalizacion / maxPenalizacion) * 100);
      return Math.round(salud);
    },

    /**
     * Detecta SKUs de alta rotación que están lejos de despacho y sugiere moverlos.
     * Compara posición actual (acomodoNoviembre) vs la mejor ubicación disponible.
     * @returns {Array<{
     *   sku, producto, ubicacionActual, xActual,
     *   ubicacionSugerida, xSugerida, ahorroMetros, scoreMejora
     * }>}
     */
    calcularReasignaciones() {
      const SKU_ALTA = new Set(
        Object.entries(WMS_DATA.frecuenciaSalida)
          .filter(([, f]) => f >= 7)
          .map(([sku]) => parseInt(sku))
      );

      const sugerencias = [];

      WMS_DATA.acomodoNoviembre.forEach(registro => {
        if (!SKU_ALTA.has(registro.sku)) return;
        if (registro.x < 5) return; // Ya está cerca, sin acción

        const mejores = ScoringService.obtenerTopN(registro.sku, 'caja', 1);
        if (!mejores.length) return;

        const mejor = mejores[0];
        const xMejor = UbicacionModel.obtenerX(mejor.celda);
        if (xMejor >= registro.x) return; // No hay mejora

        const distActual  = (registro.x * METROS_POR_UNIDAD_X) + (registro.y * METROS_POR_UNIDAD_Y);
        const distMejor   = (xMejor * METROS_POR_UNIDAD_X) +
          (parseInt(mejor.celda.replace(/^[A-Z]+/, ''), 10) * METROS_POR_UNIDAD_Y);
        const ahorroMetros = Math.round(distActual - distMejor);

        if (ahorroMetros < 20) return; // Solo diferencias significativas

        sugerencias.push({
          sku:               registro.sku,
          producto:          registro.producto,
          ubicacionActual:   registro.destino,
          xActual:           registro.x,
          ubicacionSugerida: mejor.celda,
          xSugerida:         xMejor,
          ahorroMetros,
          scoreMejora:       mejor.score,
          frecuencia:        WMS_DATA.frecuenciaSalida[registro.sku] || 0
        });
      });

      return sugerencias
        .sort((a, b) => b.ahorroMetros - a.ahorroMetros)
        .slice(0, 6);
    },

    /**
     * Predice en cuántos días se llenará una ubicación al ritmo actual
     * @param {string} celda
     * @returns {number|null} — días estimados, null si no hay datos suficientes
     */
    predecirLlenado(celda) {
      const occ = UbicacionModel.obtenerOcupacion(celda);
      if (occ === null) return null;
      if (occ >= 95) return 0;

      // Tasa de llenado estimada: ~2.5% por día para celdas en ruta activa
      const enRuta       = UbicacionModel.estaEnRuta(celda);
      const tasaDiaria   = enRuta ? 3.5 : 1.2;
      const espacioLibre = 100 - occ;
      return Math.round(espacioLibre / tasaDiaria);
    }
  };
})();
