/**
 * Modelo de ergonomia dos controles: geometria do teclado, do mouse e do controle, zonas de alcance e avaliação de
 * um atalho. Sem dependência do Foundry: o que vem dele chega por parâmetro.
 *
 * Fundamentos:
 * - Posição de jogo: uma mão nas teclas de movimento do token e a outra no mouse. Com o movimento no WASD (padrão do
 *   Foundry), mão esquerda no WASD (médio no W, anelar no A, indicador no D, mindinho em Shift e Ctrl, polegar no
 *   espaço) e direita no mouse; com o movimento nas setas, no teclado numérico ou em letras da direita, a mão direita
 *   fica nelas e a esquerda no mouse. As teclas do movimento são stone keys: a mão mora nelas.
 * - Keystroke-Level Model (Card, Moran e Newell, 1983): levar a mão entre teclado e mouse (operador H) custa cerca
 *   de 0,4 s em cada sentido; cada Shift ou Ctrl é um toque à parte (operador K).
 * - No controle, os dedos não saem do lugar para nenhum botão; o custo está em apertar dois botões ao mesmo tempo.
 * - Princípios de arranjo de controles: o mais importante e o mais usado ficam mais acessíveis; o que é usado em
 *   sequência fica junto.
 * - Diretrizes de acessibilidade de jogos (Game Accessibility Guidelines; Xbox Accessibility Guideline 107): evitar
 *   teclas simultâneas e botões segurados, controles simples e remapeáveis, perfis.
 * - Lei de Hick-Hyman: o tempo de decisão cresce com o número de opções.
 * - Relatos de jogadores (fóruns de jogos, Reddit): toque duplo é rejeitado nas teclas de movimento (dispara sem
 *   querer) e atrasa a tecla sozinha; segurar é aceito em ação séria ou rara e rejeitado na rotina; botões laterais
 *   do mouse são o lugar preferido para esquiva e ações frequentes; apertos simultâneos precisam de janela
 *   (QMK usa 50 ms; jogos de luta com 1 quadro são difíceis).
 */

import { lerGesto, teclasDe, TEMPOS } from "./gestos.mjs";

/** Níveis de alcance, do melhor ao pior. */
export const NIVEL = Object.freeze({ NA_MAO: 0, PERTO: 1, ESTICAR: 2, TROCA: 3, EVITAR: 4 });
export const NIVEIS = ["naMao", "perto", "esticar", "troca", "evitar"];

/* -------------------------------------------- */
/*  Teclado                                     */
/* -------------------------------------------- */

/** Geometria em unidades de tecla (1u); x e y no canto superior esquerdo. Layout ISO/ABNT2 completo. */
export const TECLADO = (() => {
  const teclas = [];
  const linha = (y, itens) => {
    for (const [code, x, w = 1, h = 1] of itens) teclas.push({ code, x, y, w, h });
  };
  const fileira = (y, x0, codes) => codes.forEach((code, i) => teclas.push({ code, x: x0 + i, y, w: 1, h: 1 }));
  linha(0, [["Escape", 0]]);
  fileira(0, 2, ["F1", "F2", "F3", "F4"]);
  fileira(0, 6.5, ["F5", "F6", "F7", "F8"]);
  fileira(0, 11, ["F9", "F10", "F11", "F12"]);
  fileira(0, 15.25, ["PrintScreen", "ScrollLock", "Pause"]);
  fileira(1.25, 0, ["Backquote", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8",
    "Digit9", "Digit0", "Minus", "Equal"]);
  linha(1.25, [["Backspace", 13, 2]]);
  fileira(1.25, 15.25, ["Insert", "Home", "PageUp"]);
  fileira(1.25, 18.5, ["NumLock", "NumpadDivide", "NumpadMultiply", "NumpadSubtract"]);
  linha(2.25, [["Tab", 0, 1.5]]);
  fileira(2.25, 1.5, ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft",
    "BracketRight"]);
  linha(2.25, [["Enter", 13.75, 1.25, 2]]);
  fileira(2.25, 15.25, ["Delete", "End", "PageDown"]);
  fileira(2.25, 18.5, ["Numpad7", "Numpad8", "Numpad9"]);
  linha(2.25, [["NumpadAdd", 21.5, 1, 2]]);
  linha(3.25, [["CapsLock", 0, 1.75]]);
  fileira(3.25, 1.75, ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote",
    "Backslash"]);
  fileira(3.25, 18.5, ["Numpad4", "Numpad5", "Numpad6"]);
  linha(4.25, [["ShiftLeft", 0, 1.25]]);
  fileira(4.25, 1.25, ["IntlBackslash", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period",
    "Slash", "IntlRo"]);
  linha(4.25, [["ShiftRight", 13.25, 1.75], ["ArrowUp", 16.25]]);
  fileira(4.25, 18.5, ["Numpad1", "Numpad2", "Numpad3"]);
  linha(4.25, [["NumpadEnter", 21.5, 1, 2]]);
  linha(5.25, [["ControlLeft", 0, 1.25], ["MetaLeft", 1.25, 1.25], ["AltLeft", 2.5, 1.25], ["Space", 3.75, 6.25],
    ["AltRight", 10, 1.25], ["MetaRight", 11.25, 1.25], ["ContextMenu", 12.5, 1.25], ["ControlRight", 13.75, 1.25],
    ["ArrowLeft", 15.25], ["ArrowDown", 16.25], ["ArrowRight", 17.25], ["Numpad0", 18.5, 2], ["NumpadDecimal", 20.5]]);
  return Object.freeze(teclas.map(Object.freeze));
})();

export const LARGURA_TECLADO = 22.5;
export const ALTURA_TECLADO = 6.25;

/** Rótulos padrão (layout americano); o layout do navegador, quando disponível, substitui os de caractere. */
const ROTULOS = {
  Escape: "Esc", Backspace: "⌫", Tab: "Tab", CapsLock: "Caps", Enter: "Enter", ShiftLeft: "Shift",
  ShiftRight: "Shift", ControlLeft: "Ctrl", ControlRight: "Ctrl", MetaLeft: "⊞", MetaRight: "⊞", AltLeft: "Alt",
  AltRight: "AltGr", ContextMenu: "☰", Space: "", PrintScreen: "PrtSc", ScrollLock: "ScrLk", Pause: "Pause",
  Insert: "Ins", Home: "Home", PageUp: "PgUp", Delete: "Del", End: "End", PageDown: "PgDn", ArrowUp: "↑",
  ArrowLeft: "←", ArrowDown: "↓", ArrowRight: "→", NumLock: "Num", NumpadDivide: "/", NumpadMultiply: "*",
  NumpadSubtract: "−", NumpadAdd: "+", NumpadEnter: "Enter", NumpadDecimal: ".", Backquote: "`", Minus: "-",
  Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\", Semicolon: ";", Quote: "'", Comma: ",",
  Period: ".", Slash: "/", IntlBackslash: "\\", IntlRo: "/"
};

/**
 * Rótulo curto de uma tecla física.
 * @param {string} code
 * @param {Map<string, string>} [layout]  Resultado de `navigator.keyboard.getLayoutMap()`.
 */
export function rotuloTecla(code, layout) {
  const doLayout = layout?.get?.(code);
  if (doLayout && (doLayout.trim().length === 1)) return doLayout.toUpperCase();
  if (code in ROTULOS) return ROTULOS[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return code.slice(6);
  return code;
}

/** Códigos de modificador como o Foundry agrupa (KeyboardManager.MODIFIER_CODES). */
export const CODIGOS_MODIFICADORES = Object.freeze({
  Control: ["ControlLeft", "ControlRight", "MetaLeft", "MetaRight", "Meta", "OsLeft", "OsRight"],
  Shift: ["ShiftLeft", "ShiftRight"],
  Alt: ["AltLeft", "AltRight"]
});
const TECLAS_MODIFICADORAS = new Set(Object.values(CODIGOS_MODIFICADORES).flat());
export const ehModificador = (code) => TECLAS_MODIFICADORAS.has(code);

/* -------------------------------------------- */
/*  Mãos e alcance                              */
/* -------------------------------------------- */

/** Teclas tomadas pelo sistema (stone keys do teclado): Windows, menu de contexto e as travas. */
const SISTEMA = new Set(["MetaLeft", "MetaRight", "OsLeft", "OsRight", "ContextMenu", "PrintScreen", "ScrollLock",
  "NumLock", "CapsLock"]);
export const ehDoSistema = (code) => SISTEMA.has(code);

/** Centro de cada tecla, em unidades. */
const CENTRO = new Map(TECLADO.map((t) => [t.code, { x: t.x + (t.w / 2), y: t.y + (t.h / 2) }]));

/** Fileiras de caractere, da esquerda para a direita (para deslocar o modelo do WASD: ESDF, RDFG…). */
const FILEIRAS = [
  ["Backquote", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0",
    "Minus", "Equal"],
  ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight"],
  ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Backslash"],
  ["IntlBackslash", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash", "IntlRo"]
];

/** Nível de cada tecla com a mão esquerda no WASD; o que não está aqui fica para a outra mão. */
const MODELO_WASD = (() => {
  const m = new Map();
  const nivel = (n, codes) => { for (const c of codes) m.set(c, n); };
  // Sem mexer a mão.
  nivel(0, ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyA", "KeyS", "KeyD", "KeyF", "KeyZ", "KeyX", "KeyC", "KeyV", "Digit1",
    "Digit2", "Digit3", "Digit4", "Tab", "Space", "ShiftLeft", "ControlLeft", "AltLeft"]);
  // O dedo estica; a mão fica.
  nivel(1, ["Digit5", "KeyT", "KeyG", "KeyB", "Backquote", "IntlBackslash"]);
  // A mão sai do lugar.
  nivel(2, ["Digit6", "KeyY", "KeyH", "KeyN", "Escape", "F1", "F2", "F3", "F4"]);
  return m;
})();

/** Mão direita nas setas (indicador no ←, médio no ↓ e ↑, anelar no →); a esquerda no mouse. */
const MODELO_SETAS = (() => {
  const m = new Map();
  const nivel = (n, codes) => { for (const c of codes) m.set(c, n); };
  nivel(0, ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ControlRight", "Numpad0", "Numpad1"]);
  nivel(1, ["ShiftRight", "AltRight", "Numpad2", "Numpad3", "NumpadDecimal", "NumpadEnter", "Slash", "IntlRo"]);
  nivel(2, ["Delete", "End", "PageDown", "Enter", "Numpad4", "Numpad5", "Numpad6", "Period", "Comma", "Quote",
    "Backslash"]);
  return m;
})();

/** Mão direita no teclado numérico (indicador no 4, médio no 5 e 8, anelar no 6, polegar no 0); a esquerda no mouse. */
const MODELO_NUMERICO = (() => {
  const m = new Map();
  const nivel = (n, codes) => { for (const c of codes) m.set(c, n); };
  nivel(0, ["Numpad0", "Numpad1", "Numpad2", "Numpad3", "Numpad4", "Numpad5", "Numpad6", "Numpad7", "Numpad8",
    "Numpad9", "NumpadDecimal", "NumpadEnter", "NumpadAdd", "NumpadSubtract", "NumpadMultiply", "NumpadDivide"]);
  nivel(1, ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Delete", "End", "PageDown"]);
  nivel(2, ["Insert", "Home", "PageUp", "ControlRight", "ShiftRight", "Enter"]);
  return m;
})();

/** Modelo do WASD deslocado `delta` teclas nas fileiras de caractere (ESDF = 1); o resto continua igual. */
function modeloDeslocado(delta) {
  if (!delta) return MODELO_WASD;
  const m = new Map(MODELO_WASD);
  for (const fileira of FILEIRAS) {
    for (const c of fileira) m.delete(c);
    fileira.forEach((c, i) => {
      const origem = fileira[Math.min(Math.max(i - delta, 0), fileira.length - 1)];
      if (MODELO_WASD.has(origem)) m.set(c, MODELO_WASD.get(origem));
    });
  }
  return m;
}

/** Nível pela distância (em teclas) até a tecla de movimento mais próxima: letras da direita (IJKL…). */
function modeloPorDistancia(casa) {
  const m = new Map();
  const pontos = [...casa].map((c) => CENTRO.get(c)).filter(Boolean);
  for (const t of TECLADO) {
    if (SISTEMA.has(t.code)) continue;
    const c = CENTRO.get(t.code);
    const d = Math.min(...pontos.map((p) => Math.hypot(p.x - c.x, (p.y - c.y) * 1.1)));
    if (d <= 1.6) m.set(t.code, 0);
    else if (d <= 2.6) m.set(t.code, 1);
    else if (d <= 3.6) m.set(t.code, 2);
  }
  return m;
}

/** Grupo de uma tecla de movimento: letras da esquerda, letras da direita, setas ou teclado numérico. */
function grupoDoMovimento(code) {
  if (code.startsWith("Numpad")) return "numerico";
  if (code.startsWith("Arrow")) return "setas";
  return (CENTRO.get(code).x < 7.5) ? "esquerda" : "direitaLetras";
}

const X_DO_WASD = ["KeyW", "KeyA", "KeyS", "KeyD"].reduce((s, c) => s + CENTRO.get(c).x, 0) / 4;

/**
 * Onde ficam as mãos, pelas teclas de movimento do token: o maior grupo delas (empate: o do primeiro atalho) é a casa
 * de uma mão; a outra fica no mouse. Sem tecla de movimento, o padrão do Foundry (WASD).
 * @param {string[]} [movimento]  Teclas dos atalhos de movimento, na ordem dos atalhos.
 * @returns {{modelo: "wasd"|"setas"|"numerico"|"distancia", lado: "esquerda"|"direita", delta: number,
 *   casa: Set<string>, movimento: Set<string>, zonas: Map<string, number>}}
 */
export function maosDe(movimento = []) {
  const teclas = [...new Set(movimento)].filter((c) => CENTRO.has(c) && !SISTEMA.has(c) && !ehModificador(c));
  const chave = teclas.join();
  if (MAOS_CACHE.has(chave)) return MAOS_CACHE.get(chave);
  let maos;
  if (!teclas.length) maos = { modelo: "wasd", lado: "esquerda", delta: 0, casa: new Set(), zonas: MODELO_WASD };
  else {
    const grupos = new Map();
    for (const c of teclas) {
      const g = grupoDoMovimento(c);
      if (!grupos.has(g)) grupos.set(g, []);
      grupos.get(g).push(c);
    }
    const primeiro = grupoDoMovimento(teclas[0]);
    const [grupo, casa] = [...grupos].sort((a, b) => (b[1].length - a[1].length)
      || (Number(b[0] === primeiro) - Number(a[0] === primeiro)))[0];
    if (grupo === "setas") maos = { modelo: "setas", lado: "direita", delta: 0, casa: new Set(casa), zonas: MODELO_SETAS };
    else if (grupo === "numerico") maos = { modelo: "numerico", lado: "direita", delta: 0, casa: new Set(casa), zonas: MODELO_NUMERICO };
    else if (grupo === "esquerda") {
      const x = casa.reduce((s, c) => s + CENTRO.get(c).x, 0) / casa.length;
      const delta = Math.max(-1, Math.min(3, Math.round(x - X_DO_WASD)));
      maos = { modelo: "wasd", lado: "esquerda", delta, casa: new Set(casa), zonas: modeloDeslocado(delta) };
    }
    else maos = { modelo: "distancia", lado: "direita", delta: 0, casa: new Set(casa), zonas: modeloPorDistancia(casa) };
  }
  maos.movimento = new Set(teclas);
  MAOS_CACHE.set(chave, maos);
  return maos;
}
const MAOS_CACHE = new Map();

/** Mãos do padrão do Foundry: esquerda no WASD, direita no mouse. */
export const MAOS_PADRAO = maosDe(["KeyW", "KeyA", "KeyS", "KeyD"]);

/* -------------------------------------------- */
/*  Mouse                                       */
/* -------------------------------------------- */

/** Botões do mouse que viram teclas (código, bit de `MouseEvent.buttons`). Esquerdo e direito são do Foundry. */
export const MOUSE = Object.freeze([
  Object.freeze({ code: "Mouse3", bit: 4, rotulo: "Mouse 3" }),
  Object.freeze({ code: "Mouse4", bit: 8, rotulo: "Mouse 4" }),
  Object.freeze({ code: "Mouse5", bit: 16, rotulo: "Mouse 5" })
]);

/* -------------------------------------------- */
/*  Controle                                    */
/* -------------------------------------------- */

/**
 * Botões do mapeamento padrão da Gamepad API, com nível e região. O Foundry converte cada botão em tecla
 * `<ID>_BUTTON<n>_PRESSED` e cada sentido de eixo em `<ID>_AXIS<n>_POSITIVE|NEGATIVE`. Nenhum botão tira o dedo do
 * lugar: todos ficam na mão, e no controle só o aperto de botões juntos pesa. O clique do analógico leva o aviso de
 * disparo sem querer; o botão Home é do sistema (stone key).
 */
const CONTROLE_BOTOES = [
  [0, "face"], [0, "face"], [0, "face"], [0, "face"],
  [0, "gatilho"], [0, "gatilho"], [0, "gatilho"], [0, "gatilho"],
  [0, "centro"], [0, "centro"],
  [0, "acidente"], [0, "acidente"],
  [0, "direcional"], [0, "direcional"], [0, "direcional"], [0, "direcional"],
  [0, "sistema"]
];

const ROTULOS_CONTROLE = {
  xbox: ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "View", "Menu", "LS", "RS", "↑", "↓", "←", "→", "Xbox"],
  playstation: ["✕", "○", "□", "△", "L1", "R1", "L2", "R2", "Create", "Options", "L3", "R3", "↑", "↓", "←", "→", "PS"],
  nintendo: ["B", "A", "Y", "X", "L", "R", "ZL", "ZR", "−", "+", "LS", "RS", "↑", "↓", "←", "→", "Home"]
};

const RE_BOTAO = /^(.+)_BUTTON(\d+)_PRESSED$/;
const RE_EIXO = /^(.+)_AXIS(\d+)_(POSITIVE|NEGATIVE)$/;

/** Família do controle pelo id que o Foundry põe no código. */
export function familiaControle(id = "") {
  const s = id.toUpperCase();
  if (/XBOX|045E/.test(s)) return "xbox";
  if (/054C|DUALSENSE|DUALSHOCK|PLAYSTATION/.test(s)) return "playstation";
  if (/057E|NINTENDO|PROCONTROLLER|JOY-?CON/.test(s)) return "nintendo";
  return "xbox";
}

/** Normaliza o id de um Gamepad como o Foundry faz ao montar o código. */
export function idControle(gamepadId = "") {
  return gamepadId.replaceAll(" ", "").toUpperCase().trim();
}

/**
 * Lê um código de controle do Foundry.
 * @returns {{tipo: "botao"|"eixo", id: string, indice: number, sentido?: "POSITIVE"|"NEGATIVE"}|null}
 */
export function lerControle(code) {
  let m = RE_BOTAO.exec(code);
  if (m) return { tipo: "botao", id: m[1], indice: Number(m[2]) };
  m = RE_EIXO.exec(code);
  if (m) return { tipo: "eixo", id: m[1], indice: Number(m[2]), sentido: m[3] };
  return null;
}

export const codigoBotao = (id, indice) => `${id}_BUTTON${indice}_PRESSED`;
export const codigoEixo = (id, indice, sentido) => `${id}_AXIS${indice}_${sentido}`;

/** Rótulo curto de uma entrada de controle. */
export function rotuloControle(info) {
  const familia = familiaControle(info.id);
  if (info.tipo === "botao") return ROTULOS_CONTROLE[familia][info.indice] ?? `B${info.indice}`;
  const lado = info.indice < 2 ? "LS" : "RS";
  const horizontal = (info.indice % 2) === 0;
  const seta = horizontal ? (info.sentido === "POSITIVE" ? "→" : "←") : (info.sentido === "POSITIVE" ? "↓" : "↑");
  const prefixo = familia === "playstation" ? (lado === "LS" ? "L" : "R") : lado;
  return `${prefixo} ${seta}`;
}

/* -------------------------------------------- */
/*  Entrada                                     */
/* -------------------------------------------- */

/**
 * Dispositivo, nível e região de uma entrada (código de tecla do Foundry).
 * @param {string} code
 * @param {{repeticao?: boolean}} [acao]  Ação com repetição (movimento) aproveita analógico.
 * @param {ReturnType<typeof maosDe>} [maos]  Onde as mãos ficam.
 * @returns {{dispositivo: "teclado"|"mouse"|"controle", nivel: number, regiao: string, pedra?: boolean,
 *   controle?: object, gesto?: object}}
 */
export function infoEntrada(code, acao = {}, maos = MAOS_PADRAO) {
  // Tecla composta: vale a entrada mais longe dela, e o composto vai junto.
  const gesto = lerGesto(code);
  if (gesto) {
    const infos = [...gesto.todas].map((c) => infoEntrada(c, acao, maos));
    return { ...infos.reduce((a, b) => ((b.nivel > a.nivel) ? b : a)), gesto, pedra: infos.some((i) => i.pedra) };
  }
  const controle = lerControle(code);
  if (controle) {
    if (controle.tipo === "eixo") {
      return { dispositivo: "controle", controle, nivel: NIVEL.NA_MAO, regiao: acao.repeticao ? "eixo" : "acidente" };
    }
    const [nivel, regiao] = CONTROLE_BOTOES[controle.indice] ?? [NIVEL.NA_MAO, "centro"];
    return { dispositivo: "controle", controle, nivel, regiao, pedra: regiao === "sistema" };
  }
  // KeyboardEvent.code nunca tem um caractere só ("r" no lugar de "KeyR"): o atalho não dispara.
  if ([...code].length === 1) return { dispositivo: "teclado", nivel: NIVEL.EVITAR, regiao: "caractere" };
  // Botões laterais no polegar; o do meio é a rodinha.
  if ((code === "Mouse4") || (code === "Mouse5")) return { dispositivo: "mouse", nivel: NIVEL.NA_MAO, regiao: "mouse" };
  if (code === "Mouse3") return { dispositivo: "mouse", nivel: NIVEL.PERTO, regiao: "rodinha" };
  if (SISTEMA.has(code)) return { dispositivo: "teclado", nivel: NIVEL.EVITAR, regiao: "sistema", pedra: true };
  if (!CENTRO.has(code)) return { dispositivo: "teclado", nivel: NIVEL.TROCA, regiao: "desconhecida" };
  return { dispositivo: "teclado", nivel: maos.zonas.get(code) ?? NIVEL.TROCA, regiao: "teclado" };
}

/** Nível de um modificador do Foundry: a tecla mais perto entre as que o fazem (esquerda ou direita). */
function nivelDoModificador(mod, maos) {
  const codes = (CODIGOS_MODIFICADORES[mod] ?? []).filter((c) => CENTRO.has(c) && !SISTEMA.has(c));
  return codes.length ? Math.min(...codes.map((c) => maos.zonas.get(c) ?? NIVEL.TROCA)) : NIVEL.NA_MAO;
}

/* -------------------------------------------- */
/*  Avaliação                                   */
/* -------------------------------------------- */


/**
 * Avalia um atalho. O alcance vira o nível (a cor); os motivos ficam para o que a cor não diz.
 * @param {{key: string, modifiers?: string[]}} binding
 * @param {object} [opcoes]
 * @param {{segurar?: boolean, repeticao?: boolean}} [opcoes.acao]  Ação de segurar (tem onUp) e de repetição.
 * @param {ReturnType<typeof maosDe>} [opcoes.maos]  Onde as mãos ficam (padrão: WASD e mouse).
 * @param {"externa"|"movimento"} [opcoes.pedra]   Atalho que é stone key: do navegador ou do sistema, ou do movimento.
 * @param {string[]} [opcoes.protegidas]          Teclas que o Foundry não aceita (KeyboardManager.PROTECTED_KEYS).
 * @param {string[]} [opcoes.colisoes]            Nomes das ações que disparam no mesmo atalho.
 * @param {{nome: string, dono: "navegador"|"sistema", reservada?: boolean}[]} [opcoes.ocupacoes]  Stone keys do
 *   navegador e do sistema no mesmo atalho.
 * @param {number} [opcoes.vezes]                 Usos medidos da ação.
 * @param {boolean} [opcoes.frequente]            Ação entre as mais usadas.
 * @param {boolean} [opcoes.movimento]            Composto de toques numa tecla que também move.
 * @param {{id: string, dados?: object}[]} [opcoes.esperas]  Esperas entre composto e tecla sozinha na mesma camada.
 * @returns {{nivel: number, pedra: boolean, info: object, motivos: {id: string, dados?: object}[], invalida: boolean}}
 */
export function avaliar(binding, opcoes = {}) {
  const { acao = {}, protegidas = [], colisoes = [], ocupacoes = [], maos = MAOS_PADRAO } = opcoes;
  const key = binding.key;
  const info = infoEntrada(key, acao, maos);
  const modificadores = ehModificador(key) ? [] : (binding.modifiers ?? []);
  const motivos = [];
  let nivel = info.nivel;
  const protegida = teclasDe(key).some((k) => protegidas.includes(k));
  const pedra = Boolean(opcoes.pedra || info.pedra || protegida);
  const invalida = info.regiao === "caractere";

  if (invalida) motivos.push({ id: "caractere" });
  else if (info.regiao === "desconhecida") motivos.push({ id: "desconhecida" });
  // Stone key do sistema ou do navegador: um aviso só. No atalho do Foundry, a ocupação já diz qual função pega antes.
  if (((opcoes.pedra === "externa") || (info.regiao === "sistema") || protegida) && !ocupacoes.length) {
    motivos.push({ id: "sistema" });
  }
  if (info.regiao === "acidente") motivos.push({ id: "acidente" });

  // Teclas ao mesmo tempo (KLM: cada modificador é um toque; diretrizes: evitar simultâneas). O modificador vale pela
  // tecla mais perto da mão (Ctrl da esquerda ou da direita). Stone key não tem alcance: fica só o aviso dela.
  const n = pedra ? 0 : modificadores.length;
  if (n >= 2) {
    motivos.push({ id: "simultaneas", dados: { n: n + 1 } });
    nivel = Math.max(nivel, NIVEL.ESTICAR);
  }
  if ((n >= 1) && (info.dispositivo !== "controle")) {
    const nivelMod = Math.max(...modificadores.map((m) => nivelDoModificador(m, maos)));
    const nivelTecla = (info.dispositivo === "teclado") ? info.nivel : NIVEL.NA_MAO;
    if ((nivelTecla >= NIVEL.TROCA) || (nivelMod >= NIVEL.TROCA)) {
      motivos.push({ id: "duasMaos" });
      nivel = Math.max(nivel, NIVEL.TROCA);
    }
    else if ((nivelTecla === NIVEL.ESTICAR) || (nivelMod === NIVEL.ESTICAR)) {
      motivos.push({ id: "esticaCombo" });
      nivel = Math.max(nivel, NIVEL.TROCA);
    }
  }

  // Tecla composta: toques seguidos e sequências custam tempo e disparam sem querer (jogadores desligam o toque
  // duplo, sobretudo nas teclas de movimento); segurar paga o tempo a cada uso; teclas juntas têm janela curta e, no
  // controle, tiram o dedo de um dos botões.
  if (info.gesto) {
    const p = info.gesto.pressoes;
    const mesmas = p.every((x) => (x.teclas.length === 1) && (x.teclas[0] === p[0].teclas[0]));
    if (p.length >= 2) {
      motivos.push({ id: mesmas ? "toques" : "sequencia", dados: { n: p.length, s: TEMPOS.sequencia / 1000 } });
      nivel = Math.max(nivel, NIVEL.ESTICAR);
    }
    const juntas = Math.max(...p.map((x) => x.teclas.length));
    if (juntas >= 2) {
      motivos.push({ id: "juntas", dados: { n: juntas, s: TEMPOS.juntas / 1000 } });
      nivel = Math.max(nivel, (info.dispositivo === "controle") ? NIVEL.ESTICAR : NIVEL.PERTO);
    }
    const segurar = Math.max(...p.map((x) => x.segurar));
    if (segurar) {
      motivos.push({ id: "segurarTempo", dados: { s: segurar / 1000 } });
      if (segurar >= 1000) nivel = Math.max(nivel, NIVEL.ESTICAR);
    }
    if (opcoes.movimento && (p.length >= 2)) {
      motivos.push({ id: "toquesMovimento" });
      nivel = Math.max(nivel, NIVEL.TROCA);
    }
    if (opcoes.frequente && ((p.length >= 2) || segurar)) {
      motivos.push({ id: "frequenteComposto", dados: { vezes: opcoes.vezes } });
      nivel = Math.min(NIVEL.EVITAR, nivel + 1);
    }
  }
  for (const espera of opcoes.esperas ?? []) motivos.push(espera);

  // Stone keys do navegador e do sistema no mesmo aperto: só avisa; o atalho continua valendo.
  for (const o of ocupacoes) {
    motivos.push({ id: (o.reservada || (o.dono === "sistema")) ? "pedraAntes" : "navegadorUsa", dados: { funcao: o.nome } });
  }

  if (key === "Mouse3") motivos.push({ id: "dicaMeio" });
  if (colisoes.length) motivos.push({ id: "colisao", dados: { nomes: colisoes } });

  return { nivel, pedra, info, motivos, invalida };
}

/* -------------------------------------------- */
/*  Sugestões                                   */
/* -------------------------------------------- */

/** Ordem de preferência para atalho novo: perto dos dedos em repouso primeiro, botões laterais do mouse junto. */
const PREFERENCIA = ["KeyQ", "KeyE", "KeyR", "KeyF", "Mouse4", "Mouse5", "KeyZ", "KeyX", "KeyC", "KeyV", "Digit1",
  "Digit2", "Digit3", "Digit4", "KeyT", "KeyG", "KeyB", "Digit5", "Backquote", "IntlBackslash"];

/** Botões do controle por alcance: ombros e gatilhos, direcional, botões de face (mapeamento padrão). */
const PREFERENCIA_CONTROLE = [4, 5, 6, 7, 12, 13, 14, 15, 0, 1, 2, 3];

/** Ordem de preferência fora do WASD: o que está na mão primeiro, do mais perto das teclas de movimento. */
function preferenciaDe(maos) {
  const pontos = [...maos.casa].map((c) => CENTRO.get(c));
  const cx = pontos.reduce((s, p) => s + p.x, 0) / pontos.length;
  const cy = pontos.reduce((s, p) => s + p.y, 0) / pontos.length;
  const distancia = (c) => Math.hypot(CENTRO.get(c).x - cx, CENTRO.get(c).y - cy);
  const teclas = [...maos.zonas].filter(([c, n]) => (n <= NIVEL.PERTO) && !maos.movimento.has(c) && !ehModificador(c)
    && (c !== "Space") && CENTRO.has(c)).sort((a, b) => (a[1] - b[1]) || (distancia(a[0]) - distancia(b[0])))
    .map(([c]) => c);
  return [...teclas.slice(0, 4), "Mouse4", "Mouse5", ...teclas.slice(4)];
}

/**
 * Entradas livres por perto.
 * @param {(binding: {key: string, modifiers: string[]}) => boolean} ocupada
 * @param {number} [limite]
 * @param {string|null} [controle]  Id do controle (como no código do Foundry): sugere botões dele.
 * @param {ReturnType<typeof maosDe>} [maos]  Onde as mãos ficam.
 * @returns {{key: string, modifiers: string[]}[]}
 */
export function sugerir(ocupada, limite = 6, controle = null, maos = MAOS_PADRAO) {
  const livres = [];
  if (controle) {
    for (const indice of PREFERENCIA_CONTROLE) {
      const binding = { key: codigoBotao(controle, indice), modifiers: [] };
      if (!ocupada(binding)) livres.push(binding);
      if (livres.length >= limite) break;
    }
    return livres;
  }
  const preferencia = ((maos.modelo === "wasd") && !maos.delta) ? PREFERENCIA : preferenciaDe(maos);
  for (const modifiers of [[], ["Shift"]]) {
    for (const key of preferencia) {
      if (ehModificador(key) || maos.movimento?.has(key)) continue;
      if (key.startsWith("Mouse") && modifiers.length) continue;
      const binding = { key, modifiers };
      if (!ocupada(binding)) livres.push(binding);
      if (livres.length >= limite) return livres;
    }
  }
  return livres;
}

/* -------------------------------------------- */
/*  Colisões                                    */
/* -------------------------------------------- */

/**
 * Se dois atalhos disparam no mesmo aperto, com a regra do KeyboardManager do Foundry: uma ação com modificadores
 * exigidos R e opcionais O responde quando os modificadores apertados M cumprem R ⊆ M ⊆ R ∪ O. Dois atalhos na
 * mesma tecla colidem se existe M que sirva aos dois.
 * @param {{key: string, modifiers?: string[]}} a
 * @param {string[]} opcionaisA  reservedModifiers da ação de `a`.
 * @param {{key: string, modifiers?: string[]}} b
 * @param {string[]} opcionaisB
 */
export function colidem(a, opcionaisA, b, opcionaisB) {
  if (a.key !== b.key) return false;
  if (ehModificador(a.key)) return true;
  const ra = new Set(a.modifiers ?? []);
  const rb = new Set(b.modifiers ?? []);
  const permitidosA = new Set([...ra, ...(opcionaisA ?? [])]);
  const permitidosB = new Set([...rb, ...(opcionaisB ?? [])]);
  for (const m of [...ra, ...rb]) {
    if (!permitidosA.has(m) || !permitidosB.has(m)) return false;
  }
  return true;
}

/** Chave estável de um atalho (tecla + modificadores em ordem). */
export function chaveAtalho(binding) {
  const mods = ehModificador(binding.key) ? [] : [...(binding.modifiers ?? [])].sort();
  return [...mods, binding.key].join("+");
}
