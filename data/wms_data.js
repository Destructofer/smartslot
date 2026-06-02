/**
 * @file       wms_data.js
 * @description Datos reales del almacén Justo — Noviembre 2025
 *              Fuente: Stock_Justo.xlsx · Ruta_Odoo.xlsx · Acomodo_Noviembre.xlsx
 *
 * IMPORTANTE: Este archivo es solo de datos puros (sin lógica).
 *             Para leer o transformar estos datos usar los modelos:
 *               - models/UbicacionModel.js
 *               - models/SKUModel.js
 *               - models/RutaModel.js
 */

const WMS_DATA = {

  /**
   * Ocupación por ubicación (%)
   * Key:   código de celda (ej. "BP40")
   * Value: porcentaje de ocupación (número 0-100)
   */
  ocupacion: {
    "LP60":43.5,"CP47":53.6,"CP259":59.1,"BP40":59.1,"LP38":66.2,"HP49":36.7,
    "CP26":56.1,"AP81":55.0,"AP32":61.2,"MP50":76.7,"JP06":77.5,"LP08":67.5,
    "KP37":70.4,"AP75":53.3,"GP34":25.0,"CP212":62.5,"MP61":66.9,"CP251":45.4,
    "CP31":35.5,"CP20":68.1,"JP26":35.0,"KP19":75.8,"KP04":41.2,"DP240":96.7,
    "EP41":49.8,"IP59":44.4,"HP02":76.6,"CP115":66.7,"FP21":50.6,"BP36":42.1,
    "EP23":23.9,"DP259":91.2,"LP53":65.4,"DP69":49.3,"JP27":57.5,"DP148":64.4,
    "CP88":60.8,"DP177":32.9,"DP58":55.3,"CP161":51.5,"CP255":41.9,"BP41":31.2,
    "CP52":71.7,"KP67":56.6,"JP70":32.9,"CP137":38.9,"DP61":72.6,"DP244":52.3,
    "CP123":50.8,"DP122":44.2,"JP16":29.8,"DP53":54.6,"FP67":76.8,"IP06":96.2,
    "CP152":45.9,"DP264":73.6,"IP50":61.4,"AP51":99.4,"DP103":92.5,"IP24":93.3,
    "BP74":96.7,"CP248":95.0,"CP119":95.0,"IP52":95.0,"BP58":96.7,"BP01":100.0,
    "LP32":100.0,"AP35":100.0,"HP65":100.0,"FP66":100.0,"DP193":100.0,
    "AP29":10.0,"AP36":10.0,"AP63":11.2,"AP21":11.2,"AP03":20.0,"BP20":20.0,
    "AP84":16.6,"AP85":23.3,"DP126":7.5,"CP96":8.3,"CP181":5.0,"JP19":5.0,
    "DP263":5.0,"DP88":14.2,"DP100":13.3,"FP28":11.2,"FP69":7.5,"FP70":10.0,
    "AP38":15.3,"LP42":16.7,"HP13":16.2,"JP56":15.6,"JP13":22.1,"DP13":21.4,
    "MP30":13.8,"EP24":11.7,"EP51":11.7,"AP24":18.4,"LP71":17.5,"MP14":18.3,
    "DP234":10.6,"CP145":10.0,"CP120":10.0,"BP10":10.0,"AP60":23.3
  },

  /**
   * Producto asignado por ubicación
   * Key:   código de celda
   * Value: nombre completo del producto
   */
  productos: {
    "LP60":"Cápsulas Café Punta del Cielo Espress Descafeinado 20 pzs",
    "CP47":"Café Molido Punta del Cielo Región Chiapas 300g",
    "BP40":"Cápsulas de Café Punta del Cielo Express Robusto 20 pzs",
    "LP38":"Cápsulas de Café Punta del Cielo Express 20 pzs",
    "HP49":"Cápsulas de Café Punta del Cielo Express 20 pzs",
    "CP26":"Cápsulas de Café Punta del Cielo Express Lungo 20 pzs",
    "AP81":"Cápsulas de Café Punta del Cielo Express Lungo 20 pzs",
    "AP32":"Café Molido Punta del Cielo Región Oaxaca 300g",
    "MP50":"Café en Grano Punta del Cielo Americano 250g",
    "JP06":"Café en Grano Punta del Cielo Americano 250g",
    "LP08":"Salsa Pesto Albahaca Verde Jüsto 180g",
    "KP37":"Salsa Pesto Albahaca Verde Jüsto 180g",
    "AP75":"Salsa de Tomate para Pasta Tradicional Jüsto 430g",
    "GP34":"Salsa Pesto Chile Poblano Jüsto 180g",
    "CP212":"Pasta de Tomate Natural Jüsto 180g",
    "MP61":"Pasta de Tomate Natural Jüsto 180g",
    "CP251":"Café Nescafé Cappuccino Descafeinado 6 pzs",
    "CP31":"Leche Evaporada Carnation Clavel en Polvo 1.3kg",
    "CP20":"Leche Evaporada Carnation Clavel en Polvo 1.3kg",
    "JP26":"Cereal Infantil Nestum Avena 270g",
    "KP19":"Sustituto de Crema Líquido Coffee Mate Crema Irlandesa 530g",
    "KP04":"Sustituto de Crema para Café Coffee Mate Pumpkin Spice 350g",
    "DP240":"Sustituto de Crema Líquido Coffee Mate Vainilla 680ml",
    "EP41":"Alimento Infantil Gerber Etapa 4 Manzana 110g",
    "IP59":"Jugo Sazonador Maggi Reducido en Sodio 200ml",
    "HP02":"Leche en Polvo Carnation Clavel Deslactosada 460g",
    "CP115":"Café Soluble Nescafé Café de Olla 170g",
    "FP21":"Hojas Sazonadoras Maggi Jugoso al Sartén Ajo Cebolla 4 pzs",
    "BP36":"Hojas Sazonadoras Maggi Jugoso al Sartén Ajo Cebolla 4 pzs",
    "EP23":"Café Tostado y Molido Taster's Choice Gourmet Blend 1kg",
    "DP259":"Alimento en Polvo Nesquik sabor Chocolate 700g",
    "LP53":"Café Soluble Nescafé Latte sabor Caramelo 120g",
    "DP69":"Café Soluble Nescafé Decaf Descafeinado 170g",
    "JP27":"Café Soluble Nescafé Decaf Descafeinado 170g",
    "DP148":"Café Soluble Nescafé Reserva Mexicana Oahan 180g",
    "CP88":"Café Soluble Nescafé Clásico Ice 170g",
    "DP177":"Chocolate Carlos V Original Stick 160g",
    "DP58":"Media Crema Nestlé Deslactosada 190g",
    "CP161":"Media Crema Nestlé Deslactosada 190g",
    "CP255":"Chocolate Carlos V Cero sin Azúcar 170g",
    "BP41":"Chocolate Carlos V Cero sin Azúcar 170g",
    "CP52":"Chocolate Carlos V Cero sin Azúcar 170g",
    "KP67":"Chocolate Carlos V Semiamargo Cero sin Azúcar 170g",
    "JP70":"Chocolate Carlos V Stick Cero sin Azúcar 112g",
    "CP137":"Sustituto de Crema Líquido Coffee Mate sabor Canela 530g",
    "DP61":"Cereal Cheerios Miel Bolsa 100g",
    "DP244":"Papilla Gerber Etapa 3 Cosecha Natural Mango 170g",
    "CP123":"Papilla Gerber Etapa 3 Cosecha Natural Mango 170g",
    "DP122":"Leche Evaporada Carnation Clavel para Café 496g",
    "JP16":"Cereal Cinnamon Toast Crunch sabor Canela 340g",
    "DP53":"Cereal Cinnamon Toast Crunch sabor Canela 340g",
    "FP67":"Cereal Lucky Charms Avena y Más 297g",
    "IP06":"Cereal Lucky Charms Avena y Más 297g",
    "CP152":"Sustituto de Crema para Café Coffee Mate Vainilla 530g",
    "DP264":"Leche Condensada La Lechera Original 430g",
    "IP50":"Leche Condensada La Lechera Original 430g"
  },

  /**
   * SKUs con su frecuencia de aparición en rutas de picking
   * Key:   SKU (número)
   * Value: frecuencia (cuántas veces aparece en Ruta_Odoo)
   * Derivado de: Ruta_Odoo.xlsx — Picking orden original
   */
  frecuenciaSalida: {
    10366: 8,  10210: 7,  12219: 5,  10369: 6,  12292: 4,
    21483: 9,  27629: 6,  15414: 5,  11535: 4,  11364: 7,
    10236: 8,  10242: 7,  15091: 9,  14873: 5,  13872: 4,
    13488: 8,  12477: 7,  12479: 6,  13491: 5,  22248: 8,
    22249: 7,  26983: 4,  22250: 6,  10285: 7,  26885: 5,
    12658: 9,  25095: 6,  15168: 5,  21639: 7,  26433: 6
  },

  /**
   * Celdas en ruta de picking activa (Noviembre)
   * Fuente: Ruta_Odoo.xlsx — columna Ubicación
   */
  rutaActiva: [
    "CP94","DP25","BP30","CP41","CP78","CP38","DP81","AP29","DP46","BP48",
    "DP62","AP63","EP82","CP126","DP23","DP66","DP109","CP55","CP39","DP57",
    "CP82","DP83","CP58","BP83","AP52","AP69","DP48","BP47","AP48","DP106",
    "CP136","CP63","DP119","DP59","AP83","CP108","DP21","DP41","BP50","BP56",
    "EP75","BP64","AP35","BP79","EP81","DP22","BP33","DP49","DP78","BP55",
    "DP30","BP84","CP23","DP102","CP84","CP50","DP52","CP18","AP75","CP93",
    "AP39","EP83","AP40","BP70","AP80","DP47","DP124","CP71","FP45","CP105",
    "DP39","DP97","FP37","BP78","CP32","DP60","CP61","DP43","CP97","DP61"
  ],

  /**
   * Historial de acomodo real — Noviembre 2025
   * Fuente: Acomodo_Noviembre.xlsx
   * Usado por: services/SimuladorService.js para calcular ahorro real
   */
  acomodoNoviembre: [
    { sku:12478, producto:"Cápsulas Café Punta del Cielo Descafeinado 20 pzs", destino:"CP76PK4", x:3,  y:76,  z:4 },
    { sku:13491, producto:"Café Molido Punta del Cielo Región Chiapas 300g",   destino:"KP63N6",  x:11, y:63,  z:6 },
    { sku:13488, producto:"Cápsulas Café Punta del Cielo Express Robusto",      destino:"DP53N2",  x:4,  y:53,  z:2 },
    { sku:12477, producto:"Cápsulas Café Punta del Cielo Express 20 pzs",       destino:"KP29N5",  x:11, y:29,  z:5 },
    { sku:12479, producto:"Cápsulas Café Punta del Cielo Express Lungo",         destino:"DP53N2",  x:4,  y:53,  z:2 },
    { sku:13490, producto:"Café Molido Punta del Cielo Región Oaxaca 300g",     destino:"DP53N2",  x:4,  y:53,  z:2 },
    { sku:13489, producto:"Café en Grano Punta del Cielo Americano 250g",       destino:"CP179PK2",x:3,  y:179, z:2 },
    { sku:22248, producto:"Salsa Pesto Albahaca Verde Jüsto 180g",              destino:"CP60N2",  x:3,  y:60,  z:2 },
    { sku:22249, producto:"Salsa de Tomate para Pasta Tradicional Jüsto 430g",  destino:"CP211PK3",x:3,  y:211, z:3 },
    { sku:26983, producto:"Salsa Pesto Chile Poblano Jüsto 180g",               destino:"CP60N2",  x:3,  y:60,  z:2 },
    { sku:22250, producto:"Pasta de Tomate Natural Jüsto 180g",                 destino:"BP25N2",  x:2,  y:25,  z:2 },
    { sku:21644, producto:"Leche Evaporada Carnation Clavel en Polvo 1.3kg",    destino:"DP56N2",  x:4,  y:56,  z:2 },
    { sku:12224, producto:"Cereal Infantil Nestum Avena 270g",                  destino:"DP56N2",  x:4,  y:56,  z:2 },
    { sku:20865, producto:"Jugo Sazonador Maggi Reducido en Sodio 200ml",       destino:"BP70N1",  x:2,  y:70,  z:1 },
    { sku:25367, producto:"Chocolate Carlos V Cero sin Azúcar 170g",            destino:"BP41N1",  x:2,  y:41,  z:1 },
    { sku:25366, producto:"Chocolate Carlos V Semiamargo Cero sin Azúcar 170g", destino:"EP82N1",  x:5,  y:82,  z:1 },
    { sku:10430, producto:"Leche Evaporada Carnation Clavel 1kg",               destino:"CP32PK1", x:3,  y:32,  z:1 },
    { sku:21639, producto:"Leche Condensada La Lechera Original 670g",          destino:"BP64N1",  x:2,  y:64,  z:1 },
    { sku:26885, producto:"Cereal Cinnamon Toast Crunch sabor Canela 340g",     destino:"CP54N2",  x:3,  y:54,  z:2 },
    { sku:12658, producto:"Cereal Lucky Charms Avena y Más 297g",               destino:"AP55N1",  x:1,  y:55,  z:1 }
  ],

  /**
   * Zonas del almacén por pasillo
   * Fuente: información proporcionada por Justo en el hackathon
   */
  zonas: {
    A: { pasillos: ["AP","BP"],      label: "Zona A — Cliente principal",  proximidadDespacho: 1 },
    B: { pasillos: ["CP","DP"],      label: "Zona B — Alta rotación",      proximidadDespacho: 2 },
    C: { pasillos: ["EP","FP","GP"], label: "Zona C — Rotación media",     proximidadDespacho: 3 },
    D: { pasillos: ["HP","IP","JP"], label: "Zona D — Baja rotación",      proximidadDespacho: 4 },
    E: { pasillos: ["KP","LP","MP"], label: "Zona E — Desborde / overflow",proximidadDespacho: 5 }
  },

  /**
   * Estándares de dimensiones del almacén (cm)
   * Fuente: notas del equipo — info de Justo
   */
  dimensiones: {
    estanteria: { frente: 40,  fondo: 100, alto: 90,  label: "Estantería estándar" },
    rack:       { frente: 100, fondo: 120, alto: 160, label: "Rack / tarima"       }
  },

  /**
   * Zonas preferidas por marca/cliente
   * Usadas por ScoringService para priorizar ubicaciones según el proveedor
   */
  marcaZonas: {
    "Jüsto":           { zona: "A", color: "#3fb950", label: "Marca Propia Jüsto",      icono: "🟢" },
    "Justo":           { zona: "A", color: "#3fb950", label: "Marca Propia Jüsto",      icono: "🟢" },
    "Punta del Cielo": { zona: "B", color: "#06b6d4", label: "Café Punta del Cielo",   icono: "🔵" },
    "Nescafé":         { zona: "B", color: "#388bfd", label: "Nestlé — Cafés",          icono: "🔷" },
    "Nestlé":          { zona: "C", color: "#a855f7", label: "Grupo Nestlé",            icono: "🟣" },
    "Carnation":       { zona: "C", color: "#a855f7", label: "Grupo Nestlé",            icono: "🟣" },
    "Coffee Mate":     { zona: "C", color: "#a855f7", label: "Grupo Nestlé",            icono: "🟣" },
    "Maggi":           { zona: "C", color: "#a855f7", label: "Grupo Nestlé",            icono: "🟣" },
    "Nesquik":         { zona: "C", color: "#a855f7", label: "Grupo Nestlé",            icono: "🟣" },
    "Lucky Charms":    { zona: "C", color: "#a855f7", label: "Grupo Nestlé",            icono: "🟣" },
    "Cheerios":        { zona: "C", color: "#a855f7", label: "Grupo Nestlé",            icono: "🟣" },
    "Carlos V":        { zona: "C", color: "#a855f7", label: "Grupo Nestlé",            icono: "🟣" },
    "Gerber":          { zona: "D", color: "#fbbf24", label: "Infantil / Gerber",       icono: "🟡" },
    "Nestum":          { zona: "D", color: "#fbbf24", label: "Infantil / Nestlé Baby",  icono: "🟡" },
    "La Lechera":      { zona: "C", color: "#a855f7", label: "Grupo Nestlé",            icono: "🟣" },
    "Taster's Choice": { zona: "B", color: "#388bfd", label: "Nestlé — Cafés",          icono: "🔷" }
  },

  /**
   * Pasillos del almacén y su índice X (1=más cerca de despacho)
   * Fuente: Mapa Completo de Módulos (mapa_modulos.html)
   */
  pasillos: {
    AP:{ x:1,  maxPosicion:88  },
    BP:{ x:2,  maxPosicion:88  },
    CP:{ x:3,  maxPosicion:272 },
    DP:{ x:4,  maxPosicion:272 },
    EP:{ x:5,  maxPosicion:86  },
    FP:{ x:6,  maxPosicion:72  },
    GP:{ x:7,  maxPosicion:72  },
    HP:{ x:8,  maxPosicion:72  },
    IP:{ x:9,  maxPosicion:72  },
    JP:{ x:10, maxPosicion:72  },
    KP:{ x:11, maxPosicion:72  },
    LP:{ x:12, maxPosicion:72  },
    MP:{ x:13, maxPosicion:76  }
  }
};
