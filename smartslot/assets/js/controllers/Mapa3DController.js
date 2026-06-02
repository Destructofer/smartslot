/**
 * @file       Mapa3DController.js
 * @layer      Controller (MVC)
 * @description Renderiza el almacén en 3D con Three.js.
 *              Estanterías navegables, ocupación por color, raycasting,
 *              filtros por nivel/ocupación/pasillo y vistas de cámara.
 *
 * Depende de: Three.js r128 (cargado vía CDN) · WMS_DATA
 *
 * Genera datos 3D a partir de los datos reales del almacén, expandiendo
 * cada ubicación 2D en una columna de niveles (N1-N6).
 */

const Mapa3DController = (() => {

  /* ─── Estado interno ───────────────────────────────────────── */
  let _iniciado    = false;
  let _scene, _cam, _renderer, _raf;
  let _instMeshes  = {};
  let _instData    = {};
  let _theta = -0.3, _phi = 1.05, _radius = 160;
  let _tx = 0, _ty = 3, _tz = 0;
  let _autoRot = true;
  let _fP = 0, _fZ = 1, _fAisle = 0;

  /* ─── Configuración del almacén ────────────────────────────── */
  const SY = 0.9, SZ = 1.8, SW = 1.2, GAP = 2.8;
  const AISLES = {
    1:{name:'AP',yMax:88,zMax:5,wx:0},
    2:{name:'BP',yMax:88,zMax:5,wx:SW+GAP},
    3:{name:'CP',yMax:272,zMax:6,wx:(SW+GAP)*2},
    4:{name:'DP',yMax:272,zMax:6,wx:(SW+GAP)*3},
    5:{name:'EP',yMax:86,zMax:5,wx:(SW+GAP)*4},
    6:{name:'FP',yMax:72,zMax:5,wx:(SW+GAP)*5},
    7:{name:'GP',yMax:72,zMax:5,wx:(SW+GAP)*6},
    8:{name:'HP',yMax:72,zMax:6,wx:(SW+GAP)*7},
    9:{name:'IP',yMax:72,zMax:6,wx:(SW+GAP)*8},
    10:{name:'JP',yMax:72,zMax:6,wx:(SW+GAP)*9},
    11:{name:'KP',yMax:72,zMax:6,wx:(SW+GAP)*10},
    12:{name:'LP',yMax:72,zMax:6,wx:(SW+GAP)*11},
    13:{name:'MP',yMax:76,zMax:6,wx:(SW+GAP)*12}
  };
  const COLOR_BUCKETS = [0x166534, 0x15803d, 0xa16207, 0xc2410c, 0xb91c1c];

  /* ─── Helpers ──────────────────────────────────────────────── */

  const _getBucket = (p) => {
    if (p <= 25) return 0x166534;
    if (p <= 50) return 0x15803d;
    if (p <= 75) return 0xa16207;
    if (p <= 90) return 0xc2410c;
    return 0xb91c1c;
  };

  /**
   * Genera datos 3D a partir de los datos reales 2D del almacén.
   * Expande cada celda con stock en una columna de niveles.
   */
  const _generarLookup = () => {
    const lookup = {};
    const pasilloX = {AP:1,BP:2,CP:3,DP:4,EP:5,FP:6,GP:7,HP:8,IP:9,JP:10,KP:11,LP:12,MP:13};

    Object.entries(WMS_DATA.ocupacion).forEach(([celda, occ]) => {
      const pasillo  = celda.replace(/\d.*$/, '');
      const posicion = parseInt(celda.replace(/^[A-Z]+/, ''), 10);
      const xi = pasilloX[pasillo];
      if (!xi || !posicion) return;

      const ais = AISLES[xi];
      if (posicion > ais.yMax) return;

      const producto = WMS_DATA.productos[celda] || 'Producto sin nombre';
      // Distribuye la ocupación en niveles con variación
      const niveles = Math.min(ais.zMax, 3);
      for (let zi = 1; zi <= niveles; zi++) {
        const variacion = (Math.random() - 0.5) * 20;
        const pct = Math.max(0, Math.min(100, occ + variacion));
        const cant = Math.round(pct * 4 + Math.random() * 100);
        lookup[`${xi}_${posicion}_${zi}`] = [pct, cant, producto];
      }
    });

    return lookup;
  };

  /* ─── Construcción de la escena ────────────────────────────── */

  const _construirEscena = () => {
    const canvas = document.getElementById('canvas-3d');
    if (!canvas) return;

    const THREE = window.THREE;
    const LOOKUP = _generarLookup();

    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(0x0d1117);
    _scene.fog = new THREE.FogExp2(0x0d1117, 0.0012);

    const cont = canvas.parentElement;
    const W = cont.clientWidth, H = cont.clientHeight || 600;
    _cam = new THREE.PerspectiveCamera(42, W / H, 0.1, 3000);
    _renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    _renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    _renderer.setSize(W, H);

    // Luces
    _scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(100, 200, 100);
    _scene.add(sun);
    const fill = new THREE.DirectionalLight(0x6080c0, 0.4);
    fill.position.set(-50, 50, -50);
    _scene.add(fill);
    _scene.add(new THREE.HemisphereLight(0x3a4a6a, 0x1a1a2a, 0.5));

    // Piso
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshLambertMaterial({ color: 0x161b22 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    _scene.add(floor);
    _scene.add(new THREE.GridHelper(500, 100, 0x30363d, 0x21262d));

    // Materiales de cajas
    const boxGeo = new THREE.BoxGeometry(SW * 0.84, SZ * 0.64, SY * 0.70);
    const matCache = {};
    COLOR_BUCKETS.forEach(c => {
      const col = new THREE.Color(c);
      matCache[c] = new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.12 });
    });

    // Recolectar cajas por color (color por columna promedio)
    _instData = {};
    COLOR_BUCKETS.forEach(c => { _instData[c] = []; });

    for (let xi = 1; xi <= 13; xi++) {
      const ais = AISLES[xi];
      for (let yi = 1; yi <= ais.yMax; yi++) {
        let total = 0, count = 0;
        for (let zi = 1; zi <= ais.zMax; zi++) {
          const cell = LOOKUP[`${xi}_${yi}_${zi}`];
          if (cell) { total += cell[0]; count++; }
        }
        if (!count) continue;
        const colColor = _getBucket(total / count);
        for (let zi = 1; zi <= ais.zMax; zi++) {
          const cell = LOOKUP[`${xi}_${yi}_${zi}`];
          if (!cell) continue;
          const [pct, cant, prod] = cell;
          _instData[colColor].push({
            wx: ais.wx + SW / 2, wy: (zi - 1) * SZ + SZ / 2 + 0.05, wz: (yi - 1) * SY,
            pct, cant, prod, xi, yi, zi, name: ais.name, colPct: total / count
          });
        }
      }
    }

    // InstancedMesh por color
    _instMeshes = {};
    const dummy = new THREE.Object3D();
    COLOR_BUCKETS.forEach(c => {
      const arr = _instData[c];
      if (!arr.length) return;
      const im = new THREE.InstancedMesh(boxGeo, matCache[c], arr.length);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      arr.forEach((d, i) => {
        dummy.position.set(d.wx, d.wy, d.wz);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
      _scene.add(im);
      _instMeshes[c] = im;
    });

    // Estructura de racks (simplificada para rendimiento)
    const postMat = new THREE.MeshLambertMaterial({ color: 0x4a5a6a });
    const shelfMat = new THREE.MeshLambertMaterial({ color: 0x5a6a7a, transparent: true, opacity: 0.4 });
    for (let xi = 1; xi <= 13; xi++) {
      const ais = AISLES[xi];
      const totalDepth = ais.yMax * SY;
      const totalHeight = ais.zMax * SZ + 0.08;
      const step = ais.yMax > 60 ? 4 : 2;
      const upGeo = new THREE.BoxGeometry(0.06, totalHeight, 0.06);
      for (let yi = 0; yi <= ais.yMax; yi += step) {
        const wz = yi * SY;
        const uL = new THREE.Mesh(upGeo, postMat);
        uL.position.set(ais.wx + 0.03, totalHeight / 2, wz);
        _scene.add(uL);
        const uR = new THREE.Mesh(upGeo, postMat);
        uR.position.set(ais.wx + SW - 0.03, totalHeight / 2, wz);
        _scene.add(uR);
      }
      const shelfGeo = new THREE.BoxGeometry(SW - 0.06, 0.04, totalDepth);
      for (let zi = 0; zi <= ais.zMax; zi++) {
        const shelf = new THREE.Mesh(shelfGeo, shelfMat);
        shelf.position.set(ais.wx + SW / 2, zi * SZ + 0.02, totalDepth / 2 - SY * 0.5);
        _scene.add(shelf);
      }
    }

    // Etiquetas de pasillo
    for (let xi = 1; xi <= 13; xi++) {
      const ais = AISLES[xi];
      _scene.add(_sprite(THREE, ais.name, ais.wx + SW / 2, ais.zMax * SZ + 1.5, -2));
    }

    // Cámara
    _tx = AISLES[7].wx + SW / 2;
    _tz = (AISLES[3].yMax * SY) / 2;
    _updateCam();

    _bindEventos(canvas, THREE);
    _animate();
  };

  const _sprite = (THREE, text, x, y, z) => {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.font = 'bold 30px IBM Plex Mono, monospace';
    ctx.fillStyle = '#56d3ba';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 44);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true
    }));
    sp.position.set(x, y, z);
    sp.scale.set(8, 2, 1);
    return sp;
  };

  const _updateCam = () => {
    _cam.position.x = _tx + _radius * Math.sin(_phi) * Math.sin(_theta);
    _cam.position.y = _ty + _radius * Math.cos(_phi);
    _cam.position.z = _tz + _radius * Math.sin(_phi) * Math.cos(_theta);
    _cam.lookAt(_tx, _ty, _tz);
  };

  const _bindEventos = (canvas, THREE) => {
    let drag = false, lastX = 0, lastY = 0;
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const tip = document.getElementById('tip-3d');

    canvas.addEventListener('mousedown', e => { drag = true; lastX = e.clientX; lastY = e.clientY; });
    canvas.addEventListener('mouseup', () => drag = false);
    canvas.addEventListener('mouseleave', () => { drag = false; if (tip) tip.style.display = 'none'; });
    canvas.addEventListener('mousemove', e => {
      if (drag) {
        _theta -= (e.clientX - lastX) * 0.004;
        _phi = Math.max(0.08, Math.min(1.52, _phi + (e.clientY - lastY) * 0.004));
        lastX = e.clientX; lastY = e.clientY;
        _updateCam();
        _autoRot = false;
      }
      // Hover raycast
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(mouse, _cam);
      let best = null, bestD = Infinity;
      COLOR_BUCKETS.forEach(c => {
        if (!_instMeshes[c]) return;
        const hits = [];
        ray.intersectObject(_instMeshes[c], false, hits);
        if (hits.length && hits[0].distance < bestD) {
          bestD = hits[0].distance;
          best = { c, iid: hits[0].instanceId };
        }
      });
      if (best && tip) {
        const d = _instData[best.c][best.iid];
        if (d) {
          tip.innerHTML = `<strong style="color:var(--cyan)">${d.name}${String(d.yi).padStart(2,'0')} · N${d.zi}</strong>
            <div style="color:var(--muted);font-size:11px;margin:4px 0">${d.prod}</div>
            <div style="display:flex;justify-content:space-between"><span>Ocupación:</span><b>${d.pct.toFixed(1)}%</b></div>
            <div style="display:flex;justify-content:space-between"><span>Cantidad:</span><b>${d.cant.toLocaleString()} pz</b></div>`;
          tip.style.display = 'block';
          tip.style.left = Math.min(e.clientX + 16, innerWidth - 260) + 'px';
          tip.style.top = Math.max(e.clientY - 60, 8) + 'px';
        }
      } else if (tip) {
        tip.style.display = 'none';
      }
    });
    canvas.addEventListener('wheel', e => {
      _radius = Math.max(8, Math.min(800, _radius + e.deltaY * 0.18));
      _updateCam(); e.preventDefault();
    }, { passive: false });

    // Touch
    let lt = null;
    canvas.addEventListener('touchstart', e => { lt = e.touches[0]; });
    canvas.addEventListener('touchmove', e => {
      if (!lt) return;
      const t = e.touches[0];
      _theta -= (t.clientX - lt.clientX) * 0.004;
      _phi = Math.max(0.08, Math.min(1.52, _phi + (t.clientY - lt.clientY) * 0.004));
      lt = t; _updateCam(); e.preventDefault();
    }, { passive: false });
  };

  const _animate = () => {
    _raf = requestAnimationFrame(_animate);
    if (_autoRot) { _theta += 0.0008; _updateCam(); }
    if (_renderer && _scene && _cam) _renderer.render(_scene, _cam);
  };

  const _applyFilter = () => {
    const THREE = window.THREE;
    const dummy = new THREE.Object3D();
    COLOR_BUCKETS.forEach(c => {
      const im = _instMeshes[c];
      if (!im) return;
      _instData[c].forEach((d, i) => {
        const show = d.pct >= _fP && d.zi >= _fZ && (_fAisle === 0 || d.xi === _fAisle);
        dummy.position.set(d.wx, show ? d.wy : -9999, d.wz);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
    });
  };

  /* ─── API pública ──────────────────────────────────────────── */

  return {

    /**
     * Inicializa el visor 3D (carga Three.js si hace falta).
     * Llamar cuando el usuario abre la vista 3D.
     */
    abrir() {
      const modal = document.getElementById('modal-3d');
      if (modal) modal.classList.add('show');

      if (_iniciado) {
        this.redimensionar();
        return;
      }

      // Cargar Three.js dinámicamente
      if (window.THREE) {
        _construirEscena();
        _iniciado = true;
      } else {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        script.onload = () => {
          _construirEscena();
          _iniciado = true;
        };
        document.head.appendChild(script);
      }
    },

    cerrar() {
      const modal = document.getElementById('modal-3d');
      if (modal) modal.classList.remove('show');
    },

    setOcupacionMin(v) {
      _fP = +v;
      document.getElementById('f3d-p-val').textContent = v + '%';
      _applyFilter();
    },

    setNivelMin(v) {
      _fZ = +v;
      document.getElementById('f3d-z-val').textContent = 'N' + v;
      _applyFilter();
    },

    setPasillo(xi, btnEl) {
      _fAisle = +xi;
      document.querySelectorAll('.aisle-btn-3d').forEach(b => b.classList.remove('active'));
      btnEl?.classList.add('active');
      if (xi > 0) {
        const ais = AISLES[xi];
        _tx = ais.wx + SW / 2; _ty = ais.zMax * SZ / 2; _tz = ais.yMax * SY / 2;
        _radius = Math.max(ais.yMax * SY * 0.7, 40);
        _updateCam();
      }
      _applyFilter();
    },

    resetCam() {
      _theta = -0.3; _phi = 1.05; _radius = 160;
      _tx = AISLES[7].wx + SW / 2; _ty = 3; _tz = (AISLES[3].yMax * SY) / 2;
      _updateCam();
    },

    setVista(v) {
      if (v === 'top')   { _phi = 0.05; _radius = 250; }
      if (v === 'front') { _phi = 1.4; _theta = Math.PI; _radius = 200; }
      if (v === 'iso')   { _phi = 0.75; _theta = -0.6; _radius = 200; }
      _updateCam();
    },

    toggleRotacion(btnEl) {
      _autoRot = !_autoRot;
      btnEl?.classList.toggle('active', _autoRot);
    },

    redimensionar() {
      if (!_renderer || !_cam) return;
      const canvas = document.getElementById('canvas-3d');
      const cont = canvas?.parentElement;
      if (!cont) return;
      const W = cont.clientWidth, H = cont.clientHeight || 600;
      _cam.aspect = W / H;
      _cam.updateProjectionMatrix();
      _renderer.setSize(W, H);
    },

    /** Llena los botones de pasillo del panel 3D */
    construirBotonesPasillo() {
      const cont = document.getElementById('aisle-grid-3d');
      if (!cont) return;
      let html = '<button class="aisle-btn-3d active" onclick="Mapa3DController.setPasillo(0,this)">Todos</button>';
      for (let xi = 1; xi <= 13; xi++) {
        html += `<button class="aisle-btn-3d" onclick="Mapa3DController.setPasillo(${xi},this)">${AISLES[xi].name}</button>`;
      }
      cont.innerHTML = html;
    }
  };
})();
