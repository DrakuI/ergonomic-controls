/**
 * Modelo de ergonomia dos controles: geometria do teclado, do mouse e do controle, zonas de alcance e avaliação de
 * um atalho. Sem dependência do Foundry: o que vem dele chega por parâmetro.
 *
 * Fundamentos:
 * - Posição de jogo no Foundry: mão esquerda no WASD (médio no W, anelar no A, indicador no D, mindinho em Shift e
 *   Ctrl, polegar no espaço) e mão direita no mouse.
 * - Keystroke-Level Model (Card, Moran e Newell, 1983): levar a mão entre teclado e mouse (operador H) custa cerca
 *   de 0,4 s em cada sentido; cada Shift ou Ctrl é um toque à parte (operador K).
 * - Princípios de arranjo de controles: o mais importante e o mais usado ficam mais acessíveis; o que é usado em
 *   sequência fica junto.
 * - Diretrizes de acessibilidade de jogos (Game Accessibility Guidelines; Xbox Accessibility Guideline 107): evitar
 *   teclas simultâneas e botões segurados, controles simples e remapeáveis, perfis.
 * - Lei de Hick-Hyman: o tempo de decisão cresce com o número de opções; atalho sem uso é custo.
 * - No controle, os botões de face tiram o polegar direito do analógico (o que leva à "garra"); bumpers e gatilhos
 *   são dos indicadores e deixam os polegares nos analógicos.
 * - Relatos de jogadores (fóruns de jogos, Reddit): toque duplo é rejeitado nas teclas de movimento (dispara sem
 *   querer) e atrasa a tecla sozinha; segurar é aceito em ação séria ou rara e rejeitado na rotina; botões laterais
 *   do mouse são o lugar preferido para esquiva e ações frequentes; apertos simultâneos precisam de janela
 *   (QMK usa 50 ms; jogos de luta com 1 quadro são difíceis).
 */

import { lerGesto, TEMPOS } from "./gestos.mjs";

/** Níveis de alcance, do melhor ao pior. */
export const NIVEL = Object.freeze({ NA_MAO: 0, PERTO: 1, ESTICAR: 2, TROCA: 3, EVITAR: 4 });
export const NIVEIS = ["naMao", "perto", "esticar", "troca", "evitar"];

/** Ida e volta da mão entre teclado e mouse, em segundos (2 × H do KLM). */
export const TEMPO_TROCA = 0.8;

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

/* -------------------------------------------- */
/*  Zonas de alcance                            */
/* -------------------------------------------- */

const ZONAS = new Map();
const zona = (nivel, regiao, codes) => { for (const c of codes) ZONAS.set(c, { nivel, regiao }); };

// Sem mexer a mão esquerda.
zona(0, "esquerda", ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyA", "KeyS", "KeyD", "KeyF", "KeyZ", "KeyX", "KeyC", "KeyV",
  "Digit1", "Digit2", "Digit3", "Digit4", "Tab", "Space", "ShiftLeft", "ControlLeft", "AltLeft"]);
// O dedo estica; a mão fica.
zona(1, "esquerda", ["Digit5", "KeyT", "KeyG", "KeyB", "Backquote", "IntlBackslash", "CapsLock"]);
// A mão esquerda sai do WASD.
zona(2, "esquerda", ["Digit6", "KeyY", "KeyH", "KeyN", "Escape", "F1", "F2", "F3", "F4"]);
// Fora do alcance da mão esquerda: a direita sai do mouse.
zona(3, "direita", ["Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal", "Backspace", "KeyU", "KeyI", "KeyO",
  "KeyP", "BracketLeft", "BracketRight", "Enter", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Backslash", "KeyM",
  "Comma", "Period", "Slash", "IntlRo", "ShiftRight", "AltRight", "ControlRight"]);
zona(3, "funcao", ["F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"]);
zona(3, "navegacao", ["Insert", "Home", "PageUp", "Delete", "End", "PageDown", "ArrowUp", "ArrowLeft", "ArrowDown",
  "ArrowRight"]);
zona(3, "numerico", ["NumpadDivide", "NumpadMultiply", "NumpadSubtract", "Numpad7", "Numpad8", "Numpad9", "NumpadAdd",
  "Numpad4", "Numpad5", "Numpad6", "Numpad1", "Numpad2", "Numpad3", "NumpadEnter", "Numpad0", "NumpadDecimal"]);
// Tomadas pelo sistema.
zona(4, "sistema", ["MetaLeft", "MetaRight", "ContextMenu", "PrintScreen", "ScrollLock", "Pause", "NumLock", "OsLeft",
  "OsRight"]);
// Mouse: botões laterais no polegar; o do meio é a rodinha.
zona(0, "mouse", ["Mouse4", "Mouse5"]);
zona(1, "rodinha", ["Mouse3"]);

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
 * `<ID>_BUTTON<n>_PRESSED` e cada sentido de eixo em `<ID>_AXIS<n>_POSITIVE|NEGATIVE`.
 */
const CONTROLE_BOTOES = [
  [1, "face"], [1, "face"], [1, "face"], [1, "face"],
  [0, "gatilho"], [0, "gatilho"], [0, "gatilho"], [0, "gatilho"],
  [2, "centro"], [2, "centro"],
  [2, "cliqueAnalogico"], [2, "cliqueAnalogico"],
  [1, "direcional"], [1, "direcional"], [1, "direcional"], [1, "direcional"],
  [4, "botaoSistema"]
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
 */
export function infoEntrada(code, acao = {}) {
  // Tecla composta: vale a entrada mais longe dela, e o composto vai junto.
  const gesto = lerGesto(code);
  if (gesto) {
    const infos = [...gesto.todas].map((c) => infoEntrada(c, acao));
    return { ...infos.reduce((a, b) => ((b.nivel > a.nivel) ? b : a)), gesto };
  }
  const controle = lerControle(code);
  if (controle) {
    if (controle.tipo === "eixo") {
      return { dispositivo: "controle", controle, nivel: acao.repeticao ? 0 : 2,
        regiao: acao.repeticao ? "eixoMover" : "eixoToque" };
    }
    const [nivel, regiao] = CONTROLE_BOTOES[controle.indice] ?? [2, "centro"];
    return { dispositivo: "controle", controle, nivel, regiao };
  }
  // KeyboardEvent.code nunca tem um caractere só ("r" no lugar de "KeyR"): o atalho não dispara.
  if ([...code].length === 1) return { dispositivo: "teclado", nivel: NIVEL.EVITAR, regiao: "caractere" };
  const z = ZONAS.get(code);
  if (!z) return { dispositivo: "teclado", nivel: 3, regiao: "desconhecida" };
  const mouse = (z.regiao === "mouse") || (z.regiao === "rodinha");
  return { dispositivo: mouse ? "mouse" : "teclado", nivel: z.nivel, regiao: z.regiao };
}

/* -------------------------------------------- */
/*  Avaliação                                   */
/* -------------------------------------------- */

/** Códigos de modificador como o Foundry agrupa (KeyboardManager.MODIFIER_CODES). */
export const CODIGOS_MODIFICADORES = Object.freeze({
  Control: ["ControlLeft", "ControlRight", "MetaLeft", "MetaRight", "Meta", "OsLeft", "OsRight"],
  Shift: ["ShiftLeft", "ShiftRight"],
  Alt: ["AltLeft", "AltRight"]
});
const TECLAS_MODIFICADORAS = new Set(Object.values(CODIGOS_MODIFICADORES).flat());
export const ehModificador = (code) => TECLAS_MODIFICADORAS.has(code);

/**
 * Avalia um atalho.
 * @param {{key: string, modifiers?: string[]}} binding
 * @param {object} [opcoes]
 * @param {{segurar?: boolean, repeticao?: boolean}} [opcoes.acao]  Ação de segurar (tem onUp) e de repetição.
 * @param {string[]} [opcoes.protegidas]          Teclas que o Foundry não aceita (KeyboardManager.PROTECTED_KEYS).
 * @param {string[]} [opcoes.colisoes]            Nomes das ações que disparam no mesmo atalho.
 * @param {{nome: string, dono: "navegador"|"sistema", donoNome: string, essencial?: boolean, reservada?: boolean}[]}
 *   [opcoes.ocupacoes]  Funções do navegador e do sistema que continuam no mesmo atalho.
 * @param {number} [opcoes.vezes]                 Usos medidos da ação.
 * @param {boolean} [opcoes.frequente]            Ação entre as mais usadas.
 * @param {boolean} [opcoes.semUso]               Ação sem uso desde que a contagem começou.
 * @param {boolean} [opcoes.movimento]            Composto de toques numa tecla que também move.
 * @param {{id: string, dados?: object}[]} [opcoes.esperas]  Esperas entre composto e tecla sozinha na mesma camada.
 * @returns {{nivel: number, info: object, motivos: {id: string, dados?: object}[], invalida: boolean}}
 */
export function avaliar(binding, opcoes = {}) {
  const { acao = {}, protegidas = [], colisoes = [], ocupacoes = [] } = opcoes;
  const key = binding.key;
  const info = infoEntrada(key, acao);
  const modificadores = ehModificador(key) ? [] : (binding.modifiers ?? []);
  const motivos = [];
  let nivel = info.nivel;
  let invalida = false;

  if (protegidas.includes(key)) {
    motivos.push({ id: "protegida" });
    return { nivel: NIVEL.EVITAR, info, motivos, invalida: true };
  }

  motivos.push({ id: info.regiao === "esquerda" ? `esquerda${info.nivel}` : info.regiao, dados: { s: TEMPO_TROCA } });
  if (info.regiao === "caractere") invalida = true;

  // Teclas ao mesmo tempo (KLM: cada modificador é um toque; diretrizes: evitar simultâneas).
  const n = modificadores.length;
  if (n >= 2) {
    motivos.push({ id: "simultaneas", dados: { n: n + 1 } });
    nivel = Math.max(nivel, NIVEL.ESTICAR);
  }
  if (n >= 1 && (info.dispositivo === "teclado")) {
    if (info.nivel >= NIVEL.TROCA) {
      motivos.push({ id: "duasMaos" });
      nivel = Math.max(nivel, NIVEL.TROCA);
    }
    else if (info.nivel === NIVEL.ESTICAR) {
      motivos.push({ id: "esticaCombo" });
      nivel = Math.max(nivel, NIVEL.TROCA);
    }
  }

  // Tecla composta: toques seguidos e sequências custam tempo e disparam sem querer (jogadores desligam o toque
  // duplo, sobretudo nas teclas de movimento); segurar paga o tempo a cada uso; teclas juntas têm janela curta.
  let frequenteComposto = false;
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
      nivel = Math.max(nivel, NIVEL.PERTO);
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
      frequenteComposto = true;
      motivos.push({ id: "frequenteComposto", dados: { vezes: opcoes.vezes } });
      nivel = Math.min(NIVEL.EVITAR, nivel + 1);
    }
  }
  for (const espera of opcoes.esperas ?? []) motivos.push(espera);

  // Segurar longe da mão: a tecla fica apertada enquanto a outra mão trabalha.
  if (acao.segurar && (nivel >= NIVEL.ESTICAR)) {
    motivos.push({ id: "segurarLonge" });
    nivel = Math.min(NIVEL.EVITAR, nivel + 1);
  }

  // Navegador e sistema: o que eles tratam antes da página não chega ao Foundry; recarregar, tela cheia e ferramentas
  // do desenvolvedor somem quando um atalho do Foundry consome a tecla.
  for (const o of ocupacoes) {
    const dados = { funcao: o.nome, dono: o.donoNome };
    if (o.dono === "sistema") motivos.push({ id: "sistemaUsa", dados });
    else motivos.push({ id: o.reservada ? "navegadorReservada" : "navegadorUsa", dados });
    if ((o.dono === "sistema") || o.reservada || o.essencial) nivel = NIVEL.EVITAR;
  }

  if (key === "Mouse3") motivos.push({ id: "dicaMeio" });
  if ((key === "MetaLeft") || (key === "MetaRight") || (binding.modifiers ?? []).includes("Meta")) {
    motivos.push({ id: "teclaWindows" });
  }

  if (colisoes.length) motivos.push({ id: "colisao", dados: { nomes: colisoes } });

  // Frequência medida.
  if (opcoes.frequente && (nivel >= NIVEL.ESTICAR) && !frequenteComposto) {
    motivos.push({ id: "frequenteLonge", dados: { vezes: opcoes.vezes } });
  }
  else if (opcoes.semUso) motivos.push({ id: "semUso" });

  return { nivel, info, motivos, invalida };
}

/* -------------------------------------------- */
/*  Sugestões                                   */
/* -------------------------------------------- */

/** Ordem de preferência para atalho novo: perto dos dedos em repouso primeiro, botões laterais do mouse junto. */
const PREFERENCIA = ["KeyQ", "KeyE", "KeyR", "KeyF", "Mouse4", "Mouse5", "KeyZ", "KeyX", "KeyC", "KeyV", "Digit1",
  "Digit2", "Digit3", "Digit4", "KeyT", "KeyG", "KeyB", "Digit5", "Backquote", "IntlBackslash"];

/** Botões do controle por alcance: ombros e gatilhos, direcional, botões de face (mapeamento padrão). */
const PREFERENCIA_CONTROLE = [4, 5, 6, 7, 12, 13, 14, 15, 0, 1, 2, 3];

/**
 * Entradas livres por perto.
 * @param {(binding: {key: string, modifiers: string[]}) => boolean} ocupada
 * @param {number} [limite]
 * @param {string|null} [controle]  Id do controle (como no código do Foundry): sugere botões dele.
 * @returns {{key: string, modifiers: string[]}[]}
 */
export function sugerir(ocupada, limite = 6, controle = null) {
  const livres = [];
  if (controle) {
    for (const indice of PREFERENCIA_CONTROLE) {
      const binding = { key: codigoBotao(controle, indice), modifiers: [] };
      if (!ocupada(binding)) livres.push(binding);
      if (livres.length >= limite) break;
    }
    return livres;
  }
  for (const modifiers of [[], ["Shift"]]) {
    for (const key of PREFERENCIA) {
      if (ehModificador(key)) continue;
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
