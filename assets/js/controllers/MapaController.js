/**
 * @file       MapaController.js
 * @layer      Controller (MVC)
 * @description Controla el mapa 2D interactivo del almacén con heatmap.
 *              Construye las celdas, aplica colores y maneja interacciones.
 *
 * Depende de: UbicacionModel.js · data/wms_data.js
 */

const MapaController = (() => {

  /* ─── Estado del mapa ──────────────────────────────────────── */
  let _filtroActivo  = 'all';
  let _filtroZona    = null;   // "A","B","C","D","E" o null = sin filtro zona
  let _celdaActiva   = null;
  let _estadoExtra   = {};     // celdas con estado temporal (suggested, confirmed)

  /* ─── Mapa de colores por zona de cliente ──────────────────── */
  const ZONA_COLORES = {
    A: { bg: '#3fb95022', border: '#3fb950', label: 'Marca Propia', texto: '#3fb950' },
    B: { bg: '#06b6d422', border: '#06b6d4', label: 'Alta Rotación', texto: '#06b6d4' },
    C: { bg: '#a855f722', border: '#a855f7', label: 'Rotación Media', texto: '#a855f7' },
    D: { bg: '#fbbf2422', border: '#fbbf24', label: 'Baja Rotación', texto: '#fbbf24' },
    E: { bg: '#ef444422', border: '#ef4444', label: 'Desborde', texto: '#ef4444' }
  };

  /* ─── Helpers de clasificación de celdas ──────────────────── */

  const _clasificarCelda = (celda) => {
    if (_estadoExtra[celda]) return _estadoExtra[celda];
    const occ     = UbicacionModel.obtenerOcupacion(celda);
    const enRuta  = UbicacionModel.estaEnRuta(celda);
    if (occ === null) return 'free';
    if (enRuta)       return 'ruta';
    if (occ >= 90)    return 'high';
    if (occ >= 50)    return 'med';
    if (occ >= 20)    return 'low';
    return 'free';
  };

  const _aplicarFiltro = (celda, clase) => {
    if (_filtroActivo === 'all') return true;
    return clase === _filtroActivo;
  };

  /* ─── Construcción del mapa ────────────────────────────────── */

  const _crearCelda = (id, tipo = 'main') => {
    const el     = document.createElement('div');
    const clase  = _clasificarCelda(id);
    el.id        = `cell-${id}`;
    el.className = `map-cell ${clase}`;
    el.textContent = id;

    // Barra de ocupación
    const occ = UbicacionModel.obtenerOcupacion(id);
    if (occ !== null) {
      const bar = document.createElement('div');
      bar.className = 'occ-bar';
      bar.style.width = `${occ}%`;
      bar.style.background = occ >= 90 ? 'var(--red)' : occ >= 50 ? 'var(--amber)' : 'var(--green)';
      el.appendChild(bar);
    }

    // Eventos
    el.addEventListener('click',       () => MapaController.seleccionarCelda(id));
    el.addEventListener('mouseenter',  (e) => MapaController.mostrarTooltip(e, id));
    el.addEventListener('mouseleave',  () => MapaController.ocultarTooltip());

    return el;
  };

  /**
   * Devuelve la zona (A-E) a la que pertenece un pasillo
   */
  const _zonaDelPasillo = (pasillo) => {
    for (const [zona, config] of Object.entries(WMS_DATA.zonas)) {
      if (config.pasillos.includes(pasillo)) return zona;
    }
    return null;
  };

  /**
   * Crea una columna de pasillo con su header y celdas apiladas.
   * El header se colorea según la zona del pasillo.
   * @param {string} pasillo — ej "AP"
   * @param {number} maxPos — número máximo de posiciones a mostrar
   * @param {number} limite — tope visual de celdas por columna (para no saturar)
   */
  const _crearColumna = (pasillo, maxPos, limite = 30) => {
    const col = document.createElement('div');
    col.className = 'aisle-col';
    const zona = _zonaDelPasillo(pasillo);
    if (zona) col.dataset.zona = zona;

    // Header del pasillo con color de zona
    const header = document.createElement('div');
    header.className = 'aisle-col-header';
    header.textContent = pasillo;
    if (zona && ZONA_COLORES[zona]) {
      header.style.background  = ZONA_COLORES[zona].bg;
      header.style.borderBottom = `2px solid ${ZONA_COLORES[zona].border}`;
      header.style.color        = ZONA_COLORES[zona].texto;
      header.title = `Zona ${zona} — ${ZONA_COLORES[zona].label}`;
    }
    col.appendChild(header);

    // Contador de cuántas posiciones tiene
    const count = document.createElement('div');
    count.className = 'aisle-col-count';
    count.textContent = `${maxPos} pos.`;
    col.appendChild(count);

    // Celdas (limitadas para no saturar la vista; el resto se ve scrolleando)
    const mostrar = Math.min(maxPos, limite);
    for (let i = 1; i <= mostrar; i++) {
      const id = `${pasillo}${String(i).padStart(2, '0')}`;
      col.appendChild(_crearCelda(id));
    }

    return col;
  };

  /**
   * Muestra el banner de navegación con la ruta desde recepción hasta la celda
   * @param {string} celda
   */
  const _mostrarNavegacion = (celda) => {
    const banner = document.getElementById('map-nav-banner');
    if (!banner) return;

    const pasillo  = celda.replace(/\d.*$/, '');
    const posicion = parseInt(celda.replace(/^[A-Z]+/, ''), 10) || 0;
    const x        = UbicacionModel.obtenerX(celda);
    const zona     = UbicacionModel.obtenerZona(celda);

    const metrosAprox = (x * 8) + posicion;
    const minutos     = Math.max(1, Math.ceil(metrosAprox / 80));

    const todosLosPassillos = ['AP','BP','CP','DP','EP','FP','GP','HP','IP','JP','KP','LP','MP'];
    const pasosRuta = todosLosPassillos.slice(0, x);
    const breadcrumb = ['ENTRADA', ...pasosRuta.map((p, i) => {
      const z = _zonaDelPasillo(p);
      const color = z && ZONA_COLORES[z] ? ZONA_COLORES[z].texto : 'var(--muted)';
      return `<span style="color:${color}">${p}</span>`;
    })].join(' → ');

    const zonaColor = zona && ZONA_COLORES[zona] ? ZONA_COLORES[zona].texto : 'var(--green)';

    banner.innerHTML = `
      <span style="font-size:13px">
        📍 ${breadcrumb} → <strong style="color:${zonaColor}">${celda}</strong>
        &nbsp;<span style="color:var(--muted)">·</span>&nbsp;
        ~${metrosAprox}m&nbsp;&nbsp;·&nbsp;&nbsp;~${minutos} min caminando
        &nbsp;<span style="color:var(--muted)">·</span>&nbsp;
        <span style="color:${zonaColor}">Zona ${zona}</span>
      </span>
      <button onclick="document.getElementById('map-nav-banner').style.display='none'"
              style="margin-left:auto;background:transparent;border:none;color:var(--muted);cursor:pointer;font-size:14px">✕</button>
    `;
    banner.style.display = 'flex';

    // Resaltar columna objetivo, atenuar las demás
    document.querySelectorAll('#map-grid [data-aisle]').forEach(el => {
      if (el.dataset.aisle === pasillo) {
        el.classList.add('aisle-nav-target');
        el.classList.remove('aisle-nav-dim');
      } else {
        el.classList.add('aisle-nav-dim');
        el.classList.remove('aisle-nav-target');
      }
    });

    setTimeout(() => {
      document.querySelectorAll('#map-grid [data-aisle]').forEach(el => {
        el.classList.remove('aisle-nav-target', 'aisle-nav-dim');
      });
    }, 6000);
  };

  /* ─── API pública ──────────────────────────────────────────── */

  return {

    /**
     * Construye el mapa completo del almacén por columnas uniformes.
     * Cada pasillo (AP-MP) es una columna vertical ordenada.
     * Debe llamarse en DOMContentLoaded.
     */
    construir() {
      const grid = document.getElementById('map-grid');
      if (!grid) return;

      grid.innerHTML = '';

      const PASILLOS   = ['AP','BP','CP','DP','EP','FP','GP','HP','IP','JP','KP','LP','MP'];
      const LIMITES    = { AP:88,BP:88,CP:272,DP:272,EP:86,FP:72,GP:72,HP:72,IP:72,JP:72,KP:72,LP:72,MP:72 };
      const SUB_SET    = new Set(['CP','DP']);
      const TOTAL_ROWS = 91;

      // Fila de headers
      PASILLOS.forEach(p => {
        const h = document.createElement('div');
        h.className     = 'map-header-cell';
        h.textContent   = p;
        h.dataset.aisle = p;
        const zona = _zonaDelPasillo(p);
        if (zona && ZONA_COLORES[zona]) {
          h.style.background   = ZONA_COLORES[zona].bg;
          h.style.borderBottom = `2px solid ${ZONA_COLORES[zona].border}`;
          h.style.color        = ZONA_COLORES[zona].texto;
          h.title              = `Zona ${zona} — ${ZONA_COLORES[zona].label}`;
        }
        grid.appendChild(h);
      });

      // Filas de datos
      for (let row = 1; row <= TOTAL_ROWS; row++) {
        PASILLOS.forEach(p => {
          if (SUB_SET.has(p)) {
            const container     = document.createElement('div');
            container.dataset.aisle = p;
            let hasAny = false;

            for (let sub = 1; sub <= 3; sub++) {
              const num = (row - 1) * 3 + sub;
              if (num <= LIMITES[p]) {
                const id = `${p}${String(num).padStart(2,'0')}`;
                const el = _crearCelda(id);
                el.classList.add('sub-block');
                container.appendChild(el);
                hasAny = true;
              }
            }

            container.className = hasAny ? 'sub-grid-container' : 'map-empty-cell';
            grid.appendChild(container);
          } else {
            if (row <= LIMITES[p]) {
              const id = `${p}${String(row).padStart(2,'0')}`;
              const el = _crearCelda(id);
              el.dataset.aisle = p;
              grid.appendChild(el);
            } else {
              const empty = document.createElement('div');
              empty.className     = 'map-empty-cell';
              empty.dataset.aisle = p;
              grid.appendChild(empty);
            }
          }
        });
      }

      console.log('[MapaController] Mapa construido (layout grid)');
    },

    /**
     * Resalta una celda con un estado específico
     * @param {string} celda
     * @param {"suggested"|"confirmed"|"ruta"} estado
     */
    resaltarCelda(celda, estado) {
      // Quitar estado anterior
      if (_celdaActiva && _celdaActiva !== celda) {
        delete _estadoExtra[_celdaActiva];
        this.refrescarCelda(_celdaActiva);
      }
      _estadoExtra[celda] = estado;
      _celdaActiva        = estado === 'confirmed' ? null : celda;
      this.refrescarCelda(celda);
    },

    /**
     * Refresca el className de una celda según su estado actual
     * @param {string} celda
     */
    refrescarCelda(celda) {
      const el = document.getElementById(`cell-${celda}`);
      if (!el) return;
      const clase = _clasificarCelda(celda);
      el.className = el.className
        .split(' ')
        .filter(c => !['free','low','med','high','ruta','suggested','confirmed'].includes(c))
        .concat(clase)
        .join(' ');
    },

    /**
     * Desplaza el mapa a una celda, la anima y muestra la ruta de navegación.
     * Si la celda está más allá del límite visual, la inyecta en su columna.
     * @param {string} celda
     */
    irACelda(celda) {
      let el = document.getElementById(`cell-${celda}`);

      // Si no está renderizada (posición > límite), la agregamos a su columna
      if (!el) {
        el = this._inyectarCelda(celda);
        if (!el) return;
      }

      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      this.resaltarCelda(celda, 'suggested');
      _mostrarNavegacion(celda);

      // Flash visual
      let flashes = 0;
      const interval = setInterval(() => {
        el.classList.toggle('spotlight-flash');
        if (++flashes >= 8) {
          clearInterval(interval);
          el.classList.remove('spotlight-flash');
        }
      }, 200);
    },

    /**
     * Inyecta una celda que está fuera del rango visual en su columna.
     * @param {string} celda
     * @returns {HTMLElement|null}
     */
    buscar(valor) {
      const celda = valor?.trim().toUpperCase();
      if (!celda) return;
      const el = document.getElementById(`cell-${celda}`);
      if (!el) {
        RecepcionController?.mostrarToast(`Ubicación "${celda}" no encontrada`, 'warn');
        return;
      }
      this.irACelda(celda);
    },

    _inyectarCelda(celda) {
      // Con el layout de grid todas las celdas están pre-renderizadas
      return document.getElementById(`cell-${celda}`) || null;
    },

    /**
     * Maneja el click en una celda del mapa
     * @param {string} celda
     */
    seleccionarCelda(celda) {
      const occ     = UbicacionModel.obtenerOcupacion(celda);
      const prod    = UbicacionModel.obtenerProducto(celda);
      const enRuta  = UbicacionModel.estaEnRuta(celda);
      const zona    = UbicacionModel.obtenerZona(celda);
      const dias    = SimuladorService.predecirLlenado(celda);

      const msg = occ !== null
        ? `${celda} · ${occ}% ocupado · Zona ${zona}${enRuta ? ' · ★ En ruta' : ''}${dias ? ` · Se llena en ~${dias} días` : ''}`
        : `${celda} · Sin stock registrado`;

      RecepcionController?.mostrarToast(msg, 'ok');
    },

    /**
     * Muestra el tooltip con info de la celda
     * @param {MouseEvent} e
     * @param {string} celda
     */
    mostrarTooltip(e, celda) {
      const tt  = document.getElementById('tooltip');
      if (!tt) return;
      const occ  = UbicacionModel.obtenerOcupacion(celda);
      const prod = UbicacionModel.obtenerProducto(celda);
      const dias = SimuladorService.predecirLlenado(celda);

      let html = `<strong>${celda}</strong>`;
      if (occ !== null) {
        const color = occ >= 80 ? 'var(--red)' : occ >= 40 ? 'var(--amber)' : 'var(--green)';
        html += `<br>Ocupación: <span style="color:${color}">${occ}%</span>`;
        if (prod !== '—') html += `<br><span style="font-size:11px">${prod}</span>`;
        if (dias !== null) html += `<br>Llenado en: ~${dias} días`;
      } else {
        html += '<br><span style="color:var(--green)">Sin stock registrado</span>';
      }
      if (UbicacionModel.estaEnRuta(celda)) html += '<br><span style="color:var(--purple)">★ En ruta activa</span>';

      tt.innerHTML = html;
      tt.style.left = (e.clientX + 14) + 'px';
      tt.style.top  = (e.clientY - 10) + 'px';
      tt.classList.add('show');
    },

    ocultarTooltip() {
      document.getElementById('tooltip')?.classList.remove('show');
    },

    /**
     * Aplica un filtro de ocupación al mapa
     * @param {"all"|"free"|"low"|"med"|"high"|"ruta"} filtro
     * @param {HTMLElement} btnEl
     */
    setFiltro(filtro, btnEl) {
      _filtroActivo = filtro;
      document.querySelectorAll('.filter-btn:not(.filter-zona)').forEach(b => b.classList.remove('active'));
      btnEl?.classList.add('active');

      this._aplicarVisibilidad();
    },

    /**
     * Filtra el mapa para mostrar solo las columnas de una zona (A-E)
     * @param {string|null} zona — "A","B","C","D","E" o null para quitar filtro
     * @param {HTMLElement} btnEl
     */
    setFiltroZona(zona, btnEl) {
      _filtroZona = (_filtroZona === zona) ? null : zona; // toggle
      document.querySelectorAll('.filter-zona').forEach(b => b.classList.remove('active'));
      if (_filtroZona) btnEl?.classList.add('active');

      document.querySelectorAll('#map-grid [data-aisle]').forEach(el => {
        const elZona  = _zonaDelPasillo(el.dataset.aisle);
        const visible = !_filtroZona || elZona === _filtroZona;
        el.style.opacity       = visible ? '1' : '0.08';
        el.style.pointerEvents = visible ? '' : 'none';
      });
    },

    /**
     * Aplica el filtro de ocupación activo a todas las celdas
     */
    _aplicarVisibilidad() {
      document.querySelectorAll('.map-cell').forEach(el => {
        const id = el.id.replace('cell-', '');
        if (!id) return;
        const clase = _clasificarCelda(id);
        el.style.opacity = (_filtroActivo === 'all' || clase === _filtroActivo) ? '1' : '0.12';
      });
    }
  };
})();
