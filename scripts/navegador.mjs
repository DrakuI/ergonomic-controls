/**
 * Base dos controles: desliga as funções do navegador que agem fora da página do jogo (navegação, abas, menus,
 * barra de endereço, diálogos) e a rolagem automática do botão do meio. Recarregar (F5, Ctrl+R), tela cheia (F11) e
 * as ferramentas do desenvolvedor (F12, Ctrl+Shift+I/J/C) nunca são bloqueados, e o que age na própria página continua
 * com o navegador: busca, zoom, seleção de texto, links.
 *
 * Os ouvintes entram na carga do módulo, antes do `init`, em captura na `window` (e na de cada janela destacada), e
 * em geral só chamam `preventDefault`: o KeyboardManager do Foundry escuta em bolha na `window` e não olha
 * `defaultPrevented`, então atalhos do Foundry e de módulos nas mesmas teclas continuam funcionando. As exceções
 * são `popstate` e `beforeunload`, descritos junto dos ouvintes. Até o `init` valem os valores de PADROES.
 *
 * Os botões 3 (meio), 4 e 5 do mouse viram teclas `Mouse3`, `Mouse4` e `Mouse5` para os atalhos do Foundry, do
 * mesmo jeito que o GamepadManager do core faz com o controle.
 */

import { MOUSE } from "./ergonomia.mjs";

export const MODULE_ID = "ergonomic-controls";
export const LANG = "ERGONOMIC_CONTROLS";

/** Configurações de cliente, na ordem da janela de configurações, com o valor padrão. */
export const PADROES = Object.freeze({
  historico: true,
  botaoMeio: true,
  atalhos: true,
  abas: true,
  fechar: true
});

/** Valores em uso: padrões até o `init`, depois as configurações. */
export const config = { ...PADROES };

const PLATAFORMA = navigator.userAgentData?.platform || navigator.platform || "";
const MAC = /mac|iphone|ipad/i.test(PLATAFORMA);

/* -------------------------------------------- */
/*  Atalhos do navegador                        */
/* -------------------------------------------- */

/*
 * Combinações no formato de `combinacao()`: "Mod" é Ctrl (Cmd no Mac); letras pela letra do layout ativo, como nos
 * atalhos do navegador; o resto pelo `KeyboardEvent.code`. As de `foraDeTexto` só valem com o foco fora de campo de
 * texto. Só entram funções do navegador que agem fora da página; recarregar, tela cheia, ferramentas do
 * desenvolvedor, busca, zoom, selecionar tudo, copiar, colar e desfazer continuam com ele (`ocupacoesAtuais`).
 *
 * Numa janela comum, o Chrome trata fechar, abrir e trocar aba (Ctrl+W, Ctrl+F4, Ctrl+T, Ctrl+N, Ctrl+Tab,
 * Ctrl+PageUp/PageDown) antes da página, e o cancelamento não tem efeito; Ctrl+1–9 chegam à página. Com a janela em
 * tela cheia (inclusive a do F11 do próprio navegador), só sair da tela cheia e sair do navegador ficam reservados;
 * em janela de app (página instalada como app ou `chrome --app`), nada fica. Nos dois casos, chegam e são cancelados.
 */
const NUMEROS = Array.from({ length: 9 }, (_, i) => [`Mod+Digit${i + 1}`, `Mod+Numpad${i + 1}`]).flat();

const ATALHOS_PC = {
  historico: {
    sempre: ["Alt+ArrowLeft", "Alt+ArrowRight", "Alt+Home", "BrowserBack", "BrowserForward", "BrowserHome"]
  },
  atalhos: {
    sempre: [
      "Mod+KeyS", "Mod+KeyP", "Mod+Shift+KeyP", "Mod+KeyO", "Mod+KeyU",
      "Mod+KeyD", "Mod+Shift+KeyD", "Mod+KeyH", "Mod+KeyJ", "Mod+Shift+KeyO", "Mod+Shift+KeyB",
      "Mod+Shift+Delete", "Mod+Shift+KeyA", "Mod+Shift+KeyM", "Mod+Shift+KeyQ",
      "Mod+KeyL", "Mod+KeyE", "Mod+KeyK", "Alt+KeyD", "F6", "Shift+F6",
      "Alt+KeyF", "Alt+KeyE", "F10", "Alt+Shift+KeyT", "Alt+Shift+KeyB", "Alt+Shift+KeyA", "Alt+Shift+KeyI",
      "F1", "F7", "Shift+Escape", "BrowserFavorites", "BrowserSearch"
    ],
    foraDeTexto: ["Mod+KeyB", "Mod+KeyI"]
  },
  abas: {
    sempre: [
      "Mod+KeyW", "Mod+F4", "Mod+Shift+KeyW", "Mod+KeyT", "Mod+Shift+KeyT", "Mod+KeyN", "Mod+Shift+KeyN",
      "Mod+Tab", "Mod+Shift+Tab", "Mod+PageUp", "Mod+PageDown", "Mod+Shift+PageUp", "Mod+Shift+PageDown",
      ...NUMEROS
    ]
  }
};

const ATALHOS_MAC = {
  historico: {
    sempre: ["Mod+BracketLeft", "Mod+BracketRight", "Mod+Shift+KeyH", "BrowserBack", "BrowserForward"],
    foraDeTexto: ["Mod+ArrowLeft", "Mod+ArrowRight"]
  },
  atalhos: {
    sempre: [
      "Mod+KeyS", "Mod+KeyP", "Mod+Shift+KeyP", "Mod+KeyO", "Mod+Alt+KeyU",
      "Mod+KeyD", "Mod+Shift+KeyD", "Mod+KeyY", "Mod+Shift+KeyJ", "Mod+Alt+KeyB", "Mod+Shift+KeyB",
      "Mod+Shift+Backspace", "Mod+Shift+KeyA", "Mod+KeyL", "Mod+Shift+Slash"
    ],
    foraDeTexto: ["Mod+KeyB", "Mod+KeyI"]
  },
  abas: {
    sempre: [
      "Mod+KeyW", "Mod+Shift+KeyW", "Mod+KeyT", "Mod+Shift+KeyT", "Mod+KeyN", "Mod+Shift+KeyN",
      "Ctrl+Tab", "Ctrl+Shift+Tab", "Mod+Alt+ArrowLeft", "Mod+Alt+ArrowRight",
      "Mod+Shift+BracketLeft", "Mod+Shift+BracketRight", "Mod+KeyM", "Mod+KeyH", "Mod+KeyQ", ...NUMEROS
    ]
  }
};

/** Combinação → { grupo, foraDeTexto }. */
const MAPA = new Map();
for (const [grupo, { sempre = [], foraDeTexto = [] }] of Object.entries(MAC ? ATALHOS_MAC : ATALHOS_PC)) {
  for (const c of sempre) MAPA.set(c, { grupo, foraDeTexto: false });
  for (const c of foraDeTexto) MAPA.set(c, { grupo, foraDeTexto: true });
}

/** Tipos de <input> sem digitação. */
const INPUT_SEM_TEXTO = new Set(["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset",
  "submit"]);

/** Botões 3 (voltar) e 4 (avançar) de `MouseEvent.button`. */
const BOTOES_LATERAIS = new Set([3, 4]);

/** Nome da tecla nas listas: letra pela letra do layout ativo; senão, o código físico. */
function nomeDaTecla(event) {
  const { key = "", code = "" } = event;
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  return code || key;
}

/** Combinação do evento, com os modificadores em ordem fixa: Mod, Ctrl (Mac) ou Meta (PC), Alt, Shift. */
function combinacao(event) {
  const partes = [];
  if (MAC ? event.metaKey : event.ctrlKey) partes.push("Mod");
  if (MAC && event.ctrlKey) partes.push("Ctrl");
  if (!MAC && event.metaKey) partes.push("Meta");
  if (event.altKey) partes.push("Alt");
  if (event.shiftKey) partes.push("Shift");
  partes.push(nomeDaTecla(event));
  return partes.join("+");
}

/** Se o alvo real do evento (dentro de shadow DOM inclusive) é um campo de texto. */
function emTexto(event) {
  let el = event.composedPath?.()[0] ?? event.target;
  if (el?.nodeType === Node.TEXT_NODE) el = el.parentElement;
  if (el?.nodeType !== Node.ELEMENT_NODE) return false;
  if (el.isContentEditable || (el.tagName === "TEXTAREA")) return true;
  return (el.tagName === "INPUT") && !INPUT_SEM_TEXTO.has(el.type);
}

/** Alt sozinho leva o foco ao menu do navegador (Windows, Linux) ou mostra a barra de menus (Firefox). */
function altSozinho(event) {
  return !MAC && ((event.code === "AltLeft") || (event.code === "AltRight"))
    && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}

/**
 * Grupo de configuração que bloqueia este keydown, ou null.
 * @param {KeyboardEvent} event
 */
function grupoDaTecla(event) {
  if (event.isComposing || event.getModifierState?.("AltGraph")) return null;
  const texto = emTexto(event);
  const entrada = MAPA.get(combinacao(event));
  if (entrada) {
    if (!config[entrada.grupo] || (entrada.foraDeTexto && texto)) return null;
    return entrada.grupo;
  }
  if (!texto && config.atalhos && altSozinho(event)) return "atalhos";
  return null;
}

/* -------------------------------------------- */
/*  O que fica com o navegador e o sistema      */
/* -------------------------------------------- */

/**
 * Navegador e sistema do cliente, pelo `userAgentData` (Chromium) ou pelo `userAgent`. A página não tem acesso aos
 * atalhos configurados no navegador; as tabelas abaixo são os padrões de cada um.
 * @param {Navigator} [nav]
 * @returns {{nome: string|null, motor: "chromium"|"firefox"|"safari", so: "windows"|"mac"|"linux"}}
 */
export function detectarNavegador(nav = globalThis.navigator) {
  const ua = nav?.userAgent ?? "";
  const dados = nav?.userAgentData;
  const marcas = (dados?.brands ?? []).map((b) => b.brand);
  const plataforma = (dados?.platform || nav?.platform || ua).toLowerCase();
  const so = /mac|iphone|ipad/.test(plataforma) ? "mac" : /linux|x11|cros/.test(plataforma) ? "linux" : "windows";
  const tem = (marca, re) => marcas.includes(marca) || re.test(ua);
  if (tem("Microsoft Edge", /Edg\//)) return { nome: "Edge", motor: "chromium", so };
  if (tem("Opera", /OPR\//)) return { nome: "Opera", motor: "chromium", so };
  if (marcas.includes("Brave") || nav?.brave) return { nome: "Brave", motor: "chromium", so };
  if (tem("Vivaldi", /Vivaldi\//)) return { nome: "Vivaldi", motor: "chromium", so };
  if (marcas.includes("Google Chrome")) return { nome: "Chrome", motor: "chromium", so };
  if (/Firefox\//.test(ua)) return { nome: "Firefox", motor: "firefox", so };
  if (/Version\/[\d.]+.*Safari\//.test(ua) && !/Chrome|Chromium/.test(ua)) return { nome: "Safari", motor: "safari", so };
  if (tem("Chromium", /Chrome\//)) return { nome: /Chrome\//.test(ua) && !marcas.length ? "Chrome" : "Chromium", motor: "chromium", so };
  return { nome: null, motor: "chromium", so };
}

export const NAVEGADOR = detectarNavegador();

/**
 * Funções do navegador que o módulo nunca bloqueia, no formato de `combinacao()` ("Ctrl" é o Control de verdade no
 * Mac). `essencial`: recarregar, tela cheia e ferramentas do desenvolvedor.
 * Fontes: ajuda de atalhos do Chrome e do Firefox, atalhos do DevTools (Chrome), do Firefox DevTools e do Web
 * Inspector (Safari).
 */
function funcoesDoNavegador({ motor, so }) {
  const mac = so === "mac";
  const lista = [];
  const f = (id, combos, extra = {}) => lista.push({ id, combos, dono: "navegador", ...extra });
  const essencial = { essencial: true };
  if (motor === "firefox") {
    f("recarregar", mac ? ["Mod+KeyR"] : ["F5", "Mod+KeyR"], essencial);
    f("recarregarSemCache", mac ? ["Mod+Shift+KeyR"] : ["Mod+F5", "Mod+Shift+KeyR"], essencial);
    f("telaCheia", mac ? ["Mod+Ctrl+KeyF", "Mod+Shift+KeyF"] : ["F11"], essencial);
    f("ferramentas", mac ? ["Mod+Alt+KeyI", "F12"] : ["F12", "Mod+Shift+KeyI"], essencial);
    f("console", mac ? ["Mod+Alt+KeyK", "Mod+Alt+KeyJ"] : ["Mod+Shift+KeyK", "Mod+Shift+KeyJ"], essencial);
    f("inspecionar", mac ? ["Mod+Alt+KeyC"] : ["Mod+Shift+KeyC"], essencial);
  }
  else if (motor === "safari") {
    f("recarregar", ["Mod+KeyR"], essencial);
    f("recarregarSemCache", ["Mod+Alt+KeyR"], essencial);
    f("telaCheia", ["Mod+Ctrl+KeyF"], essencial);
    f("ferramentas", ["Mod+Alt+KeyI"], essencial);
    f("console", ["Mod+Alt+KeyC"], essencial);
    f("inspecionar", ["Mod+Shift+KeyC"], essencial);
  }
  else {
    f("recarregar", mac ? ["Mod+KeyR"] : ["F5", "Mod+KeyR"], essencial);
    f("recarregarSemCache", mac ? ["Mod+Shift+KeyR"] : ["Shift+F5", "Mod+F5", "Mod+Shift+KeyR"], essencial);
    f("telaCheia", mac ? ["Mod+Ctrl+KeyF"] : ["F11"], essencial);
    f("ferramentas", mac ? ["Mod+Alt+KeyI"] : ["F12", "Mod+Shift+KeyI"], essencial);
    f("console", mac ? ["Mod+Alt+KeyJ"] : ["Mod+Shift+KeyJ"], essencial);
    f("inspecionar", mac ? ["Mod+Shift+KeyC", "Mod+Alt+KeyC"] : ["Mod+Shift+KeyC"], essencial);
  }
  f("buscar", mac ? ["Mod+KeyF", "Mod+KeyG", "Mod+Shift+KeyG"]
    : ["Mod+KeyF", "F3", "Shift+F3", "Mod+KeyG", "Mod+Shift+KeyG"]);
  f("zoom", mac ? ["Mod+Equal", "Mod+Shift+Equal", "Mod+Minus", "Mod+Digit0"]
    : ["Mod+Equal", "Mod+Shift+Equal", "Mod+Minus", "Mod+Digit0", "Mod+NumpadAdd", "Mod+NumpadSubtract", "Mod+Numpad0"]);
  f("selecionarTudo", ["Mod+KeyA"]);
  f("copiar", ["Mod+KeyC"]);
  f("recortar", ["Mod+KeyX"]);
  f("colar", ["Mod+KeyV", "Mod+Shift+KeyV"]);
  f("desfazer", ["Mod+KeyZ"]);
  f("refazer", mac ? ["Mod+Shift+KeyZ"] : ["Mod+KeyY", "Mod+Shift+KeyZ"]);
  return lista;
}

/**
 * Abas e janelas que o navegador trata antes da página. No Chromium, só numa janela comum
 * (BrowserCommandController::IsReservedCommandOrKey: em tela cheia só sair dela e sair do navegador ficam reservados;
 * em janela de app, nada); no Firefox e no Safari, sempre.
 */
function reservadasDoNavegador({ so }) {
  const f = (id, combos) => ({ id, combos, dono: "navegador", reservada: true });
  if (so === "mac") {
    return [f("fecharAba", ["Mod+KeyW"]), f("fecharJanela", ["Mod+Shift+KeyW"]), f("novaAba", ["Mod+KeyT"]),
      f("reabrirAba", ["Mod+Shift+KeyT"]), f("novaJanela", ["Mod+KeyN", "Mod+Shift+KeyN"]),
      f("trocarAba", ["Ctrl+Tab", "Ctrl+Shift+Tab"]), f("sair", ["Mod+KeyQ"])];
  }
  return [f("fecharAba", ["Mod+KeyW", "Mod+F4"]), f("fecharJanela", ["Mod+Shift+KeyW"]), f("novaAba", ["Mod+KeyT"]),
    f("reabrirAba", ["Mod+Shift+KeyT"]), f("novaJanela", ["Mod+KeyN", "Mod+Shift+KeyN"]),
    f("trocarAba", ["Mod+Tab", "Mod+Shift+Tab", "Mod+PageUp", "Mod+PageDown"])];
}

/** Atalhos do sistema operacional, que a página não consegue segurar. */
function doSistema({ so }) {
  const f = (id, combos) => ({ id, combos, dono: "sistema" });
  if (so === "mac") return [f("trocarJanela", ["Mod+Tab"]), f("spotlight", ["Mod+Space"])];
  const lista = [f("trocarJanela", ["Alt+Tab"]), f("fecharPrograma", ["Alt+F4"])];
  if (so === "windows") lista.push(f("gerenciadorTarefas", ["Mod+Shift+Escape"]), f("menuIniciar", ["MetaLeft", "MetaRight"]));
  return lista;
}

const FUNCOES = funcoesDoNavegador(NAVEGADOR);
const RESERVADAS = reservadasDoNavegador(NAVEGADOR);
const SISTEMA = doSistema(NAVEGADOR);

/** Recarregar: o navegador recarrega se nada consumir a tecla. */
const RECARREGAR = new Set([...FUNCOES.filter((f) => f.id.startsWith("recarregar")).flatMap((f) => f.combos),
  "BrowserRefresh"]);

/**
 * Como a janela está aberta: "app" (instalada como app), "telaCheia" (F11 do navegador ou da página) ou "comum".
 * @param {Window} [win]
 */
export function modoDaJanela(win = globalThis.window) {
  const mq = (q) => Boolean(win?.matchMedia?.(q).matches);
  if (mq("(display-mode: standalone)") || mq("(display-mode: minimal-ui)")
    || mq("(display-mode: window-controls-overlay)")) return "app";
  if (win?.document?.fullscreenElement || mq("(display-mode: fullscreen)")) return "telaCheia";
  return "comum";
}

/** Consultas de mídia que mudam o modo da janela. */
export const CONSULTAS_DO_MODO = ["(display-mode: fullscreen)", "(display-mode: standalone)",
  "(display-mode: minimal-ui)", "(display-mode: window-controls-overlay)"];

/**
 * Combinação no formato de `combinacao()` → atalho no formato do Foundry. No Mac, Cmd e Control viram "Control"
 * (o KeyboardManager trata metaKey como Control); `mac` marca o Control de verdade, para o rótulo.
 * @param {string} combo
 */
export function paraAtalho(combo) {
  const partes = combo.split("+");
  const key = partes.pop();
  const modifiers = [];
  if (partes.includes("Mod") || partes.includes("Ctrl")) modifiers.push("Control");
  if (partes.includes("Shift")) modifiers.push("Shift");
  if (partes.includes("Alt")) modifiers.push("Alt");
  const atalho = { key, modifiers };
  if (MAC && partes.includes("Ctrl")) atalho.controlDoMac = true;
  return atalho;
}

/**
 * O que continua com o navegador e com o sistema agora, com as configurações e o modo da janela atuais: funções que
 * o módulo nunca bloqueia, abas e janelas que o navegador trata antes da página, grupos de bloqueio desligados,
 * botões do mouse e atalhos do sistema.
 * @returns {{id: string, dono: "navegador"|"sistema", grupo?: string, essencial?: boolean, reservada?: boolean,
 *   atalhos: {key: string, modifiers: string[], controlDoMac?: boolean}[]}[]}
 */
export function ocupacoesAtuais(win = globalThis.window) {
  const lista = [...FUNCOES];
  const reservadasValem = (NAVEGADOR.motor !== "chromium") || (modoDaJanela(win) === "comum") || !config.abas;
  if (reservadasValem) lista.push(...RESERVADAS);
  const vistas = new Set(lista.flatMap((o) => o.combos));
  for (const grupo of Object.keys(PADROES)) {
    if (config[grupo]) continue;
    const combos = [...MAPA].filter(([c, e]) => (e.grupo === grupo) && !vistas.has(c)).map(([c]) => c);
    if (grupo === "historico") combos.push("Mouse4", "Mouse5");
    if (grupo === "botaoMeio") combos.push("Mouse3");
    if (combos.length) lista.push({ id: grupo, grupo, combos, dono: "navegador" });
  }
  lista.push({ id: "abrirLink", combos: ["Mouse3"], dono: "navegador" });
  lista.push(...SISTEMA);
  return lista.map(({ combos, ...o }) => ({ ...o, atalhos: combos.map(paraAtalho) }));
}

/* -------------------------------------------- */
/*  Histórico                                   */
/* -------------------------------------------- */

/*
 * Trava de histórico, para o que não passa pelos botões do mouse (gesto, botão do navegador, teclas de mídia, botões
 * no Firefox): uma entrada a mais do /game, criada durante uma interação do usuário. O core já empilha uma entrada
 * ao carregar e, no popstate, empilha de novo e pergunta se quer sair; criada sem ativação do usuário, essa entrada
 * pode ser pulada pelo botão de voltar do Chrome. A entrada da trava é empilhada num pointerdown ou keydown
 * confiável com ativação, então não é pulada. Voltar dela cai numa entrada do mesmo documento: o popstate é
 * consumido antes do core (sem a pergunta) e a trava se rearma na próxima interação, que costuma ser o próprio botão
 * ou tecla de voltar seguinte. Popstate que não sai nem chega na trava fica com o core.
 */
const trava = {
  /** Identifica as entradas deste carregamento da página. */
  id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
  /** Se a entrada atual é a da trava. */
  armada: false
};

function armar() {
  if (!config.historico || trava.armada) return;
  if (globalThis.game?.view && (game.view !== "game")) return;
  if (navigator.userActivation && !navigator.userActivation.isActive) return;
  history.pushState({ [MODULE_ID]: trava.id }, "", location.href);
  trava.armada = true;
}

/** @param {PopStateEvent} event */
function aoNavegar(event) {
  const nossa = event.state?.[MODULE_ID] === trava.id;
  const daTrava = trava.armada || nossa;
  trava.armada = nossa;
  if (config.historico && daTrava) event.stopImmediatePropagation();
}

/* -------------------------------------------- */
/*  Fechamento acidental                        */
/* -------------------------------------------- */

/*
 * Com Ctrl, Alt ou Meta apertado (Ctrl+W, Ctrl+F4, Alt+F4, Cmd+Q…), sair da página pede confirmação. O estado dos
 * modificadores vem dos eventos de teclado e de ponteiro e zera quando a janela perde o foco. Recarregar não pede:
 * uma tecla de recarregar que ninguém consumiu marca a saída como recarga. Fechar a aba com o mouse também não pede.
 *
 * Ao pedir, o beforeunload para nos ouvintes da trava: o do core marca a página como saindo (deixa de avisar queda
 * de conexão), fecha as janelas destacadas e salva a névoa, e isso não pode acontecer se a pessoa ficar. Se ela
 * sair, o pagehide dispara um beforeunload sintético para o core e os módulos fazerem o que fariam.
 */
const guarda = {
  /** Algum modificador apertado no último evento de teclado ou ponteiro. */
  modificador: false,
  /** Confirmação pedida e ouvintes adiados, até a próxima interação. */
  pendente: false,
  /** Momento (performance.now) da última tecla de recarregar não consumida, ou 0. */
  recarga: 0
};

/** Saída logo depois de uma tecla de recarregar é recarga. */
const RECARGA_MS = 2000;

/**
 * Tecla de recarregar: marca a recarga, desfeita depois do despacho se algum atalho consumiu a tecla (então o
 * navegador não recarrega).
 * @param {KeyboardEvent} event
 */
function marcarRecarga(event) {
  const momento = performance.now();
  guarda.recarga = momento;
  setTimeout(() => {
    if (event.defaultPrevented && (guarda.recarga === momento)) guarda.recarga = 0;
  });
}

const algumModificador = (event) => Boolean(event.ctrlKey || event.metaKey || event.altKey);

/** @param {BeforeUnloadEvent} event */
function aoSair(event) {
  if (!event.isTrusted) return;
  const recarga = (guarda.recarga > 0) && ((performance.now() - guarda.recarga) < RECARGA_MS);
  if (!config.fechar || !guarda.modificador || recarga) {
    guarda.pendente = false;
    return;
  }
  event.preventDefault();
  event.returnValue = true;
  event.stopImmediatePropagation();
  guarda.pendente = true;
}

function aoEsconder() {
  if (!guarda.pendente) return;
  guarda.pendente = false;
  window.dispatchEvent(new Event("beforeunload"));
}

/** Interação na janela principal: modificadores, fim da confirmação pendente e trava de histórico. */
function aoInteragir(event) {
  guarda.modificador = algumModificador(event);
  if (!event.isTrusted) return;
  guarda.pendente = false;
  armar();
}

/* -------------------------------------------- */
/*  Botões do mouse como teclas                 */
/* -------------------------------------------- */

/**
 * Converte as mudanças de `buttons` (meio, 4 e 5) em keydown e keyup com códigos `Mouse3`, `Mouse4` e `Mouse5` e os
 * modificadores do evento. O evento parte do elemento focado, como uma tecla de verdade: passa pelos ouvintes em
 * captura da janela antes do KeyboardManager (que escuta em bolha na janela e ignora as teclas quando um campo de
 * texto tem o foco) e chega a um campo de atalho focado da janela Configurar Controles.
 * @param {Window} win
 */
function emitirMouse(win) {
  let apertados = 0;
  const emitir = (code, solto, origem) => {
    const tecla = new KeyboardEvent(solto ? "keyup" : "keydown", {
      code,
      bubbles: true,
      cancelable: true,
      ctrlKey: origem?.ctrlKey ?? false,
      shiftKey: origem?.shiftKey ?? false,
      altKey: origem?.altKey ?? false,
      metaKey: origem?.metaKey ?? false
    });
    const doc = win.document;
    (doc.activeElement ?? doc.body ?? win).dispatchEvent(tecla);
  };
  const atualizar = (event) => {
    if (event.pointerType !== "mouse") return;
    const atual = event.buttons & (4 | 8 | 16);
    if (atual === apertados) return;
    for (const { code, bit } of MOUSE) {
      const agora = atual & bit;
      if ((apertados & bit) === agora) continue;
      apertados ^= bit;
      emitir(code, !agora, event);
    }
  };
  const soltarTudo = () => {
    for (const { code, bit } of MOUSE) {
      if (!(apertados & bit)) continue;
      apertados ^= bit;
      emitir(code, true);
    }
  };
  for (const tipo of ["pointerdown", "pointermove", "pointerup"]) {
    win.addEventListener(tipo, atualizar, { capture: true, passive: true });
  }
  win.addEventListener("blur", soltarTudo);
  win.document.addEventListener("visibilitychange", () => {
    if (win.document.hidden) soltarTudo();
  });
}

/* -------------------------------------------- */
/*  Ouvintes                                    */
/* -------------------------------------------- */

/**
 * @param {Window} win
 * @param {boolean} principal  Janela do jogo; as destacadas não têm histórico próprio nem guarda de fechamento.
 */
export function instalar(win, principal) {
  const opcoes = { capture: true };

  win.addEventListener("keydown", (event) => {
    if (principal) {
      aoInteragir(event);
      if (event.isTrusted && RECARREGAR.has(combinacao(event))) marcarRecarga(event);
    }
    if (grupoDaTecla(event)) event.preventDefault();
  }, opcoes);

  win.addEventListener("keyup", (event) => {
    if (principal) guarda.modificador = algumModificador(event);
    if (config.atalhos && altSozinho(event) && !emTexto(event)) event.preventDefault();
  }, opcoes);

  // O Chrome navega com os botões 3 e 4 quando a soltura não é cancelada: pointerup, ou pointermove quando outro
  // botão continua apertado. O preventDefault do core no pointerdown não cancela e ainda suprime o mouseup.
  const soltura = (event) => {
    if (principal) guarda.modificador = algumModificador(event);
    if (config.historico && BOTOES_LATERAIS.has(event.button)) event.preventDefault();
  };
  win.addEventListener("pointerup", soltura, opcoes);
  win.addEventListener("pointermove", soltura, opcoes);

  // Rolagem automática do botão do meio, no mousedown. O link com o botão do meio (auxclick) continua abrindo em
  // outra aba, e o Foundry continua travando dicas com ele (pointerup).
  win.addEventListener("mousedown", (event) => {
    if (config.botaoMeio && (event.button === 1) && !emTexto(event)) event.preventDefault();
  }, opcoes);

  emitirMouse(win);

  if (!principal) return;
  win.addEventListener("pointerdown", aoInteragir, opcoes);
  win.addEventListener("popstate", aoNavegar, opcoes);
  win.addEventListener("beforeunload", aoSair, opcoes);
  win.addEventListener("pagehide", aoEsconder, opcoes);
  win.addEventListener("blur", () => { guarda.modificador = false; });
  win.document.addEventListener("visibilitychange", () => {
    if (win.document.hidden) guarda.modificador = false;
  });
}

/** Aplica o que não é ouvinte: o gesto de deslizar sai pelo CSS. */
export function aplicar() {
  document.documentElement.classList.toggle(`${MODULE_ID}-historico`, config.historico);
}
