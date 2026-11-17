/**
 * Janela dos perfis de controle (menu nas configurações do módulo e atalho opcional) e o adaptador da interface para
 * o Foundry: ações e atalhos (game.keybindings), perfis e uso (perfis.mjs), diálogos, controles conectados.
 */

import { MODULE_ID, LANG, NAVEGADOR, ocupacoesAtuais } from "./navegador.mjs";
import { InterfacePerfis } from "./interface.mjs";
import * as perfis from "./perfis.mjs";
import { MOUSE, lerControle, rotuloControle, rotuloTecla, idControle, ehModificador } from "./ergonomia.mjs";
import { lerGesto } from "./gestos.mjs";

const t = (chave, dados) => (dados ? game.i18n.format(`${LANG}.${chave}`, dados) : game.i18n.localize(`${LANG}.${chave}`));

/** Rótulos das teclas modificadoras usadas sozinhas; as da direita levam ▸. */
const ROTULO_MODIFICADOR = {
  ShiftLeft: "Shift", ShiftRight: "Shift ▸", ControlLeft: "Ctrl", ControlRight: "Ctrl ▸", AltLeft: "Alt",
  AltRight: "AltGr", MetaLeft: "⊞", MetaRight: "⊞ ▸", OsLeft: "⊞", OsRight: "⊞ ▸", Meta: "⊞"
};

function rotuloControl() {
  const s = game.keyboard?.constructor?.CONTROL_KEY_STRING ?? "Ctrl";
  return s === "Control" ? "Ctrl" : s;
}

/** Rótulo de uma tecla num atalho: espaço por extenso e teclado numérico com "Num". */
function rotuloDaTecla(key, layout) {
  if (key === "Space") return t("Teclas.Espaco");
  const curto = rotuloTecla(key, layout);
  return key.startsWith("Numpad") ? `Num ${curto}` : curto;
}

/** Rótulo de uma entrada física: tecla, botão do mouse ou do controle. */
function rotuloDaEntrada(key, layout) {
  const controle = lerControle(key);
  if (controle) return rotuloControle(controle);
  const mouse = MOUSE.find((m) => m.code === key);
  if (mouse) return mouse.rotulo;
  return ROTULO_MODIFICADOR[key] ?? rotuloDaTecla(key, layout);
}

/**
 * Rótulo de uma tecla composta: "Q ×2", "Q segurado 1 s", "E + Q", "Q, E".
 * @param {import("./gestos.mjs").Gesto} gesto
 * @param {Map<string, string>|null} [layout]
 */
export function rotuloGesto(gesto, layout = null) {
  const numero = new Intl.NumberFormat(game.i18n.lang, { maximumFractionDigits: 1 });
  const p = gesto.pressoes;
  const partes = [];
  for (let i = 0; i < p.length; i++) {
    const tecla = p[i].teclas.map((c) => rotuloDaEntrada(c, layout)).join(" + ");
    if (p[i].segurar) {
      partes.push(t("Gestos.Segurado", { tecla, s: numero.format(p[i].segurar / 1000) }));
      continue;
    }
    let n = 1;
    while (((i + n) < p.length) && !p[i + n].segurar && (p[i + n].teclas.join() === p[i].teclas.join())) n++;
    partes.push((n > 1) ? t("Gestos.Vezes", { tecla, n }) : tecla);
    i += n - 1;
  }
  return partes.join(", ");
}

/**
 * Rótulo de um atalho, com os modificadores antes da tecla.
 * @param {{key: string, modifiers?: string[]}} binding
 * @param {Map<string, string>|null} layout
 */
export function rotuloAtalho(binding, layout = null) {
  const key = binding.key;
  const partes = ehModificador(key) ? [] : (binding.modifiers ?? []).map((m) => (m === "Control" ? rotuloControl() : m));
  if (binding.controlDoMac) partes.unshift("⌃");
  const gesto = lerGesto(key);
  partes.push(gesto ? rotuloGesto(gesto, layout) : rotuloDaEntrada(key, layout));
  return partes.join(" + ");
}

/** Usos do Foundry para cada botão do mouse (ControlsConfig.POINTER_CONTROLS). */
function usosDoPonteiro() {
  const usos = { esquerdo: [], direito: [], meio: [], rodinha: [] };
  const lista = foundry.applications.sidebar?.apps?.ControlsConfig?.POINTER_CONTROLS ?? [];
  for (const [, nome, entradas = [], restrito] of lista) {
    if (restrito && !game.user.isGM) continue;
    const mods = entradas.filter((e) => ["Control", "Shift", "Alt"].includes(e)).map((e) => (e === "Control" ? rotuloControl() : e));
    const texto = [...mods, game.i18n.localize(nome)].join(" + ");
    if (entradas.some((e) => e.startsWith("LeftClick") || (e === "LongPress"))) usos.esquerdo.push(texto);
    if (entradas.some((e) => e.startsWith("RightClick"))) usos.direito.push(texto);
    if (entradas.includes("MiddleClick")) usos.meio.push(texto);
    if (entradas.includes("MouseWheel")) usos.rodinha.push(texto);
  }
  return usos;
}

const NOME_DO_SISTEMA = { windows: "Windows", mac: "macOS", linux: "Linux" };

/** Nome do navegador e do sistema detectados. */
export function donos() {
  return { navegador: NAVEGADOR.nome ?? t("Navegador.Navegador"), sistema: NOME_DO_SISTEMA[NAVEGADOR.so] };
}

/**
 * Teclas do navegador e do sistema mudadas na janela de perfis (a página não lê as configurações do navegador).
 * Configuração de cliente: vale para este navegador. Chave `${dono}.${id}`, valor lista de atalhos.
 * @returns {Record<string, {key: string, modifiers: string[]}[]>}
 */
function lerPedras() {
  let valor;
  try { valor = game.settings.get(MODULE_ID, "pedras"); }
  catch { return {}; }
  const limpas = {};
  for (const [chave, lista] of Object.entries(valor ?? {})) {
    if (!Array.isArray(lista)) continue;
    limpas[chave] = lista.filter((b) => (typeof b?.key === "string") && b.key)
      .map((b) => ({ key: b.key, modifiers: Array.isArray(b.modifiers) ? b.modifiers.filter((m) => typeof m === "string") : [] }));
  }
  return limpas;
}

/** O que continua com o navegador e o sistema, com nomes e as mudanças guardadas no módulo. */
function ocupacoes() {
  const nomes = donos();
  const mudadas = lerPedras();
  return ocupacoesAtuais().map((o) => {
    const chave = `${o.dono}.${o.id}`;
    const editavel = !o.grupo;
    const alterada = editavel && Object.hasOwn(mudadas, chave);
    return {
      ...o,
      chave,
      editavel,
      alterada,
      padrao: o.atalhos,
      atalhos: alterada ? mudadas[chave] : o.atalhos,
      nome: o.grupo ? t(`Settings.${o.grupo[0].toUpperCase()}${o.grupo.slice(1)}.Name`) : t(`Navegador.Funcoes.${o.id}`),
      donoNome: nomes[o.dono]
    };
  });
}

/** Movimento do núcleo: token (WASD) e câmera (setas, numérico). */
function movimentoDe(id) {
  if (/^core\.move(Up|Down|Left|Right)/.test(id)) return "token";
  if (/^core\.pan(Up|Down|Left|Right)/.test(id)) return "camera";
  return null;
}

function categoria(namespace) {
  if (namespace === "core") return { id: "core", titulo: game.i18n.localize("KEYBINDINGS.CoreKeybindings"), ordem: 0 };
  if (namespace === game.system.id) return { id: namespace, titulo: game.system.title, ordem: 1 };
  const modulo = game.modules.get(namespace);
  return { id: namespace, titulo: modulo?.title ?? namespace, ordem: 2 };
}

async function escolherArquivo() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  return new Promise((resolve) => {
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}

/** Adaptador da interface para o Foundry. */
export function criarFonte() {
  const DialogV2 = foundry.applications.api.DialogV2;
  const { escapeHTML, deepClone } = foundry.utils;
  const numero = new Intl.NumberFormat(game.i18n.lang);
  let layout = null;
  return {
    t,
    numero: (n) => numero.format(n),
    lista: (nomes) => game.i18n.getListFormatter().format(nomes),
    get protegidas() {
      return game.keyboard?.constructor?.PROTECTED_KEYS ?? [];
    },
    acoes() {
      const mapa = game.settings.get("core", "keybindings") ?? {};
      const lista = [];
      for (const [id, a] of game.keybindings.actions) {
        if (a.restricted && !game.user.isGM) continue;
        lista.push({
          id,
          namespace: a.namespace,
          categoria: categoria(a.namespace),
          nome: game.i18n.localize(a.name),
          dica: a.hint ? game.i18n.localize(a.hint) : "",
          restrita: Boolean(a.restricted),
          segurar: typeof a.onUp === "function",
          repeticao: Boolean(a.repeat),
          reservados: a.reservedModifiers ?? [],
          fixos: deepClone(a.uneditable ?? []),
          editaveis: deepClone(mapa[id] ?? a.editable ?? []),
          padrao: deepClone(a.editable ?? []),
          alterada: Object.hasOwn(mapa, id),
          movimento: movimentoDe(id),
          ordem: a.order ?? 0
        });
      }
      return lista;
    },
    rotulo: (binding) => rotuloAtalho(binding, layout),
    async layout() {
      try {
        const mapa = await navigator.keyboard?.getLayoutMap?.();
        layout = mapa?.size ? mapa : null;
      }
      catch {
        layout = null;
      }
      return layout;
    },
    ocupacoes,
    donos,
    /**
     * Guarda (ou tira, com undefined) a mudança de uma tecla do navegador ou do sistema. Só o módulo usa: o navegador
     * e o sistema continuam iguais.
     */
    async definirPedra(chave, lista) {
      const atual = lerPedras();
      if (lista === undefined) delete atual[chave];
      else atual[chave] = lista.map((b) => ({ key: b.key, modifiers: [...(b.modifiers ?? [])] }));
      await game.settings.set(MODULE_ID, "pedras", atual);
    },
    ponteiro: usosDoPonteiro,
    controles: () => [...(navigator.getGamepads?.() ?? [])].filter(Boolean)
      .map((gp) => ({ id: idControle(gp.id), nome: gp.id })),
    uso: () => perfis.estatisticasUso(),
    perfis: () => {
      const dados = perfis.lerPerfis();
      return { ativo: dados.ativo, lista: dados.lista.map(({ id, nome }) => ({ id, nome })) };
    },
    definir(acaoId, editaveis) {
      const i = acaoId.indexOf(".");
      return game.keybindings.set(acaoId.slice(0, i), acaoId.slice(i + 1), editaveis ? deepClone(editaveis) : undefined);
    },
    async definirVarios(mudancas) {
      const mapa = perfis.mapeamentoAtual();
      for (const [id, lista] of Object.entries(mudancas)) {
        if (lista === undefined) delete mapa[id];
        else mapa[id] = lista;
      }
      await perfis.aplicarMapeamento(mapa);
    },
    ativar: perfis.ativarPerfil,
    criar: (nome) => perfis.criarPerfil(nome),
    duplicar: perfis.duplicarPerfil,
    renomear: perfis.renomearPerfil,
    apagar: perfis.apagarPerfil,
    restaurarPadrao: perfis.restaurarPadrao,
    exportar: perfis.exportarPerfil,
    async importar() {
      const arquivo = await escolherArquivo();
      if (!arquivo) return;
      try {
        const perfil = await perfis.importarPerfil(await foundry.utils.readTextFromFile(arquivo));
        ui.notifications.info(t("Perfis.Importado", { nome: perfil.nome }));
      }
      catch (err) {
        ui.notifications.error(err.message || t("Perfis.ArquivoInvalido"));
      }
    },
    async confirmar(titulo, texto) {
      const sim = await DialogV2.confirm({
        window: { title: titulo },
        content: `<p>${escapeHTML(texto)}</p>`,
        rejectClose: false,
        modal: true
      });
      return sim === true;
    },
    async pedirNome(titulo, valor) {
      const nome = await DialogV2.prompt({
        window: { title: titulo },
        content: `<input type="text" name="nome" value="${escapeHTML(valor ?? "")}" autofocus>`,
        ok: { callback: (_event, botao) => botao.form.elements.nome.value.trim() },
        rejectClose: false,
        modal: true
      });
      return (typeof nome === "string") ? nome : null;
    },
    aviso: (texto, tipo = "info") => ui.notifications[tipo]?.(texto),
    aoMudar: perfis.aoMudar
  };
}

export class AppPerfis extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "ergonomic-controls-perfis",
    classes: ["ergonomic-controls-janela"],
    window: {
      title: "ERGONOMIC_CONTROLS.App.Titulo",
      icon: "fa-solid fa-keyboard",
      resizable: true,
      contentClasses: ["ec-conteudo"]
    },
    position: { width: 1280, height: 780 }
  };

  /** @type {InterfacePerfis|null} */
  #interface = null;

  /** @override */
  async _renderHTML() {
    this.#interface ??= new InterfacePerfis(criarFonte());
    await this.#interface.render();
    return this.#interface.el;
  }

  /** @override */
  _replaceHTML(resultado, conteudo) {
    if (resultado.parentElement !== conteudo) conteudo.replaceChildren(resultado);
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);
    this.#interface?.destruir();
    this.#interface = null;
  }
}
