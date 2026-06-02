# CHANGELOG — SmartSlot AI

## v2.0 — Mapa 3D + Temas + Mejoras

### Nuevo
- **Mapa 3D navegable** (`Mapa3DController.js`): almacén completo en Three.js
  con estanterías, niveles N1-N6, ocupación por color, raycasting con tooltip,
  filtros por ocupación/nivel/pasillo, vistas planta/frontal/isométrica y
  rotación automática. Se abre en modal desde el botón "Ver en 3D".
- **Selector de temas** (`ThemeService.js`): 5 esquemas de color
  (Midnight, Nebula, Ocean, Forest, Daylight) aplicables en caliente.
- Animaciones de entrada en cards del dashboard.
- HUD del 3D con leyenda, stats y filtros interactivos.

### Arquitectura
- `ThemeService` y `Mapa3DController` se integran respetando el patrón MVC.
- El 3D genera sus datos a partir de los datos reales 2D (`_generarLookup`),
  expandiendo cada ubicación en columna de niveles.
- Three.js se carga de forma diferida (solo al abrir el 3D) para no penalizar
  la carga inicial.

## v1.0 — Base MVC
- Motor de scoring, simulador, Waldo IA, mapa 2D, dashboard, ruta, histórico.
