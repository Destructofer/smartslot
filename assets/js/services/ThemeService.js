/**
 * @file       ThemeService.js
 * @layer      Service (MVC)
 * @description Gestiona los temas de color del sistema.
 *              Permite cambiar entre varios esquemas y persiste la elección.
 *
 * No depende de otros módulos.
 */

const ThemeService = (() => {

  /* ─── Catálogo de temas ─────────────────────────────────────── */
  const TEMAS = {
    midnight: {
      nombre: 'Midnight',
      icono:  '🌙',
      vars: {
        '--bg':'#0d1117','--bg2':'#161b22','--bg3':'#1c2128','--bg4':'#22272e',
        '--border':'rgba(255,255,255,0.08)','--border2':'rgba(255,255,255,0.15)',
        '--text':'#e6edf3','--muted':'#8b949e','--dim':'#484f58',
        '--accent':'#388bfd','--accent2':'#1f6feb','--green':'#3fb950','--green2':'#238636',
        '--amber':'#d29922','--red':'#f85149','--purple':'#bc8cff','--cyan':'#56d3ba'
      }
    },
    nebula: {
      nombre: 'Nebula',
      icono:  '🌌',
      vars: {
        '--bg':'#0f0a1e','--bg2':'#1a1130','--bg3':'#241640','--bg4':'#2e1d50',
        '--border':'rgba(188,140,255,0.12)','--border2':'rgba(188,140,255,0.25)',
        '--text':'#ece6f5','--muted':'#a594c4','--dim':'#5a4a78',
        '--accent':'#a855f7','--accent2':'#9333ea','--green':'#34d399','--green2':'#10b981',
        '--amber':'#fbbf24','--red':'#fb7185','--purple':'#c084fc','--cyan':'#22d3ee'
      }
    },
    ocean: {
      nombre: 'Ocean',
      icono:  '🌊',
      vars: {
        '--bg':'#06141f','--bg2':'#0a1f30','--bg3':'#0e2a40','--bg4':'#123550',
        '--border':'rgba(56,211,234,0.12)','--border2':'rgba(56,211,234,0.25)',
        '--text':'#e0f2fe','--muted':'#7dd3fc','--dim':'#3b6478',
        '--accent':'#06b6d4','--accent2':'#0891b2','--green':'#10b981','--green2':'#059669',
        '--amber':'#f59e0b','--red':'#ef4444','--purple':'#8b5cf6','--cyan':'#22d3ee'
      }
    },
    forest: {
      nombre: 'Forest',
      icono:  '🌲',
      vars: {
        '--bg':'#0a140d','--bg2':'#101f14','--bg3':'#16291b','--bg4':'#1d3424',
        '--border':'rgba(63,185,80,0.12)','--border2':'rgba(63,185,80,0.25)',
        '--text':'#e3f0e5','--muted':'#86b894','--dim':'#3f6049',
        '--accent':'#22c55e','--accent2':'#16a34a','--green':'#4ade80','--green2':'#22c55e',
        '--amber':'#eab308','--red':'#f87171','--purple':'#a78bfa','--cyan':'#2dd4bf'
      }
    },
    light: {
      nombre: 'Daylight',
      icono:  '☀️',
      vars: {
        '--bg':'#f1f5f9','--bg2':'#ffffff','--bg3':'#f8fafc','--bg4':'#e2e8f0',
        '--border':'rgba(0,0,0,0.08)','--border2':'rgba(0,0,0,0.15)',
        '--text':'#1e293b','--muted':'#64748b','--dim':'#94a3b8',
        '--accent':'#2563eb','--accent2':'#1d4ed8','--green':'#16a34a','--green2':'#15803d',
        '--amber':'#d97706','--red':'#dc2626','--purple':'#9333ea','--cyan':'#0891b2'
      }
    }
  };

  let _temaActual = 'midnight';

  /* ─── API pública ──────────────────────────────────────────── */

  return {

    /**
     * Aplica un tema al documento
     * @param {string} id — clave del tema
     */
    aplicar(id) {
      const tema = TEMAS[id];
      if (!tema) return;
      _temaActual = id;
      const root = document.documentElement;
      Object.entries(tema.vars).forEach(([k, v]) => root.style.setProperty(k, v));

      // Marca el body para estilos light especiales
      document.body.classList.toggle('theme-light', id === 'light');

      // Actualiza UI del selector
      document.querySelectorAll('.theme-option').forEach(el => {
        el.classList.toggle('active', el.dataset.tema === id);
      });
    },

    /**
     * Devuelve la lista de temas disponibles
     * @returns {Array<{id,nombre,icono}>}
     */
    listar() {
      return Object.entries(TEMAS).map(([id, t]) => ({
        id, nombre: t.nombre, icono: t.icono
      }));
    },

    /**
     * Devuelve el tema activo
     * @returns {string}
     */
    actual() {
      return _temaActual;
    }
  };
})();
