/**
 * Ergonomic Controls
 *
 * - navegador.mjs: base que desliga as funções do navegador que agem fora da página e converte os botões 3, 4 e 5
 *   do mouse em teclas para os atalhos.
 * - perfis.mjs: perfis de atalhos por usuário e contagem de uso.
 * - app.mjs + interface.mjs: janela dos perfis (menu nas configurações do módulo).
 * - ergonomia.mjs: modelo de alcance e avaliação de atalhos.
 * - gestos.mjs: teclas compostas (duas vezes, segurar, juntas, em sequência) entre os eventos e o KeyboardManager.
 */

import { MODULE_ID, LANG, PADROES, config, instalar, aplicar } from "./navegador.mjs";
import { AppPerfis, rotuloGesto } from "./app.mjs";
import * as gestos from "./gestos.mjs";
import * as perfis from "./perfis.mjs";
import { MOUSE, lerControle, rotuloControle, idControle, codigoBotao, codigoEixo } from "./ergonomia.mjs";

/**
 * Nomes de exibição dos códigos de mouse, de controle e das teclas compostas na janela Configurar Controles do
 * Foundry (KeyboardManager.KEYCODE_DISPLAY_MAPPING).
 * @param {Iterable<string>} codes
 */
function rotularEntradas(codes = []) {
  const mapa = game.keyboard?.constructor?.KEYCODE_DISPLAY_MAPPING;
  if (!mapa || Object.isFrozen(mapa)) return;
  for (const { code, rotulo } of MOUSE) mapa[code] ??= rotulo;
  for (const code of codes) {
    const g = gestos.lerGesto(code);
    if (g) {
      mapa[code] ??= rotuloGesto(g);
      for (const tecla of g.todas) {
        const c = lerControle(tecla);
        if (c) mapa[tecla] ??= rotuloControle(c);
      }
      continue;
    }
    const c = lerControle(code);
    if (c) mapa[code] ??= rotuloControle(c);
  }
}

/** Códigos usados nos atalhos agora (os gravados e os padrões). */
function codigosEmUso() {
  return [...(game.keybindings?.activeKeys?.keys() ?? [])];
}

/** Códigos de todos os botões e eixos de um Gamepad. */
function codigosDoControle(gamepad) {
  const id = idControle(gamepad.id);
  const codes = [];
  for (let i = 0; i < gamepad.buttons.length; i++) codes.push(codigoBotao(id, i));
  for (let i = 0; i < gamepad.axes.length; i++) codes.push(codigoEixo(id, i, "POSITIVE"), codigoEixo(id, i, "NEGATIVE"));
  return codes;
}

function registrar() {
  for (const [chave, padrao] of Object.entries(PADROES)) {
    const nome = chave[0].toUpperCase() + chave.slice(1);
    game.settings.register(MODULE_ID, chave, {
      name: `${LANG}.Settings.${nome}.Name`,
      hint: `${LANG}.Settings.${nome}.Hint`,
      scope: "client",
      config: true,
      type: Boolean,
      default: padrao,
      onChange: (valor) => {
        config[chave] = valor;
        aplicar();
        perfis.avisarMudanca();
      }
    });
    config[chave] = game.settings.get(MODULE_ID, chave);
  }

  game.settings.registerMenu(MODULE_ID, "perfis", {
    name: `${LANG}.Menu.Name`,
    label: `${LANG}.Menu.Label`,
    hint: `${LANG}.Menu.Hint`,
    icon: "fa-solid fa-keyboard",
    type: AppPerfis,
    restricted: false
  });
  game.settings.register(MODULE_ID, "perfis", {
    scope: "user", config: false, type: Object, default: { ativo: null, lista: [] }
  });
  game.settings.register(MODULE_ID, "uso", { scope: "user", config: false, type: Object, default: {} });
  game.settings.register(MODULE_ID, "pedras", {
    scope: "client", config: false, type: Object, default: {}, onChange: () => perfis.avisarMudanca()
  });

  game.keybindings.register(MODULE_ID, "perfis", {
    name: `${LANG}.Keybindings.Perfis.Name`,
    hint: `${LANG}.Keybindings.Perfis.Hint`,
    editable: [],
    onDown: () => {
      const aberta = foundry.applications.instances.get(AppPerfis.DEFAULT_OPTIONS.id);
      if (aberta) aberta.close();
      else new AppPerfis().render({ force: true });
      return true;
    }
  });

  aplicar();
}

async function aoFicarPronto() {
  gestos.instalar();
  const usados = Object.values(game.settings.get("core", "keybindings") ?? {}).flat().map((b) => b?.key).filter(Boolean);
  const conectados = [...(navigator.getGamepads?.() ?? [])].filter(Boolean).flatMap(codigosDoControle);
  rotularEntradas([...usados, ...conectados, ...codigosEmUso()]);
  try {
    await perfis.prepararPerfis();
  }
  catch (err) {
    console.error(`${MODULE_ID} | Profiles not prepared`, err);
  }
  perfis.iniciarUso();
}

/**
 * Aviso no topo da seção do módulo em Configurar Opções (os atalhos do navegador mostrados são os padrões dele).
 * Classe própria, fora de `.hint`, que temas transformam em dica.
 * @param {Application} _app
 * @param {HTMLElement|JQuery} html
 */
function avisoNasConfiguracoes(_app, html) {
  const raiz = (html instanceof HTMLElement) ? html : html?.[0];
  const secao = raiz?.querySelector(`section[data-category="${MODULE_ID}"]`) ?? raiz?.querySelector(`section[data-tab="${MODULE_ID}"]`);
  if (!secao || secao.querySelector(".ergonomic-controls-aviso")) return;
  const aviso = document.createElement("p");
  aviso.className = "ergonomic-controls-aviso";
  const icone = document.createElement("i");
  icone.className = "fa-solid fa-circle-info";
  icone.setAttribute("inert", "");
  aviso.append(icone, " ", game.i18n.localize(`${LANG}.Avisos.Navegador`));
  const titulo = secao.querySelector(":scope > h2");
  if (titulo) titulo.after(aviso);
  else secao.prepend(aviso);
}

const MARCA = Symbol.for(MODULE_ID);
if (!globalThis[MARCA]) {
  globalThis[MARCA] = true;
  instalar(window, true);
  aplicar();
  Hooks.once("init", registrar);
  Hooks.once("ready", aoFicarPronto);
  Hooks.on("clientSettingChanged", (key) => {
    if (!game.ready || (key !== "core.keybindings")) return;
    perfis.sincronizar();
    rotularEntradas(codigosEmUso());
  });
  Hooks.on("openDetachedWindow", (_id, win) => instalar(win, false));
  Hooks.on("renderSettingsConfig", avisoNasConfiguracoes);
  window.addEventListener("gamepadconnected", (event) => {
    if (event.gamepad) rotularEntradas(codigosDoControle(event.gamepad));
  });
}
