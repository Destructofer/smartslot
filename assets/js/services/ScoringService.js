/**
 * @file       ScoringService.js
 * @layer      Service (MVC — lógica de negocio)
 * @description Motor de scoring inteligente de ubicaciones.
 *              Calcula el score óptimo para cada ubicación candidata
 *              usando 4 factores ponderados con datos reales de Justo.
 *
 * Depende de: UbicacionModel.js · SKUModel.js
 *
 * FÓRMULA:
 *   Score = (espacio × 0.35) + (proximidad × 0.30) + (frecuencia × 0.25) + (zona × 0.10)
 */

const ScoringService = (() => {

  /* ─── Pesos de cada factor (deben sumar 1.0) ──────────────── */
  const PESOS = {
    espacio:     0.35,
    proximidad:  0.30,
    frecuencia:  0.25,
    zona:        0.10
  };

  /* ─── Helpers de score por factor ─────────────────────────── */

  /**
   * Detecta la marca de un producto por su descripción
   * @param {string} descripcion
   * @returns {string|null}
   */
  const _detectarMarca = (descripcion) => {
    if (!descripcion) return null;
    const d = descripcion.toLowerCase();
    for (const marca of Object.keys(WMS_DATA.marcaZonas)) {
      if (d.includes(marca.toLowerCase())) return marca;
    }
    return null;
  };

  /**
   * Factor 1: Espacio disponible (0-1)
   * Más espacio libre = score más alto
   */
  const _scoreEspacio = (celda) => {
    const occ = UbicacionModel.obtenerOcupacion(celda) ?? 100;
    return (100 - occ) / 100;
  };

  /**
   * Factor 2: Proximidad a zona de despacho (0-1)
   * Pasillo más cercano (X=1) = score más alto
   */
  const _scoreProximidad = (celda) => {
    const x = UbicacionModel.obtenerX(celda);
    const MAX_PASILLOS = 13;
    return (MAX_PASILLOS - x) / (MAX_PASILLOS - 1);
  };

  /**
   * Factor 3: Frecuencia de salida del SKU (0-1)
   * SKU de alta rotación → debe estar cerca = premia las celdas cercanas
   */
  const _scoreFrecuencia = (celda, sku) => {
    const freqNorm = SKUModel.obtenerFrecuenciaNorm(sku);
    const proxNorm = _scoreProximidad(celda);
    return freqNorm * proxNorm + (1 - freqNorm) * 0.5;
  };

  /**
   * Factor 4: Compatibilidad de zona por marca/cliente (0-1)
   * Si se conoce la marca, premia celdas en la zona asignada a ese cliente.
   * Sin marca conocida, usa scoring por proximidad a despacho.
   * @param {string} celda
   * @param {string|null} marca — resultado de _detectarMarca()
   */
  const _scoreZona = (celda, marca = null) => {
    const zona = UbicacionModel.obtenerZona(celda);

    if (marca && WMS_DATA.marcaZonas[marca]) {
      const zonaPreferida = WMS_DATA.marcaZonas[marca].zona;
      if (zona === zonaPreferida) return 1.0;
      // Zonas adyacentes reciben score parcial
      const distancia = Math.abs(zona.charCodeAt(0) - zonaPreferida.charCodeAt(0));
      return Math.max(0.1, 1.0 - distancia * 0.25);
    }

    const puntosZona = { A: 1.0, B: 0.9, C: 0.7, D: 0.5, E: 0.2, '?': 0.3 };
    return puntosZona[zona] ?? 0.3;
  };

  /* ─── API pública ──────────────────────────────────────────── */

  return {

    /**
     * Calcula el score final de una ubicación para un SKU
     * @param {string} celda
     * @param {number|string} sku
     * @returns {{
     *   celda: string,
     *   score: number,          // 0-100
     *   factores: {
     *     espacio:    number,   // 0-1
     *     proximidad: number,   // 0-1
     *     frecuencia: number,   // 0-1
     *     zona:       number    // 0-1
     *   },
     *   detalle: Object         // metadata de la ubicación
     * }}
     */
    /**
     * Calcula el score final de una ubicación para un SKU
     * @param {string} celda
     * @param {number|string} sku
     * @param {string|null} [descripcion] — descripción del producto para detectar marca
     */
    calcularScore(celda, sku, descripcion = null) {
      const marca = _detectarMarca(descripcion);
      const e = _scoreEspacio(celda);
      const p = _scoreProximidad(celda);
      const f = _scoreFrecuencia(celda, sku);
      const z = _scoreZona(celda, marca);

      const scoreRaw =
        (e * PESOS.espacio) +
        (p * PESOS.proximidad) +
        (f * PESOS.frecuencia) +
        (z * PESOS.zona);

      return {
        celda,
        score:    Math.round(scoreRaw * 100),
        marca:    marca,
        factores: {
          espacio:    Math.round(e * 100),
          proximidad: Math.round(p * 100),
          frecuencia: Math.round(f * 100),
          zona:       Math.round(z * 100)
        },
        detalle: UbicacionModel.obtenerDetalle(celda)
      };
    },

    /**
     * Devuelve el Top N de ubicaciones sugeridas para un SKU
     * @param {number|string} sku
     * @param {"caja"|"tarima"|"suelto"} tipo
     * @param {number} [top=3]
     * @param {string|null} [descripcion] — descripción para detectar marca/cliente
     * @param {Object|null} [dims] — { largo, ancho, alto } en cm para filtro dimensional
     * @returns {Array} — lista de resultados ordenados por score desc
     */
    obtenerTopN(sku, tipo = 'caja', top = 3, descripcion = null, dims = null) {
      const candidatas = UbicacionModel.obtenerCompatibles(tipo, dims);

      return candidatas
        .map(celda => this.calcularScore(celda, sku, descripcion))
        .sort((a, b) => b.score - a.score)
        .slice(0, top);
    },

    /**
     * Detecta la marca de un producto (expuesto para uso en UI)
     * @param {string} descripcion
     * @returns {string|null}
     */
    detectarMarca(descripcion) {
      return _detectarMarca(descripcion);
    },

    /**
     * Genera la razón en lenguaje natural para la sugerencia #1
     * @param {Object} resultado — objeto devuelto por calcularScore()
     * @param {number|string} sku
     * @returns {string}
     */
    generarRazon(resultado, sku) {
      const { factores, detalle } = resultado;
      const rotacion = SKUModel.obtenerRotacion(sku);
      const partes = [];

      if (factores.espacio >= 60)
        partes.push(`${100 - detalle.ocupacion}% de espacio libre`);

      if (factores.proximidad >= 70)
        partes.push(`Pasillo ${detalle.pasillo} (cerca de despacho)`);
      else if (factores.proximidad <= 30)
        partes.push(`Pasillo ${detalle.pasillo} (zona de desborde)`);

      if (rotacion === 'alta')
        partes.push('SKU de alta rotación');
      else if (rotacion === 'baja')
        partes.push('SKU de baja rotación');

      if (detalle.enRuta)
        partes.push('En ruta de picking activa');

      return partes.length > 0 ? partes.join(' · ') : 'Mejor opción disponible';
    },

    /**
     * Expone los pesos para mostrarlos en el dashboard
     * @returns {Object}
     */
    obtenerPesos() {
      return { ...PESOS };
    }
  };
})();
