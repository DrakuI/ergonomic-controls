/**
 * Teclas compostas: apertar mais de uma vez, segurar por um tempo, apertar juntas, em sequência.
 *
 * Um atalho composto é um código de tecla próprio, que o KeyboardManager do Foundry trata como qualquer outro:
 * - "Gesto:KeyQ,KeyQ"      Q duas vezes;
 * - "Gesto:KeyQ@1000"      Q segurado 1 s;
 * - "Gesto:KeyE+KeyQ"      E e Q juntas;
 * - "Gesto:KeyQ,KeyE"      Q e depois E;
 * - "Gesto:KeyQ,KeyQ@500"  Q, e Q de novo segurado 0,5 s.
 * Cada pressão lista as teclas (em ordem alfabética, "+") e o tempo de segurar ("@ms"); as pressões vêm em ordem
 * (","). Caracteres de separação dentro de um código (ids de controle) vão como %XX.
 *
 * O Reconhecedor fica entre os eventos e game.keyboard._processKeyboardContext:
 * - tecla que não começa nenhum composto (com os modificadores apertados) passa direto, sem atraso;
 * - tecla que começa um composto só é retida quando a ação dela sozinha é de um toque; ação contínua ou de segurar
 *   (movimento, câmera, destacar) passa na hora e o composto dispara junto;
 * - a retenção dura só até decidir: acorde em até TEMPOS.juntas, segurar até soltar ou atingir o tempo, sequência
 *   até TEMPOS.sequencia depois de soltar; outra tecla apertada no meio decide na hora;
 * - sem composto reconhecido, os eventos retidos seguem para o Foundry na ordem em que aconteceram.
 */

export const PREFIXO = "Gesto:";

/** Janelas em ms: teclas juntas (acorde), intervalo entre pressões de uma sequência, início do segurar. */
export const TEMPOS = Object.freeze({ juntas: 80, sequencia: 250, segurar: 400 });

/** Segurar gravado na captura: passos de 0,5 s, de 0,5 s a 5 s. */
export const SEGURAR = Object.freeze({ passo: 500, minimo: 500, maximo: 5000 });

/** Pressões por composto e teclas por pressão. */
export const LIMITES = Object.freeze({ pressoes: 4, teclas: 3 });

const codificar = (code) => code.replace(/[%,+@]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
const decodificar = (code) => code.replace(/%([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

export const ehGesto = (code) => (typeof code === "string") && code.startsWith(PREFIXO);

/** Tempo de segurar medido na captura, em passos. */
export function arredondarSegurar(ms) {
  return Math.min(SEGURAR.maximo, Math.max(SEGURAR.minimo, Math.round(ms / SEGURAR.passo) * SEGURAR.passo));
}

/**
 * @typedef {{teclas: string[], segurar: number}} Pressao
 * @typedef {{pressoes: Pressao[], todas: Set<string>}} Gesto
 */

/**
 * @param {Pressao[]} pressoes
 * @returns {string}
 */
export function escreverGesto(pressoes) {
  return PREFIXO + pressoes.map((p) => [...p.teclas].sort().map(codificar).join("+")
    + (p.segurar ? `@${Math.round(p.segurar)}` : "")).join(",");
}

/**
 * Lê um código composto; null se não for composto ou se for inválido. Uma pressão de uma tecla sem segurar é tecla
 * comum, não composto.
 * @param {string} code
 * @returns {Gesto|null}
 */
export function lerGesto(code) {
  if (!ehGesto(code)) return null;
  const corpo = code.slice(PREFIXO.length);
  if (!corpo) return null;
  const pressoes = [];
  for (const parte of corpo.split(",")) {
    const m = /^([^@]+)(?:@(\d+))?$/.exec(parte);
    if (!m) return null;
    const teclas = m[1].split("+").map(decodificar);
    if (teclas.some((c) => !c) || (teclas.length > LIMITES.teclas) || (new Set(teclas).size !== teclas.length)) return null;
    const segurar = m[2] ? Number(m[2]) : 0;
    if (segurar && ((segurar < TEMPOS.segurar) || (segurar > SEGURAR.maximo))) return null;
    pressoes.push({ teclas: teclas.sort(), segurar });
  }
  if (!pressoes.length || (pressoes.length > LIMITES.pressoes)) return null;
  if ((pressoes.length === 1) && (pressoes[0].teclas.length === 1) && !pressoes[0].segurar) return null;
  return { pressoes, todas: new Set(pressoes.flatMap((p) => p.teclas)) };
}

/** Teclas físicas de um código, composto ou não. */
export function teclasDe(code) {
  const g = lerGesto(code);
  return g ? [...g.todas] : [code];
}

/**
 * Pressões a partir dos eventos de apertar e soltar, em ordem. Uma pressão junta as teclas apertadas até `juntas` ms
 * depois da primeira, enquanto nenhuma foi solta; termina quando todas são soltas.
 * @param {{code: string, up: boolean, t: number}[]} eventos
 * @param {number} [juntas]
 */
export function montarPressoes(eventos, juntas = TEMPOS.juntas) {
  const lista = [];
  for (const ev of eventos) {
    if (!ev.up) {
      const atual = lista.at(-1);
      if (atual && (atual.fim === null) && !atual.soltou && !atual.teclas.has(ev.code) && ((ev.t - atual.inicio) <= juntas)) {
        atual.teclas.add(ev.code);
        atual.apertadas.add(ev.code);
      }
      else lista.push({ teclas: new Set([ev.code]), apertadas: new Set([ev.code]), inicio: ev.t, fim: null, soltou: false });
      continue;
    }
    for (let i = lista.length - 1; i >= 0; i--) {
      const p = lista[i];
      if (!p.apertadas.has(ev.code)) continue;
      p.apertadas.delete(ev.code);
      p.soltou = true;
      if (!p.apertadas.size) p.fim = ev.t;
      break;
    }
  }
  return lista;
}

/**
 * Compara as pressões vistas até `t` com um composto.
 * - completo: o composto aconteceu (a última pressão de toque completa já conta, sem esperar soltar; a de segurar
 *   conta ao atingir o tempo);
 * - possivel: ainda pode acontecer com o que vier;
 * - prazo: quando a resposta muda sem evento novo (fim da janela de acorde ou de sequência, tempo de segurar).
 * @param {Gesto} g
 * @param {ReturnType<typeof montarPressoes>} pressoes
 * @param {number} t
 * @param {typeof TEMPOS} [tempos]
 * @returns {{completo: boolean, possivel: boolean, prazo: number|null}}
 */
export function comparar(g, pressoes, t, tempos = TEMPOS) {
  const nao = { completo: false, possivel: false, prazo: null };
  const total = g.pressoes.length;
  if (pressoes.length > total) return nao;
  for (let i = 0; i < pressoes.length; i++) {
    const p = pressoes[i];
    const gp = g.pressoes[i];
    const ultimaVista = i === (pressoes.length - 1);
    const ultimaDoGesto = i === (total - 1);
    if ((i > 0) && ((p.inicio - pressoes[i - 1].fim) > tempos.sequencia)) return nao;
    if (!ultimaVista && (p.fim === null)) return nao;
    if (![...p.teclas].every((c) => gp.teclas.includes(c))) return nao;
    if (p.teclas.size < gp.teclas.length) {
      // Acorde se formando: só enquanto a janela está aberta e nenhuma tecla foi solta.
      if (p.soltou || ((t - p.inicio) > tempos.juntas)) return nao;
      return { completo: false, possivel: true, prazo: p.inicio + tempos.juntas };
    }
    if (p.fim !== null) {
      const dur = p.fim - p.inicio;
      if (!gp.segurar && (dur >= tempos.segurar)) return nao;
      if (gp.segurar && (dur < gp.segurar)) return nao;
      continue;
    }
    const dur = t - p.inicio;
    if (!gp.segurar) {
      if (dur >= tempos.segurar) return nao;
      if (ultimaDoGesto) return { completo: true, possivel: false, prazo: null };
      return { completo: false, possivel: true, prazo: p.inicio + tempos.segurar };
    }
    if (dur >= gp.segurar) {
      if (ultimaDoGesto) return { completo: true, possivel: false, prazo: null };
      return { completo: false, possivel: true, prazo: null };
    }
    return { completo: false, possivel: true, prazo: p.inicio + gp.segurar };
  }
  if (pressoes.length === total) return { completo: true, possivel: false, prazo: null };
  const fim = pressoes.at(-1).fim;
  if ((t - fim) > tempos.sequencia) return nao;
  return { completo: false, possivel: true, prazo: fim + tempos.sequencia };
}

/** Mais pressões, depois o segurar mais longo na última, depois mais teclas. */
function melhor(lista) {
  const peso = (g) => [g.pressoes.length, g.pressoes.at(-1).segurar, g.todas.size];
  return [...lista].sort((a, b) => {
    const pa = peso(a);
    const pb = peso(b);
    return (pb[0] - pa[0]) || (pb[1] - pa[1]) || (pb[2] - pa[2]);
  })[0];
}

/**
 * Reconhecedor de compostos sobre contextos de teclado do Foundry ({key, up, repeat, isShift, isControl, isAlt, …}).
 * Sem Foundry: tudo o que depende dele chega pelos ganchos.
 */
export class Reconhecedor {
  /** Eventos da tentativa atual: {code, up, t, context, entregue}. */
  #eventos = [];
  /** Compostos possíveis na tentativa atual (com `code`). */
  #candidatos = [];
  /** Teclas acompanhadas enquanto apertadas: {entregue, reconhecendo, gesto}. */
  #fisicas = new Map();
  /** Compostos disparados com teclas ainda apertadas: código → teclas. */
  #ativos = new Map();
  /** Composto completo com mais por vir: {gesto, n}. */
  #ultimo = null;
  #timer = null;

  /**
   * @param {object} o
   * @param {(context: object) => void} o.seguir            Entrega ao KeyboardManager.
   * @param {(context: object) => (Gesto & {code: string})[]} o.iniciais  Compostos que podem começar com esta
   *   tecla, com os modificadores do evento.
   * @param {(context: object) => boolean} o.reter          A tecla sozinha tem ação de um toque (espera o composto).
   * @param {(code: string, up: boolean, base: object, repeat?: boolean) => object} o.sintetico  Contexto de um
   *   composto com os modificadores de `base`.
   * @param {() => number} [o.agora]
   * @param {(fn: Function, ms: number) => any} [o.agendar]
   * @param {(id: any) => void} [o.cancelar]
   * @param {typeof TEMPOS} [o.tempos]
   */
  constructor({ seguir, iniciais, reter, sintetico, agora, agendar, cancelar, tempos }) {
    this.seguir = seguir;
    this.iniciais = iniciais;
    this.reter = reter;
    this.sintetico = sintetico;
    this.agora = agora ?? (() => performance.now());
    this.agendar = agendar ?? ((fn, ms) => setTimeout(fn, ms));
    this.cancelar = cancelar ?? ((id) => clearTimeout(id));
    this.tempos = tempos ?? TEMPOS;
  }

  /** Nada retido, nenhum composto aberto, nenhuma tecla acompanhada. */
  get ocioso() {
    return !this.#eventos.length && !this.#ativos.size && !this.#fisicas.size;
  }

  /** A tecla está sendo acompanhada (apertada numa tentativa ou num composto aberto). */
  acompanha(code) {
    return this.#fisicas.has(code);
  }

  /** @param {object} context */
  receber(context) {
    const code = context.key;
    const t = this.agora();
    const fis = this.#fisicas.get(code);
    if (context.up) return fis ? this.#soltar(context, fis, t) : this.seguir(context);
    if (fis) return this.#repetir(context, fis);
    if (context.repeat) return this.seguir(context);
    return this.#apertar(context, t);
  }

  /** Decide o que está retido (campo de texto ganhou o foco, por exemplo). */
  esvaziar() {
    this.#finalizar(this.agora());
  }

  /** Janela perdeu o foco: descarta o retido e solta os compostos abertos. */
  abandonar() {
    this.#limpar();
    for (const code of this.#ativos.keys()) this.seguir(this.sintetico(code, true, {}));
    this.#ativos.clear();
    this.#fisicas.clear();
  }

  #apertar(context, t) {
    const code = context.key;
    if (this.#eventos.length) {
      const ev = { code, up: false, t, context, entregue: false };
      this.#eventos.push(ev);
      const estado = this.#estado(t);
      if (estado.completos.length || estado.possivel) {
        ev.entregue = !this.reter(context);
        if (ev.entregue) this.seguir(context);
        this.#fisicas.set(code, { entregue: ev.entregue, reconhecendo: true, gesto: null });
        return this.#decidir(t);
      }
      // A tecla nova não cabe em nenhum composto em andamento: ele se decide agora.
      this.#eventos.pop();
      this.#finalizar(t);
    }
    const iniciais = this.iniciais(context);
    if (!iniciais.length) return this.seguir(context);
    this.#candidatos = iniciais;
    const entregue = !this.reter(context);
    if (entregue) this.seguir(context);
    this.#eventos.push({ code, up: false, t, context, entregue });
    this.#fisicas.set(code, { entregue, reconhecendo: true, gesto: null });
    this.#decidir(t);
  }

  #repetir(context, fis) {
    if (fis.gesto && this.#ativos.has(fis.gesto)) this.seguir(this.sintetico(fis.gesto, false, context, true));
    if (fis.entregue) this.seguir(context);
  }

  #soltar(context, fis, t) {
    const code = context.key;
    this.#fisicas.delete(code);
    if (fis.entregue) this.seguir(context);
    if (fis.reconhecendo) {
      this.#eventos.push({ code, up: true, t, context, entregue: fis.entregue });
      return this.#decidir(t);
    }
    if (!fis.gesto) return;
    const ativo = this.#ativos.get(fis.gesto);
    if (!ativo) return;
    ativo.delete(code);
    if (ativo.size) return;
    this.#ativos.delete(fis.gesto);
    this.seguir(this.sintetico(fis.gesto, true, context));
  }

  #estado(t) {
    const pressoes = montarPressoes(this.#eventos, this.tempos.juntas);
    const completos = [];
    let possivel = false;
    let prazo = null;
    for (const g of this.#candidatos) {
      const r = comparar(g, pressoes, t, this.tempos);
      if (r.completo) completos.push(g);
      if (r.possivel) possivel = true;
      if (r.prazo !== null) prazo = (prazo === null) ? r.prazo : Math.min(prazo, r.prazo);
    }
    return { completos, possivel, prazo };
  }

  #decidir(t) {
    this.#pararTimer();
    if (!this.#eventos.length) return;
    const estado = this.#estado(t);
    if (!estado.possivel) {
      if (estado.completos.length) return this.#disparar(melhor(estado.completos), this.#eventos.length);
      return this.#falhar();
    }
    if (estado.completos.length) this.#ultimo = { gesto: melhor(estado.completos), n: this.#eventos.length };
    if (estado.prazo !== null) {
      this.#timer = this.agendar(() => {
        this.#timer = null;
        this.#decidir(this.agora());
      }, Math.max(0, estado.prazo - t) + 1);
    }
  }

  /** Nada mais entra na tentativa atual. */
  #finalizar(t) {
    this.#pararTimer();
    if (!this.#eventos.length) return;
    const estado = this.#estado(t);
    if (estado.completos.length) return this.#disparar(melhor(estado.completos), this.#eventos.length);
    this.#falhar();
  }

  #falhar() {
    const ultimo = this.#ultimo;
    if (ultimo) return this.#disparar(ultimo.gesto, ultimo.n);
    const eventos = this.#eventos;
    this.#limpar();
    this.#entregar(eventos);
  }

  /**
   * Dispara o composto com os `n` primeiros eventos; o resto segue como teclas comuns.
   * @param {Gesto & {code: string}} gesto
   * @param {number} n
   */
  #disparar(gesto, n) {
    const usados = this.#eventos.slice(0, n);
    const resto = this.#eventos.slice(n);
    this.#limpar();
    const base = usados.findLast((e) => !e.up)?.context ?? usados.at(-1).context;
    this.seguir(this.sintetico(gesto.code, false, base));
    const presas = new Set();
    for (const code of gesto.pressoes.at(-1).teclas) {
      const fis = this.#fisicas.get(code);
      if (!fis?.reconhecendo || resto.some((e) => e.code === code)) continue;
      fis.reconhecendo = false;
      fis.gesto = gesto.code;
      presas.add(code);
    }
    if (presas.size) this.#ativos.set(gesto.code, presas);
    else this.seguir(this.sintetico(gesto.code, true, base));
    this.#entregar(resto);
  }

  /** Entrega os eventos retidos na ordem; tecla ainda apertada passa a seguir direto. */
  #entregar(eventos) {
    for (const ev of eventos) {
      if (!ev.entregue) this.seguir(ev.context);
      if (ev.up) continue;
      const fis = this.#fisicas.get(ev.code);
      if (!fis?.reconhecendo) continue;
      fis.reconhecendo = false;
      fis.entregue = true;
    }
  }

  #limpar() {
    this.#pararTimer();
    this.#eventos = [];
    this.#candidatos = [];
    this.#ultimo = null;
  }

  #pararTimer() {
    if (this.#timer === null) return;
    this.cancelar(this.#timer);
    this.#timer = null;
  }
}

/* -------------------------------------------- */
/*  Foundry                                     */
/* -------------------------------------------- */

const MARCA = Symbol.for("ergonomic-controls.gestos");

/** Teclas de cada modificador do contexto do KeyboardManager. */
const TECLAS_DO_MODIFICADOR = {
  isShift: ["ShiftLeft", "ShiftRight"],
  isControl: ["ControlLeft", "ControlRight", "MetaLeft", "MetaRight", "Meta", "OsLeft", "OsRight"],
  isAlt: ["AltLeft", "AltRight"]
};

/**
 * Contexto sem os modificadores que vêm das próprias teclas do composto (Shift duas vezes: o Shift apertado não é
 * modificador do atalho).
 * @param {object} context
 * @param {Set<string>} teclas
 */
function semModificadoresProprios(context, teclas) {
  const limpo = { ...context };
  for (const [flag, codes] of Object.entries(TECLAS_DO_MODIFICADOR)) {
    if (codes.some((c) => teclas.has(c))) limpo[flag] = false;
  }
  limpo.hasModifier = Boolean(limpo.isShift || limpo.isControl || limpo.isAlt);
  limpo.modifiers = [["isShift", "Shift"], ["isControl", "Control"], ["isAlt", "Alt"]].filter(([f]) => limpo[f]).map(([, m]) => m);
  return limpo;
}
const indice = { mapa: null, gestos: [], iniciais: new Map() };
let reconhecedor = null;

/** Compostos com atalho, a partir de game.keybindings.activeKeys (o Foundry troca o Map a cada mudança). */
function atualizarIndice() {
  const ativos = game.keybindings?.activeKeys;
  if (!ativos || (indice.mapa === ativos)) return;
  indice.mapa = ativos;
  indice.gestos = [];
  indice.iniciais = new Map();
  for (const code of ativos.keys()) {
    const g = lerGesto(code);
    if (!g) continue;
    const item = { code, ...g };
    indice.gestos.push(item);
    for (const tecla of g.pressoes[0].teclas) {
      if (!indice.iniciais.has(tecla)) indice.iniciais.set(tecla, []);
      indice.iniciais.get(tecla).push(item);
    }
  }
}

/** Compostos em uso agora (com atalho). */
export function compostosAtivos() {
  atualizarIndice();
  return indice.gestos;
}

/**
 * Liga o reconhecedor ao KeyboardManager (game.keyboard._processKeyboardContext, chamado para teclado, botões do
 * mouse convertidos e controle). Contextos forçados (emulateKeypress) e os do próprio reconhecedor passam direto.
 */
export function instalar() {
  const km = game.keyboard;
  if (!km || km[MARCA]) return;
  const KM = km.constructor;
  const original = km._processKeyboardContext;
  const seguir = (context, opcoes) => original.call(km, context, opcoes);
  const testar = (context) => KM._getMatchingActions(context);
  reconhecedor = new Reconhecedor({
    seguir: (context) => seguir(context),
    iniciais: (context) => (indice.iniciais.get(context.key) ?? []).filter((g) => testar({
      ...semModificadoresProprios(context, g.todas), key: g.code, logicalKey: g.code, up: false, repeat: false
    }).length),
    reter: (context) => {
      const acoes = testar({ ...context, up: false, repeat: false });
      const discreta = acoes.some((a) => !a.repeat && !a.onUp);
      if (discreta) context.event?.preventDefault?.();
      return discreta;
    },
    sintetico: (code, up, base, repeat = false) => {
      const limpo = semModificadoresProprios(base, lerGesto(code)?.todas ?? new Set());
      const event = new KeyboardEvent(up ? "keyup" : "keydown", {
        code, key: "Unidentified", repeat,
        shiftKey: Boolean(limpo.isShift), ctrlKey: Boolean(limpo.isControl), altKey: Boolean(limpo.isAlt)
      });
      const context = KM.getKeyboardEventContext(event, up);
      context.ergonomicControls = true;
      return context;
    }
  });
  km._processKeyboardContext = function (context, opcoes = {}) {
    if (opcoes?.force || context?.ergonomicControls) return seguir(context, opcoes);
    atualizarIndice();
    if (!indice.gestos.length && reconhecedor.ocioso) return seguir(context, opcoes);
    if (km.hasFocus) {
      reconhecedor.esvaziar();
      if (context.up && reconhecedor.acompanha(context.key)) return reconhecedor.receber(context);
      return seguir(context, opcoes);
    }
    return reconhecedor.receber(context);
  };
  km[MARCA] = true;
  window.addEventListener("blur", () => reconhecedor.abandonar());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) reconhecedor.abandonar();
  });
}
