# SmartSlot AI — WMS Inteligente para Justo
**SIS-HACK 2026 · TESCI · Equipo UDU**

---

## ¿Qué es?

SmartSlot AI es el primer copiloto inteligente de almacén diseñado específicamente para Justo.  
Sugiere en menos de 1 segundo la ubicación óptima para cada mercancía recibida,  
usando datos reales del stock, historial de salidas y proximidad a la zona de despacho.

---

## Estructura del proyecto (MVC)

```
smartslot/
│
├── index.html                    ← Punto de entrada único (una sola página)
│
├── data/
│   └── wms_data.js               ← Datos reales de Justo (Stock, Rutas, Acomodo)
│
├── assets/
│   ├── css/
│   │   └── styles.css            ← Estilos globales del sistema
│   │
│   └── js/
│       ├── models/               ← MODELO: lógica de datos pura
│       │   ├── UbicacionModel.js ← Consulta ubicaciones, ocupación, zona, distancia
│       │   └── SKUModel.js       ← Consulta frecuencia de salida, vecinos
│       │
│       ├── services/             ← SERVICIO: lógica de negocio
│       │   ├── ScoringService.js ← Motor de scoring (4 factores, Top 3)
│       │   ├── SimuladorService.js← ROI, ahorro en metros, score de salud
│       │   └── WaldoService.js   ← Integración Claude API (Waldo el asistente)
│       │
│       ├── controllers/          ← CONTROLADOR: orquesta modelos y actualiza UI
│       │   ├── RecepcionController.js ← Flujo de recepción guiada + voz
│       │   ├── MapaController.js      ← Mapa 2D interactivo con heatmap
│       │   └── DashboardController.js ← ROI en vivo, score salud, alertas, Waldo
│       │
│       └── app.js                ← Entry point — inicializa todo
│
├── views/
│   └── partials/                 ← Fragmentos HTML reutilizables (referencia)
│       ├── recepcion.html        ← Vista del operador
│       ├── mapa.html             ← Vista del mapa
│       └── dashboard.html        ← Vista gerencial
│
└── docs/
    ├── arquitectura.md           ← Decisiones de diseño
    └── pitch.md                  ← Guión del pitch para el hackathon
```

---

## Arquitectura MVC

| Capa        | Archivo                  | Responsabilidad                              |
|-------------|--------------------------|----------------------------------------------|
| **Model**   | `UbicacionModel.js`      | Leer/consultar datos de ubicaciones          |
| **Model**   | `SKUModel.js`            | Leer/consultar datos de SKUs                 |
| **Service** | `ScoringService.js`      | Calcular scores (lógica de negocio)          |
| **Service** | `SimuladorService.js`    | ROI, ahorro, salud del almacén               |
| **Service** | `WaldoService.js`        | Llamadas a Claude API                        |
| **Controller** | `RecepcionController.js`| Orquestar recepción, actualizar UI        |
| **Controller** | `MapaController.js`  | Construir y animar el mapa                   |
| **Controller** | `DashboardController.js`| Dashboard, métricas, chat Waldo          |
| **Data**    | `wms_data.js`            | Datos crudos de Justo (solo lectura)         |

---

## Motor de Scoring

```
Score Final =
  Espacio disponible     × 35%
  Proximidad a despacho  × 30%
  Frecuencia de salida   × 25%
  Compatibilidad zona    × 10%
```

---

## Orden de carga de scripts en index.html

```html
<!-- 1. Datos primero -->
<script src="data/wms_data.js"></script>

<!-- 2. Modelos -->
<script src="assets/js/models/UbicacionModel.js"></script>
<script src="assets/js/models/SKUModel.js"></script>

<!-- 3. Servicios (dependen de modelos) -->
<script src="assets/js/services/ScoringService.js"></script>
<script src="assets/js/services/SimuladorService.js"></script>
<script src="assets/js/services/WaldoService.js"></script>

<!-- 4. Controladores (dependen de servicios) -->
<script src="assets/js/controllers/MapaController.js"></script>
<script src="assets/js/controllers/RecepcionController.js"></script>
<script src="assets/js/controllers/DashboardController.js"></script>

<!-- 5. Entry point (siempre último) -->
<script src="assets/js/app.js"></script>
```

---

## Rúbrica cubierta

| Criterio               | Cómo se cubre                                      | Puntos |
|------------------------|---------------------------------------------------|--------|
| Innovación             | Waldo IA + mapa 3D + modo voz                     | 5/5    |
| Solución del problema  | Scoring real con datos de Justo                   | 5/5    |
| Funcionalidad técnica  | Demo en vivo, interactivo, sin errores            | 5/5    |
| Viabilidad             | HTML puro, se integra a Odoo sin modificarlo      | 5/5    |
| Impacto                | ROI anual $378k MXN, ahorro 36% en metros         | 5/5    |
| Uso de tecnología      | Stack justificado, sin sobreingeniería, Git       | 5/5    |
| Presentación           | Pitch 3min + demo + defensa preparada             | 5/5    |

**Meta: 35/35**
