/**
 * @file       Mapa3DController.js
 * @layer      Controller (MVC)
 * @description Almacén 3D navegable — orbit + walk mode (WASD / click en piso).
 *              Pasillos amplios y caminables, transiciones suaves de cámara.
 *
 * Depende de: Three.js r128 (CDN) · WMS_DATA · UbicacionModel
 */

const Mapa3DController = (() => {

  /* ─── Estado del renderer ──────────────────────────────────── */
  let _iniciado   = false;
  let _scene, _cam, _renderer, _raf;
  let _instMeshes = {}, _instData = {};
  let _THREE_ref  = null;

  /* ─── Modo orbit (vista general) ──────────────────────────── */
  let _theta  = -0.4, _phi = 0.9, _radius = 220;
  let _tx = 0, _ty = 3, _tz = 0;
  let _autoRot = true;

  /* ─── Modo walk (primera persona) ──────────────────────────── */
  let _walkMode  = false;
  let _walkX     = 0, _walkY = 1.85, _walkZ = 0;
  let _walkYaw   = 0, _walkPitch = 0;
  let _keys      = {};
  let _walkSpeed = 0.22;
  let _lookDrag  = false, _lookLastX = 0, _lookLastY = 0;

  /* ─── Lerp suave entre vistas ───────────────────────────────── */
  let _lerpActive = false;
  let _lerpFrom   = {}, _lerpTo = {}, _lerpT = 0;

  /* ─── Filtros ───────────────────────────────────────────────── */
  let _fP = 0, _fZ = 1, _fAisle = 0;

  /* ─── Highlight de celda ────────────────────────────────────── */
  let _hlMesh = null, _hlEdges = null, _hlBeam = null;
  let _hlRaf  = null, _hlT = 0;

  /* ─── Geometría del almacén ─────────────────────────────────── */
  const SW       = 1.4;   // ancho de estantería
  const SH       = 2.0;   // altura por nivel
  const SD       = 0.95;  // profundidad de celda
  const AISLE_W  = 3.5;   // corredor caminable entre pasillos
  const SLOT     = SW + AISLE_W;

  const AISLES = {
    1: {name:'AP', yMax:88,  zMax:5, wx: SLOT*0  },
    2: {name:'BP', yMax:88,  zMax:5, wx: SLOT*1  },
    3: {name:'CP', yMax:90,  zMax:6, wx: SLOT*2  },
    4: {name:'DP', yMax:90,  zMax:6, wx: SLOT*3  },
    5: {name:'EP', yMax:86,  zMax:5, wx: SLOT*4  },
    6: {name:'FP', yMax:72,  zMax:5, wx: SLOT*5  },
    7: {name:'GP', yMax:72,  zMax:5, wx: SLOT*6  },
    8: {name:'HP', yMax:72,  zMax:6, wx: SLOT*7  },
    9: {name:'IP', yMax:72,  zMax:6, wx: SLOT*8  },
   10: {name:'JP', yMax:72,  zMax:6, wx: SLOT*9  },
   11: {name:'KP', yMax:72,  zMax:6, wx: SLOT*10 },
   12: {name:'LP', yMax:72,  zMax:6, wx: SLOT*11 },
   13: {name:'MP', yMax:76,  zMax:6, wx: SLOT*12 }
  };

  // Mismos 5 estados que el mapa 2D
  const COLOR_BUCKETS = [0x166534, 0x15803d, 0xa16207, 0xb91c1c, 0x7c3aed];
  //                      free      low       med       high      ruta

  const _getBucket = (p, enRuta = false) => {
    if (enRuta)  return 0x7c3aed;  // purple — en ruta picking
    if (p < 20)  return 0x166534;  // verde oscuro — libre
    if (p < 50)  return 0x15803d;  // verde — bajo
    if (p < 90)  return 0xa16207;  // ámbar — medio
    return 0xb91c1c;               // rojo  — alto/crítico
  };

  /* ─── Generación del lookup de celdas ──────────────────────── */
  const _generarLookup = () => {
    const lookup  = {};
    const pidx    = {AP:1,BP:2,CP:3,DP:4,EP:5,FP:6,GP:7,HP:8,IP:9,JP:10,KP:11,LP:12,MP:13};
    const enRutaSet = new Set(WMS_DATA.rutaActiva || []);

    Object.entries(WMS_DATA.ocupacion).forEach(([celda, occ]) => {
      const pasillo  = celda.replace(/\d.*$/, '');
      const posicion = parseInt(celda.replace(/^[A-Z]+/, ''), 10);
      const xi = pidx[pasillo];
      if (!xi || !posicion) return;
      const ais    = AISLES[xi];
      if (posicion > ais.yMax) return;
      const prod   = WMS_DATA.productos[celda] || '—';
      const enRuta = enRutaSet.has(celda);
      const niveles = Math.min(ais.zMax, 3);
      for (let zi = 1; zi <= niveles; zi++) {
        const pct  = Math.max(0, Math.min(100, occ + (zi - 1) * 2));
        const cant = Math.round(pct * 3.8 + 20);
        lookup[`${xi}_${posicion}_${zi}`] = [pct, cant, prod, enRuta];
      }
    });
    return lookup;
  };

  /* ─── Highlight de celda 3D ────────────────────────────────── */

  const _clearHighlight = () => {
    if (_hlRaf) { cancelAnimationFrame(_hlRaf); _hlRaf = null; }
    [_hlMesh, _hlEdges, _hlBeam].forEach(m => {
      if (m && _scene) {
        _scene.remove(m);
        m.geometry?.dispose();
        m.material?.dispose();
      }
    });
    _hlMesh = _hlEdges = _hlBeam = null;
  };

  const _highlightCell = (wx, wy, wz, aisZMax) => {
    const THREE = _THREE_ref;
    if (!THREE || !_scene) return;
    _clearHighlight();

    const colH = aisZMax * SH;          // altura total del rack en esa columna
    const cy   = colH / 2 + 0.04;       // centro vertical del bloque

    // Caja semitransparente que envuelve toda la columna del lote
    const boxGeo = new THREE.BoxGeometry(SW * 1.22, colH + 0.1, SD * 1.22);
    const boxMat = new THREE.MeshBasicMaterial({
      color: 0x56d3ba, transparent: true, opacity: 0.22, depthWrite: false
    });
    _hlMesh = new THREE.Mesh(boxGeo, boxMat);
    _hlMesh.position.set(wx, cy, wz);
    _scene.add(_hlMesh);

    // Wireframe de aristas para contorno nítido
    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x56d3ba, linewidth: 2 });
    _hlEdges = new THREE.LineSegments(edgesGeo, edgesMat);
    _hlEdges.position.set(wx, cy, wz);
    _scene.add(_hlEdges);

    // Rayo de luz vertical (beacon) que asciende desde el techo del rack
    const beamGeo = new THREE.CylinderGeometry(0.08, 0.35, 18, 8, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x56d3ba, transparent: true, opacity: 0.18,
      side: THREE.DoubleSide, depthWrite: false
    });
    _hlBeam = new THREE.Mesh(beamGeo, beamMat);
    _hlBeam.position.set(wx, colH + 9, wz);
    _scene.add(_hlBeam);

    // Animación de pulso
    _hlT = 0;
    const pulse = () => {
      _hlT += 0.04;
      const s = 0.15 + Math.abs(Math.sin(_hlT)) * 0.18;
      boxMat.opacity  = s;
      beamMat.opacity = s * 0.8;
      const sc = 1 + Math.sin(_hlT * 1.2) * 0.04;
      _hlMesh.scale.set(sc, 1, sc);
      _hlEdges.scale.set(sc, 1, sc);
      _hlRaf = requestAnimationFrame(pulse);
    };
    _hlRaf = requestAnimationFrame(pulse);

    // Auto-apagar a los 6 segundos
    setTimeout(_clearHighlight, 6000);
  };

  /* ─── Construcción de la escena ─────────────────────────────── */
  const _construirEscena = () => {
    const canvas = document.getElementById('canvas-3d');
    if (!canvas) return;
    const THREE = _THREE_ref;
    const LOOKUP = _generarLookup();

    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(0x0a0e14);
    _scene.fog = new THREE.FogExp2(0x0a0e14, 0.0006);

    const cont = canvas.parentElement;
    const W = cont.clientWidth, H = cont.clientHeight || 600;
    _cam = new THREE.PerspectiveCamera(65, W / H, 0.05, 2000);
    _renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    _renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    _renderer.setSize(W, H);
    _renderer.shadowMap.enabled = true;

    /* Luces */
    _scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(80, 160, 80);
    sun.castShadow = true;
    _scene.add(sun);
    _scene.add(new THREE.HemisphereLight(0x3a4a6a, 0x1a1a2a, 0.5));

    /* Piso principal */
    const totalW = SLOT * 13 + SW;
    const maxDepth = AISLES[3].yMax * SD;
    const floorGeo = new THREE.PlaneGeometry(totalW + 20, maxDepth + 20);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x111820 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(totalW / 2 - SW / 2, -0.01, maxDepth / 2);
    floor.receiveShadow = true;
    _scene.add(floor);

    /* Líneas de pasillo pintadas en el suelo */
    const lineMat = new THREE.LineBasicMaterial({ color: 0x1e3a2a, linewidth: 1 });
    for (let xi = 1; xi <= 13; xi++) {
      const ais = AISLES[xi];
      const cx  = ais.wx + SW + AISLE_W / 2; // centro del corredor
      const pts = [
        new THREE.Vector3(cx, 0.01, 0),
        new THREE.Vector3(cx, 0.01, ais.yMax * SD)
      ];
      _scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts), lineMat
      ));
    }

    /* Grid sutil */
    const grid = new THREE.GridHelper(Math.max(totalW, maxDepth) + 40, 80, 0x1e2530, 0x161c24);
    grid.position.set(totalW / 2, 0, maxDepth / 2);
    _scene.add(grid);

    /* ── Cajas (instanced) ──────────────────────────────────── */
    const boxGeo = new THREE.BoxGeometry(SW * 0.86, SH * 0.62, SD * 0.72);
    const matCache = {};
    COLOR_BUCKETS.forEach(c => {
      const col = new THREE.Color(c);
      matCache[c] = new THREE.MeshLambertMaterial({
        color: col, emissive: col, emissiveIntensity: 0.08
      });
    });

    _instData = {};
    COLOR_BUCKETS.forEach(c => { _instData[c] = []; });

    for (let xi = 1; xi <= 13; xi++) {
      const ais = AISLES[xi];
      for (let yi = 1; yi <= ais.yMax; yi++) {
        let tot = 0, cnt = 0;
        for (let zi = 1; zi <= ais.zMax; zi++) {
          const cell = LOOKUP[`${xi}_${yi}_${zi}`];
          if (cell) { tot += cell[0]; cnt++; }
        }
        if (!cnt) continue;
        const anyRuta  = Array.from({length: ais.zMax}, (_,i) => LOOKUP[`${xi}_${yi}_${i+1}`]).some(c => c?.[3]);
        const colColor = _getBucket(tot / cnt, anyRuta);
        for (let zi = 1; zi <= ais.zMax; zi++) {
          const cell = LOOKUP[`${xi}_${yi}_${zi}`];
          if (!cell) continue;
          const [pct, cant, prod, enRuta] = cell;
          _instData[colColor].push({
            wx: ais.wx + SW / 2,
            wy: (zi - 1) * SH + SH / 2 + 0.04,
            wz: (yi - 1) * SD,
            pct, cant, prod, xi, yi, zi,
            name: ais.name,
            colPct: tot / cnt
          });
        }
      }
    }

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

    /* ── Estructura de racks ────────────────────────────────── */
    const postMat  = new THREE.MeshLambertMaterial({ color: 0x3a5060 });
    const shelfMat = new THREE.MeshLambertMaterial({ color: 0x4a6070, transparent: true, opacity: 0.35 });

    for (let xi = 1; xi <= 13; xi++) {
      const ais   = AISLES[xi];
      const depth = ais.yMax * SD;
      const h     = ais.zMax * SH + 0.1;
      const step  = ais.yMax > 60 ? 5 : 3;

      const upGeo = new THREE.BoxGeometry(0.07, h, 0.07);
      for (let yi = 0; yi <= ais.yMax; yi += step) {
        const wz = yi * SD;
        [ais.wx + 0.035, ais.wx + SW - 0.035].forEach(px => {
          const post = new THREE.Mesh(upGeo, postMat);
          post.position.set(px, h / 2, wz);
          _scene.add(post);
        });
      }
      const shelfGeo = new THREE.BoxGeometry(SW - 0.07, 0.045, depth);
      for (let zi = 0; zi <= ais.zMax; zi++) {
        const shelf = new THREE.Mesh(shelfGeo, shelfMat);
        shelf.position.set(ais.wx + SW / 2, zi * SH + 0.02, depth / 2 - SD * 0.5);
        _scene.add(shelf);
      }
    }

    /* ── Techo del almacén (estructura) ─────────────────────── */
    const roofH  = 14;
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x1a2530, transparent: true, opacity: 0.6 });
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(totalW + 20, maxDepth + 20), roofMat);
    roof.rotation.x = Math.PI / 2;
    roof.position.set(totalW / 2 - SW / 2, roofH, maxDepth / 2);
    _scene.add(roof);

    /* Columnas del techo */
    const colMat = new THREE.MeshLambertMaterial({ color: 0x2a3545 });
    for (let xi = 0; xi <= 13; xi += 3) {
      for (let zi = 0; zi <= 2; zi++) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, roofH, 6), colMat);
        col.position.set(xi * SLOT - 2, roofH / 2, zi * (maxDepth / 2));
        _scene.add(col);
      }
    }

    /* ── Zona de recepción ──────────────────────────────────── */
    const recepcionMat = new THREE.MeshLambertMaterial({ color: 0x1a3a2a });
    const recepcion = new THREE.Mesh(
      new THREE.BoxGeometry(totalW + 10, 0.06, 8),
      recepcionMat
    );
    recepcion.position.set(totalW / 2 - SW / 2, 0.02, -6);
    _scene.add(recepcion);

    /* Letrero RECEPCIÓN */
    _scene.add(_sprite(THREE, '↓  RECEPCIÓN  ↓', totalW / 2 - SW / 2, 3.5, -8));

    /* ── Etiquetas de pasillo ────────────────────────────────── */
    for (let xi = 1; xi <= 13; xi++) {
      const ais = AISLES[xi];
      _scene.add(_sprite(THREE, ais.name, ais.wx + SW / 2, ais.zMax * SH + 1.8, -2));
      // Señal al inicio del corredor caminable
      _scene.add(_sprite(THREE, ais.name, ais.wx + SW + AISLE_W / 2, 3.2, -1.5));
    }

    /* ── Posición inicial de la cámara ─────────────────────── */
    _tx = totalW / 2 - SW / 2;
    _tz = maxDepth / 2;
    _walkX = AISLES[7].wx + SW + AISLE_W / 2;
    _walkZ = maxDepth * 0.35;
    _walkYaw = 0;
    _updateCam();

    /* ── Eventos ─────────────────────────────────────────────── */
    _bindEventos(canvas, THREE);
    _animate();
  };

  /* ─── Sprite de texto ──────────────────────────────────────── */
  const _sprite = (THREE, text, x, y, z) => {
    const cv  = document.createElement('canvas');
    cv.width  = 320; cv.height = 72;
    const ctx = cv.getContext('2d');
    ctx.font      = 'bold 32px IBM Plex Mono, monospace';
    ctx.fillStyle = '#56d3ba';
    ctx.textAlign = 'center';
    ctx.fillText(text, 160, 50);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true
    }));
    sp.position.set(x, y, z);
    sp.scale.set(10, 2.2, 1);
    return sp;
  };

  /* ─── Actualizar cámara orbit ──────────────────────────────── */
  const _updateCam = () => {
    _cam.position.x = _tx + _radius * Math.sin(_phi) * Math.sin(_theta);
    _cam.position.y = _ty  + _radius * Math.cos(_phi);
    _cam.position.z = _tz  + _radius * Math.sin(_phi) * Math.cos(_theta);
    _cam.lookAt(_tx, _ty, _tz);
  };

  /* ─── Actualizar cámara walk ────────────────────────────────── */
  const _updateCamWalk = () => {
    _cam.position.set(_walkX, _walkY, _walkZ);
    const t = new _THREE_ref.Vector3(
      _walkX + Math.sin(_walkYaw) * Math.cos(_walkPitch),
      _walkY + Math.sin(_walkPitch),
      _walkZ + Math.cos(_walkYaw) * Math.cos(_walkPitch)
    );
    _cam.lookAt(t);
  };

  /* ─── Etiqueta de posición en HUD ──────────────────────────── */
  const _updateFPLabel = () => {
    const label = document.getElementById('fp-pos-label');
    if (!label) return;
    let nearName = '—', minD = Infinity;
    for (let xi = 1; xi <= 13; xi++) {
      const d = Math.abs(_walkX - (AISLES[xi].wx + SW + AISLE_W / 2));
      if (d < minD) { minD = d; nearName = AISLES[xi].name; }
    }
    label.textContent = `Pasillo ${nearName} · Pos. ${Math.max(0, Math.round(_walkZ / SD))}`;
  };

  /* ─── Procesar WASD en walk mode ────────────────────────────── */
  const _processWASD = () => {
    const spd  = _keys['shift'] ? _walkSpeed * 2.5 : _walkSpeed;
    const fwdX = Math.sin(_walkYaw), fwdZ = Math.cos(_walkYaw);
    const rgtX = Math.cos(_walkYaw), rgtZ = -Math.sin(_walkYaw);

    if (_keys['w'] || _keys['arrowup'])    { _walkX += fwdX*spd; _walkZ += fwdZ*spd; }
    if (_keys['s'] || _keys['arrowdown'])  { _walkX -= fwdX*spd; _walkZ -= fwdZ*spd; }
    if (_keys['a'] || _keys['arrowleft'])  { _walkX -= rgtX*spd; _walkZ -= rgtZ*spd; }
    if (_keys['d'] || _keys['arrowright']) { _walkX += rgtX*spd; _walkZ += rgtZ*spd; }
    _updateFPLabel();
  };

  /* ─── Lerp de cámara orbit ──────────────────────────────────── */
  const _startLerp = (to) => {
    _lerpFrom = { tx:_tx, ty:_ty, tz:_tz, theta:_theta, phi:_phi, radius:_radius };
    _lerpTo   = to;
    _lerpT    = 0;
    _lerpActive = true;
    _autoRot  = false;
  };

  const _processLerp = () => {
    _lerpT = Math.min(1, _lerpT + 0.025);
    const ease = t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
    const e = ease(_lerpT);
    _tx     = _lerpFrom.tx     + (_lerpTo.tx     - _lerpFrom.tx)     * e;
    _ty     = _lerpFrom.ty     + (_lerpTo.ty     - _lerpFrom.ty)     * e;
    _tz     = _lerpFrom.tz     + (_lerpTo.tz     - _lerpFrom.tz)     * e;
    _theta  = _lerpFrom.theta  + (_lerpTo.theta  - _lerpFrom.theta)  * e;
    _phi    = _lerpFrom.phi    + (_lerpTo.phi    - _lerpFrom.phi)    * e;
    _radius = _lerpFrom.radius + (_lerpTo.radius - _lerpFrom.radius) * e;
    if (_lerpT >= 1) _lerpActive = false;
  };

  /* ─── Bind de eventos ───────────────────────────────────────── */
  const _bindEventos = (canvas, THREE) => {
    const ray   = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const tip   = document.getElementById('tip-3d');
    let orbitDrag = false, oLastX = 0, oLastY = 0;

    /* ── Mouse down ──────────────────────────────────────────── */
    canvas.addEventListener('mousedown', e => {
      if (_walkMode) {
        _lookDrag = true; _lookLastX = e.clientX; _lookLastY = e.clientY;
        canvas.style.cursor = 'none';
      } else {
        orbitDrag = true; oLastX = e.clientX; oLastY = e.clientY;
      }
    });

    canvas.addEventListener('mouseup',    () => { orbitDrag = false; _lookDrag = false; canvas.style.cursor = ''; });
    canvas.addEventListener('mouseleave', () => { orbitDrag = false; _lookDrag = false; if (tip) tip.style.display = 'none'; });

    /* ── Pointer lock: activa/desactiva mirar libre en walk mode ── */
    canvas.addEventListener('click', () => {
      if (_walkMode && !document.pointerLockElement) canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      const hint = document.getElementById('fp-click-hint');
      if (!hint) return;
      hint.style.display = (_walkMode && !document.pointerLockElement) ? 'block' : 'none';
    });

    /* ── Mouse move ──────────────────────────────────────────── */
    canvas.addEventListener('mousemove', e => {
      const dx = e.clientX - oLastX, dy = e.clientY - oLastY;

      if (_walkMode) {
        if (document.pointerLockElement === canvas) {
          // Pointer lock activo: mirar libre sin mantener botón
          _walkYaw   -= e.movementX * 0.003;
          _walkPitch  = Math.max(-1.2, Math.min(1.2, _walkPitch + e.movementY * 0.003));
        } else if (_lookDrag) {
          // Fallback: arrastrar con botón presionado
          _walkYaw   -= (e.clientX - _lookLastX) * 0.003;
          _walkPitch  = Math.max(-1.2, Math.min(1.2, _walkPitch + (e.clientY - _lookLastY) * 0.003));
          _lookLastX  = e.clientX; _lookLastY = e.clientY;
        }
        return;
      }

      if (!_walkMode && orbitDrag) {
        _theta -= dx * 0.005;
        _phi    = Math.max(0.06, Math.min(1.55, _phi + dy * 0.005));
        oLastX  = e.clientX; oLastY = e.clientY;
        _updateCam(); _autoRot = false;
        return;
      }

      /* Hover raycast */
      const rect = canvas.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      ray.setFromCamera(mouse, _cam);

      let best = null, bestD = Infinity;
      COLOR_BUCKETS.forEach(c => {
        if (!_instMeshes[c]) return;
        const hits = [];
        ray.intersectObject(_instMeshes[c], false, hits);
        if (hits.length && hits[0].distance < bestD) {
          bestD = hits[0].distance; best = { c, iid: hits[0].instanceId };
        }
      });

      if (best && tip) {
        const d = _instData[best.c][best.iid];
        if (d) {
          tip.innerHTML = `
            <strong style="color:var(--cyan)">${d.name}${String(d.yi).padStart(2,'0')} · N${d.zi}</strong>
            <div style="color:var(--muted);font-size:11px;margin:4px 0;max-width:200px">${d.prod}</div>
            <div style="display:flex;justify-content:space-between;gap:16px">
              <span>Ocupación:</span><b style="color:${d.pct>85?'var(--red)':d.pct>50?'var(--amber)':'var(--green)'}">${d.pct.toFixed(0)}%</b>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px">
              <span>Cantidad:</span><b>${d.cant.toLocaleString()} pz</b>
            </div>`;
          tip.style.display = 'block';
          tip.style.left = Math.min(e.clientX + 18, innerWidth - 250) + 'px';
          tip.style.top  = Math.max(e.clientY - 60, 8) + 'px';
        }
      } else if (tip) {
        tip.style.display = 'none';
      }
    });

    /* ── Scroll — zoom orbit / velocidad walk ─────────────────── */
    canvas.addEventListener('wheel', e => {
      if (_walkMode) {
        _walkSpeed = Math.max(0.05, Math.min(1.0, _walkSpeed - e.deltaY * 0.0003));
        _mostrarToastWalk(`Velocidad: ${Math.round(_walkSpeed * 100)}%`);
      } else {
        _radius = Math.max(8, Math.min(600, _radius + e.deltaY * 0.2));
        _updateCam();
      }
      e.preventDefault();
    }, { passive: false });

    /* ── Doble click en modo orbit → navegar al punto ─────────── */
    canvas.addEventListener('dblclick', e => {
      if (_walkMode) return;
      const rect = canvas.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      ray.setFromCamera(mouse, _cam);
      COLOR_BUCKETS.forEach(c => {
        if (!_instMeshes[c]) return;
        const hits = [];
        ray.intersectObject(_instMeshes[c], false, hits);
        if (hits.length) {
          const d = _instData[c][hits[0].instanceId];
          if (d) {
            _startLerp({ tx: d.wx, ty: d.wy, tz: d.wz, theta: _theta, phi: 0.6, radius: 18 });
          }
        }
      });
    });

    /* ── Click en modo walk → teletransportar al frente ─────── */
    canvas.addEventListener('click', e => {
      if (!_walkMode || _lookDrag) return;
      // Raycast al piso
      const rect = canvas.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      ray.setFromCamera(mouse, _cam);
      const floorPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
      const target = new THREE.Vector3();
      ray.ray.intersectPlane(floorPlane, target);
      if (target && isFinite(target.x)) {
        const dist = Math.sqrt((_walkX-target.x)**2 + (_walkZ-target.z)**2);
        if (dist < 80) { _walkX = target.x; _walkZ = target.z; }
      }
    });

    /* ── Teclado WASD ────────────────────────────────────────── */
    const onKey = (e, down) => {
      _keys[e.key.toLowerCase()] = down;
      if (down && e.key === 'Escape' && _walkMode) Mapa3DController.toggleWalk();
    };
    window.addEventListener('keydown', e => onKey(e, true));
    window.addEventListener('keyup',   e => onKey(e, false));

    /* ── Touch ───────────────────────────────────────────────── */
    let lt = null, lt2 = null, ltDist = null;
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        lt = e.touches[0];
        if (_walkMode) { _lookDrag = true; _lookLastX = lt.clientX; _lookLastY = lt.clientY; }
      } else if (e.touches.length === 2) {
        lt2 = e.touches[1];
        ltDist = Math.hypot(e.touches[0].clientX-lt2.clientX, e.touches[0].clientY-lt2.clientY);
      }
    });
    canvas.addEventListener('touchmove', e => {
      if (e.touches.length === 1 && lt) {
        const t = e.touches[0];
        const dx = t.clientX - lt.clientX, dy = t.clientY - lt.clientY;
        if (_walkMode) {
          _walkYaw   -= dx * 0.004;
          _walkPitch  = Math.max(-1.2, Math.min(1.2, _walkPitch + dy * 0.004));
        } else {
          _theta -= dx * 0.005;
          _phi    = Math.max(0.06, Math.min(1.55, _phi + dy * 0.005));
          _updateCam(); _autoRot = false;
        }
        lt = t;
      } else if (e.touches.length === 2 && ltDist !== null) {
        const d2 = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
        _radius = Math.max(8, Math.min(600, _radius - (d2 - ltDist) * 0.5));
        _updateCam(); ltDist = d2;
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', () => { lt = null; lt2 = null; ltDist = null; _lookDrag = false; });
  };

  /* ─── Toast de ayuda en walk mode ──────────────────────────── */
  const _mostrarToastWalk = (msg) => {
    const el = document.getElementById('walk-toast');
    if (!el) return;
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 1500);
  };

  /* ─── Loop de animación ─────────────────────────────────────── */
  const _animate = () => {
    _raf = requestAnimationFrame(_animate);
    if (_walkMode) {
      _processWASD();
      _updateCamWalk();
    } else {
      if (_autoRot) { _theta += 0.0006; }
      if (_lerpActive) _processLerp();
      _updateCam();
    }
    if (_renderer && _scene && _cam) _renderer.render(_scene, _cam);
  };

  /* ─── Aplicar filtros ────────────────────────────────────────── */
  const _applyFilter = () => {
    const THREE = _THREE_ref;
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

  /* ─── API pública ────────────────────────────────────────────── */
  return {

    abrir() {
      const modal = document.getElementById('modal-3d');
      if (modal) modal.classList.add('show');
      if (_iniciado) { this.redimensionar(); return; }

      const _init = () => { _THREE_ref = window.THREE; _construirEscena(); _iniciado = true; };
      if (window.THREE) { _init(); }
      else {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        s.onload = _init;
        document.head.appendChild(s);
      }
    },

    cerrar() {
      document.getElementById('modal-3d')?.classList.remove('show');
      _keys = {};
      if (_walkMode) { _walkMode = false; document.getElementById('fp-hud').style.display = 'none'; }
      if (document.pointerLockElement) document.exitPointerLock();
    },

    /** Alterna entre modo orbit y modo walk (primera persona) */
    toggleWalk() {
      _walkMode = !_walkMode;
      _autoRot  = !_walkMode;

      const btn = document.getElementById('btn-fp-mode');
      if (btn) btn.classList.toggle('active', _walkMode);

      const hud = document.getElementById('fp-hud');
      if (hud) hud.style.display = _walkMode ? 'block' : 'none';

      if (_walkMode) {
        // Partir desde el pasillo/posición que la cámara orbit tiene como objetivo
        let nearAisle = AISLES[7];
        let minDist   = Infinity;
        for (let xi = 1; xi <= 13; xi++) {
          const d = Math.abs(_tx - (AISLES[xi].wx + SW / 2));
          if (d < minDist) { minDist = d; nearAisle = AISLES[xi]; }
        }
        _walkX     = nearAisle.wx + SW + AISLE_W / 2;  // centro del corredor de ese pasillo
        _walkZ     = Math.max(2, _tz);                  // misma profundidad que el lote visto
        _walkYaw   = 0; _walkPitch = 0;
        _walkSpeed = 0.3;
        _updateFPLabel();
        const canvas = document.getElementById('canvas-3d');
        if (canvas) canvas.requestPointerLock();
      } else {
        if (document.pointerLockElement) document.exitPointerLock();
      }
    },

    /** Alias público para el botón HTML */
    entrarPrimeraPersona() { this.toggleWalk(); },
    salirPrimeraPersona()  { if (_walkMode) this.toggleWalk(); },

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

    /**
     * Vuela la cámara orbit hasta el pasillo seleccionado.
     * En walk mode, teletransporta al corredor de ese pasillo.
     */
    setPasillo(xi, btnEl) {
      _fAisle = +xi;
      document.querySelectorAll('.aisle-btn-3d').forEach(b => b.classList.remove('active'));
      btnEl?.classList.add('active');

      if (xi > 0) {
        const ais = AISLES[xi];
        if (_walkMode) {
          // Teletransporta al corredor del pasillo en walk mode
          _walkX   = ais.wx + SW + AISLE_W / 2;
          _walkZ   = ais.yMax * SD * 0.35;
          _walkYaw = 0; _walkPitch = 0;
          _mostrarToastWalk(`Pasillo ${ais.name}`);
        } else {
          _startLerp({
            tx:     ais.wx + SW / 2,
            ty:     ais.zMax * SH * 0.5,
            tz:     ais.yMax * SD / 2,
            theta:  _theta,
            phi:    0.75,
            radius: Math.max(ais.yMax * SD * 0.65, 45)
          });
        }
      } else {
        // "Todos" — vuelve a vista general
        if (!_walkMode) {
          const totalW = SLOT * 13 + SW;
          _startLerp({ tx: totalW/2 - SW/2, ty: 3, tz: AISLES[3].yMax*SD/2, theta: -0.4, phi: 0.9, radius: 220 });
        }
      }
      _applyFilter();
    },

    resetCam() {
      _walkMode = false;
      _autoRot  = true;
      _keys     = {};
      if (document.pointerLockElement) document.exitPointerLock();
      const totalW = SLOT * 13 + SW;
      _theta = -0.4; _phi = 0.9; _radius = 220;
      _tx = totalW/2 - SW/2; _ty = 3; _tz = AISLES[3].yMax*SD/2;
      _updateCam();
      const btn = document.getElementById('btn-fp-mode');
      if (btn) btn.classList.remove('active');
      const hud = document.getElementById('fp-hud');
      if (hud) hud.style.display = 'none';
    },

    setVista(v) {
      if (_walkMode) return;
      if (v === 'top')   { _startLerp({ tx:_tx, ty:_ty, tz:_tz, theta:_theta, phi:0.04,  radius:300 }); }
      if (v === 'front') { _startLerp({ tx:_tx, ty:_ty, tz:_tz, theta:Math.PI, phi:1.45,  radius:240 }); }
      if (v === 'iso')   { _startLerp({ tx:_tx, ty:_ty, tz:_tz, theta:-0.6,   phi:0.72,  radius:200 }); }
    },

    toggleRotacion(btnEl) {
      if (_walkMode) return;
      _autoRot = !_autoRot;
      btnEl?.classList.toggle('active', _autoRot);
    },

    redimensionar() {
      if (!_renderer || !_cam) return;
      const cont = document.getElementById('canvas-3d')?.parentElement;
      if (!cont) return;
      const W = cont.clientWidth, H = cont.clientHeight || 600;
      _cam.aspect = W / H;
      _cam.updateProjectionMatrix();
      _renderer.setSize(W, H);
    },

    /**
     * Abre el modal 3D y vuela la cámara hasta la celda indicada.
     * @param {string} celda — ej. "AP29", "CP144"
     */
    irACelda3D(celda) {
      const pasillo  = celda.replace(/\d.*$/, '');
      const posicion = parseInt(celda.replace(/^[A-Z]+/, ''), 10);
      const pidx = { AP:1,BP:2,CP:3,DP:4,EP:5,FP:6,GP:7,HP:8,IP:9,JP:10,KP:11,LP:12,MP:13 };
      const xi = pidx[pasillo];
      if (!xi || !posicion) return;

      const ais = AISLES[xi];
      const wx  = ais.wx + SW / 2;
      const wz  = Math.max(0, (posicion - 1) * SD);
      const wy  = SH;

      const fly = () => {
        if (_walkMode) this.toggleWalk();
        _startLerp({ tx: wx, ty: wy, tz: wz, theta: -0.5, phi: 0.58, radius: 22 });
        _highlightCell(wx, wy, wz, ais.zMax);
        _mostrarToastWalk(`📦 ${celda} — ${ais.name} pos. ${posicion}`);
      };

      this.abrir();

      if (_iniciado) {
        setTimeout(fly, 120);
      } else {
        const t = setInterval(() => { if (_iniciado) { clearInterval(t); fly(); } }, 80);
      }
    },

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
