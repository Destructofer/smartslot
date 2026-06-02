/**
 * @file       RecepcionController.js
 * @layer      Controller (MVC)
 * @description Controla el flujo de la vista de recepción guiada.
 *              Orquesta modelos y servicios, actualiza la UI.
 *              No contiene lógica de negocio — eso va en los Services.
 *
 * Depende de: ScoringService.js · SKUModel.js · UbicacionModel.js
 * Controla:   views/partials/recepcion.html (o la sección #panel-recepcion)
 */

const RecepcionController = (() => {

  /* ─── Estado local del controlador ─────────────────────────── */
  let _estadoActual = {
    sku:           null,
    tipo:          'caja',
    sugerencias:   [],
    confirmada:    null
  };

  /* ─── Helpers de UI (solo manipulación del DOM) ────────────── */

  const _mostrarCargando = (mostrar) => {
    const btn = document.getElementById('btn-calcular');
    if (!btn) return;
    btn.disabled    = mostrar;
    btn.textContent = mostrar ? 'Calculando…' : 'Sugerir ubicación';
  };

  const _renderizarSugerencias = (sugerencias, sku, descripcion = null) => {
    const contenedor = document.getElementById('panel-sugerencias');
    if (!contenedor) return;

    if (!sugerencias.length) {
      contenedor.innerHTML = '<p class="muted">No se encontraron ubicaciones disponibles.</p>';
      return;
    }

    const medallas  = ['🥇', '🥈', '🥉'];
    const colores   = ['var(--green)', 'var(--accent)', 'var(--amber)'];

    const marca     = ScoringService.detectarMarca(descripcion);
    const marcaInfo = marca && WMS_DATA.marcaZonas?.[marca];

    contenedor.innerHTML = sugerencias.map((s, i) => {
      const razon    = ScoringService.generarRazon(s, sku);
      const rotacion = SKUModel.obtenerRotacion(sku);
      const vecinos  = SKUModel.obtenerVecinos(sku);

      return `
        <div class="result-card" data-celda="${s.celda}" style="border-color:${colores[i]}20;border-left:3px solid ${colores[i]}">
          <div class="result-header">
            <span style="font-size:18px">${medallas[i]}</span>
            <span class="result-code" style="color:${colores[i]}">${s.celda}</span>
            <span class="score-badge" style="background:${colores[i]}22;color:${colores[i]}">
              ${s.score}/100
            </span>
          </div>

          <p class="result-razon">${razon}</p>

          <div class="factores-grid">
            <div class="factor">
              <span class="factor-label">Espacio libre</span>
              <div class="factor-bar">
                <div style="width:${s.factores.espacio}%;background:var(--green)"></div>
              </div>
              <span class="factor-val">${s.factores.espacio}%</span>
            </div>
            <div class="factor">
              <span class="factor-label">Cercanía despacho</span>
              <div class="factor-bar">
                <div style="width:${s.factores.proximidad}%;background:var(--accent)"></div>
              </div>
              <span class="factor-val">${s.factores.proximidad}%</span>
            </div>
            <div class="factor">
              <span class="factor-label">Rotación SKU</span>
              <div class="factor-bar">
                <div style="width:${s.factores.frecuencia}%;background:var(--amber)"></div>
              </div>
              <span class="factor-val">${s.factores.frecuencia}%</span>
            </div>
          </div>

          <div class="result-meta">
            <span class="badge ${rotacion === 'alta' ? 'alta' : rotacion === 'media' ? 'media' : 'baja'}">
              ↻ ${rotacion.charAt(0).toUpperCase() + rotacion.slice(1)} rotación
            </span>
            <span class="badge">Zona ${s.detalle.zona}</span>
            ${s.detalle.enRuta ? '<span class="badge ruta">★ En ruta activa</span>' : ''}
            ${marcaInfo && i === 0 ? `<span class="badge" style="background:${marcaInfo.color}22;color:${marcaInfo.color};border-color:${marcaInfo.color}44">${marcaInfo.icono} ${marcaInfo.label}</span>` : ''}
          </div>

          ${vecinos.length && i === 0 ? `
            <p class="vecinos-hint">
              💡 Vecinos compatibles: SKU ${vecinos.join(', ')} — suelen pedirse juntos
            </p>` : ''}

          <div class="result-actions">
            <button class="btn" onclick="RecepcionController.verEnMapa('${s.celda}')">
              🗺️ Ver en mapa
            </button>
            <button class="btn" onclick="Mapa3DController.irACelda3D('${s.celda}')">
              🧊 Ver en 3D
            </button>
            <button class="btn primary" onclick="RecepcionController.confirmar('${s.celda}')">
              ✓ Confirmar ubicación
            </button>
          </div>
        </div>
      `;
    }).join('');

    contenedor.classList.add('show');
  };

  /* ─── API pública ──────────────────────────────────────────── */

  return {

    /**
     * Inicializa el controlador — llama esto en DOMContentLoaded
     */
    init() {
      // Modo voz
      this.initVoz();

      // Listener para el campo SKU con debounce (delega a buscarSKULive)
      const inputSKU = document.getElementById('input-sku');
      if (inputSKU) {
        let timer;
        inputSKU.addEventListener('input', (e) => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            if (typeof this.buscarSKULive === 'function') {
              this.buscarSKULive(e.target.value);
            }
          }, 300);
        });
      }

      console.log('[RecepcionController] Inicializado');
    },

    /**
     * Cambia el tipo de mercancía (caja/tarima/suelto)
     * @param {string} tipo
     */
    setTipo(tipo) {
      _estadoActual.tipo = tipo;
      document.querySelectorAll('.tipo-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tipo === tipo);
      });
    },

    /**
     * Ejecuta el cálculo de scoring y renderiza sugerencias
     */
    calcular() {
      const inputSKU  = document.getElementById('input-sku');
      const inputDesc = document.getElementById('input-desc');

      const sku  = inputSKU?.value?.trim();
      const desc = inputDesc?.value?.trim();

      if (!sku && !desc) {
        this.mostrarToast('Ingresa un SKU o nombre de producto', 'warn');
        return;
      }

      // Lee dimensiones opcionales
      const largo = parseFloat(document.getElementById('input-largo')?.value) || null;
      const ancho = parseFloat(document.getElementById('input-ancho')?.value) || null;
      const alto  = parseFloat(document.getElementById('input-alto')?.value)  || null;
      const dims  = (largo || ancho || alto) ? { largo, ancho, alto } : null;

      _mostrarCargando(true);

      // Simula proceso async (en producción aquí iría fetch a Odoo)
      setTimeout(() => {
        const sugerencias = ScoringService.obtenerTopN(
          sku || 0,
          _estadoActual.tipo,
          3,
          desc || null,
          dims
        );

        _estadoActual.sku         = sku;
        _estadoActual.sugerencias = sugerencias;

        _renderizarSugerencias(sugerencias, sku, desc);
        _mostrarCargando(false);

        // Muestra badge de marca detectada si aplica
        const marca = ScoringService.detectarMarca(desc);
        const marcaInfo = marca && WMS_DATA.marcaZonas?.[marca];
        const marcaTxt = marcaInfo
          ? ` · ${marcaInfo.icono} ${marcaInfo.label} → Zona ${marcaInfo.zona}`
          : '';
        this.mostrarToast(`Top 3 sugerencias para SKU ${sku}${marcaTxt}`, 'ok');
      }, 400);
    },

    /**
     * Confirma una ubicación y notifica al mapa
     * @param {string} celda
     */
    confirmar(celda) {
      _estadoActual.confirmada = celda;
      MapaController?.resaltarCelda(celda, 'confirmed');
      DashboardController?.registrarRecepcion(celda, _estadoActual.sku);

      const card = document.querySelector(`#panel-sugerencias .result-card[data-celda="${celda}"]`);
      if (card) card.remove();

      const contenedor = document.getElementById('panel-sugerencias');
      if (contenedor && !contenedor.querySelector('.result-card')) {
        contenedor.classList.remove('show');
      }

      this.mostrarToast(`✓ Registrado en ${celda}`, 'ok');
    },

    /**
     * Le pide al MapaController que muestre la celda
     * @param {string} celda
     */
    verEnMapa(celda) {
      // Activar el panel del mapa (y su tab de navegación)
      const tabMapa = document.querySelector('.nav-tab[onclick*="mapa"]');
      showPanel('mapa', tabMapa);

      // Esperar dos frames para que el panel sea visible antes de hacer scroll
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          MapaController?.irACelda(celda);
        });
      });
    },

    /**
     * Limpia el formulario de recepción
     */
    limpiar() {
      ['input-sku','input-desc','input-largo','input-ancho','input-alto']
        .forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
      _estadoActual = { sku: null, tipo: 'caja', sugerencias: [], confirmada: null };
      document.getElementById('panel-sugerencias')?.classList.remove('show');
    },

    /**
     * Inicializa el modo voz (Web Speech API)
     */
    initVoz() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      const reconocedor = new SpeechRecognition();
      reconocedor.lang         = 'es-MX';
      reconocedor.interimResults = false;

      reconocedor.onresult = (event) => {
        const texto = event.results[0][0].transcript;
        // Extrae SKU del texto hablado: "recibí 48 piezas SKU 12478"
        const matchSKU = texto.match(/(?:sku|clave)\s*(\d+)/i);
        if (matchSKU) {
          const skuInput = document.getElementById('input-sku');
          if (skuInput) skuInput.value = matchSKU[1];
          this.calcular();
        }
        this.mostrarToast(`Escuché: "${texto}"`, 'ok');
      };

      reconocedor.onerror = () => this.mostrarToast('No pude escucharte', 'warn');

      const btnVoz = document.getElementById('btn-voz');
      if (btnVoz) {
        btnVoz.addEventListener('click', () => reconocedor.start());
      }
    },

    /**
     * Muestra un toast de notificación
     * @param {string} mensaje
     * @param {"ok"|"warn"|"err"} tipo
     */
    mostrarToast(mensaje, tipo = 'ok') {
      const toast = document.getElementById('toast');
      if (!toast) return;
      toast.textContent = mensaje;
      toast.className   = `toast show ${tipo}`;
      setTimeout(() => toast.classList.remove('show'), 3500);
    },

    /**
     * Devuelve el estado actual (para debug)
     */
    getEstado() {
      return { ..._estadoActual };
    }
  };
})();
