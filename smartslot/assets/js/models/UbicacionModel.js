/**
 * @file       UbicacionModel.js
 * @layer      Model (MVC)
 * @description Representa y consulta las ubicaciones físicas del almacén.
 *              No hace fetch, no toca el DOM — solo lógica de datos.
 *
 * Depende de: data/wms_data.js (debe cargarse antes en el HTML)
 */

const UbicacionModel = (() => {

  /* ─── Helpers internos ─────────────────────────────────────── */

  /**
   * Extrae el prefijo de pasillo de un código de celda
   * @param {string} celda — ej. "BP40", "CP259"
   * @returns {string} — ej. "BP", "CP"
   */
  const _pasillo = (celda) => celda.replace(/\d.*$/, '');

  /**
   * Extrae el número de posición de un código de celda
   * @param {string} celda — ej. "BP40"
   * @returns {number} — ej. 40
   */
  const _posicion = (celda) => parseInt(celda.replace(/^[A-Z]+/, ''), 10) || 0;

  /* ─── API pública ──────────────────────────────────────────── */

  return {

    /**
     * Devuelve todas las celdas registradas en el sistema
     * @returns {string[]}
     */
    obtenerTodas() {
      return Object.keys(WMS_DATA.ocupacion);
    },

    /**
     * Devuelve el % de ocupación de una celda
     * @param {string} celda
     * @returns {number|null}
     */
    obtenerOcupacion(celda) {
      return WMS_DATA.ocupacion[celda] ?? null;
    },

    /**
     * Devuelve el producto asignado a una celda
     * @param {string} celda
     * @returns {string}
     */
    obtenerProducto(celda) {
      return WMS_DATA.productos[celda] ?? '—';
    },

    /**
     * Indica si una celda está en la ruta de picking activa
     * @param {string} celda
     * @returns {boolean}
     */
    estaEnRuta(celda) {
      return WMS_DATA.rutaActiva.includes(celda);
    },

    /**
     * Devuelve el índice X (proximidad a despacho) de una celda
     * 1 = más cerca, 13 = más lejos
     * @param {string} celda
     * @returns {number}
     */
    obtenerX(celda) {
      const pasillo = _pasillo(celda);
      return WMS_DATA.pasillos[pasillo]?.x ?? 13;
    },

    /**
     * Devuelve la zona (A-E) a la que pertenece una celda
     * @param {string} celda
     * @returns {string} — "A","B","C","D","E" o "?"
     */
    obtenerZona(celda) {
      const pasillo = _pasillo(celda);
      for (const [zona, config] of Object.entries(WMS_DATA.zonas)) {
        if (config.pasillos.includes(pasillo)) return zona;
      }
      return '?';
    },

    /**
     * Filtra ubicaciones disponibles (ocupación < umbral)
     * @param {number} [umbralMax=90] — porcentaje máximo de ocupación
     * @returns {string[]}
     */
    obtenerDisponibles(umbralMax = 90) {
      return Object.entries(WMS_DATA.ocupacion)
        .filter(([, occ]) => occ < umbralMax)
        .map(([celda]) => celda);
    },

    /**
     * Filtra ubicaciones compatibles con el tipo y dimensiones de mercancía.
     *
     * Reglas dimensionales:
     *   tarima  (120×100×160cm): solo pasillos AP/BP con mucho espacio (occ <70%)
     *                             y pasillos KP-MP (zona overflow para pallets grandes)
     *   caja    (40×100×90cm):   cualquier pasillo disponible
     *   suelto  (unidad suelta):  preferencia a CP/DP (estantería), evita tarima
     *
     * @param {"caja"|"tarima"|"suelto"} tipo
     * @param {Object} [dims] — { largo, ancho, alto } en cm (opcional)
     * @returns {string[]}
     */
    obtenerCompatibles(tipo, dims = null) {
      const todas = this.obtenerDisponibles();

      if (tipo === 'tarima') {
        // Tarimas necesitan rack de piso (pasillos A/B) o zona overflow (K-M)
        const pasilloPallet = ['AP','BP','KP','LP','MP'];
        return todas.filter(c => {
          const p = _pasillo(c);
          if (!pasilloPallet.includes(p)) return false;
          const occ = WMS_DATA.ocupacion[c] ?? 100;
          return occ < 70; // Tarimas necesitan más espacio libre
        });
      }

      if (tipo === 'suelto') {
        // Producto suelto → estantería estándar CP/DP/EP preferida
        // No va a zona overflow (KP-MP) salvo que no haya opción
        const pasilloSuelto = ['AP','BP','CP','DP','EP','FP','GP','HP','IP','JP'];
        const cands = todas.filter(c => pasilloSuelto.includes(_pasillo(c)));
        return cands.length ? cands : todas;
      }

      // Caja: cualquier ubicación disponible
      // Si hay dimensiones y no caben en estantería, excluir CP/DP
      if (dims && dims.alto > 90) {
        return todas.filter(c => !['CP','DP'].includes(_pasillo(c)));
      }
      return todas;
    },

    /**
     * Calcula la distancia Manhattan entre dos celdas (en unidades de posición)
     * Usada por el simulador de ahorro
     * @param {string} celdaA
     * @param {string} celdaB
     * @returns {number}
     */
    calcularDistancia(celdaA, celdaB) {
      const xA = this.obtenerX(celdaA);
      const xB = this.obtenerX(celdaB);
      const yA = _posicion(celdaA);
      const yB = _posicion(celdaB);
      // Cada unidad X = ~8 metros entre pasillos, cada unidad Y = ~1 metro
      return (Math.abs(xA - xB) * 8) + Math.abs(yA - yB);
    },

    /**
     * Devuelve metadata completa de una celda
     * @param {string} celda
     * @returns {Object}
     */
    obtenerDetalle(celda) {
      return {
        celda,
        pasillo:   _pasillo(celda),
        posicion:  _posicion(celda),
        x:         this.obtenerX(celda),
        zona:      this.obtenerZona(celda),
        ocupacion: this.obtenerOcupacion(celda),
        producto:  this.obtenerProducto(celda),
        enRuta:    this.estaEnRuta(celda)
      };
    }
  };
})();
