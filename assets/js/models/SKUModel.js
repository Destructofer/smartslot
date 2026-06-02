/**
 * @file       SKUModel.js
 * @layer      Model (MVC)
 * @description Representa un SKU y su historial de salida.
 *              Expone métodos de consulta sin tocar el DOM.
 *
 * Depende de: data/wms_data.js
 */

const SKUModel = (() => {

  return {

    /**
     * Devuelve la frecuencia de salida de un SKU
     * @param {number|string} sku
     * @returns {number} — 0 si no hay historial
     */
    obtenerFrecuencia(sku) {
      return WMS_DATA.frecuenciaSalida[parseInt(sku, 10)] ?? 0;
    },

    /**
     * Frecuencia normalizada entre 0 y 1
     * @param {number|string} sku
     * @returns {number}
     */
    obtenerFrecuenciaNorm(sku) {
      const max = Math.max(...Object.values(WMS_DATA.frecuenciaSalida));
      return this.obtenerFrecuencia(sku) / (max || 1);
    },

    /**
     * Clasifica la rotación de un SKU
     * @param {number|string} sku
     * @returns {"alta"|"media"|"baja"|"sin datos"}
     */
    obtenerRotacion(sku) {
      const f = this.obtenerFrecuencia(sku);
      if (f === 0)  return 'sin datos';
      if (f >= 8)   return 'alta';
      if (f >= 5)   return 'media';
      return 'baja';
    },

    /**
     * Busca ubicaciones actuales de un SKU en el stock
     * @param {number|string} sku
     * @returns {string[]} — lista de celdas donde está el SKU
     */
    obtenerUbicaciones(sku) {
      // Busca en productos por nombre aproximado no está en los datos base,
      // pero sí podemos buscar en acomodo histórico
      return WMS_DATA.acomodoNoviembre
        .filter(r => r.sku === parseInt(sku, 10))
        .map(r => r.destino);
    },

    /**
     * Devuelve SKUs "vecinos" (que suelen salir juntos en la misma ruta)
     * Derivado del análisis de Ruta_Odoo — pares frecuentes
     * @param {number|string} sku
     * @returns {number[]}
     */
    obtenerVecinos(sku) {
      // Pares identificados del análisis de Ruta_Odoo.xlsx
      const pares = {
        10366: [10210, 12219],  // Atún Dolores + Mayonesa + Ate Guayaba
        10210: [10366, 10369],  // Mayonesa + Atún + Chiles Jalapeños
        21483: [12292, 27629],  // Toallas Jüsto + Servilletas + Toallitas Baby
        12219: [10366, 12292],  // Ate Guayaba + Atún + Servilletas
        10236: [10242, 15091],  // Avena + Azúcar Morena + Agua Manantial
        13488: [12477, 12479],  // Cápsulas Robusto + Express + Lungo
        22248: [22249, 26983],  // Pesto Albahaca + Salsa Tomate + Pesto Poblano
        22249: [22248, 22250],  // Salsa Tomate + Pesto + Pasta Tomate
      };
      return pares[parseInt(sku, 10)] ?? [];
    }
  };
})();
