/**
 * @file       WaldoService.js
 * @layer      Service (MVC — asistente IA)
 * @description Asistente Waldo con respuestas inteligentes generadas a partir
 *              de los datos reales del almacén. No requiere conexión externa.
 *
 * Depende de: SimuladorService.js · UbicacionModel.js · SKUModel.js
 */

const WaldoService = (() => {

  /* ─── Historial de conversación ─────────────────────────────── */
  let _historial = [];

  /* ─── Detectores de intención ────────────────────────────────── */

  const _detectarIntencion = (msg) => {
    const m = msg.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (/cuanto|ahorro|dinero|roi|economia|save|pesos|mxn/.test(m))        return 'roi';
    if (/critico|critica|llena|llenara|lleno|alerta|urgente/.test(m))      return 'alertas';
    if (/salud|score|estado|calidad|porcentaje|health/.test(m))            return 'salud';
    if (/reasign|mover|move|cambiar|reorgani|opti/.test(m))                return 'reasignacion';
    if (/sku\s*\d+|\d{5}/.test(m))                                         return 'sku';
    if (/pasillo|aisle|zona|area|seccion/.test(m))                         return 'pasillos';
    if (/ruta|picking|pedido|order/.test(m))                               return 'ruta';
    if (/vecin|junto|compatib|par|parej/.test(m))                          return 'vecinos';
    if (/recepcion|recib|entreg|arribo/.test(m))                           return 'recepcion';
    if (/prediccion|predic|cuanto tiempo|cuando|dias/.test(m))             return 'prediccion';
    if (/hola|buen|gracias|quien|eres/.test(m))                            return 'saludo';
    return 'general';
  };

  /* ─── Generadores de respuesta por intención ─────────────────── */

  const _respuestas = {

    roi() {
      const roi   = SimuladorService.calcularROI();
      const sim   = SimuladorService.calcularAhorroNoviembre();
      return `💰 Con SmartSlot, Justo ahorra aproximadamente **$${roi.ahorroDiarioMXN.toLocaleString('es-MX')} MXN diarios** al reducir el tiempo de decisión de ${roi.segPorDecisionAntes}s a ${roi.segPorDecisionAhora}s por recepción. En noviembre, el sistema hubiera ahorrado **${sim.metrosAhorrados.toLocaleString('es-MX')} metros** de caminata (${sim.porcentajeAhorro}% menos), equivalente a **$${roi.ahorroMensualMXN.toLocaleString('es-MX')} MXN/mes**. En un año: **$${roi.ahorroAnualMXN.toLocaleString('es-MX')} MXN**.`;
    },

    alertas() {
      const todas = UbicacionModel.obtenerTodas();
      const criticas = todas
        .map(c => ({ celda: c, occ: UbicacionModel.obtenerOcupacion(c) ?? 0, dias: SimuladorService.predecirLlenado(c) }))
        .filter(a => a.occ >= 85)
        .sort((a, b) => b.occ - a.occ)
        .slice(0, 4);

      if (!criticas.length) return '✅ El almacén no tiene ubicaciones en estado crítico en este momento. El sistema monitoreará en tiempo real conforme lleguen nuevas recepciones.';

      const lista = criticas.map(a =>
        `• **${a.celda}** — ${a.occ}% lleno${a.dias !== null ? `, se llena en ~${a.dias} días` : ''}`
      ).join('\n');
      return `⚠️ Hay **${criticas.length} ubicaciones en estado crítico** (>85% ocupadas):\n${lista}\n\nSe recomienda priorizar estas celdas para reasignación preventiva antes de la próxima recepción.`;
    },

    salud() {
      const score  = SimuladorService.calcularScoreSalud();
      const todas  = UbicacionModel.obtenerTodas();
      const disp   = UbicacionModel.obtenerDisponibles().length;
      const crit   = todas.filter(c => (UbicacionModel.obtenerOcupacion(c) ?? 0) >= 90).length;
      const estado = score >= 70 ? 'buen estado 🟢' : score >= 40 ? 'estado regular 🟡' : 'estado crítico 🔴';
      return `📊 El almacén tiene un score de salud de **${score}/100** — en ${estado}. Hay **${disp} ubicaciones disponibles** de ${todas.length} totales, y **${crit} ubicaciones críticas** (≥90% llenas). ${score < 70 ? 'Se recomienda ejecutar las reasignaciones preventivas visibles en el Dashboard.' : 'El sistema está bien distribuido.'}`;
    },

    reasignacion() {
      const sugs = SimuladorService.calcularReasignaciones();
      if (!sugs.length) return '✅ No hay reasignaciones urgentes — los SKUs de alta rotación están en zonas adecuadas.';
      const top = sugs.slice(0, 3).map(s =>
        `• SKU **${s.sku}** de ${s.ubicacionActual} → **${s.ubicacionSugerida}** (ahorra ~${s.ahorroMetros}m/visita)`
      ).join('\n');
      return `🔄 Hay **${sugs.length} reasignaciones sugeridas** para SKUs de alta rotación que están lejos del despacho:\n${top}\n\nPuedes verlas en el Dashboard → sección "Reasignación preventiva".`;
    },

    sku(msg) {
      const match = msg.match(/\d{5}/);
      if (!match) return 'Por favor indica el número de SKU (5 dígitos) para buscarlo.';
      const sku   = parseInt(match[0]);
      const freq  = SKUModel.obtenerFrecuencia(sku);
      const rot   = SKUModel.obtenerRotacion(sku);
      const ubics = SKUModel.obtenerUbicaciones(sku);
      const vec   = SKUModel.obtenerVecinos(sku);

      if (freq === 0 && !ubics.length) return `No encontré historial para el SKU **${sku}** en los datos de noviembre. Puede ser un SKU nuevo o de baja frecuencia.`;

      let resp = `🔍 **SKU ${sku}**: rotación ${rot} (frecuencia ${freq}×/mes).`;
      if (ubics.length) resp += ` Ubicaciones históricas: **${ubics.join(', ')}**.`;
      if (vec.length)   resp += ` Sus vecinos de co-picking son los SKUs **${vec.join(', ')}** — convienen estar en pasillos adyacentes.`;
      return resp;
    },

    pasillos() {
      const pasillos = Object.keys(WMS_DATA.pasillos);
      const occs = pasillos.map(p => {
        const celdas = UbicacionModel.obtenerTodas().filter(c => c.startsWith(p));
        if (!celdas.length) return { p, avg: 0 };
        const sum = celdas.reduce((a, c) => a + (UbicacionModel.obtenerOcupacion(c) ?? 0), 0);
        return { p, avg: Math.round(sum / celdas.length) };
      }).sort((a, b) => b.avg - a.avg);

      const criticos = occs.filter(o => o.avg >= 70).map(o => `**${o.p}** (${o.avg}%)`);
      const libres   = occs.filter(o => o.avg < 30).map(o => `**${o.p}** (${o.avg}%)`);

      let resp = `🗺️ El almacén tiene 13 pasillos (AP–MP). `;
      if (criticos.length) resp += `Pasillos más llenos: ${criticos.slice(0, 3).join(', ')}. `;
      if (libres.length)   resp += `Pasillos con más espacio: ${libres.slice(0, 3).join(', ')}. `;
      resp += `AP y BP son los más cercanos a la zona de despacho — ideales para SKUs de alta rotación.`;
      return resp;
    },

    ruta() {
      const ruta = WMS_DATA.rutaActiva;
      const dist = {};
      ruta.forEach(c => { const p = c.replace(/\d.*$/, ''); dist[p] = (dist[p] || 0) + 1; });
      const top3 = Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 3);
      return `🛒 La ruta de picking activa incluye **${ruta.length} ubicaciones** en ${Object.keys(dist).length} pasillos. Los pasillos con más picks son: ${top3.map(([p, n]) => `**${p}** (${n} picks)`).join(', ')}. Los productos en ruta deben estar en ubicaciones con alta disponibilidad para no frenar el picking.`;
    },

    vecinos() {
      const pares = [
        { a: 10366, na: 'Atún Dolores', b: 10210, nb: 'Mayonesa McCormick' },
        { a: 13488, na: 'Cápsulas Robusto', b: 12477, nb: 'Cápsulas Express' },
        { a: 22248, na: 'Pesto Albahaca', b: 22249, nb: 'Salsa Tomate Jüsto' },
        { a: 10236, na: 'Avena', b: 10242, nb: 'Azúcar Morena' }
      ];
      const lista = pares.map(p => `• **${p.na}** (${p.a}) ↔ **${p.nb}** (${p.b})`).join('\n');
      return `🤝 SmartSlot identifica SKUs que siempre se piden juntos en picking ("vecinos compatibles"). Los pares principales son:\n${lista}\n\nEl sistema los coloca en pasillos adyacentes para reducir el recorrido del picker.`;
    },

    recepcion() {
      const roi  = SimuladorService.calcularROI();
      const disp = UbicacionModel.obtenerDisponibles().length;
      return `📦 En el flujo de recepción, SmartSlot evalúa en <1 segundo ${disp} ubicaciones disponibles usando 4 factores: espacio libre (35%), cercanía al despacho (30%), rotación histórica del SKU (25%) y zona del cliente (10%). Cada decisión tarda **${roi.segPorDecisionAhora}s** vs los **${roi.segPorDecisionAntes}s** manuales actuales.`;
    },

    prediccion() {
      const todas = UbicacionModel.obtenerTodas();
      const preds = todas
        .map(c => ({ celda: c, dias: SimuladorService.predecirLlenado(c), occ: UbicacionModel.obtenerOcupacion(c) ?? 0 }))
        .filter(p => p.dias !== null && p.dias <= 4 && p.occ >= 70)
        .sort((a, b) => a.dias - b.dias)
        .slice(0, 4);

      if (!preds.length) return '📅 No hay ubicaciones con riesgo inmediato de llenado esta semana. El sistema monitorea continuamente y alertará con anticipación.';

      const lista = preds.map(p => `• **${p.celda}** — ${p.occ}% lleno, se llena en ~${p.dias} días`).join('\n');
      return `📅 Estas ubicaciones se llenarán en los próximos días al ritmo actual:\n${lista}\n\nSe recomienda no asignar nuevas recepciones a estas celdas.`;
    },

    saludo() {
      const salud = SimuladorService.calcularScoreSalud();
      const disp  = UbicacionModel.obtenerDisponibles().length;
      return `👋 ¡Hola! Soy Waldo, el asistente de SmartSlot. Estoy conectado a los datos reales del almacén de Justo.\n\nEstado actual: salud **${salud}/100**, **${disp} ubicaciones disponibles**. ¿En qué te puedo ayudar? Puedo responder sobre ROI, pasillos críticos, SKUs específicos, reasignaciones sugeridas o cualquier aspecto de la operación.`;
    },

    general(msg) {
      const salud = SimuladorService.calcularScoreSalud();
      const roi   = SimuladorService.calcularROI();
      return `🤖 Soy Waldo, asistente del almacén Justo. El almacén tiene salud **${salud}/100** y SmartSlot genera un ahorro estimado de **$${roi.ahorroDiarioMXN.toLocaleString('es-MX')} MXN/día**. Puedes preguntarme sobre: ahorros, pasillos críticos, SKUs, reasignaciones, predicciones de llenado o la ruta de picking activa.`;
    }
  };

  /* ─── Formatea markdown básico a HTML para el chat ───────────── */

  const _formatear = (texto) =>
    texto
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

  /* ─── API pública ────────────────────────────────────────────── */

  return {

    /**
     * Procesa un mensaje y devuelve la respuesta de Waldo
     * @param {string} mensaje
     * @returns {Promise<string>}
     */
    async preguntar(mensaje) {
      _historial.push({ role: 'user', content: mensaje });

      // Simula latencia de "procesamiento" para realismo
      await new Promise(r => setTimeout(r, 280 + Math.random() * 320));

      const intencion = _detectarIntencion(mensaje);
      const fn = _respuestas[intencion];
      const respuestaRaw = typeof fn === 'function'
        ? fn(mensaje)
        : _respuestas.general(mensaje);

      const respuesta = _formatear(respuestaRaw);
      _historial.push({ role: 'assistant', content: respuestaRaw });

      if (_historial.length > 20) _historial = _historial.slice(-20);

      return respuesta;
    },

    /**
     * Limpia el historial de conversación
     */
    limpiarHistorial() {
      _historial = [];
    },

    /**
     * Devuelve el historial actual
     * @returns {Array}
     */
    obtenerHistorial() {
      return [..._historial];
    }
  };
})();
