/**
 * @fileoverview Diccionario Digital Interactivo — El cielo y los paisajes
 *
 * FLUJO:  PORTADA (video inicial) → PALABRAS (una por una) → JUEGO → FINAL
 *
 * PORTADA → la imagen de presentación en assets/img/portada.(jpg|png|webp). Si no
 * existe, se muestra una portada provisional.
 *
 * LECCIÓN → un VIDEO por palabra (en bucle, SIN sonido) y sus frases. La voz dice:
 * PALABRA (pausa) qué es (pausa) frase de ejemplo. Entre palabras hay fundido cruzado.
 *
 * JUEGO → los videos en recuadros, cada uno en bucle y de forma independiente;
 * se toca el video que responde a la pregunta ("¿Dónde está la nube?").
 *
 * VIDEOS: cada palabra usa dos archivos en assets/video/ — uno 4:3 para la lección
 * (nube.mp4) y uno cuadrado y liviano para el juego (nube_card.mp4).
 * Si falta el video de una palabra, se omite automáticamente.
 *
 * @version 2.0.0
 */

'use strict';

/* ============================================================
   DATOS
   ============================================================ */

const VID = './assets/video/';
const IS_IMAGE = /^data:image\/|\.(jpe?g|png|webp|gif|svg)(\?.*)?$/i;

/** Duración del fundido cruzado entre diapositivas (debe coincidir con el CSS: 1s). */
const TRANSITION_MS = 1000;

/** Pausa (ms) entre la palabra y cada frase al leer la lección. */
const PAUSE_MS = 900;

/** Imagen de portada: se usa la primera que exista (en este orden). */
const COVER_VIDEO = VID + 'portada.mp4';   // portada en video (bucle, sin sonido)
const COVER_CANDIDATES = ['portada.jpg', 'portada.jpeg', 'portada.png', 'portada.webp'].map((n) => './assets/img/' + n);
let COVER = null;

/** Portada provisional (SVG) mientras no exista assets/img/portada.*  */
const FALLBACK_COVER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
     <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0" stop-color="#d9f4d4"/><stop offset="1" stop-color="#fdebc8"/></linearGradient></defs>
     <rect width="800" height="600" fill="url(#g)"/>
     <g font-size="150" text-anchor="middle">
       <text x="200" y="260">☁️</text><text x="400" y="230">⚡</text><text x="600" y="260">🌧️</text>
       <text x="290" y="440">🏝️</text><text x="510" y="440">🌴</text>
     </g>
     <text x="400" y="545" font-family="Nunito,Segoe UI,sans-serif" font-weight="900"
           font-size="38" text-anchor="middle" fill="#4b2a99">EL CIELO Y LOS PAISAJES</text>
   </svg>`);


/** Las palabras. Si el archivo de video no existe, la palabra se omite. */
const ITEMS = [
  {
    id: 'nube', label: 'NUBE', icon: '☁️', color: '#12b5cf',
    say:      'Nube.',
    def:      'Es blanca, esponjosa y flota en el cielo.',
    example:  'Miro la nube pasar despacito.',
    question: '¿Dónde está la nube?',
    answer:   'Esta es la nube.',
    video: VID + 'nube.mp4',                  // lección (4:3)
    card:  VID + 'nube_card.mp4',             // juego (cuadrado, liviano)
  },
  {
    id: 'lluvia', label: 'LLUVIA', icon: '🌧️', color: '#3b7fd9',
    say:      'Lluvia.',
    def:      'Son gotas de agua que caen del cielo.',
    example:  'Abro mi paraguas cuando empieza a caer la lluvia.',
    question: '¿Dónde está la lluvia?',
    answer:   'Esta es la lluvia.',
    video: VID + 'lluvia.mp4',
    card:  VID + 'lluvia_card.mp4',
  },
  {
    id: 'rayo', label: 'RAYO', icon: '⚡', color: '#f5a300',
    say:      'Rayo.',
    def:      'Es una luz brillante y rápida que cruza el cielo cuando hay tormenta.',
    example:  'El rayo alumbró la ciudad.',
    question: '¿Dónde está el rayo?',
    answer:   'Este es el rayo.',
    video: VID + 'rayo.mp4',
    card:  VID + 'rayo_card.mp4',
  },
  {
    id: 'isla', label: 'ISLA', icon: '🏝️', color: '#2aa86a',
    say:      'Isla.',
    def:      'Es un trocito de tierra rodeado de agua.',
    example:  'Hay una palmera creciendo en la isla.',
    question: '¿Dónde está la isla?',
    answer:   'Esta es la isla.',
    video: VID + 'isla.mp4',
    card:  VID + 'isla_card.mp4',
  },
  {
    id: 'oasis', label: 'OASIS', icon: '🌴', color: '#e8742a',
    say:      'Oasis.',
    def:      'Es un lugar con agua y plantitas rodeado de arena.',
    example:  'El desierto tiene un oasis.',
    question: '¿Dónde está el oasis?',
    answer:   'Este es el oasis.',
    video: VID + 'oasis.mp4',
    card:  VID + 'oasis_card.mp4',
  },
];

/** Palabras con video disponible (se llena al iniciar). */
let ACTIVE = [];

/* ============================================================
   UTILIDADES
   ============================================================ */

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ============================================================
   VOZ VIRTUAL (SpeechSynthesis del navegador, sin archivos de audio)
   ============================================================ */

class VoiceManager {
  constructor() {
    this._synth  = 'speechSynthesis' in window ? window.speechSynthesis : null;
    this._voice  = null;
    this._muted  = false;
    this._timer  = 0;
    this._resolve = null;
    this._seq = 0;
    if (this._synth) {
      this._pickVoice();
      this._synth.addEventListener?.('voiceschanged', () => this._pickVoice());
    }
  }

  get muted()    { return this._muted; }
  get hasVoice() { return !!this._voice; }

  /** Elige la mejor voz en español disponible (prefiere es-PE / es-419 / es-US / es-MX). */
  _pickVoice() {
    const all = this._synth.getVoices();
    const es  = all.filter((v) => /^es([-_]|$)/i.test(v.lang));
    if (!es.length) { this._voice = null; return; }
    const rank = (v) => {
      const lang = v.lang.replace('_', '-').toLowerCase();
      const order = ['es-pe', 'es-419', 'es-us', 'es-mx', 'es-co', 'es-ar', 'es-es'];
      let s = order.indexOf(lang); s = s < 0 ? order.length : s;
      if (/google|natural|online|neural|premium|paulina|monica|sabina|helena|laura/i.test(v.name)) s -= 0.5;
      return s;
    };
    this._voice = es.sort((a, b) => rank(a) - rank(b))[0];
  }

  /** Lee el texto. Devuelve una promesa que se cumple al terminar (o al cancelarse). */
  speak(text) {
    this.stop();
    return this._say(text);
  }

  /** Dice un texto sin cancelar la secuencia en curso. */
  _say(text) {
    if (this._synth) this._synth.cancel();
    if (!this._synth || this._muted) return Promise.resolve();
    return new Promise((resolve) => {
      this._resolve = resolve;
      const u = new SpeechSynthesisUtterance(text);
      u.lang   = this._voice ? this._voice.lang : 'es-PE';
      if (this._voice) u.voice = this._voice;
      u.rate   = 0.9;     // un poco más lento para niños
      u.pitch  = 1.1;
      const done = () => { clearTimeout(this._timer); if (this._resolve === resolve) this._resolve = null; resolve(); };
      u.onend = done; u.onerror = done;
      // Respaldo: si el navegador nunca avisa que terminó
      this._timer = setTimeout(done, 1500 + text.length * 110);
      // Pequeño retraso: evita que cancel() + speak() seguidos se pierdan en Chrome
      setTimeout(() => { if (this._resolve === resolve) this._synth.speak(u); }, 60);
    });
  }

  /**
   * Lee varias partes con una PAUSA entre cada una:
   *   NUBE. (pausa) es blanca... (pausa) Miro la nube...
   * Se corta sola si otra acción llama a stop() o a speak().
   */
  async speakSequence(parts, pauseMs = 900) {
    this.stop();
    const id = ++this._seq;
    for (let i = 0; i < parts.length; i++) {
      if (id !== this._seq) return;
      await this._say(parts[i]);
      if (id !== this._seq) return;
      if (i < parts.length - 1) await sleep(pauseMs);
    }
  }

  stop() {
    this._seq++;
    clearTimeout(this._timer);
    if (this._synth) this._synth.cancel();
    if (this._resolve) { const r = this._resolve; this._resolve = null; r(); }
  }

  toggleMute() {
    this._muted = !this._muted;
    if (this._muted) this.stop();
    return this._muted;
  }
}

/** Comprueba si una imagen existe/carga. */
function probeImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload  = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

/** Comprueba si un video existe/carga. Solo se descarta si el navegador da error. */
function probeVideo(src) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    let finished = false;
    const done = (ok) => {
      if (finished) return;
      finished = true;
      v.onloadedmetadata = v.onerror = null;
      v.removeAttribute('src');
      resolve(ok);
    };
    v.onloadedmetadata = () => done(true);
    v.onerror = () => done(false);
    setTimeout(() => done(true), 4000);   // sin respuesta: se asume que existe
    v.src = src;
  });
}

/* ============================================================
   ESCENA (videos con fundido cruzado / tarjetas del juego)
   ============================================================ */

class SceneController {
  constructor(slidesEl, gridEl, stageEl) {
    this._slides  = slidesEl;
    this._grid    = gridEl;
    this._stage   = stageEl;
    this._layout  = stageEl.parentElement;   // .layout (se ensancha en el juego)
    this._current = null;
  }

  _makeSlide(src) {
    const slide = document.createElement('div');
    slide.className = 'slide';
    if (IS_IMAGE.test(src)) {
      slide.classList.add('is-cover');
      const img = document.createElement('img');
      img.className = 'slide-image';
      img.alt = 'El cielo y los paisajes';
      img.decoding = 'async';
      img.src = src;
      slide.appendChild(img);
      return slide;
    }
    const v = document.createElement('video');
    v.className = 'slide-video';
    v.muted = true;                       // los videos van siempre sin sonido
    v.defaultMuted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.setAttribute('disablepictureinpicture', '');
    v.src = src;
    slide.appendChild(v);
    return slide;
  }

  _lastVideo() { return this._slides.lastElementChild?.querySelector('video') || null; }

  /**
   * Muestra el video de una acción con fundido cruzado: el nuevo aparece ENCIMA
   * del anterior (que sigue reproduciéndose debajo), así nunca hay un cuadro vacío.
   * Si ya es el video actual, sigue reproduciéndose sin reiniciar.
   */
  async show(src, instant = false) {
    this._stage.classList.remove('is-game');
    this._layout.classList.remove('is-game');
    this._grid.hidden   = true;
    this._slides.hidden = false;

    if (src === this._current) {
      const cur = this._lastVideo();
      if (cur && cur.paused) cur.play().catch(() => {});
      return;
    }
    this._current = src;

    const slide = this._makeSlide(src);
    const m = slide.firstChild;
    const isImg = m.tagName === 'IMG';
    this._slides.appendChild(slide);

    // Esperar a que haya imagen lista (o 1.5 s como máximo) antes de mostrarlo
    await new Promise((resolve) => {
      if (isImg ? m.complete : m.readyState >= 2) { resolve(); return; }
      m.addEventListener(isImg ? 'load' : 'loadeddata', resolve, { once: true });
      m.addEventListener('error', resolve, { once: true });
      setTimeout(resolve, 1500);
    });
    if (!isImg) m.play().catch(() => {});

    if (instant) slide.classList.add('instant');
    void slide.offsetWidth;
    slide.classList.add('in');

    // Al terminar el fundido, se quitan (y detienen) los videos anteriores
    const cleanup = () => {
      while (slide.parentNode === this._slides && this._slides.firstChild !== slide) {
        const old = this._slides.firstChild;
        old.querySelector('video')?.pause();
        this._slides.removeChild(old);
      }
    };
    if (instant) cleanup(); else setTimeout(cleanup, TRANSITION_MS + 80);
  }

  /** Reinicia el video actual desde el principio (al repetir). */
  replay() {
    const v = this._lastVideo();
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  }

  /** Pantalla de inicio: la imagen de portada (o la portada provisional si falta). */
  showHome(instant = false) {
    if (COVER) return this.show(COVER, instant);
    return this.show(FALLBACK_COVER, instant);
  }

  /** Juego: pausa los videos de la lección y muestra las tarjetas. */
  showGame() {
    this._slides.querySelectorAll('video').forEach((v) => v.pause());
    this._slides.hidden = true;
    this._stage.classList.add('is-game');
    this._layout.classList.add('is-game');
    this._grid.hidden   = false;
  }
}

/* ============================================================
   ESTADO
   ============================================================ */

class StateManager {
  constructor() {
    this._mode  = 'welcome';
    this._epoch = 0;
  }
  get mode()  { return this._mode; }
  get epoch() { return this._epoch; }
  newEpoch()  { return ++this._epoch; }

  show(name) {
    this._mode = name;
    ['welcome', 'lesson', 'game', 'finish'].forEach((id) => { $(id).hidden = id !== name; });
    $('controls').hidden = name === 'welcome' || name === 'finish';
    $('prev').hidden     = name === 'game';
    $('next').hidden     = name === 'game';
  }

  updateProgress(current, total) {
    $('dots').innerHTML = Array.from({ length: total }, (_, n) => {
      const cls = n === current ? 'current' : n < current ? 'done' : '';
      return `<span class="dot ${cls}"></span>`;
    }).join('');
  }
}

/* ============================================================
   LECCIÓN
   ============================================================ */

class LessonMode {
  constructor(scene, state, voice) {
    this._scene = scene;
    this._state = state;
    this._voice = voice;
    this._index = 0;
  }

  get total() { return ACTIVE.length; }

  async goTo(i) {
    const token = this._reset();
    this._index = i;
    this._state.show('lesson');

    $('prev').disabled     = i === 0;
    $('next').textContent  = i === this.total - 1 ? 'JUGAR →' : 'SIGUIENTE →';
    $('count').textContent = `${i + 1} DE ${this.total}`;
    this._state.updateProgress(i, this.total);

    await this._play(i, token, false);
  }

  /** Muestra el texto y el video; la voz dice la palabra y luego sus frases, con pausas. */
  async _play(i, token, restart) {
    const a = ACTIVE[i];
    $('word').textContent       = a.label;
    $('word').style.setProperty('--w', a.color);
    $('word').className         = a.label.length >= 11 ? 'xlong' : a.label.length >= 8 ? 'long' : '';
    $('phrase').textContent     = a.def + '\n' + a.example;
    $('lessonIcon').textContent = a.icon;
    $('lessonIcon').hidden      = false;

    // PALABRA (pausa) qué es (pausa) frase de ejemplo
    this._voice.speakSequence([a.say, a.def, a.example], PAUSE_MS);
    await this._scene.show(a.video);
    if (restart) this._scene.replay();
  }

  /** Vuelve a mostrar el video desde el inicio y a decir la acción. */
  async repeat() {
    const token = this._reset();
    this._state.show('lesson');
    await this._play(this._index, token, true);
  }

  prev() { if (this._index > 0) this.goTo(this._index - 1); }

  next() {
    if (this._index < this.total - 1) { this.goTo(this._index + 1); return false; }
    return true; // → iniciar juego
  }

  _reset() {
    const token = this._state.newEpoch();
    this._voice.stop();
    $('celebration').hidden = true;
    $('stage').classList.remove('encourage');
    return token;
  }
}

/* ============================================================
   JUEGO
   ============================================================ */

class GameMode {
  constructor(scene, state, voice) {
    this._scene  = scene;
    this._state  = state;
    this._voice  = voice;
    this._queue  = [];
    this._turn   = 0;
    this._ready  = false;
    this._locked = false;
  }

  start() {
    this._scene.showGame();
    this._queue = shuffle(ACTIVE);
    this._turn  = 0;
    this._ask();
  }

  _ask() {
    const token = this._state.newEpoch();
    $('celebration').hidden = true;
    this._state.show('game');
    const cur = this._queue[this._turn];
    $('question').textContent  = cur.question;
    $('feedback').textContent  = '👆 TOCA EL VIDEO';
    $('gameCount').textContent = `${this._turn + 1} DE ${this._queue.length}`;

    // Todos los videos en recuadros, cada uno en bucle y por su cuenta.
    // Cambian de lugar en cada pregunta y empiezan en un punto distinto.
    const grid = $('gameGrid');
    grid.innerHTML = '';
    shuffle(ACTIVE).forEach((a, n) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'act-card';
      b.dataset.id = a.id;
      b.setAttribute('aria-label', `Video ${n + 1}`);
      const v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.preload = 'auto';
      v.setAttribute('disablepictureinpicture', '');
      v.addEventListener('loadedmetadata', () => {
        if (isFinite(v.duration)) v.currentTime = Math.random() * v.duration;
        v.play().catch(() => {});
      }, { once: true });
      v.src = a.card;
      b.appendChild(v);
      b.addEventListener('click', () => this.pick(b, token));
      grid.appendChild(b);
    });
    this._ready  = true;
    this._locked = false;
    this._voice.speak(cur.question);
  }

  repeatQuestion() {
    if (!this._locked && this._queue[this._turn]) this._voice.speak(this._queue[this._turn].question);
  }

  async pick(card, token) {
    if (!this._ready || this._locked || token !== this._state.epoch) return;
    this._locked = true;
    const cur = this._queue[this._turn];

    if (card.dataset.id === cur.id) {
      card.classList.add('correct');
      document.querySelectorAll('.act-card').forEach((c) => { c.disabled = true; if (c !== card) c.classList.add('dim'); });
      $('feedback').textContent = `¡MUY BIEN! ${cur.answer}`;
      $('celebration').hidden   = false;
      await Promise.all([sleep(2400), this._voice.speakSequence(['¡Muy bien!', cur.answer], 350)]);
      if (token !== this._state.epoch) return;
      this._turn++;
      if (this._turn < this._queue.length) this._ask();
      else this._finish();
    } else {
      card.classList.add('wrong', 'dim');
      card.disabled = true;
      $('feedback').textContent = '¡INTÉNTALO OTRA VEZ!';
      this._voice.speak('Inténtalo otra vez');
      await sleep(700);
      if (token !== this._state.epoch) return;
      card.classList.remove('wrong');
      $('feedback').textContent = '👆 TOCA EL VIDEO';
      this._locked = false;
    }
  }

  _finish() {
    this._state.newEpoch();
    $('celebration').hidden = true;
    this._state.show('finish');
    this._voice.speak('¡Excelente trabajo! ¡Ya conoces las palabras del cielo y los paisajes!');
  }
}

/* ============================================================
   APP
   ============================================================ */

class App {
  constructor() {
    this.scene  = new SceneController($('slides'), $('gameGrid'), $('stage'));
    this.voice  = new VoiceManager();
    this.state  = new StateManager();
    this.lesson = new LessonMode(this.scene, this.state, this.voice);
    this.game   = new GameMode(this.scene, this.state, this.voice);

    this.state.show('welcome');
    this._bind();
    this._voiceStatus();
    this._init();
  }

  /** Detecta la portada y qué videos existen, y muestra la pantalla de inicio. */
  async _init() {
    const [coverVideo, covers, ...found] = await Promise.all([
      probeVideo(COVER_VIDEO),
      Promise.all(COVER_CANDIDATES.map(probeImage)),
      ...ITEMS.map((a) => probeVideo(a.video)),
    ]);
    const ci = covers.indexOf(true);
    COVER  = coverVideo ? COVER_VIDEO : (ci >= 0 ? COVER_CANDIDATES[ci] : null);
    ACTIVE = ITEMS.filter((_, i) => found[i]);
    this.scene.showHome(true);
    if (!ACTIVE.length) {
      $('status').textContent = 'AGREGA LOS VIDEOS EN LA CARPETA assets/video/ (nube.mp4, lluvia.mp4, rayo.mp4…).';
      $('start').disabled = true;
    }
  }

  /** Aviso si el dispositivo no tiene voz en español. */
  _voiceStatus() {
    const show = () => {
      if ($('start').disabled) return;
      $('status').textContent = ('speechSynthesis' in window && !this.voice.hasVoice)
        ? 'SI NO ESCUCHAS LA VOZ, INSTALA UNA VOZ EN ESPAÑOL EN TU DISPOSITIVO.' : '';
    };
    setTimeout(show, 1500);
    window.speechSynthesis?.addEventListener?.('voiceschanged', show);
  }

  _bind() {
    $('start').onclick      = () => this.lesson.goTo(0);
    $('prev').onclick       = () => { if (this.state.mode === 'lesson') this.lesson.prev(); };
    $('next').onclick       = () => {
      if (this.state.mode === 'lesson' && this.lesson.next()) this.game.start();
    };
    $('listen').onclick     = () => { if (this.state.mode === 'lesson') this.lesson.repeat(); };
    $('repeat').onclick     = () => {
      if (this.state.mode === 'lesson') this.lesson.repeat();
      else if (this.state.mode === 'game') this.game.repeatQuestion();
    };
    $('home').onclick       = () => {
      this.state.newEpoch();
      this.voice.stop();
      $('celebration').hidden = true;
      this.scene.showHome();
      this.state.show('welcome');
    };
    $('again').onclick      = () => this.game.start();
    $('dictionary').onclick = () => this.lesson.goTo(0);

    $('sound').onclick = () => {
      const muted = this.voice.toggleMute();
      $('sound').setAttribute('aria-label', muted ? 'Activar voz' : 'Desactivar voz');
      $('sound').setAttribute('aria-pressed', String(!muted));
      if (!muted) {
        if (this.state.mode === 'lesson') this.lesson.repeat();
        else if (this.state.mode === 'game') this.game.repeatQuestion();
      }
    };

    document.addEventListener('visibilitychange', () => { if (document.hidden) this.voice.stop(); });
  }
}

const app = new App();
