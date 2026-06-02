/**
 * @file       DashboardController.js
 * @layer      Controller (MVC)
 * @description Controla el dashboard gerencial y el chat de Waldo.
 *              Renderiza métricas de ROI, score de salud y predicciones.
 *
 * Depende de: SimuladorService.js · WaldoService.js · UbicacionModel.js
 */

const DashboardController = (() => {

  /* ─── Helpers de formato ────────────────────────────────────── */

  const _fmt = (n) => n.toLocaleString('es-MX');
  const _pct = (n) => `${n}%`;

  /* ─── Renderizado de métricas ────────────────────────────────── */

  const _renderMetrica = (id, valor, sufijo = '') => {
    const el = document.getElementById(id);
    if (el) el.textContent = valor + sufijo;
  };

  /* ─── API pública ─────────────────────────────────────────────── */

  return {

    /**
     * Inicializa el dashboard — llama en DOMContentLoaded
     */
    init() {
      this.renderROI();
      this.renderSalud();
      this.renderSimulador();
      this.renderAlertas();
      this.renderReasignaciones();
      this.initWaldo();
      console.log('[DashboardController] Inicializado');
    },

    /**
     * Renderiza el panel de ROI financiero
     */
    renderROI() {
      const roi = SimuladorService.calcularROI();

      _renderMetrica('roi-diario',         `$${_fmt(roi.ahorroDiarioMXN)}`, ' MXN');
      _renderMetrica('roi-mensual',        `$${_fmt(roi.ahorroMensualMXN)}`, ' MXN');
      _renderMetrica('roi-anual',          `$${_fmt(roi.ahorroAnualMXN)}`, ' MXN');
      _renderMetrica('roi-tiempo-antes',   roi.segPorDecisionAntes, 's');
      _renderMetrica('roi-tiempo-ahora',   roi.segPorDecisionAhora, 's');
      _renderMetrica('roi-errores',        roi.erroresEvitados, '/día');
      _renderMetrica('roi-recepciones',    _fmt(roi.recepcionesDia), '/día');
      _renderMetrica('roi-horas-ahorradas',roi.tiempoAhorradoDia, 'h/día');
    },

    /**
     * Renderiza el score de salud del almacén (0-100)
     */
    renderSalud() {
      const score = SimuladorService.calcularScoreSalud();
      const el    = document.getElementById('score-salud');
      if (!el) return;

      const color = score >= 70 ? 'var(--green)' : score >= 40 ? 'var(--amber)' : 'var(--red)';
      el.textContent = score;
      el.style.color = color;

      // Barra de salud
      const barra = document.getElementById('barra-salud');
      if (barra) {
        barra.style.width      = `${score}%`;
        barra.style.background = color;
      }

      // Descripción textual
      const desc = document.getElementById('desc-salud');
      if (desc) {
        desc.textContent = score >= 70
          ? 'Almacén en buen estado'
          : score >= 40
          ? 'Requiere optimización en algunos pasillos'
          : 'Atención urgente — múltiples ubicaciones críticas';
      }
    },

    /**
     * Renderiza el panel del simulador de ahorro de Noviembre
     */
    renderSimulador() {
      const ahorro = SimuladorService.calcularAhorroNoviembre();

      _renderMetrica('sim-metros-real',   _fmt(ahorro.metrosReales), 'm');
      _renderMetrica('sim-metros-smart',  _fmt(ahorro.metrosSmartSlot), 'm');
      _renderMetrica('sim-metros-ahorro', _fmt(ahorro.metrosAhorrados), 'm');
      _renderMetrica('sim-porcentaje',    ahorro.porcentajeAhorro, '%');

      // Tabla de detalles (primeros 5)
      const tbody = document.getElementById('sim-tabla-body');
      if (!tbody) return;
      tbody.innerHTML = ahorro.detalles.slice(0, 5).map(d => `
        <tr>
          <td style="font-family:var(--mono);color:var(--accent)">${d.sku}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.producto}</td>
          <td style="font-family:var(--mono);color:var(--muted)">${d.destinoReal}</td>
          <td style="font-family:var(--mono)">${d.metrosReal}m</td>
          <td style="font-family:var(--mono);color:var(--green)">${d.metrosOpt}m</td>
          <td style="font-family:var(--mono);color:var(--cyan)">-${d.ahorro}m</td>
        </tr>
      `).join('');
    },

    /**
     * Renderiza alertas de ubicaciones próximas a llenarse
     */
    renderAlertas() {
      const contenedor = document.getElementById('lista-alertas');
      if (!contenedor) return;

      const alertas = UbicacionModel.obtenerTodas()
        .map(celda => ({
          celda,
          dias:     SimuladorService.predecirLlenado(celda),
          occ:      UbicacionModel.obtenerOcupacion(celda),
          producto: UbicacionModel.obtenerProducto(celda)
        }))
        .filter(a => a.dias !== null && a.dias <= 5 && a.occ >= 75)
        .sort((a, b) => a.dias - b.dias)
        .slice(0, 5);

      if (!alertas.length) {
        contenedor.innerHTML = '<p class="muted">Sin alertas críticas por el momento</p>';
        return;
      }

      contenedor.innerHTML = alertas.map(a => `
        <div class="alerta-item" onclick="DashboardController.mostrarDetalleAlerta('${a.celda}')">
          <span class="badge ${a.dias <= 1 ? 'alta' : a.dias <= 3 ? 'media' : 'baja'}">
            ${a.dias === 0 ? '¡LLENA!' : `${a.dias}d`}
          </span>
          <span style="font-family:var(--mono);color:var(--accent)">${a.celda}</span>
          <span style="color:var(--muted);font-size:11px">${a.occ}% · ${a.producto.substring(0,35)}</span>
        </div>
      `).join('');
    },

    /**
     * Renderiza sugerencias de reasignación preventiva de SKUs
     * (SKUs de alta rotación lejos del despacho)
     */
    renderReasignaciones() {
      const contenedor = document.getElementById('lista-reasignaciones');
      if (!contenedor) return;

      const sugerencias = SimuladorService.calcularReasignaciones();

      if (!sugerencias.length) {
        contenedor.innerHTML = '<p class="muted" style="font-size:12px;padding:8px 0">El almacén está bien distribuido — sin reasignaciones urgentes</p>';
        return;
      }

      const pasillos = ['AP','BP','CP','DP','EP','FP','GP','HP','IP','JP','KP','LP','MP'];

      contenedor.innerHTML = sugerencias.map(s => {
        const flechas = pasillos.slice(s.xSugerida - 1, s.xActual - 1)
          .map(p => `<span style="color:var(--green);font-size:11px">${p}</span>`)
          .reverse().join(' ← ');

        return `
        <div class="reasig-item">
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
            <span class="badge alta" style="flex-shrink:0">SKU ${s.sku}</span>
            <div style="min-width:0">
              <div style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                ${s.producto.substring(0, 42)}
              </div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">
                <span style="color:var(--red)">${s.ubicacionActual}</span>
                &nbsp;→&nbsp;
                <span style="color:var(--green)">${s.ubicacionSugerida}</span>
                &nbsp;·&nbsp; Ahorra <strong style="color:var(--cyan)">~${s.ahorroMetros}m</strong>/visita
                &nbsp;·&nbsp; Frec. ${s.frecuencia}×/mes
              </div>
            </div>
          </div>
          <button class="btn" style="font-size:11px;flex-shrink:0;padding:4px 10px"
                  onclick="MapaController.irACelda('${s.ubicacionSugerida}');showPanel('mapa',document.querySelectorAll('.nav-tab')[1])">
            Ver →
          </button>
        </div>`;
      }).join('');
    },

    /**
     * Registra una nueva recepción confirmada (actualiza métricas en vivo)
     * @param {string} celda
     * @param {string|null} sku
     */
    registrarRecepcion(celda, sku) {
      this.renderSalud();
      this.renderAlertas();
      console.log(`[DashboardController] Recepción registrada: ${celda} · SKU ${sku}`);
    },

    /**
     * Muestra el modal de detalle para una alerta
     * @param {string} celda
     */
    mostrarDetalleAlerta(celda) {
      const modal   = document.getElementById('modal-alerta');
      const content = document.getElementById('modal-alerta-content');
      if (!modal || !content) return;

      const occ     = UbicacionModel.obtenerOcupacion(celda);
      const producto = UbicacionModel.obtenerProducto(celda);
      const zona    = UbicacionModel.obtenerZona(celda);
      const enRuta  = UbicacionModel.estaEnRuta(celda);
      const x       = UbicacionModel.obtenerX(celda);
      const dias    = SimuladorService.predecirLlenado(celda) ?? 0;

      const ZONA_LABELS = { A:'Marca Propia', B:'Alta Rotación', C:'Grupo Nestlé', D:'Infantil / Baja rot.', E:'Desborde / Overflow' };
      const ZONA_COLORS = { A:'#3fb950', B:'#06b6d4', C:'#a855f7', D:'#fbbf24', E:'#ef4444' };
      const zonaColor   = ZONA_COLORS[zona] || 'var(--accent)';
      const zonaLabel   = ZONA_LABELS[zona]  || zona;

      const occColor = occ >= 95 ? 'var(--red)' : occ >= 85 ? '#f97316' : 'var(--amber)';
      const distancia = x * 8;

      // Nivel de urgencia
      let urgenciaTitulo, urgenciaDesc, urgenciaBg;
      if (dias === 0) {
        urgenciaTitulo = '🚨 Capacidad máxima alcanzada';
        urgenciaDesc   = 'Esta ubicación ya no tiene espacio disponible. Cualquier nueva recepción asignada aquí generará un error operativo. Se requiere acción inmediata.';
        urgenciaBg     = 'rgba(239,68,68,.12)';
      } else if (dias === 1) {
        urgenciaTitulo = '⚠️ Se llena en menos de 24 horas';
        urgenciaDesc   = 'El ritmo actual de entrada de producto agotará el espacio disponible mañana. Sin intervención, esta ubicación bloqueará nuevas recepciones.';
        urgenciaBg     = 'rgba(249,115,22,.12)';
      } else if (dias <= 3) {
        urgenciaTitulo = `⏳ Se llena en ${dias} días`;
        urgenciaDesc   = `Con el flujo actual, esta ubicación alcanzará el 100% de ocupación en ${dias} días. Es momento de planificar la redistribución del inventario.`;
        urgenciaBg     = 'rgba(251,191,36,.10)';
      } else {
        urgenciaTitulo = `📊 Ocupación elevada — ${dias} días restantes`;
        urgenciaDesc   = `La ocupación supera el 75%. Aunque hay margen, conviene monitorear de cerca y considerar redistribución preventiva.`;
        urgenciaBg     = 'rgba(6,182,212,.10)';
      }

      // Acción recomendada
      let accion;
      if (dias <= 1) {
        accion = `Reasigna de inmediato los productos de menor rotación a pasillos con más espacio (LP, MP o KP). Verifica si hay SKUs de alta rotación que deban estar más cerca del despacho.`;
      } else if (dias <= 3) {
        accion = `Planifica en las próximas horas la redistribución de al menos 2–3 SKUs hacia ubicaciones con < 60% de ocupación. Usa el módulo de Recepción para obtener sugerencias de destino.`;
      } else {
        accion = `Monitorea diariamente. Si la tendencia continúa, programa una redistribución antes de que supere el 90%. Usa el filtro de "Alta" en el Mapa para identificar otras ubicaciones críticas.`;
      }

      content.innerHTML = `
        <div class="modal-celda-id" style="color:${occColor}">${celda}</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:4px">${producto}</div>

        <div style="display:flex;align-items:center;gap:8px;margin:12px 0 2px">
          <span style="font-size:22px;font-weight:800;color:${occColor}">${occ}%</span>
          <span style="font-size:12px;color:var(--muted)">de ocupación</span>
        </div>
        <div class="modal-occ-bar-wrap">
          <div class="modal-occ-bar-fill" style="width:${occ}%;background:${occColor}"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--dim);margin-bottom:6px">
          <span>0%</span><span>50%</span><span>100%</span>
        </div>

        <div class="modal-section">
          <div class="modal-row">
            <span class="modal-row-icon">📍</span>
            <div>
              <div class="modal-row-label">Zona</div>
              <div class="modal-row-value" style="color:${zonaColor}">Zona ${zona} — ${zonaLabel}</div>
            </div>
          </div>
          <div class="modal-row">
            <span class="modal-row-icon">📏</span>
            <div>
              <div class="modal-row-label">Distancia al despacho</div>
              <div class="modal-row-value">~${distancia} metros (Pasillo ${celda.replace(/\d.*$/,'')})</div>
            </div>
          </div>
          <div class="modal-row">
            <span class="modal-row-icon">${enRuta ? '🛒' : '⬜'}</span>
            <div>
              <div class="modal-row-label">Ruta de picking</div>
              <div class="modal-row-value" style="color:${enRuta ? 'var(--purple)' : 'var(--muted)'}">
                ${enRuta ? '★ Ubicación en ruta activa — impacto directo en operaciones' : 'No está en la ruta de picking activa'}
              </div>
            </div>
          </div>
        </div>

        <div class="modal-urgencia-box" style="background:${urgenciaBg};border:1px solid ${occColor}44">
          <strong style="color:${occColor}">${urgenciaTitulo}</strong>
          <p style="margin:6px 0 0;color:var(--text)">${urgenciaDesc}</p>
        </div>

        <div class="modal-accion-box">
          <strong style="color:var(--accent);font-size:11px;letter-spacing:.5px">ACCIÓN RECOMENDADA</strong>
          <p style="margin:6px 0 0;color:var(--text)">${accion}</p>
        </div>

        <div style="margin-top:16px;display:flex;gap:8px">
          <button class="btn primary" onclick="
            document.getElementById('modal-alerta').style.display='none';
            const t=document.querySelector('.nav-tab[onclick*=mapa]');
            showPanel('mapa',t);
            requestAnimationFrame(()=>requestAnimationFrame(()=>MapaController?.buscar('${celda}')));
          ">🗺️ Ver en mapa</button>
          <button class="btn" onclick="document.getElementById('modal-alerta').style.display='none'">Cerrar</button>
        </div>
      `;

      modal.style.display = 'flex';
    },

    /* ─── WALDO ─────────────────────────────────────────────── */

    /**
     * Inicializa el chat de Waldo
     */
    initWaldo() {
      const input = document.getElementById('waldo-input');
      if (!input) return;

      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.enviarAWaldo();
        }
      });
    },

    /**
     * Envía el mensaje del usuario a Waldo y renderiza la respuesta
     */
    async enviarAWaldo() {
      const input = document.getElementById('waldo-input');
      const chat  = document.getElementById('waldo-chat');
      if (!input || !chat) return;

      const mensaje = input.value.trim();
      if (!mensaje) return;

      input.value   = '';
      input.disabled = true;

      // Renderiza burbuja del usuario
      chat.innerHTML += `
        <div class="chat-msg user">
          <span>${mensaje}</span>
        </div>`;

      // Indicador de carga
      const loaderId = `loader-${Date.now()}`;
      chat.innerHTML += `
        <div class="chat-msg waldo" id="${loaderId}">
          <span class="typing">Waldo está pensando…</span>
        </div>`;
      chat.scrollTop = chat.scrollHeight;

      try {
        const respuesta = await WaldoService.preguntar(mensaje);

        // Reemplaza el loader con la respuesta
        const loader = document.getElementById(loaderId);
        if (loader) loader.innerHTML = `<span>${respuesta}</span>`;

      } catch (e) {
        const loader = document.getElementById(loaderId);
        if (loader) loader.innerHTML = '<span style="color:var(--red)">Error al conectar con Waldo</span>';
      }

      input.disabled = false;
      input.focus();
      chat.scrollTop = chat.scrollHeight;
    },

    /**
     * Envía una pregunta predefinida a Waldo (botones de acceso rápido)
     * @param {string} pregunta
     */
    preguntaRapida(pregunta) {
      const input = document.getElementById('waldo-input');
      if (input) {
        input.value = pregunta;
        this.enviarAWaldo();
      }
    }
  };
})();
