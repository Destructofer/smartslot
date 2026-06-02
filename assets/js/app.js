/**
 * @file       app.js
 * @layer      Entry point (MVC)
 * @description Punto de entrada de SmartSlot AI.
 *              Inicializa todos los controladores cuando el DOM está listo.
 *              No contiene lógica de negocio.
 *
 * Orden de carga requerido en index.html:
 *   1. data/wms_data.js
 *   2. models/UbicacionModel.js
 *   3. models/SKUModel.js
 *   4. services/ScoringService.js
 *   5. services/SimuladorService.js
 *   6. services/WaldoService.js
 *   7. controllers/MapaController.js
 *   8. controllers/RecepcionController.js
 *   9. controllers/DashboardController.js
 *  10. app.js  ← este archivo (siempre último)
 */

document.addEventListener('DOMContentLoaded', () => {

  console.log('%c SmartSlot AI — v1.0 ', 'background:#388bfd;color:#fff;font-weight:bold;padding:4px 8px;border-radius:4px');
  console.log('%c Datos reales de Justo · Noviembre 2025', 'color:#8b949e');

  /* ─── 1. Inicializar controladores ─────────────────────────── */
  MapaController.construir();
  RecepcionController.init();
  DashboardController.init();

  /* ─── 2. Panel activo por defecto ──────────────────────────── */
  showPanel('recepcion', document.querySelector('.nav-tab'));

  /* ─── 3. Log de estado inicial ──────────────────────────────── */
  const salud = SimuladorService.calcularScoreSalud();
  const roi   = SimuladorService.calcularROI();
  console.log(`[SmartSlot] Score de salud inicial: ${salud}/100`);
  console.log(`[SmartSlot] ROI anual estimado: $${roi.ahorroAnualMXN.toLocaleString()} MXN`);
});

/* ─── Funciones globales del layout ──────────────────────────── */

/**
 * Cambia el panel visible
 * @param {string} nombre
 * @param {HTMLElement} btnEl
 */
function showPanel(nombre, btnEl) {
  document.querySelectorAll('.content-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  document.getElementById(`panel-${nombre}`)?.classList.add('active');
  btnEl?.classList.add('active');
}
