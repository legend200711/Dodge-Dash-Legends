'use strict';
// ═══════════════════════════════════════════════════════════
//  DODGE DASH LEGENDS — script.js
//  Full game logic. Requires Three.js r128 loaded before this.
// ═══════════════════════════════════════════════════════════

// ── Renderer & Scene ────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87CEEB, 80, 400);
const clock = new THREE.Clock();
let deltaTime = 0;

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ── Camera ──────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(0, 5, 12);

// ── Lighting ────────────────────────────────────────────────
function buildLighting(skyColor = 0x87CEEB, groundColor = 0x4a7c59) {
  scene.children.filter(c => c.isLight).forEach(l => scene.remove(l));
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffeedd, 1.4);
  sun.position.set(60, 100, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 500;
  sun.shadow.camera.left = -150;
  sun.shadow.camera.right = 150;
  sun.shadow.camera.top = 150;
  sun.shadow.camera.bottom = -150;
  sun.shadow.bias = -0.001;
  scene.add(sun);
  scene.userData.sun = sun;
  const hemi = new THREE.HemisphereLight(skyColor, groundColor, 0.6);
  scene.add(hemi);
}
buildLighting();

// ═══════════════════════════════════════════════════════════
//  TRACK DEFINITIONS
// ═══════════════════════════════════════════════════════════
const TRACK_DEFS = [
  { id:'city',     name:'City Speedway',   emoji:'🏙️', unlockLevel:1,  laps:4, timeLimit:180, sky:0x87CEEB, fogColor:0x87CEEB, fogNear:80,  fogFar:400, groundColor:0x555566, bgColor:0x1a1a2e, weather:'clear', desc:'Urban circuits through downtown streets' },
  { id:'desert',   name:'Desert Highway',  emoji:'🏜️', unlockLevel:1,  laps:4, timeLimit:180, sky:0xFFD59E, fogColor:0xFFD59E, fogNear:120, fogFar:500, groundColor:0xc2a87a, bgColor:0x2a1a00, weather:'clear', desc:'Blazing fast through the Mojave' },
  { id:'mountain', name:'Mountain Pass',   emoji:'⛰️', unlockLevel:1,  laps:3, timeLimit:200, sky:0xa8d8ea, fogColor:0xd0e8f0, fogNear:60,  fogFar:300, groundColor:0x6b8f71, bgColor:0x0a1520, weather:'fog',   desc:'Technical turns on icy cliffs' },
  { id:'snow',     name:'Snow Circuit',    emoji:'❄️', unlockLevel:1,  laps:3, timeLimit:200, sky:0xddeeff, fogColor:0xeeeeff, fogNear:50,  fogFar:280, groundColor:0xddddff, bgColor:0x0a0a20, weather:'snow',  desc:'Slippery ice with snowfall' },
  { id:'forest',   name:'Forest Raceway',  emoji:'🌲', unlockLevel:3,  laps:4, timeLimit:190, sky:0x3d7a3d, fogColor:0x2a5a2a, fogNear:50,  fogFar:250, groundColor:0x2d5a2d, bgColor:0x0a1a00, weather:'clear', desc:'Dense canopy through ancient woods' },
  { id:'neon',     name:'Night Neon City', emoji:'🌃', unlockLevel:5,  laps:4, timeLimit:175, sky:0x080820, fogColor:0x100820, fogNear:40,  fogFar:220, groundColor:0x202030, bgColor:0x05051a, weather:'night', desc:'Glow-wire racing through neon lights' },
  { id:'volcano',  name:'Volcano Ring',    emoji:'🌋', unlockLevel:8,  laps:3, timeLimit:165, sky:0x2a1000, fogColor:0x3a1500, fogNear:40,  fogFar:200, groundColor:0x3a1500, bgColor:0x1a0500, weather:'lava',  desc:'Dodge lava on the crater rim' },
  { id:'coastal',  name:'Coastal Highway', emoji:'🌊', unlockLevel:10, laps:4, timeLimit:185, sky:0x007ACC, fogColor:0x005580, fogNear:70,  fogFar:350, groundColor:0x5a8f6b, bgColor:0x001520, weather:'clear', desc:'Ocean-side sprint at sunset' },
];

function generateTrackWaypoints(trackId) {
  const configs = {
    city:     { rx:90,  ry:60, variant:'square'  },
    desert:   { rx:120, ry:50, variant:'oval'    },
    mountain: { rx:80,  ry:70, variant:'winding' },
    snow:     { rx:85,  ry:65, variant:'oval'    },
    forest:   { rx:75,  ry:80, variant:'winding' },
    neon:     { rx:95,  ry:55, variant:'square'  },
    volcano:  { rx:70,  ry:70, variant:'ring'    },
    coastal:  { rx:110, ry:55, variant:'oval'    },
  };
  const cfg = configs[trackId] || configs.city;
  const N = 20;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    let x, z;
    if (cfg.variant === 'square') {
      x = cfg.rx * Math.cos(t) + (cfg.rx * 0.15) * Math.cos(3 * t);
      z = cfg.ry * Math.sin(t) + (cfg.ry * 0.1) * Math.sin(2 * t);
    } else if (cfg.variant === 'ring') {
      x = cfg.rx * Math.cos(t);
      z = cfg.rx * Math.sin(t);
    } else if (cfg.variant === 'winding') {
      x = cfg.rx * Math.cos(t) + 20 * Math.sin(3 * t);
      z = cfg.ry * Math.sin(t) + 12 * Math.cos(2 * t);
    } else {
      x = cfg.rx * Math.cos(t);
      z = cfg.ry * Math.sin(t);
    }
    pts.push(new THREE.Vector3(x, 0, z));
  }
  return pts;
}

// ═══════════════════════════════════════════════════════════
//  VEHICLE DEFINITIONS
// ═══════════════════════════════════════════════════════════
const CAR_DEFS = [
  { id:'speeder', name:'Speeder',  emoji:'🏎️', unlockLevel:1,  color:0xff2244, accel:28, maxSpeed:44, handling:0.9,  braking:0.88, desc:'Balanced starter car' },
  { id:'bruiser', name:'Bruiser',  emoji:'🚙', unlockLevel:3,  color:0x2244ff, accel:22, maxSpeed:40, handling:0.7,  braking:0.95, desc:'Heavy, slow but tough' },
  { id:'phantom', name:'Phantom',  emoji:'🚗', unlockLevel:5,  color:0x222244, accel:32, maxSpeed:50, handling:1.0,  braking:0.80, desc:'Lightweight speed demon' },
  { id:'titan',   name:'Titan',    emoji:'🛻', unlockLevel:8,  color:0xff8800, accel:20, maxSpeed:38, handling:0.65, braking:0.98, desc:'Monster truck powerhouse' },
  { id:'viper',   name:'Viper',    emoji:'🏍️', unlockLevel:12, color:0x00ff88, accel:36, maxSpeed:56, handling:1.1,  braking:0.75, desc:'Insane top speed' },
  { id:'legend',  name:'Legend X', emoji:'⚡', unlockLevel:18, color:0xFFD700, accel:34, maxSpeed:52, handling:1.05, braking:0.85, desc:'The ultimate ride' },
];

function buildCarMesh(carDef, isPlayer = false) {
  const g = new THREE.Group();
  const col = carDef.color;

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 4.0), new THREE.MeshLambertMaterial({ color: col }));
  body.position.y = 0.38; body.castShadow = true; g.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.48, 2.0), new THREE.MeshLambertMaterial({ color: 0x111122 }));
  cabin.position.set(0, 0.81, -0.2); cabin.castShadow = true; g.add(cabin);

  const wind = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.38, 0.08), new THREE.MeshLambertMaterial({ color: 0x88ccff, transparent: true, opacity: 0.6 }));
  wind.position.set(0, 0.88, 0.78); g.add(wind);

  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 8);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const rimMat   = new THREE.MeshLambertMaterial({ color: 0xcccccc });
  const rimGeo   = new THREE.CylinderGeometry(0.16, 0.16, 0.24, 6);
  const wheelPos = [[-1.02,0.28,1.4],[1.02,0.28,1.4],[-1.02,0.28,-1.4],[1.02,0.28,-1.4]];
  g.userData.wheels = [];
  wheelPos.forEach(([wx,wy,wz]) => {
    const wg = new THREE.Group();
    const wm = new THREE.Mesh(wheelGeo, wheelMat); wm.rotation.z = Math.PI/2; wm.castShadow = true;
    const rm = new THREE.Mesh(rimGeo, rimMat); rm.rotation.z = Math.PI/2;
    wg.add(wm); wg.add(rm); wg.position.set(wx,wy,wz); g.add(wg);
    g.userData.wheels.push(wg);
  });

  if (isPlayer) {
    [[-0.55,0.4,2.01],[0.55,0.4,2.01]].forEach(([lx,ly,lz]) => {
      const lm = new THREE.Mesh(new THREE.BoxGeometry(0.25,0.14,0.06), new THREE.MeshLambertMaterial({color:0xffffcc,emissive:0xffffaa,emissiveIntensity:0.8}));
      lm.position.set(lx,ly,lz); g.add(lm);
    });
    const hLight = new THREE.PointLight(0xffffcc, 1.2, 20);
    hLight.position.set(0, 0.4, 2.5); g.add(hLight); g.userData.headlight = hLight;
  }

  g.userData.brakeLights = [];
  [[-0.55,0.38,-2.01],[0.55,0.38,-2.01]].forEach(([lx,ly,lz]) => {
    const lm = new THREE.Mesh(new THREE.BoxGeometry(0.28,0.12,0.06), new THREE.MeshLambertMaterial({color:0x330000,emissive:0x220000}));
    lm.position.set(lx,ly,lz); g.add(lm); g.userData.brakeLights.push(lm);
  });

  g.receiveShadow = true;
  return g;
}

// ═══════════════════════════════════════════════════════════
//  TRACK BUILDER
// ═══════════════════════════════════════════════════════════
let trackGroup = null;
let trackSpline = null;
let trackWaypoints = [];
const trackWidth = 14;

function buildTrack(trackDef) {
  if (trackGroup) scene.remove(trackGroup);
  trackGroup = new THREE.Group();
  scene.add(trackGroup);

  const pts = generateTrackWaypoints(trackDef.id);
  trackWaypoints = pts;
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
  trackSpline = curve;
  const N = 120;
  const tubeRadius = trackWidth / 2;

  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    const p0 = curve.getPointAt(t0), p1 = curve.getPointAt(t1);
    const tan = curve.getTangentAt(t0);
    const right = new THREE.Vector3(-tan.z, 0, tan.x).normalize().multiplyScalar(tubeRadius);
    const v0 = p0.clone().add(right), v1 = p0.clone().sub(right);
    const v2 = p1.clone().sub(right), v3 = p1.clone().add(right);
    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      v0.x,0.01,v0.z, v1.x,0.01,v1.z, v2.x,0.01,v2.z,
      v0.x,0.01,v0.z, v2.x,0.01,v2.z, v3.x,0.01,v3.z,
    ]), 3));
    roadGeo.computeVertexNormals();
    const isStripe = Math.floor(i / 3) % 2 === 0;
    const roadMat = new THREE.MeshLambertMaterial({ color: isStripe ? trackDef.groundColor : (trackDef.groundColor & 0xfefefe) + 0x080808 });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    trackGroup.add(roadMesh);

    const isTireWall = (i % 6 === 0), isArrow = (i % 18 === 0);
    const wallH = 1.4, wallD = 3.8;
    const wallGeo = new THREE.BoxGeometry(0.32, wallH, wallD);
    const stripeAlt = Math.floor(i / 3) % 2 === 0;
    const concreteMat = new THREE.MeshLambertMaterial({ color: stripeAlt ? 0xeeeeee : 0xcc2222 });
    const wL = new THREE.Mesh(wallGeo, concreteMat);
    const wR = new THREE.Mesh(wallGeo, concreteMat);
    wL.position.copy(v1).add(new THREE.Vector3(0, wallH * 0.5, 0));
    wR.position.copy(v0).add(new THREE.Vector3(0, wallH * 0.5, 0));
    wL.lookAt(wL.position.clone().add(tan)); wR.lookAt(wR.position.clone().add(tan));
    wL.castShadow = wR.castShadow = true;
    trackGroup.add(wL); trackGroup.add(wR);

    if (isTireWall) {
      const tireGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.22, 8);
      const tireMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
      [[wL, v1],[wR, v0]].forEach(([wall]) => {
        const ts = new THREE.Group();
        for (let ti = 0; ti < 3; ti++) {
          const t2 = new THREE.Mesh(tireGeo, tireMat);
          t2.rotation.z = Math.PI / 2;
          t2.position.set(0, wallH + 0.12 + ti * 0.24, (ti - 1) * 0.26);
          ts.add(t2);
        }
        ts.position.copy(wall.position); ts.rotation.copy(wall.rotation); ts.castShadow = true;
        trackGroup.add(ts);
      });
    }
    if (isArrow) {
      const arrowGeo = new THREE.BoxGeometry(0.08, 0.7, 0.5);
      const arrowMat = new THREE.MeshLambertMaterial({ color: 0xFFD700, emissive: 0xaa8800, emissiveIntensity: 0.6 });
      [[wL],[wR]].forEach(([wall]) => {
        const arrow = new THREE.Mesh(arrowGeo, arrowMat);
        arrow.position.copy(wall.position).add(new THREE.Vector3(0, wallH * 0.3, 0));
        arrow.rotation.copy(wall.rotation); trackGroup.add(arrow);
      });
    }
  }

  const groundColors = { snow:0xddeeff, volcano:0x2a1000, neon:0x080820, desert:0xc8a060, forest:0x1a4a1a };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 4, 4), new THREE.MeshLambertMaterial({ color: groundColors[trackDef.id] || 0x4a7c4a }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.position.y = -0.05;
  trackGroup.add(ground);

  renderer.setClearColor(new THREE.Color(trackDef.bgColor));
  scene.fog = new THREE.Fog(trackDef.fogColor, trackDef.fogNear, trackDef.fogFar);
  addTrackProps(trackDef, curve, N);
  buildLighting(trackDef.sky, new THREE.Color(trackDef.groundColor).getHex());
  rebuildSplineSamples();

  const startPt = curve.getPointAt(0), startTan = curve.getTangentAt(0);
  const line = new THREE.Mesh(new THREE.BoxGeometry(trackWidth * 1.1, 0.05, 0.6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  line.position.copy(startPt); line.position.y = 0.03;
  line.rotation.y = Math.atan2(startTan.x, startTan.z);
  trackGroup.add(line);
}

function addTrackProps(trackDef, curve, N) {
  const mat_tree  = new THREE.MeshLambertMaterial({ color: 0x1a6e1a });
  const mat_trunk = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  const mat_cactus= new THREE.MeshLambertMaterial({ color: 0x4a8a3a });

  for (let i = 0; i < N; i += 5) {
    const t = i / N;
    const pt  = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const right = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const side = Math.random() > 0.5 ? 1 : -1;
    const offset = (trackWidth / 2 + 3 + Math.random() * 8) * side;
    const pos = pt.clone().add(right.clone().multiplyScalar(offset));

    if (['forest','mountain','coastal'].includes(trackDef.id)) {
      const h = 4 + Math.random() * 4;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.3,h*0.4,5), mat_trunk);
      trunk.position.set(pos.x, h*0.2, pos.z);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.2+Math.random(),h*0.7,5), mat_tree);
      crown.position.set(pos.x, h*0.4+h*0.35, pos.z);
      trunk.castShadow = crown.castShadow = true;
      trackGroup.add(trunk); trackGroup.add(crown);
    } else if (['city','neon'].includes(trackDef.id)) {
      const bh = 6 + Math.random() * 18, bw = 3 + Math.random() * 4;
      const bColors = trackDef.id==='neon' ? [0x330066,0x003366,0x660033,0x006633] : [0x778899];
      const bEm     = trackDef.id==='neon' ? [0x220044,0x002244,0x440022,0x004422] : [0x000000];
      const ri = Math.floor(Math.random()*bColors.length);
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bw), new THREE.MeshLambertMaterial({ color:bColors[ri], emissive:bEm[ri], emissiveIntensity:trackDef.id==='neon'?0.3:0 }));
      b.position.set(pos.x, bh/2, pos.z); b.castShadow = true; trackGroup.add(b);
    } else if (trackDef.id === 'desert') {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.2,2.5,5), mat_cactus);
      c.position.set(pos.x, 1.25, pos.z); c.castShadow = true; trackGroup.add(c);
    } else if (trackDef.id === 'snow') {
      const sm = new THREE.Mesh(new THREE.SphereGeometry(0.8+Math.random(),5,4), new THREE.MeshLambertMaterial({color:0xeeeeff}));
      sm.position.set(pos.x, 0.4, pos.z); sm.scale.y = 0.4; trackGroup.add(sm);
    } else if (trackDef.id === 'volcano') {
      const rm = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8+Math.random(),0), new THREE.MeshLambertMaterial({color:0x3a1a00,emissive:0x550800,emissiveIntensity:0.4}));
      rm.position.set(pos.x, 0.4, pos.z); rm.castShadow = true; trackGroup.add(rm);
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════════════════
const GameState = {
  mode: 'menu',
  raceMode: 'quick',
  currentTrack: null,
  currentCar: null,
  player: {
    mesh: null, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
    speed: 0, heading: 0, angularVel: 0, onGround: true,
    health: 100, invincible: 0, frozen: 0, boosting: 0, shielded: 0, magnetized: 0,
    braking: false, drifting: false,
    lapWaypointIdx: 0, lapCount: 0, lapStartTime: 0, lapTimes: [], totalTime: 0, finishedRace: false,
  },
  opponents: [], coins: [], powerups: [], obstacles: [], particles: [], weather: [],
  heldPowerup: null,
  camMode: 0,
  camModeNames: ['CHASE','HOOD','COCKPIT','TOP-DOWN','CINEMATIC'],
  camSmooth: new THREE.Vector3(), camLookAt: new THREE.Vector3(), cinemaAngle: 0,
  raceTimer: 0, timeLimitSeconds: 180, countdownVal: 3, lastHudUpdate: 0,
};

// ═══════════════════════════════════════════════════════════
//  SAVE / PROGRESSION
// ═══════════════════════════════════════════════════════════
const Save = {
  data: {
    coins: 0, xp: 0, level: 1,
    selectedCar: 'speeder', selectedTrack: 'city',
    unlockedCars: ['speeder'], unlockedTracks: ['city','desert'],
    bestTimes: {}, totalRaces: 0, totalWins: 0,
  },
  load() {
    try { const raw = localStorage.getItem('ddl_save'); if (raw) Object.assign(this.data, JSON.parse(raw)); } catch(_) {}
    if (!Array.isArray(this.data.unlockedTracks)) this.data.unlockedTracks = [];
    if (!Array.isArray(this.data.unlockedCars))   this.data.unlockedCars   = [];
    ['city','desert'].forEach(id => { if (!this.data.unlockedTracks.includes(id)) this.data.unlockedTracks.push(id); });
    if (!this.data.unlockedCars.includes('speeder')) this.data.unlockedCars.push('speeder');
    TRACK_DEFS.forEach(t => { if (t.unlockLevel <= this.data.level && !this.data.unlockedTracks.includes(t.id)) this.data.unlockedTracks.push(t.id); });
    CAR_DEFS.forEach(c =>   { if (c.unlockLevel <= this.data.level && !this.data.unlockedCars.includes(c.id))   this.data.unlockedCars.push(c.id); });
  },
  save() { try { localStorage.setItem('ddl_save', JSON.stringify(this.data)); } catch(_) {} },
  xpForLevel(lv) { return lv * lv * 120; },
  addXP(amount) {
    this.data.xp += amount;
    const needed = this.xpForLevel(this.data.level);
    if (this.data.xp >= needed) {
      this.data.xp -= needed; this.data.level++;
      showToast(`🎉 LEVEL UP! Now Level ${this.data.level}`, 3000);
      TRACK_DEFS.forEach(t => { if (t.unlockLevel <= this.data.level && !this.data.unlockedTracks.includes(t.id)) this.data.unlockedTracks.push(t.id); });
      CAR_DEFS.forEach(c =>   { if (c.unlockLevel <= this.data.level && !this.data.unlockedCars.includes(c.id))   this.data.unlockedCars.push(c.id); });
    }
    this.save(); updateHudXP();
  },
  addCoins(amount) { this.data.coins += amount; this.save(); },
};
Save.load();

// ═══════════════════════════════════════════════════════════
//  AUDIO — Web Audio API
// ═══════════════════════════════════════════════════════════
const Audio = {
  ctx: null, engineNode: null, engineGain: null,
  init() { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(_) { this.ctx = null; } },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  playTone(freq, type='sine', duration=0.15, vol=0.18, startTime=0) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime + startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + startTime + duration);
    osc.start(this.ctx.currentTime + startTime);
    osc.stop(this.ctx.currentTime + startTime + duration + 0.01);
  },
  sfxCoin()     { this.playTone(880,'sine',0.1,0.15); this.playTone(1100,'sine',0.1,0.1,0.08); },
  sfxBoost()    { this.playTone(200,'sawtooth',0.3,0.22); this.playTone(320,'sawtooth',0.25,0.18,0.1); },
  sfxHit()      { this.playTone(80,'sawtooth',0.18,0.25); this.playTone(60,'sawtooth',0.15,0.2,0.08); },
  sfxPickup()   { [440,550,660,880].forEach((f,i) => this.playTone(f,'sine',0.12,0.12,i*0.06)); },
  sfxCountdown(){ this.playTone(440,'sine',0.2,0.3); },
  sfxCountdownGo(){ this.playTone(660,'square',0.35,0.35); this.playTone(880,'square',0.25,0.25,0.15); },
  sfxLap()      { [440,550,660,550,660,880].forEach((f,i) => this.playTone(f,'sine',0.12,0.14,i*0.07)); },
  sfxFinish()   { [440,550,660,880,1100,1320].forEach((f,i) => this.playTone(f,'sine',0.2,0.18,i*0.09)); },
  sfxShield()   { this.playTone(600,'sine',0.2,0.2); this.playTone(800,'sine',0.15,0.15,0.1); },
  sfxFreeze()   { this.playTone(300,'sine',0.3,0.2); this.playTone(200,'sine',0.25,0.15,0.1); },
  startEngine() {
    if (!this.ctx) return;
    if (this.engineNode) this.stopEngine();
    this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0.04; this.engineGain.connect(this.ctx.destination);
    this.engineNode = this.ctx.createOscillator(); this.engineNode.type = 'sawtooth'; this.engineNode.frequency.value = 80;
    this.engineNode.connect(this.engineGain); this.engineNode.start();
  },
  updateEngine(speed, maxSpeed) {
    if (!this.engineNode) return;
    const ratio = Math.min(speed / maxSpeed, 1);
    this.engineNode.frequency.setTargetAtTime(55 + ratio * 180, this.ctx.currentTime, 0.05);
    this.engineGain.gain.setTargetAtTime(0.02 + ratio * 0.055, this.ctx.currentTime, 0.05);
  },
  stopEngine() {
    if (this.engineNode) { try { this.engineNode.stop(); } catch(_) {} this.engineNode = null; }
    if (this.engineGain) { this.engineGain.disconnect(); this.engineGain = null; }
  },
};
Audio.init();
document.addEventListener('pointerdown', () => Audio.resume(), { once: true });
document.addEventListener('keydown',     () => Audio.resume(), { once: true });

// ═══════════════════════════════════════════════════════════
//  INPUT — Keyboard + Mobile
// ═══════════════════════════════════════════════════════════
const Keys = { up:false, down:false, left:false, right:false, space:false };

document.addEventListener('keydown', e => {
  switch(e.code) {
    case 'ArrowUp':    Keys.up    = true; e.preventDefault(); break;
    case 'ArrowDown':  Keys.down  = true; e.preventDefault(); break;
    case 'ArrowLeft':  Keys.left  = true; e.preventDefault(); break;
    case 'ArrowRight': Keys.right = true; e.preventDefault(); break;
    case 'Space':
      Keys.space = true; e.preventDefault();
      if (GameState.mode === 'racing') activateNitro(); break;
    case 'KeyP': case 'Escape':
      if (GameState.mode === 'racing') pauseRace();
      else if (GameState.mode === 'paused') resumeRace(); break;
    case 'KeyC':
      if (GameState.mode === 'racing') cycleCameraMode(); break;
    case 'KeyE':
      if (GameState.mode === 'racing') usePowerup(); break;
  }
});

document.addEventListener('keyup', e => {
  switch(e.code) {
    case 'ArrowUp':    Keys.up    = false; break;
    case 'ArrowDown':  Keys.down  = false; break;
    case 'ArrowLeft':  Keys.left  = false; break;
    case 'ArrowRight': Keys.right = false; break;
    case 'Space':      Keys.space = false; break;
  }
});

const MobileInput = { gas: false, brake: false, left: false, right: false };

(function setupMobileButtons() {
  function holdBtn(id, prop) {
    const btn = document.getElementById(id); if (!btn) return;
    function on(e)  { e.preventDefault(); MobileInput[prop] = true; }
    function off(e) { e.preventDefault(); MobileInput[prop] = false; }
    btn.addEventListener('touchstart',  on,  { passive: false });
    btn.addEventListener('touchend',    off, { passive: false });
    btn.addEventListener('touchcancel', off, { passive: false });
    btn.addEventListener('mousedown', on); btn.addEventListener('mouseup', off); btn.addEventListener('mouseleave', off);
  }
  holdBtn('btn-gas', 'gas'); holdBtn('btn-brake', 'brake'); holdBtn('btn-left', 'left'); holdBtn('btn-right', 'right');
  const btnBoost = document.getElementById('btn-boost');
  if (btnBoost) { btnBoost.addEventListener('touchstart', e => { e.preventDefault(); activateNitro(); }, { passive: false }); btnBoost.addEventListener('mousedown', () => activateNitro()); }
  const btnCam = document.getElementById('btn-cam');
  if (btnCam)   { btnCam.addEventListener('touchstart', e => { e.preventDefault(); cycleCameraMode(); }, { passive: false }); btnCam.addEventListener('mousedown', () => cycleCameraMode()); }
  const btnPowerup = document.getElementById('btn-powerup');
  if (btnPowerup) { btnPowerup.addEventListener('touchstart', e => { e.preventDefault(); usePowerup(); }, { passive: false }); btnPowerup.addEventListener('mousedown', () => usePowerup()); }
})();

function isMobile() { return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768; }

// ═══════════════════════════════════════════════════════════
//  TRACK BOUNDARY SYSTEM
// ═══════════════════════════════════════════════════════════
let _splineSamples = [];
const SPLINE_SAMPLES = 200;

function rebuildSplineSamples() {
  _splineSamples = [];
  if (!trackSpline) return;
  for (let i = 0; i < SPLINE_SAMPLES; i++) {
    const t = i / SPLINE_SAMPLES;
    const pt  = trackSpline.getPointAt(t);
    const tan = trackSpline.getTangentAt(t);
    const right = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    _splineSamples.push({ pt, tan, right });
  }
}

function getNearestTrackPoint(worldPos) {
  if (!_splineSamples.length) return null;
  let bestDist = Infinity, bestIdx = 0;
  for (let i = 0; i < _splineSamples.length; i++) {
    const dx = worldPos.x - _splineSamples[i].pt.x, dz = worldPos.z - _splineSamples[i].pt.z;
    const d = dx*dx + dz*dz;
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  const s = _splineSamples[bestIdx];
  const dx = worldPos.x - s.pt.x, dz = worldPos.z - s.pt.z;
  return { centre: s.pt, right: s.right, tan: s.tan, lateralOffset: dx*s.right.x + dz*s.right.z, sampleIdx: bestIdx };
}

let _barrierFlash = 0;

function enforceTrackBoundary(p) {
  if (!_splineSamples.length) return;
  const halfWidth = (trackWidth / 2) - 0.9;
  const info = getNearestTrackPoint(p.pos);
  if (!info) return;
  const overshoot = Math.abs(info.lateralOffset) - halfWidth;
  if (overshoot <= 0) return;
  const sign = info.lateralOffset > 0 ? 1 : -1;
  p.pos.add(info.right.clone().multiplyScalar(sign * (halfWidth - Math.abs(info.lateralOffset))));
  p.mesh.position.copy(p.pos); p.mesh.position.y = 0;
  const tangential = p.speed * (Math.sin(p.heading)*info.tan.x + Math.cos(p.heading)*info.tan.z);
  p.speed = tangential * 0.72;
  let dA = Math.atan2(info.tan.x, info.tan.z) - p.heading;
  while (dA >  Math.PI) dA -= Math.PI*2;
  while (dA < -Math.PI) dA += Math.PI*2;
  p.heading += dA * 0.45;
  if (_barrierFlash <= 0) { _barrierFlash = 0.35; spawnHitParticles(p.pos, 0xddddcc); p.heading += (Math.random()-0.5)*0.06; }
}

function tickBarrierFlash(dt) {
  if (_barrierFlash > 0) {
    _barrierFlash -= dt;
    if (GameState.player.mesh) {
      const flashOn = Math.floor(_barrierFlash / 0.07) % 2 === 0;
      GameState.player.mesh.traverse(child => {
        if (child.isMesh && child.material && child.material.emissive) {
          child.material.emissiveIntensity = flashOn ? 0.55 : 0;
          if (flashOn) child.material.emissive.setHex(0xffffff);
        }
      });
    }
  } else if (GameState.player.mesh) {
    GameState.player.mesh.traverse(child => {
      if (child.isMesh && child.material && child.material.emissive) child.material.emissiveIntensity = 0;
    });
  }
}

// ═══════════════════════════════════════════════════════════
//  PLAYER PHYSICS
// ═══════════════════════════════════════════════════════════
function updatePlayerPhysics(dt, carDef) {
  const p = GameState.player;
  if (!p.mesh) return;
  const frozen = p.frozen > 0, boosting = p.boosting > 0;
  const speedMult = boosting ? 1.5 : (frozen ? 0.3 : 1.0);
  const accel = carDef.accel * speedMult, maxSpeed = carDef.maxSpeed * speedMult;
  const handling = carDef.handling * (frozen ? 0.4 : 1.0);

  const gasIn   = Keys.up    || MobileInput.gas;
  const brakeIn = Keys.down  || MobileInput.brake;
  const leftIn  = Keys.left  || MobileInput.left;
  const rightIn = Keys.right || MobileInput.right;

  if (gasIn)        p.speed = Math.min(p.speed + accel * dt, maxSpeed);
  else if (brakeIn) { p.speed = Math.max(p.speed - carDef.accel * carDef.braking * 2 * dt, -maxSpeed * 0.4); p.braking = true; }
  else              { p.speed *= (1 - 0.9 * dt); p.braking = false; }
  if (!brakeIn) p.braking = false;

  const speedRatio = Math.min(Math.abs(p.speed) / Math.max(maxSpeed * 0.15, 1), 1);
  let steer = 0;
  if (leftIn)  steer = -handling * speedRatio * 1.8;
  if (rightIn) steer =  handling * speedRatio * 1.8;
  if (p.speed < 0) steer *= -1;
  p.heading += steer * dt; p.angularVel = steer;

  const dir = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
  p.pos.addScaledVector(dir, p.speed * dt);
  p.mesh.position.copy(p.pos); p.mesh.rotation.y = p.heading;

  if (p.mesh.userData.wheels) {
    const rollAmt = p.speed * dt * 0.9;
    p.mesh.userData.wheels.forEach((w, i) => { w.rotation.x -= rollAmt; if (i < 2) w.rotation.y = steer * 0.4; });
  }
  if (p.mesh.userData.brakeLights) {
    p.mesh.userData.brakeLights.forEach(l => { l.material.emissive.setHex(p.braking ? 0x880000 : 0x220000); l.material.emissiveIntensity = p.braking ? 0.9 : 0; });
  }

  if (p.frozen > 0)     p.frozen     -= dt;
  if (p.boosting > 0)   p.boosting   -= dt;
  if (p.shielded > 0)   p.shielded   -= dt;
  if (p.magnetized > 0) p.magnetized -= dt;
  if (p.invincible > 0) p.invincible -= dt;

  p.pos.y = 0; p.mesh.position.y = 0;
  enforceTrackBoundary(p);
  tickBarrierFlash(dt);
  p.mesh.rotation.z = -steer * 0.12;
  p.mesh.rotation.x =  (p.speed / maxSpeed) * 0.04;
  Audio.updateEngine(Math.abs(p.speed), maxSpeed);
}

// ═══════════════════════════════════════════════════════════
//  OPPONENTS — AI cars
// ═══════════════════════════════════════════════════════════
const AI_COLORS = [0x4488ff, 0xff8800, 0x44ff88, 0xff44aa];
const AI_NAMES  = ['RIVAL-X','TURBO-J','BLAZE-K','NIGHT-R'];

function spawnOpponents(trackDef, carDef) {
  GameState.opponents.forEach(o => { if (o.mesh) scene.remove(o.mesh); });
  GameState.opponents = [];
  const startPt = trackSpline ? trackSpline.getPointAt(0) : new THREE.Vector3();
  const startTan = trackSpline ? trackSpline.getTangentAt(0) : new THREE.Vector3(0,0,1);
  const startAngle = Math.atan2(startTan.x, startTan.z);
  for (let i = 0; i < 4; i++) {
    const aiDef = { ...carDef, color: AI_COLORS[i], maxSpeed: carDef.maxSpeed*(0.82+Math.random()*0.14), accel: carDef.accel*(0.8+Math.random()*0.15) };
    const mesh = buildCarMesh(aiDef, false); scene.add(mesh);
    const right = new THREE.Vector3(-startTan.z, 0, startTan.x);
    const spawnPos = startPt.clone().addScaledVector(startTan, -4 - i*5).addScaledVector(right, (i-1.5)*3.2);
    mesh.position.copy(spawnPos); mesh.rotation.y = startAngle;
    GameState.opponents.push({ mesh, pos: spawnPos.clone(), speed: 0, heading: startAngle, waypointT: 0.001*(i+1), lapCount: 0, maxSpeed: aiDef.maxSpeed, accel: aiDef.accel, name: AI_NAMES[i] });
  }
}

function updateOpponents(dt, laps) {
  if (!trackSpline) return;
  GameState.opponents.forEach(opp => {
    opp.waypointT += (opp.speed / (trackSpline.getLength() || 100)) * dt;
    if (opp.waypointT >= 1) { opp.waypointT -= 1; opp.lapCount++; }
    const target = trackSpline.getPointAt(Math.min(opp.waypointT, 0.9999));
    const dx = target.x - opp.pos.x, dz = target.z - opp.pos.z;
    let dAngle = Math.atan2(dx, dz) - opp.heading;
    while (dAngle >  Math.PI) dAngle -= Math.PI*2;
    while (dAngle < -Math.PI) dAngle += Math.PI*2;
    opp.heading += Math.min(Math.max(dAngle, -2.5*dt), 2.5*dt);
    opp.speed += (opp.maxSpeed * Math.max(0.55, 1 - Math.abs(dAngle)*0.4) - opp.speed) * Math.min(dt*2,1);
    opp.pos.addScaledVector(new THREE.Vector3(Math.sin(opp.heading), 0, Math.cos(opp.heading)), opp.speed * dt);
    opp.pos.y = 0; opp.mesh.position.copy(opp.pos); opp.mesh.rotation.y = opp.heading;
    if (_splineSamples.length) {
      const info = getNearestTrackPoint(opp.pos);
      if (info && Math.abs(info.lateralOffset) > (trackWidth/2)-0.9) {
        const sign = info.lateralOffset > 0 ? 1 : -1;
        opp.pos.add(info.right.clone().multiplyScalar(sign*((trackWidth/2-0.9) - Math.abs(info.lateralOffset))));
        opp.mesh.position.copy(opp.pos); opp.mesh.position.y = 0; opp.speed *= 0.65;
        let dA = Math.atan2(info.tan.x, info.tan.z) - opp.heading;
        while (dA > Math.PI) dA -= Math.PI*2; while (dA < -Math.PI) dA += Math.PI*2;
        opp.heading += dA * 0.5;
      }
    }
    if (opp.mesh.userData.wheels) opp.mesh.userData.wheels.forEach(w => { w.rotation.x -= opp.speed * dt * 0.9; });
    if (opp.lapCount >= laps) opp.lapCount = laps;
  });
}

function getPlayerPosition() {
  const p = GameState.player;
  const playerProg = p.lapCount + (p.lapWaypointIdx / Math.max(trackWaypoints.length, 1));
  let ahead = 0;
  GameState.opponents.forEach(o => { if (o.lapCount + o.waypointT > playerProg) ahead++; });
  return ahead + 1;
}

// ═══════════════════════════════════════════════════════════
//  OBSTACLES
// ═══════════════════════════════════════════════════════════
const OBSTACLE_TYPES = ['traffic','traffic','traffic','oil','cone','cone','barrier'];
let obstacleSpawnTimer = 0;

function spawnObstacle() {
  if (!trackSpline) return;
  const t = Math.random(), pt = trackSpline.getPointAt(t), tan = trackSpline.getTangentAt(t);
  const right = new THREE.Vector3(-tan.z, 0, tan.x);
  pt.addScaledVector(right, (Math.random()-0.5)*(trackWidth*0.6));
  const type = OBSTACLE_TYPES[Math.floor(Math.random()*OBSTACLE_TYPES.length)];
  let mesh;
  if (type === 'traffic') {
    const tCar = new THREE.Group(), col = [0xcc4444,0x4444cc,0x44cc44,0xcccc44,0xffffff][Math.floor(Math.random()*5)];
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.5,3.5), new THREE.MeshLambertMaterial({color:col})); b.position.y = 0.38;
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.4,1.8), new THREE.MeshLambertMaterial({color:0x111122})); c.position.set(0,0.72,-0.3);
    tCar.add(b); tCar.add(c); tCar.castShadow = true; mesh = tCar;
  } else if (type === 'oil') {
    mesh = new THREE.Mesh(new THREE.CircleGeometry(1.8,8), new THREE.MeshLambertMaterial({color:0x110022,transparent:true,opacity:0.75}));
    mesh.rotation.x = -Math.PI/2; mesh.position.y = 0.02;
  } else if (type === 'cone') {
    mesh = new THREE.Mesh(new THREE.ConeGeometry(0.25,0.8,6), new THREE.MeshLambertMaterial({color:0xff6600})); mesh.position.y = 0.4;
  } else {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.9,2.8), new THREE.MeshLambertMaterial({color:0xdddddd})); mesh.position.y = 0.45;
  }
  mesh.position.x = pt.x; mesh.position.z = pt.z; mesh.castShadow = true; scene.add(mesh);
  GameState.obstacles.push({ mesh, type, pos: new THREE.Vector3(pt.x,0,pt.z), radius: type==='oil'?1.8:type==='traffic'?2.0:0.6, speed: type==='traffic'?(4+Math.random()*8):0, heading: Math.atan2(tan.x,tan.z), waypointT: t, active: true });
}

function updateObstacles(dt) {
  obstacleSpawnTimer -= dt;
  if (obstacleSpawnTimer <= 0) { obstacleSpawnTimer = 2.5 + Math.random()*3.0; spawnObstacle(); }
  while (GameState.obstacles.length > 28) { const old = GameState.obstacles.shift(); if (old.mesh) scene.remove(old.mesh); }
  GameState.obstacles.forEach(obs => {
    if (!obs.active || obs.speed <= 0 || !trackSpline) return;
    obs.waypointT += (obs.speed / (trackSpline.getLength()||100)) * dt;
    if (obs.waypointT >= 1) obs.waypointT -= 1;
    const pt = trackSpline.getPointAt(obs.waypointT), tan = trackSpline.getTangentAt(obs.waypointT);
    obs.pos.set(pt.x,0,pt.z); obs.mesh.position.set(pt.x, obs.mesh.position.y, pt.z); obs.mesh.rotation.y = Math.atan2(tan.x,tan.z);
  });
}

function checkObstacleCollisions() {
  const p = GameState.player;
  if (p.invincible > 0 || p.finishedRace) return;
  GameState.obstacles.forEach(obs => {
    if (!obs.active) return;
    const dx = p.pos.x - obs.pos.x, dz = p.pos.z - obs.pos.z;
    if (Math.sqrt(dx*dx+dz*dz) < obs.radius + 1.2) {
      if (obs.type === 'oil') { p.speed *= 0.6; p.heading += 0.3*(Math.random()>0.5?1:-1); showToast('🛢 OIL SLICK!',800); }
      else if (p.shielded > 0) { obs.active = false; scene.remove(obs.mesh); spawnHitParticles(obs.pos,0x00aaff); Audio.sfxShield(); showToast('🛡 SHIELD ABSORBED HIT!',1000); }
      else {
        const dmg = obs.type === 'traffic' ? 18 : 10;
        p.health = Math.max(0, p.health - dmg); p.invincible = 1.2; p.speed *= 0.3;
        spawnHitParticles(p.pos, 0xff4422); Audio.sfxHit(); updateHealthHUD();
        if (p.health <= 0) { p.health = 15; p.invincible = 3.0; p.speed = 0; showToast('💥 CRASHED! Respawning…',1800); }
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════
//  POWER-UPS
// ═══════════════════════════════════════════════════════════
const POWERUP_DEFS = [
  { id:'nitro',  icon:'⚡', name:'NITRO BURST',   color:0xff6d00, duration:4  },
  { id:'shield', icon:'🛡', name:'SHIELD',         color:0x00aaff, duration:8  },
  { id:'magnet', icon:'🧲', name:'COIN MAGNET',    color:0xffcc00, duration:10 },
  { id:'wind',   icon:'🌪', name:'WIND BLAST',     color:0x88ddff, duration:0  },
  { id:'freeze', icon:'❄',  name:'FREEZE PULSE',   color:0x44ccff, duration:3  },
  { id:'repair', icon:'🔧', name:'INSTANT REPAIR', color:0x00e676, duration:0  },
];
let powerupSpawnTimer = 0;

function spawnPowerup() {
  if (!trackSpline || GameState.powerups.length >= 8) return;
  const t = Math.random(), pt = trackSpline.getPointAt(t), tan = trackSpline.getTangentAt(t);
  const right = new THREE.Vector3(-tan.z, 0, tan.x);
  pt.addScaledVector(right, (Math.random()-0.5)*(trackWidth*0.55));
  const def = POWERUP_DEFS[Math.floor(Math.random()*POWERUP_DEFS.length)];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.1,1.1,1.1), new THREE.MeshLambertMaterial({color:def.color,emissive:def.color,emissiveIntensity:0.4}));
  mesh.position.set(pt.x, 0.7, pt.z); mesh.castShadow = true; scene.add(mesh);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7,0.9,12), new THREE.MeshLambertMaterial({color:def.color,side:THREE.DoubleSide,transparent:true,opacity:0.6}));
  ring.rotation.x = -Math.PI/2; ring.position.set(pt.x,0.05,pt.z); scene.add(ring);
  GameState.powerups.push({ mesh, ring, def, pos: new THREE.Vector3(pt.x,0,pt.z), active: true });
}

function updatePowerups(dt) {
  powerupSpawnTimer -= dt;
  if (powerupSpawnTimer <= 0) { powerupSpawnTimer = 4 + Math.random()*5; spawnPowerup(); }
  const t = performance.now()*0.001, p = GameState.player;
  GameState.powerups.forEach(pu => {
    if (!pu.active) return;
    pu.mesh.rotation.y = t*2; pu.mesh.position.y = 0.7 + Math.sin(t*2.5+pu.pos.x)*0.2; pu.ring.rotation.z = t;
    const dx = p.pos.x - pu.pos.x, dz = p.pos.z - pu.pos.z;
    if (Math.sqrt(dx*dx+dz*dz) < 2.0) {
      pu.active = false; scene.remove(pu.mesh); scene.remove(pu.ring);
      GameState.heldPowerup = pu.def; updatePowerupHUD(); Audio.sfxPickup();
      showToast(`${pu.def.icon} ${pu.def.name} READY! (press E)`, 1500);
    }
  });
  GameState.powerups = GameState.powerups.filter(pu => pu.active);
}

let nitroCooldown = 0;

function activateNitro() {
  if (GameState.mode !== 'racing') return;
  if (nitroCooldown > 0) { showToast(`⚡ NITRO RECHARGING… ${nitroCooldown.toFixed(1)}s`,800); return; }
  GameState.player.boosting = 3.5; nitroCooldown = 8;
  Audio.sfxBoost(); showToast('⚡ NITRO BURST!',1200); spawnBoostParticles();
}

function tickNitroCooldown(dt) { if (nitroCooldown > 0) nitroCooldown = Math.max(0, nitroCooldown - dt); }

function usePowerup() {
  const pu = GameState.heldPowerup;
  if (!pu || GameState.mode !== 'racing') return;
  const p = GameState.player;
  switch(pu.id) {
    case 'nitro':  p.boosting = pu.duration; Audio.sfxBoost(); showToast('⚡ NITRO BURST!',1200); spawnBoostParticles(); break;
    case 'shield': p.shielded = pu.duration; Audio.sfxShield(); showToast('🛡 SHIELD ACTIVE!',1200); break;
    case 'magnet': p.magnetized = pu.duration; showToast('🧲 COIN MAGNET!',1200); break;
    case 'wind':
      GameState.opponents.forEach(o => { const dx=o.pos.x-p.pos.x, dz=o.pos.z-p.pos.z, d=Math.sqrt(dx*dx+dz*dz); if(d<25){o.pos.addScaledVector(new THREE.Vector3(dx,0,dz).normalize(),12);o.speed*=0.4;o.mesh.position.copy(o.pos);} });
      showToast('🌪 WIND BLAST!',1200); spawnHitParticles(p.pos,0x88ddff); break;
    case 'freeze':
      GameState.opponents.forEach(o => { o.speed *= 0.2; }); Audio.sfxFreeze(); showToast('❄ FREEZE PULSE!',1200); spawnHitParticles(p.pos,0x44ccff); break;
    case 'repair':
      p.health = Math.min(100, p.health+55); updateHealthHUD(); showToast('🔧 REPAIRED!',1200); spawnHitParticles(p.pos,0x00e676); break;
  }
  GameState.heldPowerup = null; updatePowerupHUD();
}

// ═══════════════════════════════════════════════════════════
//  COINS
// ═══════════════════════════════════════════════════════════
let coinSpawnTimer = 0;
const coinGeo = new THREE.CylinderGeometry(0.35,0.35,0.12,8);
const coinMat = new THREE.MeshLambertMaterial({color:0xFFD700,emissive:0xaa8800,emissiveIntensity:0.5});

function spawnCoin() {
  if (!trackSpline || GameState.coins.length >= 40) return;
  const t = Math.random(), pt = trackSpline.getPointAt(t), tan = trackSpline.getTangentAt(t);
  const right = new THREE.Vector3(-tan.z,0,tan.x);
  pt.addScaledVector(right,(Math.random()-0.5)*(trackWidth*0.7));
  const mesh = new THREE.Mesh(coinGeo, coinMat);
  mesh.position.set(pt.x,0.45,pt.z); mesh.castShadow = true; scene.add(mesh);
  GameState.coins.push({ mesh, pos: new THREE.Vector3(pt.x,0,pt.z), active: true, value: Math.random()<0.15?5:1 });
}

function updateCoins(dt) {
  coinSpawnTimer -= dt;
  if (coinSpawnTimer <= 0) { coinSpawnTimer = 0.8+Math.random()*1.2; spawnCoin(); spawnCoin(); }
  const t = performance.now()*0.001, p = GameState.player;
  GameState.coins.forEach(coin => {
    if (!coin.active) return;
    coin.mesh.rotation.y = t*3;
    let dx = p.pos.x-coin.pos.x, dz = p.pos.z-coin.pos.z;
    const dist = Math.sqrt(dx*dx+dz*dz);
    if (p.magnetized > 0 && dist < 18) {
      const pull = 28*dt, nx=dx/dist, nz=dz/dist;
      coin.pos.x += nx*pull; coin.pos.z += nz*pull;
      coin.mesh.position.x = coin.pos.x; coin.mesh.position.z = coin.pos.z;
      dx = p.pos.x-coin.pos.x; dz = p.pos.z-coin.pos.z;
    }
    if (Math.sqrt(dx*dx+dz*dz) < 1.6) {
      coin.active = false; scene.remove(coin.mesh);
      Save.addCoins(coin.value);
      document.getElementById('hud-coins').textContent = Save.data.coins;
      Audio.sfxCoin();
    }
  });
  GameState.coins = GameState.coins.filter(c => c.active);
}

// ═══════════════════════════════════════════════════════════
//  PARTICLES
// ═══════════════════════════════════════════════════════════
function spawnHitParticles(pos, color) {
  for (let i = 0; i < 12; i++) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12,4,4), new THREE.MeshLambertMaterial({color,emissive:color,emissiveIntensity:0.8}));
    mesh.position.copy(pos).add(new THREE.Vector3(0,0.5,0)); scene.add(mesh);
    GameState.particles.push({ mesh, vel: new THREE.Vector3((Math.random()-0.5)*14,Math.random()*10+2,(Math.random()-0.5)*14), life: 0.8+Math.random()*0.4 });
  }
}

function spawnBoostParticles() {
  const p = GameState.player, dir = new THREE.Vector3(Math.sin(p.heading),0,Math.cos(p.heading));
  for (let i = 0; i < 20; i++) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.09+Math.random()*0.14,4,4), new THREE.MeshLambertMaterial({color:0xff6d00,emissive:0xff4400,emissiveIntensity:1}));
    mesh.position.copy(p.pos).add(new THREE.Vector3(0,0.4,0)); scene.add(mesh);
    const vel = dir.clone().negate().multiplyScalar(6+Math.random()*8).add(new THREE.Vector3((Math.random()-0.5)*4,Math.random()*3,(Math.random()-0.5)*4));
    GameState.particles.push({ mesh, vel, life: 0.5+Math.random()*0.3 });
  }
}

function updateParticles(dt) {
  GameState.particles.forEach(pt => {
    pt.life -= dt; pt.vel.y -= 14*dt; pt.mesh.position.addScaledVector(pt.vel, dt);
    pt.mesh.scale.setScalar(Math.max(pt.life, 0.05));
    if (pt.life <= 0) scene.remove(pt.mesh);
  });
  GameState.particles = GameState.particles.filter(pt => pt.life > 0);
}

// ═══════════════════════════════════════════════════════════
//  WEATHER
// ═══════════════════════════════════════════════════════════
function initWeather(type) {
  clearWeather();
  if (type === 'snow') {
    for (let i = 0; i < 200; i++) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.08+Math.random()*0.1,4,4), new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:0.85}));
      mesh.position.set((Math.random()-0.5)*80, Math.random()*30, (Math.random()-0.5)*80); scene.add(mesh);
      GameState.weather.push({ mesh, type:'snow', vy: -(0.8+Math.random()*1.5) });
    }
  } else if (type === 'lava') {
    for (let i = 0; i < 6; i++) {
      const light = new THREE.PointLight(0xff4400,2,40);
      const pt = trackSpline ? trackSpline.getPointAt(i/6) : new THREE.Vector3(i*20,0,0);
      light.position.set(pt.x,2,pt.z); scene.add(light); GameState.weather.push({ light, type:'lava_light' });
    }
  } else if (type === 'night' && trackSpline) {
    for (let i = 0; i < 16; i++) {
      const pt = trackSpline.getPointAt(i/16);
      const light = new THREE.PointLight(0xffeedd,1.5,30); light.position.set(pt.x,5,pt.z); scene.add(light);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,5,5), new THREE.MeshLambertMaterial({color:0x888888}));
      pole.position.set(pt.x,2.5,pt.z); scene.add(pole);
      GameState.weather.push({ light, type:'street_light' }); GameState.weather.push({ mesh:pole, type:'pole' });
    }
  }
}

function clearWeather() {
  GameState.weather.forEach(w => { if (w.mesh) scene.remove(w.mesh); if (w.light) scene.remove(w.light); });
  GameState.weather = [];
}

function updateWeather(dt) {
  const p = GameState.player;
  GameState.weather.forEach(w => {
    if (w.type === 'snow' && w.mesh) {
      w.mesh.position.y += w.vy*dt*8;
      w.mesh.position.x += Math.sin(performance.now()*0.001+w.vy)*0.5*dt*4;
      if (w.mesh.position.y < -1) w.mesh.position.y = 28;
      w.mesh.position.x = ((w.mesh.position.x - p.pos.x + 40) % 80) + p.pos.x - 40;
      w.mesh.position.z = ((w.mesh.position.z - p.pos.z + 40) % 80) + p.pos.z - 40;
    } else if (w.type === 'lava_light' && w.light) {
      w.light.intensity = 1.5 + Math.sin(performance.now()*0.004+w.light.position.x)*0.8;
    }
  });
}

// ═══════════════════════════════════════════════════════════
//  LAP TRACKING
// ═══════════════════════════════════════════════════════════
function updateLapTracking() {
  if (!trackSpline || GameState.mode !== 'racing') return;
  const p = GameState.player;
  if (p.finishedRace) return;
  let nearest = 0, nearestDist = Infinity;
  trackWaypoints.forEach((wp, i) => { const dx=p.pos.x-wp.x, dz=p.pos.z-wp.z, d=dx*dx+dz*dz; if(d<nearestDist){nearestDist=d;nearest=i;} });
  const N = trackWaypoints.length, expected = (p.lapWaypointIdx + 1) % N;
  if (nearest === expected) {
    p.lapWaypointIdx = nearest;
    if (nearest === 0) {
      const lapTime = (GameState.raceTimer - p.lapStartTime).toFixed(2);
      p.lapTimes.push(parseFloat(lapTime)); p.lapStartTime = GameState.raceTimer; p.lapCount++;
      const totalLaps = GameState.currentTrack ? GameState.currentTrack.laps : 4;
      if (p.lapCount >= totalLaps) { p.finishedRace = true; setTimeout(finishRace, 600); }
      else { Audio.sfxLap(); showToast(`🏁 LAP ${p.lapCount}/${totalLaps} — ${lapTime}s`, 2200); }
      updateLapHUD();
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  CAMERA MODES
// ═══════════════════════════════════════════════════════════
function updateCamera(dt) {
  const p = GameState.player;
  if (!p.mesh) return;
  const pos = p.pos, head = p.heading, speed = Math.abs(p.speed);
  const dir = new THREE.Vector3(Math.sin(head),0,Math.cos(head));
  const lerpF = Math.min(dt*7,1);
  switch(GameState.camMode) {
    case 0: {
      const behind = dir.clone().negate(), fovBoost = speed>25?1.0+(speed-25)/40:1.0;
      GameState.camSmooth.lerp(pos.clone().add(behind.clone().multiplyScalar(9*fovBoost)).add(new THREE.Vector3(0,4.5,0)), lerpF);
      camera.position.copy(GameState.camSmooth);
      GameState.camLookAt.lerp(pos.clone().add(dir.clone().multiplyScalar(8)).add(new THREE.Vector3(0,1.2,0)), lerpF);
      camera.lookAt(GameState.camLookAt); break;
    }
    case 1: { const hood = pos.clone().add(dir.clone().multiplyScalar(1.5)).add(new THREE.Vector3(0,1.1,0)); camera.position.copy(hood); camera.lookAt(pos.clone().add(dir.clone().multiplyScalar(20)).add(new THREE.Vector3(0,0.8,0))); break; }
    case 2: { const cockpit = pos.clone().add(dir.clone().multiplyScalar(0.2)).add(new THREE.Vector3(0,0.85,0)); camera.position.copy(cockpit); camera.lookAt(pos.clone().add(dir.clone().multiplyScalar(15)).add(new THREE.Vector3(0,0.5,0))); break; }
    case 3: { GameState.camSmooth.lerp(pos.clone().add(new THREE.Vector3(0,55,0)), lerpF*0.5); camera.position.copy(GameState.camSmooth); camera.lookAt(pos); break; }
    case 4: {
      GameState.cinemaAngle += dt*0.35;
      const radius = 18+Math.sin(GameState.cinemaAngle*0.5)*4, height = 5+Math.sin(GameState.cinemaAngle*0.7)*2.5;
      camera.position.set(pos.x+Math.cos(GameState.cinemaAngle)*radius, pos.y+height, pos.z+Math.sin(GameState.cinemaAngle)*radius);
      camera.lookAt(pos.clone().add(new THREE.Vector3(0,1,0))); break;
    }
  }
  const targetFov = 58 + Math.min(speed/3,18);
  camera.fov += (targetFov - camera.fov) * lerpF * 0.4;
  camera.updateProjectionMatrix();
}

function cycleCameraMode() {
  GameState.camMode = (GameState.camMode + 1) % GameState.camModeNames.length;
  document.getElementById('hud-cam').textContent = `CAM: ${GameState.camModeNames[GameState.camMode]}`;
  showToast(`📷 ${GameState.camModeNames[GameState.camMode]} CAM`, 900);
}

// ═══════════════════════════════════════════════════════════
//  MINI-MAP
// ═══════════════════════════════════════════════════════════
const minimap = document.getElementById('minimap');
const mmCtx = minimap ? minimap.getContext('2d') : null;

function drawMinimap() {
  if (!mmCtx || !trackSpline) return;
  mmCtx.clearRect(0,0,140,140);
  const cx=70, cy=70, scale=0.48;
  mmCtx.beginPath(); mmCtx.strokeStyle='rgba(255,255,255,0.35)'; mmCtx.lineWidth=5;
  trackSpline.getPoints(60).forEach((p,i) => { const sx=cx+p.x*scale, sy=cy+p.z*scale; i===0?mmCtx.moveTo(sx,sy):mmCtx.lineTo(sx,sy); });
  mmCtx.closePath(); mmCtx.stroke();
  GameState.opponents.forEach((o,i) => { const colors=['#4488ff','#ff8800','#44ff88','#ff44aa']; mmCtx.beginPath(); mmCtx.fillStyle=colors[i]||'#888'; mmCtx.arc(cx+o.pos.x*scale,cy+o.pos.z*scale,3,0,Math.PI*2); mmCtx.fill(); });
  const p = GameState.player;
  mmCtx.beginPath(); mmCtx.fillStyle='#fff'; mmCtx.arc(cx+p.pos.x*scale,cy+p.pos.z*scale,5,0,Math.PI*2); mmCtx.fill();
  mmCtx.save(); mmCtx.translate(cx+p.pos.x*scale,cy+p.pos.z*scale); mmCtx.rotate(p.heading); mmCtx.beginPath(); mmCtx.fillStyle='#ff6d00'; mmCtx.moveTo(0,-8); mmCtx.lineTo(-3,2); mmCtx.lineTo(3,2); mmCtx.closePath(); mmCtx.fill(); mmCtx.restore();
  mmCtx.fillStyle='rgba(255,215,0,0.7)';
  GameState.coins.slice(0,20).forEach(c => { mmCtx.beginPath(); mmCtx.arc(cx+c.pos.x*scale,cy+c.pos.z*scale,2,0,Math.PI*2); mmCtx.fill(); });
}

// ═══════════════════════════════════════════════════════════
//  HUD HELPERS
// ═══════════════════════════════════════════════════════════
function updateSpeedHUD() {
  document.getElementById('hud-speed').textContent = Math.abs(Math.round(GameState.player.speed * 3.6));
  const boostEl = document.getElementById('hud-boost');
  if (GameState.player.boosting > 0) { boostEl.style.display='block'; boostEl.textContent='BOOST!'; boostEl.style.color='#ff6d00'; boostEl.style.animation=''; }
  else if (nitroCooldown > 0) { boostEl.style.display='block'; boostEl.textContent=`⚡ ${nitroCooldown.toFixed(1)}s`; boostEl.style.color='#888'; boostEl.style.animation='none'; }
  else { boostEl.style.display='none'; boostEl.style.animation=''; }
}
function updateHealthHUD() {
  const h = Math.max(0, GameState.player.health), el = document.getElementById('hud-health');
  el.style.width = h+'%';
  el.style.background = h>60?'linear-gradient(90deg,#00e676,#69f0ae)':h>30?'linear-gradient(90deg,#ffcc00,#ffee55)':'linear-gradient(90deg,#ff4444,#ff8844)';
}
function updateLapHUD() {
  const laps = GameState.currentTrack ? GameState.currentTrack.laps : 4;
  document.getElementById('hud-lap').textContent = `${Math.min(GameState.player.lapCount+1,laps)}/${laps}`;
}
function updateTimerHUD() {
  const t = GameState.raceTimer, m = Math.floor(t/60), s = Math.floor(t%60).toString().padStart(2,'0');
  document.getElementById('hud-time').textContent = `${m}:${s}`;
  if (GameState.raceMode === 'trial') { const rem = GameState.timeLimitSeconds - t; document.getElementById('hud-time').style.color = rem<20?'#ff4444':'#FFD700'; }
}
function updatePositionHUD() {
  const pos = getPlayerPosition(), suffixes=['','st','nd','rd','th','th'];
  document.getElementById('hud-pos').textContent = pos+(suffixes[pos]||'th');
}
function updatePowerupHUD() {
  const pu = GameState.heldPowerup, el = document.getElementById('hud-powerup');
  if (pu) { el.style.display='block'; document.getElementById('hud-powerup-icon').textContent=pu.icon; document.getElementById('hud-powerup-name').textContent=pu.name; }
  else el.style.display='none';
}
function updateHudXP() {
  document.getElementById('hud-level').textContent = `Lv.${Save.data.level}`;
  document.getElementById('hud-xp').style.width = Math.min((Save.data.xp/Save.xpForLevel(Save.data.level))*100,100)+'%';
}
function updateEffectsHUD() {
  const p = GameState.player, container = document.getElementById('hud-effects');
  container.innerHTML = '';
  const effects = [];
  if (p.shielded>0)   effects.push({icon:'🛡',label:`${p.shielded.toFixed(1)}s`,color:'#00aaff'});
  if (p.magnetized>0) effects.push({icon:'🧲',label:`${p.magnetized.toFixed(1)}s`,color:'#FFD700'});
  if (p.boosting>0)   effects.push({icon:'⚡',label:`${p.boosting.toFixed(1)}s`,color:'#ff6d00'});
  if (p.frozen>0)     effects.push({icon:'❄',label:`${p.frozen.toFixed(1)}s`,color:'#44ccff'});
  if (p.invincible>0) effects.push({icon:'💫',label:`${p.invincible.toFixed(1)}s`,color:'#ffcc00'});
  effects.forEach(e => {
    const div = document.createElement('div'); div.className='effect-badge'; div.style.borderColor=e.color;
    div.innerHTML=`<span>${e.icon}</span><span style="color:${e.color}">${e.label}</span>`; container.appendChild(div);
  });
}
let toastTimer = null;
function showToast(msg, duration=1800) {
  const el = document.getElementById('game-toast');
  el.textContent=msg; el.style.display='block'; el.style.animation='none'; void el.offsetWidth; el.style.animation='toastIn 0.25s ease-out';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.style.display='none'; }, duration);
}

// ═══════════════════════════════════════════════════════════
//  RACE FLOW
// ═══════════════════════════════════════════════════════════
function startRace(trackId, raceMode='quick') {
  const trackDef = TRACK_DEFS.find(t => t.id===trackId), carDef = CAR_DEFS.find(c => c.id===Save.data.selectedCar);
  if (!trackDef || !carDef) return;
  GameState.currentTrack=trackDef; GameState.currentCar=carDef; GameState.raceMode=raceMode; GameState.timeLimitSeconds=trackDef.timeLimit;
  Save.data.selectedTrack=trackId; Save.save();
  clearRaceObjects(); buildTrack(trackDef);
  const startPt=trackSpline.getPointAt(0), startTan=trackSpline.getTangentAt(0), startAngle=Math.atan2(startTan.x,startTan.z);
  if (GameState.player.mesh) scene.remove(GameState.player.mesh);
  const playerMesh = buildCarMesh(carDef, true); scene.add(playerMesh);
  const p = GameState.player;
  Object.assign(p, { mesh:playerMesh, speed:0, heading:startAngle, health:100, invincible:0, frozen:0, boosting:0, shielded:0, magnetized:0, lapCount:0, lapWaypointIdx:0, lapStartTime:0, lapTimes:[], totalTime:0, finishedRace:false, braking:false });
  p.pos.copy(startPt).addScaledVector(startTan,2); p.pos.y=0; p.vel.set(0,0,0);
  GameState.heldPowerup=null; nitroCooldown=0; _barrierFlash=0;
  playerMesh.position.copy(p.pos); playerMesh.rotation.y=p.heading;
  GameState.camSmooth.copy(p.pos.clone().add(new THREE.Vector3(0,5,10))); GameState.camLookAt.copy(p.pos);
  spawnOpponents(trackDef, carDef);
  obstacleSpawnTimer=3; powerupSpawnTimer=5; coinSpawnTimer=1;
  initWeather(trackDef.weather);
  updateHealthHUD(); updateLapHUD(); updatePowerupHUD(); updateHudXP();
  document.getElementById('hud-coins').textContent = Save.data.coins;
  document.getElementById('hud').style.display='block';
  if (isMobile()) document.getElementById('mobile-controls').style.display='block';
  document.querySelectorAll('[id^="screen-"]').forEach(s => s.style.display='none');
  GameState.mode='countdown'; GameState.raceTimer=0;
  startCountdown();
}

function startCountdown() {
  const countEl=document.getElementById('countdown-num'), overlay=document.getElementById('screen-countdown');
  overlay.style.display='flex'; let count=3; countEl.textContent=count; countEl.style.color='#fff'; Audio.sfxCountdown();
  const interval = setInterval(() => {
    count--;
    if (count > 0) { countEl.textContent=count; countEl.style.animation='none'; void countEl.offsetWidth; countEl.style.animation='countPop 0.5s ease-out'; Audio.sfxCountdown(); }
    else { clearInterval(interval); countEl.textContent='GO!'; countEl.style.color='#00ff88'; Audio.sfxCountdownGo(); Audio.startEngine(); setTimeout(()=>{ overlay.style.display='none'; GameState.mode='racing'; },700); }
  }, 1000);
}

function pauseRace()  { if(GameState.mode!=='racing') return; GameState.mode='paused'; Audio.stopEngine(); document.getElementById('screen-pause').style.display='flex'; }
function resumeRace() { if(GameState.mode!=='paused') return; document.getElementById('screen-pause').style.display='none'; GameState.mode='racing'; Audio.startEngine(); }
function abandonRace(){ document.getElementById('screen-pause').style.display='none'; endRaceSession(); showScreen('screen-main'); }
function retryRace()  { const tid=GameState.currentTrack?GameState.currentTrack.id:'city', rm=GameState.raceMode; document.getElementById('screen-results').style.display='none'; startRace(tid,rm); }

function endRaceSession() {
  GameState.mode='menu'; Audio.stopEngine();
  document.getElementById('hud').style.display='none'; document.getElementById('mobile-controls').style.display='none';
  clearRaceObjects();
}

function clearRaceObjects() {
  GameState.obstacles.forEach(o => { if(o.mesh) scene.remove(o.mesh); }); GameState.obstacles=[];
  GameState.coins.forEach(c => { if(c.mesh) scene.remove(c.mesh); }); GameState.coins=[];
  GameState.powerups.forEach(p => { if(p.mesh) scene.remove(p.mesh); if(p.ring) scene.remove(p.ring); }); GameState.powerups=[];
  GameState.particles.forEach(p => { if(p.mesh) scene.remove(p.mesh); }); GameState.particles=[];
  clearWeather();
}

function startTimeTrialMode() { showScreen('screen-mode'); GameState.raceMode='trial'; }

function finishRace() {
  if (GameState.mode==='results') return;
  Audio.sfxFinish(); Audio.stopEngine(); GameState.mode='results';
  const p=GameState.player, pos=getPlayerPosition(), isWin=pos===1;
  const time=GameState.raceTimer, m=Math.floor(time/60), s=(time%60).toFixed(2), timeStr=`${m}:${s.padStart(5,'0')}`;
  const coinsEarned=Math.floor(30+(5-pos)*15+Math.random()*20), xpEarned=Math.floor(80+(5-pos)*40);
  Save.addCoins(coinsEarned); Save.addXP(xpEarned); Save.data.totalRaces++; if(isWin) Save.data.totalWins++;
  const tid=GameState.currentTrack.id;
  if (!Save.data.bestTimes[tid] || time < Save.data.bestTimes[tid]) Save.data.bestTimes[tid]=parseFloat(time.toFixed(2));
  Save.save();
  const suffixes=['','1st','2nd','3rd','4th','5th'];
  document.getElementById('results-trophy').textContent = isWin?'🏆':pos<=3?'🥈':'🏁';
  document.getElementById('results-title').textContent  = isWin?'VICTORY!':'RACE COMPLETE';
  document.getElementById('results-title').style.color  = isWin?'#FFD700':'#00e5ff';
  document.getElementById('results-subtitle').textContent = `FINISHED IN ${suffixes[pos]} PLACE`;
  document.getElementById('results-grid').innerHTML = `
    <div style="text-align:center;"><div style="font-size:11px;color:#888;letter-spacing:1px;margin-bottom:6px;">FINISH TIME</div><div style="font-size:28px;font-weight:900;color:#FFD700;">${timeStr}</div></div>
    <div style="text-align:center;"><div style="font-size:11px;color:#888;letter-spacing:1px;margin-bottom:6px;">POSITION</div><div style="font-size:28px;font-weight:900;color:#00e5ff;">${suffixes[pos]}</div></div>
    <div style="text-align:center;"><div style="font-size:11px;color:#888;letter-spacing:1px;margin-bottom:6px;">LAPS</div><div style="font-size:28px;font-weight:900;color:#fff;">${p.lapCount}/${GameState.currentTrack.laps}</div></div>`;
  document.getElementById('results-rewards').innerHTML = `
    <div style="display:flex;gap:20px;justify-content:center;flex-wrap:wrap;">
      <div style="background:rgba(255,215,0,0.12);border:1px solid rgba(255,215,0,0.3);border-radius:12px;padding:10px 20px;text-align:center;"><div style="font-size:22px;">🪙</div><div style="font-size:20px;font-weight:900;color:#FFD700;">+${coinsEarned}</div><div style="font-size:10px;color:#888;letter-spacing:1px;">COINS</div></div>
      <div style="background:rgba(124,77,255,0.12);border:1px solid rgba(124,77,255,0.3);border-radius:12px;padding:10px 20px;text-align:center;"><div style="font-size:22px;">⭐</div><div style="font-size:20px;font-weight:900;color:#b39ddb;">+${xpEarned}</div><div style="font-size:10px;color:#888;letter-spacing:1px;">XP</div></div>
    </div>`;
  document.getElementById('hud').style.display='none'; document.getElementById('mobile-controls').style.display='none';
  document.getElementById('screen-results').style.display='flex';
}

// ═══════════════════════════════════════════════════════════
//  MAIN GAME LOOP
// ═══════════════════════════════════════════════════════════
function gameLoop() {
  requestAnimationFrame(gameLoop);
  deltaTime = Math.min(clock.getDelta(), 0.05);
  if (GameState.mode === 'racing') {
    const carDef = GameState.currentCar, laps = GameState.currentTrack ? GameState.currentTrack.laps : 4;
    GameState.raceTimer += deltaTime;
    if (GameState.raceMode==='trial' && GameState.raceTimer>=GameState.timeLimitSeconds) { GameState.player.finishedRace=true; setTimeout(finishRace,400); }
    updatePlayerPhysics(deltaTime, carDef);
    updateOpponents(deltaTime, laps);
    updateObstacles(deltaTime);
    updatePowerups(deltaTime);
    updateCoins(deltaTime);
    updateParticles(deltaTime);
    updateWeather(deltaTime);
    tickNitroCooldown(deltaTime);
    checkObstacleCollisions();
    updateLapTracking();
    if (GameState.raceTimer - GameState.lastHudUpdate > 0.05) {
      GameState.lastHudUpdate = GameState.raceTimer;
      updateSpeedHUD(); updateTimerHUD(); updatePositionHUD(); updateEffectsHUD();
    }
    drawMinimap();
  }
  if (['racing','paused','countdown'].includes(GameState.mode)) updateCamera(deltaTime);
  renderer.render(scene, camera);
}

// ═══════════════════════════════════════════════════════════
//  UI SCREENS
// ═══════════════════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('[id^="screen-"]').forEach(s => s.style.display='none');
  const el = document.getElementById(id); if (el) el.style.display='flex';
  if (id==='screen-mode')   buildTrackGrid();
  if (id==='screen-garage') buildCarGrid();
  if (id==='screen-stats')  buildStatsScreen();
  if (id==='screen-main')   updateMainMenu();
}

function updateMainMenu() {
  document.getElementById('save-badge').textContent = `Lv.${Save.data.level}  ·  🪙 ${Save.data.coins}  ·  ${Save.data.totalRaces} Races`;
}

function buildTrackGrid() {
  const grid = document.getElementById('track-grid'); grid.innerHTML='';
  TRACK_DEFS.forEach(t => {
    const unlocked=Save.data.unlockedTracks.includes(t.id), best=Save.data.bestTimes[t.id];
    const bestStr = best ? `⏱ ${Math.floor(best/60)}:${(best%60).toFixed(2).padStart(5,'0')}` : 'No best time yet';
    const div=document.createElement('div'); div.className='track-card'+(unlocked?'':' locked');
    div.innerHTML=`<div style="font-size:32px;margin-bottom:8px;">${t.emoji}</div><div style="font-weight:800;font-size:14px;color:${unlocked?'#fff':'#888'};margin-bottom:4px;">${t.name}</div><div style="font-size:11px;color:#666;margin-bottom:6px;">${t.desc}</div><div style="font-size:11px;color:#aaa;">${t.laps} laps · ${t.timeLimit}s</div><div style="font-size:12px;margin-top:6px;font-weight:700;color:${unlocked?'#00e5ff':'#ff8888'};">${unlocked?bestStr:'🔒 Reach Level '+t.unlockLevel}</div>${unlocked?'<div style="font-size:10px;color:#00e676;margin-top:5px;letter-spacing:1px;">TAP TO RACE ▶</div>':''}`;
    div.style.cursor=unlocked?'pointer':'not-allowed';
    div.onclick = unlocked ? () => startRace(t.id, GameState.raceMode||'quick') : () => showToast(`🔒 Reach Level ${t.unlockLevel} to unlock ${t.name}`,2000);
    grid.appendChild(div);
  });
}

function buildCarGrid() {
  const grid=document.getElementById('car-grid'); grid.innerHTML='';
  CAR_DEFS.forEach(c => {
    const unlocked=Save.data.unlockedCars.includes(c.id), selected=Save.data.selectedCar===c.id;
    const div=document.createElement('div'); div.className='car-card'+(selected?' selected':'')+(unlocked?'':' locked');
    div.innerHTML=`<div style="font-size:28px;margin-bottom:6px;">${c.emoji}</div><div style="font-weight:800;font-size:13px;color:#fff;">${c.name}</div><div style="font-size:10px;color:#888;margin:4px 0;">${c.desc}</div><div style="font-size:10px;color:#aaa;margin-top:6px;"><div>⚡ ${c.accel} &nbsp; 🏎 ${c.maxSpeed}</div><div style="margin-top:2px;">🎯 ${Math.round(c.handling*10)}/10</div></div>${unlocked?(selected?'<div style="font-size:10px;color:#00e5ff;margin-top:5px;font-weight:800;">✓ SELECTED</div>':'<div style="font-size:10px;color:#aaa;margin-top:5px;">Click to select</div>'):`<div style="font-size:10px;color:#ff8888;margin-top:5px;">🔒 Level ${c.unlockLevel}</div>`}`;
    if (unlocked) div.onclick = () => { Save.data.selectedCar=c.id; Save.save(); buildCarGrid(); };
    grid.appendChild(div);
  });
}

function buildStatsScreen() {
  const s=Save.data;
  document.getElementById('stats-content').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px 32px;text-align:left;">
      <div><div style="font-size:11px;color:#888;letter-spacing:1px;">DRIVER LEVEL</div><div style="font-size:28px;font-weight:900;color:#b39ddb;">Level ${s.level}</div></div>
      <div><div style="font-size:11px;color:#888;letter-spacing:1px;">TOTAL COINS</div><div style="font-size:28px;font-weight:900;color:#FFD700;">🪙 ${s.coins}</div></div>
      <div><div style="font-size:11px;color:#888;letter-spacing:1px;">TOTAL RACES</div><div style="font-size:28px;font-weight:900;color:#00e5ff;">${s.totalRaces}</div></div>
      <div><div style="font-size:11px;color:#888;letter-spacing:1px;">TOTAL WINS</div><div style="font-size:28px;font-weight:900;color:#00e676;">${s.totalWins}</div></div>
      <div><div style="font-size:11px;color:#888;letter-spacing:1px;">WIN RATE</div><div style="font-size:28px;font-weight:900;color:#fff;">${s.totalRaces>0?Math.round(s.totalWins/s.totalRaces*100):0}%</div></div>
      <div><div style="font-size:11px;color:#888;letter-spacing:1px;">CARS UNLOCKED</div><div style="font-size:28px;font-weight:900;color:#ff8888;">${s.unlockedCars.length}/${CAR_DEFS.length}</div></div>
    </div>
    <div style="margin-top:20px;border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;">
      <div style="font-size:11px;color:#888;letter-spacing:1px;margin-bottom:10px;">BEST LAP TIMES</div>
      ${TRACK_DEFS.filter(t=>s.bestTimes[t.id]).map(t=>{const bt=s.bestTimes[t.id];return`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:#ccc;">${t.emoji} ${t.name}</span><span style="color:#FFD700;font-weight:800;">⏱ ${Math.floor(bt/60)}:${(bt%60).toFixed(2).padStart(5,'0')}</span></div>`;}).join('')||'<div style="color:#555;font-size:13px;text-align:center;padding:10px;">No races completed yet.</div>'}
    </div>
    <button onclick="if(confirm('Reset all save data?')){localStorage.removeItem('ddl_save');location.reload();}" style="margin-top:18px;background:rgba(244,67,54,0.2);border:1px solid rgba(244,67,54,0.4);color:#ff8888;border-radius:8px;padding:8px 20px;cursor:pointer;font-size:12px;letter-spacing:1px;">🗑 RESET SAVE</button>`;
}

// ═══════════════════════════════════════════════════════════
//  PWA — Install prompt (SNS-style banner)
// ═══════════════════════════════════════════════════════════
let _ddlInstallPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _ddlInstallPrompt = e;
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'flex';
});

window.addEventListener('appinstalled', () => {
  _ddlInstallPrompt = null;
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'none';
  showToast('✅ App installed! Launch from your home screen.', 3500);
});

window.ddlInstallApp = function() {
  if (!_ddlInstallPrompt) return;
  _ddlInstallPrompt.prompt();
  _ddlInstallPrompt.userChoice.then(choice => {
    if (choice.outcome === 'accepted') ddlDismissBanner();
    _ddlInstallPrompt = null;
  });
};

window.ddlDismissBanner = function() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'none';
};

// ── Service Worker registration & update flow ──────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/Dodge-Dash-Legends/sw.js', { scope: '/Dodge-Dash-Legends/' })
      .then(reg => {
        // Check for updates on every page load
        reg.update();

        // When a new SW is waiting, show the update toast
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              const toast  = document.getElementById('pwa-update-toast');
              const btn    = document.getElementById('pwa-update-btn');
              if (toast) toast.style.display = 'flex';
              if (btn) btn.onclick = () => {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                if (toast) toast.style.display = 'none';
                location.reload();
              };
            }
          });
        });
      })
      .catch(err => console.warn('[DDL SW] Registration failed:', err));

    // Reload when the controlling SW changes (after update)
    let _swRefreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!_swRefreshing) { _swRefreshing = true; location.reload(); }
    });
  });
}

// ═══════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════
function boot() {
  // Save migration: wipe malformed saves with empty unlock arrays
  try {
    const raw = localStorage.getItem('ddl_save');
    if (raw) {
      const s = JSON.parse(raw);
      if (!s.unlockedTracks || !Array.isArray(s.unlockedTracks) || s.unlockedTracks.length===0) {
        localStorage.removeItem('ddl_save');
        Save.data = { coins:s.coins||0, xp:s.xp||0, level:s.level||1, selectedCar:'speeder', selectedTrack:'city', unlockedCars:['speeder'], unlockedTracks:['city','desert','mountain','snow'], bestTimes:s.bestTimes||{}, totalRaces:s.totalRaces||0, totalWins:s.totalWins||0 };
        Save.save();
      }
    }
  } catch(_) {}
  Save.load();

  renderer.setClearColor(0x0a0a0f);
  buildTrack(TRACK_DEFS[0]);
  GameState.mode = 'menu';
  showScreen('screen-main');
  updateMainMenu();
  updateHudXP();

  // Idle camera orbits the menu track
  let idleAngle = 0;
  const idleLoop = setInterval(() => {
    if (GameState.mode !== 'menu') { clearInterval(idleLoop); return; }
    idleAngle += 0.005;
    camera.position.set(Math.cos(idleAngle)*130, 45, Math.sin(idleAngle)*80);
    camera.lookAt(0,0,0);
    renderer.render(scene, camera);
  }, 16);

  gameLoop();
}

boot();
