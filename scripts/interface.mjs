/**
 * Interface dos perfis de controle: ações com atalho à esquerda; teclado, mouse e controle à direita; captura de
 * tecla, botão do mouse ou do controle; avaliação de ergonomia de cada atalho (ergonomia.mjs).
 *
 * Tudo o que vem do Foundry passa pelo adaptador `fonte` (app.mjs), o que deixa a interface testável fora dele.
 */

import {
  TECLADO, MOUSE, NIVEIS, NIVEL, rotuloTecla, infoEntrada, avaliar, sugerir, colidem, chaveAtalho, ehModificador,
  ehDoSistema, maosDe, lerControle, rotuloControle, codigoBotao, codigoEixo
} from "./ergonomia.mjs";
import { ehGesto, lerGesto, teclasDe, montarPressoes, escreverGesto, arredondarSegurar, TEMPOS, LIMITES } from "./gestos.mjs";

/** Filtros da lista; "pedras" mostra as stone keys: atalhos do navegador e do sistema e o movimento do token. */
const FILTROS = ["comAtalho", "todas", "longe", "colisoes", "pedras"];

/**
 * Entrada de controle vista logo no início da captura já estava ativa (botão segurado, analógico com folga): fica de
 * fora até ser solta.
 */
const JA_ATIVA_MS = 250;

/** Recarregar, tela cheia e console: na captura também ficam com o navegador (o Foundry não as aceita em atalho). */
const DO_NAVEGADOR = new Set(["F5", "F11", "F12"]);

/** Tecla que representa cada modificador no desenho (a da mão esquerda). */
const TECLA_DO_MODIFICADOR = { Control: "ControlLeft", Shift: "ShiftLeft", Alt: "AltLeft" };

/** Modificador do Foundry de cada tecla modificadora (Cmd conta como Control no Mac, como no KeyboardManager). */
const MAC = /mac|iphone|ipad/i.test(globalThis.navigator?.userAgentData?.platform || globalThis.navigator?.platform || "");
const MODIFICADOR_DA_TECLA = {
  ControlLeft: "Control", ControlRight: "Control", ShiftLeft: "Shift", ShiftRight: "Shift", AltLeft: "Alt",
  AltRight: "Alt", ...(MAC ? { MetaLeft: "Control", MetaRight: "Control" } : {})
};

/** Consultas de mídia que mudam o que o navegador trata antes da página (tela cheia, janela de app). */
const CONSULTAS_DO_MODO = ["(display-mode: fullscreen)", "(display-mode: standalone)", "(display-mode: minimal-ui)",
  "(display-mode: window-controls-overlay)"];

/** Ícone de cada função do navegador e do sistema no desenho. */
const ICONE_DA_FUNCAO = {
  recarregar: "fa-rotate-right", recarregarSemCache: "fa-rotate-right", telaCheia: "fa-expand",
  ferramentas: "fa-code", console: "fa-terminal", inspecionar: "fa-crosshairs", buscar: "fa-magnifying-glass",
  zoom: "fa-magnifying-glass-plus", selecionarTudo: "fa-object-group", copiar: "fa-copy", recortar: "fa-scissors",
  colar: "fa-paste", desfazer: "fa-rotate-left", refazer: "fa-arrow-rotate-right", fecharAba: "fa-xmark",
  fecharJanela: "fa-xmark", novaAba: "fa-plus", reabrirAba: "fa-clock-rotate-left", novaJanela: "fa-window-restore",
  trocarAba: "fa-right-left", sair: "fa-power-off", abrirLink: "fa-up-right-from-square",
  trocarJanela: "fa-right-left", fecharPrograma: "fa-power-off", gerenciadorTarefas: "fa-list-check",
  menuIniciar: "fa-table-cells-large", spotlight: "fa-magnifying-glass"
};

/** Modificadores do atalho (nenhum quando a própria tecla é modificadora). */
function modificadoresDoAtalho(binding) {
  return ehModificador(binding.key) ? [] : (binding.modifiers ?? []);
}

/** Se o atalho é da camada (mesmo conjunto de modificadores). */
function daCamada(binding, camada) {
  const mods = modificadoresDoAtalho(binding);
  return (mods.length === camada.size) && mods.every((m) => camada.has(m));
}

/** Botões do controle no desenho: [índice, x, y, largura, altura, forma], em unidades da caixa de 20 × 8,6. */
const CONTROLE_DESENHO = [
  [6, 1.4, 0, 3.2, 0.9, "gatilho"], [4, 1.4, 1.05, 3.2, 0.75, "bumper"],
  [7, 15.4, 0, 3.2, 0.9, "gatilho"], [5, 15.4, 1.05, 3.2, 0.75, "bumper"],
  [8, 7.5, 3.1, 1.3, 0.75, "centro"], [16, 9.4, 2.3, 1.2, 1.2, "redondo"], [9, 11.2, 3.1, 1.3, 0.75, "centro"],
  [3, 15.9, 2.4, 1.2, 1.2, "redondo"], [2, 14.7, 3.6, 1.2, 1.2, "redondo"], [1, 17.1, 3.6, 1.2, 1.2, "redondo"],
  [0, 15.9, 4.8, 1.2, 1.2, "redondo"],
  [12, 6.2, 5.0, 1, 1, "seta"], [13, 6.2, 7.0, 1, 1, "seta"], [14, 5.2, 6.0, 1, 1, "seta"], [15, 7.2, 6.0, 1, 1, "seta"]
];

/** Analógicos: botão do clique, eixos e posição (canto do anel de 3 × 3). */
const ANALOGICOS = [
  { botao: 10, eixoX: 0, eixoY: 1, x: 2.4, y: 2.6 },
  { botao: 11, eixoX: 2, eixoY: 3, x: 11.6, y: 5.0 }
];

const normalizar = (s) => String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const escapar = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
})[c]);

function no(tag, classe, filhos) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (filhos !== undefined) {
    e.append(...[].concat(filhos).filter((f) => (f !== null) && (f !== undefined) && (f !== false)));
  }
  return e;
}

function botao(classe, conteudo, dados = {}, dica) {
  const b = no("button", classe, conteudo);
  b.type = "button";
  Object.assign(b.dataset, dados);
  if (dica) {
    b.dataset.tooltipText = dica;
    b.setAttribute("aria-label", dica);
  }
  return b;
}

function icone(classe) {
  const i = no("i", classe);
  i.setAttribute("inert", "");
  return i;
}

/** Modificadores de um evento, como o Foundry entende (Meta conta como Control). */
function modificadoresDo(event) {
  const mods = [];
  if (event.ctrlKey || event.metaKey) mods.push("Control");
  if (event.shiftKey) mods.push("Shift");
  if (event.altKey) mods.push("Alt");
  return mods;
}

export class InterfacePerfis {
  #desligar = [];
  #dados = null;
  #fimDaCaptura = null;
  /** Teclas apertadas agora (para acender no desenho e para a camada de modificadores). */
  #apertadas = new Set();

  /** @param {object} fonte  Adaptador (ver app.mjs). */
  constructor(fonte) {
    this.fonte = fonte;
    this.estado = {
      busca: "", filtro: "comAtalho", entrada: null, selecionada: null, foco: null, aba: "teclado",
      recolhidas: new Set(), camada: new Set()
    };
    this.captura = null;
    this.layout = null;
    this.el = no("div", "ec-perfis");
    this.#montar();
    this.#ligar();
  }

  get t() {
    return this.fonte.t;
  }

  /* -------------------------------------------- */
  /*  Estrutura                                   */
  /* -------------------------------------------- */

  #montar() {
    this.barra = no("header", "ec-barra");
    this.busca = no("input", "ec-busca");
    this.busca.type = "search";
    this.busca.placeholder = this.t("Lista.Buscar");
    this.busca.spellcheck = false;
    this.filtros = no("div", "ec-filtros");
    this.grupos = no("div", "ec-grupos");
    this.lista = no("section", "ec-lista", [no("div", "ec-ferramentas", [this.busca, this.filtros]), this.grupos]);
    this.abas = no("nav", "ec-abas");
    this.dispositivos = no("div", "ec-dispositivos");
    this.legenda = no("div", "ec-legenda");
    this.avaliacao = no("div", "ec-avaliacao");
    this.visual = no("section", "ec-visual", [this.abas, this.dispositivos, this.legenda, this.avaliacao]);
    // Com o foco aqui, o KeyboardManager não dispara atalhos (hasFocus com data-keyboard-focus), inclusive os do
    // controle, que o GamepadManager dispara direto na janela, antes de qualquer ouvinte da interface.
    this.sumidouro = no("span", "ec-sumidouro");
    this.sumidouro.tabIndex = -1;
    this.sumidouro.dataset.keyboardFocus = "true";
    this.el.append(this.barra, no("div", "ec-corpo", [this.lista, this.visual]), this.sumidouro);
  }

  #ligar() {
    const ao = (alvo, tipo, fn, opcoes) => {
      alvo.addEventListener(tipo, fn, opcoes);
      this.#desligar.push(() => alvo.removeEventListener(tipo, fn, opcoes));
    };
    ao(this.el, "click", (e) => this.#aoClicar(e));
    ao(this.el, "change", (e) => this.#aoMudarCampo(e));
    ao(this.busca, "input", () => {
      const tinhaTecla = Boolean(this.estado.entrada);
      this.estado.entrada = null;
      this.estado.busca = this.busca.value;
      this.#renderLista();
      if (tinhaTecla) this.#renderVisual();
    });
    ao(this.el, "pointerover", (e) => this.#aoPassar(e));
    ao(this.el, "pointerout", (e) => this.#aoPassar(e, true));
    ao(window, "keydown", (e) => this.#acender(e.code, true));
    ao(window, "keyup", (e) => this.#acender(e.code, false));
    ao(window, "blur", () => this.#soltarTodas());
    ao(document, "visibilitychange", () => {
      if (document.hidden) this.#soltarTodas();
    });
    ao(document, "fullscreenchange", () => this.render());
    for (const consulta of CONSULTAS_DO_MODO) {
      const mql = window.matchMedia?.(consulta);
      if (mql) ao(mql, "change", () => this.render());
    }
    ao(window, "gamepadconnected", () => this.render());
    ao(window, "gamepaddisconnected", () => this.render());
    const fim = this.fonte.aoMudar?.(() => this.render());
    if (fim) this.#desligar.push(fim);
  }

  destruir() {
    this.#pararCaptura(false);
    for (const fn of this.#desligar) fn();
    this.#desligar = [];
    this.el.remove();
  }

  /* -------------------------------------------- */
  /*  Dados                                       */
  /* -------------------------------------------- */

  #calcular() {
    const fonte = this.fonte;
    const uso = fonte.uso();
    const protegidas = fonte.protegidas ?? [];
    const acoes = fonte.acoes().map((a) => ({
      ...a,
      atalhos: [
        ...a.fixos.map((binding) => ({ binding, fixo: true, indice: -1 })),
        ...a.editaveis.map((binding, indice) => ({ binding, fixo: false, indice }))
      ]
    }));
    const porTecla = new Map();
    const indexar = (k, atalho) => {
      if (!porTecla.has(k)) porTecla.set(k, []);
      porTecla.get(k).push(atalho);
    };
    for (const acao of acoes) {
      for (const atalho of acao.atalhos) {
        atalho.acao = acao;
        atalho.gesto = lerGesto(atalho.binding.key);
        atalho.teclas = teclasDe(atalho.binding.key);
        indexar(atalho.binding.key, atalho);
        if (atalho.gesto) for (const c of atalho.teclas) indexar(c, atalho);
      }
    }

    // Mãos: a do movimento do token nas teclas dele (stone keys), a outra no mouse.
    const movimento = [];
    for (const acao of acoes) {
      if (acao.movimento !== "token") continue;
      acao.pedra = acao.atalhos.length > 0;
      for (const { binding } of acao.atalhos) {
        if (!modificadoresDoAtalho(binding).length && !lerControle(binding.key) && !ehGesto(binding.key)) movimento.push(binding.key);
      }
    }
    const maos = maosDe(movimento);

    // O que continua com o navegador e com o sistema: entra no desenho como stone key, numa lista própria e na
    // avaliação dos atalhos do Foundry nas mesmas teclas.
    const ocupacoes = fonte.ocupacoes?.() ?? [];
    const externosPorTecla = new Map();
    for (const ocupacao of ocupacoes) {
      for (const binding of ocupacao.atalhos) {
        if (!externosPorTecla.has(binding.key)) externosPorTecla.set(binding.key, []);
        externosPorTecla.get(binding.key).push({ ocupacao, binding });
      }
    }
    const externosDe = (binding, reservados) => [...new Set(teclasDe(binding.key).flatMap((key) => (externosPorTecla.get(key) ?? [])
      .filter((x) => colidem({ key, modifiers: binding.modifiers ?? [] }, reservados, x.binding, [])).map((x) => x.ocupacao)))];
    const pesado = (o) => o.essencial || o.reservada || (o.dono === "sistema");

    // Colisões entre ações diferentes. Teclas modificadoras sozinhas (Shift para pular diálogo, Alt para destacar)
    // somam por desenho e ficam de fora.
    for (const [tecla, lista] of porTecla) {
      if ((lista.length < 2) || ehModificador(tecla)) continue;
      for (let i = 0; i < lista.length; i++) {
        for (let j = i + 1; j < lista.length; j++) {
          const a = lista[i];
          const b = lista[j];
          if (a.acao === b.acao) continue;
          if (!colidem(a.binding, a.acao.reservados, b.binding, b.acao.reservados)) continue;
          (a.colisoes ??= new Set()).add(b.acao);
          (b.colisoes ??= new Set()).add(a.acao);
        }
      }
    }

    // Composto e tecla sozinha na mesma camada: a tecla sozinha com ação de um toque espera o composto decidir
    // (gestos.mjs); toques seguidos numa tecla de movimento disparam sem querer.
    const esperas = new Map();
    const anotar = (atalho, item) => {
      if (!esperas.has(atalho)) esperas.set(atalho, []);
      esperas.get(atalho).push(item);
    };
    for (const acao of acoes) {
      for (const g of acao.atalhos) {
        if (!g.gesto) continue;
        const pressoes = g.gesto.pressoes;
        const camada = new Set(g.binding.modifiers ?? []);
        const espera = (pressoes.length >= 2) ? TEMPOS.sequencia / 1000 : (pressoes[0].segurar ? null : TEMPOS.juntas / 1000);
        for (const c of pressoes[0].teclas) {
          for (const a of porTecla.get(c) ?? []) {
            if (a.gesto || (a.binding.key !== c) || !daCamada(a.binding, camada) || (a.acao === acao)) continue;
            if (a.acao.segurar || a.acao.repeticao) {
              if (a.acao.movimento && (pressoes.length >= 2)) g.movimento = true;
              continue;
            }
            const dados = { tecla: fonte.rotulo({ key: c, modifiers: [...camada] }), gesto: fonte.rotulo(g.binding), nome: a.acao.nome, s: espera };
            const tipo = (espera === null) ? "Soltura" : "Tempo";
            anotar(g, { id: `esperaSozinha${tipo}`, dados });
            anotar(a, { id: `esperaComposto${tipo}`, dados });
          }
        }
      }
    }

    const niveis = [0, 0, 0, 0, 0];
    const contagem = { comAtalho: 0, todas: acoes.length, longe: 0, colisoes: 0, pedras: 0 };
    for (const acao of acoes) {
      acao.vezes = uso.contagem[acao.id] ?? 0;
      let melhor = null;
      let pedras = 0;
      for (const atalho of acao.atalhos) {
        atalho.externos = externosDe(atalho.binding, acao.reservados);
        atalho.conflitoExterno = atalho.externos.some(pesado);
        atalho.avaliacao = avaliar(atalho.binding, {
          acao: { segurar: acao.segurar, repeticao: acao.repeticao },
          maos,
          pedra: acao.pedra ? "movimento" : undefined,
          protegidas,
          colisoes: [...(atalho.colisoes ?? [])].map((o) => o.nome),
          ocupacoes: atalho.externos,
          vezes: acao.vezes,
          frequente: uso.frequentes.has(acao.id),
          movimento: Boolean(atalho.movimento),
          esperas: esperas.get(atalho)
        });
        // Stone key é só aviso: não entra no alcance da ação, nas contagens nem no veredito.
        if (atalho.avaliacao.pedra) pedras++;
        else melhor = (melhor === null) ? atalho.avaliacao.nivel : Math.min(melhor, atalho.avaliacao.nivel);
      }
      if (pedras && (pedras === acao.atalhos.length)) acao.pedra = true;
      acao.melhor = melhor;
      acao.colide = acao.atalhos.some((a) => a.colisoes?.size || a.conflitoExterno);
      if (!acao.atalhos.length) continue;
      contagem.comAtalho++;
      if (melhor !== null) {
        niveis[melhor]++;
        if (melhor >= NIVEL.TROCA) contagem.longe++;
      }
      if (acao.colide) contagem.colisoes++;
      if (acao.pedra) contagem.pedras++;
    }

    // Linhas do navegador e do sistema (filtro "pedras"), fora das contagens do Foundry. As editáveis guardam a
    // mudança só no módulo (fonte.definirPedra): muda o que o desenho e a avaliação mostram, não o navegador.
    const donos = fonte.donos?.() ?? {};
    const titulo = { navegador: this.t("Navegador.Navegador"), sistema: this.t("Navegador.Sistema") };
    const externas = ocupacoes.map((o, i) => {
      const editavel = Boolean(o.editavel);
      const externa = {
        id: `externa.${o.dono}.${o.id}`, externa: o.dono, ocupacao: o, nome: o.nome, dica: null, restrita: false,
        categoria: { id: `externa.${o.dono}`, titulo: donos[o.dono] ? `${titulo[o.dono]} · ${donos[o.dono]}` : titulo[o.dono],
          ordem: (o.dono === "navegador") ? 8 : 9 },
        fixos: editavel ? [] : o.atalhos, editaveis: editavel ? o.atalhos : [], padrao: o.padrao ?? o.atalhos,
        alterada: Boolean(o.alterada), editavel, reservados: [], ordem: i, vezes: 0
      };
      externa.atalhos = o.atalhos.map((binding, indice) => {
        const foundry = (porTecla.get(binding.key) ?? []).filter((a) => colidem(a.binding, a.acao.reservados, binding, []));
        const nomes = [...new Set(foundry.map((a) => a.acao.nome))];
        return { binding, fixo: !editavel, indice: editavel ? indice : -1, acao: externa, foundry: nomes,
          conflitoExterno: nomes.length && pesado(o), avaliacao: avaliar(binding, { colisoes: nomes, pedra: "externa", maos }) };
      });
      externa.melhor = externa.atalhos.length ? Math.min(...externa.atalhos.map((a) => a.avaliacao.nivel)) : null;
      externa.colide = externa.atalhos.some((a) => a.conflitoExterno);
      return externa;
    });
    contagem.pedras += externas.length;

    const porId = new Map([...acoes, ...externas].map((a) => [a.id, a]));
    return { acoes, externas, porId, porTecla, externosPorTecla, contagem, niveis, uso, protegidas, maos };
  }

  /** Se um atalho novo dispararia junto com algum existente, do Foundry, do navegador ou do sistema. */
  #ocupada(binding) {
    for (const atalho of this.#dados.porTecla.get(binding.key) ?? []) {
      if (colidem(binding, [], atalho.binding, atalho.acao.reservados)) return true;
    }
    return (this.#dados.externosPorTecla.get(binding.key) ?? []).some((x) => colidem(binding, [], x.binding, []));
  }

  /** Camada de modificadores do desenho: a das teclas apertadas, senão a escolhida. */
  #camadaAtual() {
    const apertados = new Set([...this.#apertadas].map((c) => MODIFICADOR_DA_TECLA[c]).filter(Boolean));
    return apertados.size ? apertados : this.estado.camada;
  }

  /** Tecla apertada ou solta: muda a camada quando é modificadora. */
  #registrarTecla(code, apertada) {
    if (!code) return;
    const antes = [...this.#camadaAtual()].sort().join();
    if (apertada) this.#apertadas.add(code);
    else this.#apertadas.delete(code);
    if ([...this.#camadaAtual()].sort().join() !== antes) this.#renderDesenho();
  }

  #soltarTodas() {
    if (!this.#apertadas.size) return;
    const tinha = [...this.#apertadas].some((c) => MODIFICADOR_DA_TECLA[c]);
    this.#apertadas.clear();
    if (tinha) this.#renderDesenho();
  }

  #numero(n) {
    return this.fonte.numero?.(n) ?? String(n);
  }

  /** Quantas vezes a ação foi usada (uma vez tem texto próprio). */
  #usada(n) {
    return (n === 1) ? this.t("Lista.UsadaUma") : this.t("Lista.Usada", { n: this.#numero(n) });
  }

  #focoAtual() {
    const { foco, selecionada } = this.estado;
    const acao = this.#dados.porId.get(foco?.acaoId ?? selecionada);
    if (!acao) return null;
    const atalho = foco ? acao.atalhos.find((a) => chaveAtalho(a.binding) === foco.chave) : acao.atalhos[0];
    return atalho ? { acao, atalho } : null;
  }

  /* -------------------------------------------- */
  /*  Renderização                                */
  /* -------------------------------------------- */

  async render() {
    if (this.layout === null) {
      try { this.layout = (await this.fonte.layout?.()) ?? false; }
      catch { this.layout = false; }
    }
    this.#dados = this.#calcular();
    if (this.estado.selecionada && !this.#dados.porId.has(this.estado.selecionada)) this.estado.selecionada = null;
    this.#renderBarra();
    this.#renderFiltros();
    this.#renderLista();
    this.#renderVisual();
  }

  #renderBarra() {
    const { ativo, lista } = this.fonte.perfis();
    const seletor = no("select", "ec-perfil");
    seletor.dataset.campo = "perfil";
    seletor.setAttribute("aria-label", this.t("Perfis.Perfil"));
    for (const p of lista) {
      const opcao = no("option", null, [p.nome]);
      opcao.value = p.id;
      opcao.selected = p.id === ativo;
      seletor.append(opcao);
    }
    const botoes = [
      botao("ec-icone", [icone("fa-solid fa-plus")], { acao: "novo" }, this.t("Perfis.Novo")),
      botao("ec-icone", [icone("fa-solid fa-copy")], { acao: "duplicar" }, this.t("Perfis.Duplicar")),
      botao("ec-icone", [icone("fa-solid fa-pen")], { acao: "renomear" }, this.t("Perfis.Renomear")),
      botao("ec-icone", [icone("fa-solid fa-trash")], { acao: "apagar" }, this.t("Perfis.Apagar")),
      no("span", "ec-espaco"),
      botao("ec-icone", [icone("fa-solid fa-file-export")], { acao: "exportar" }, this.t("Perfis.Exportar")),
      botao("ec-icone", [icone("fa-solid fa-file-import")], { acao: "importar" }, this.t("Perfis.Importar")),
      botao("ec-icone", [icone("fa-solid fa-rotate-left")], { acao: "padrao" }, this.t("Perfis.Padrao"))
    ];
    for (const b of botoes) {
      if (b.tagName !== "BUTTON") continue;
      b.disabled = (b.dataset.acao === "apagar") && (lista.length <= 1);
    }
    this.barra.replaceChildren(no("label", "ec-rotulo-perfil", [this.t("Perfis.Perfil")]), seletor, ...botoes);
  }

  #renderFiltros() {
    const c = this.#dados.contagem;
    const ativo = this.estado.entrada ? null : this.estado.filtro;
    const chips = FILTROS.map((f) => botao(`ec-filtro${ativo === f ? " ec-ativo" : ""}`,
      [this.t(`Filtros.${f}`), no("span", "ec-num", [this.#numero(c[f])])], { filtro: f }));
    this.filtros.replaceChildren(...chips);
  }

  #passa(acao, termo) {
    const { filtro, entrada, selecionada } = this.estado;
    // Tecla clicada no desenho: tudo o que usa a tecla (do Foundry, do navegador e do sistema), em qualquer camada, ou
    // só na camada de modificadores escolhida.
    if (entrada) {
      return acao.atalhos.some((a) => teclasDe(a.binding.key).includes(entrada.key)
        && (!entrada.camada || daCamada(a.binding, new Set(entrada.modifiers))));
    }
    if ((filtro === "pedras") ? !(acao.externa || acao.pedra) : Boolean(acao.externa)) return false;
    const fixa = acao.id === selecionada;
    if ((filtro === "comAtalho") && !acao.atalhos.length && !fixa) return false;
    if ((filtro === "longe") && !((acao.melhor ?? 0) >= NIVEL.TROCA) && !fixa) return false;
    if ((filtro === "colisoes") && !acao.colide && !fixa) return false;
    if (!termo) return true;
    if (normalizar(acao.nome).includes(termo) || normalizar(acao.categoria.titulo).includes(termo)) return true;
    return acao.atalhos.some((a) => normalizar(this.fonte.rotulo(a.binding)).includes(termo));
  }

  #renderLista() {
    if (!this.#dados) return;
    const topo = this.grupos.scrollTop;
    const termo = normalizar(this.estado.busca.trim());
    const grupos = new Map();
    for (const acao of [...this.#dados.acoes, ...this.#dados.externas]) {
      if (!this.#passa(acao, termo)) continue;
      const c = acao.categoria;
      if (!grupos.has(c.id)) grupos.set(c.id, { ...c, acoes: [] });
      grupos.get(c.id).acoes.push(acao);
    }
    const ordenados = [...grupos.values()].sort((a, b) => (a.ordem - b.ordem) || a.titulo.localeCompare(b.titulo));
    const frag = document.createDocumentFragment();
    if ((this.estado.filtro === "pedras") && !this.estado.entrada) {
      frag.append(no("p", "ergonomic-controls-aviso ec-aviso-pedras", [icone("fa-solid fa-circle-info"), " ",
        this.t("Avisos.Navegador")]));
    }
    for (const grupo of ordenados) frag.append(this.#grupo(grupo));
    if (!ordenados.length) frag.append(no("p", "ec-vazio", [this.t("Lista.Nada")]));
    this.grupos.replaceChildren(frag);
    this.grupos.scrollTop = topo;
  }

  #grupo(grupo) {
    const recolhido = this.estado.recolhidas.has(grupo.id) && !this.estado.busca;
    const todas = [...this.#dados.acoes, ...this.#dados.externas].filter((a) => a.categoria.id === grupo.id);
    const comAtalho = todas.filter((a) => a.atalhos.length).length;
    const externo = grupo.id.startsWith("externa.");
    const limpavel = !externo && todas.some((a) => a.editaveis.length);
    const topo = no("header", "ec-grupo-topo", [
      botao("ec-recolher", [icone(`fa-solid fa-caret-${recolhido ? "right" : "down"}`)], { grupo: grupo.id }),
      no("h4", null, [grupo.titulo]),
      no("span", "ec-num", [`${this.#numero(comAtalho)}/${this.#numero(todas.length)}`]),
      limpavel ? botao("ec-icone ec-limpar", [icone("fa-solid fa-eraser")], { limparGrupo: grupo.id },
        this.t("Lista.LimparGrupo")) : null
    ]);
    const secao = no("section", `ec-grupo${recolhido ? " ec-recolhido" : ""}${externo ? " ec-grupo-externo" : ""}`, [topo]);
    if (!recolhido) secao.append(no("ol", "ec-acoes", grupo.acoes.sort((a, b) => a.ordem - b.ordem).map((a) => this.#linha(a))));
    return secao;
  }

  #linha(acao) {
    const li = no("li", "ec-acao");
    li.dataset.acaoId = acao.id;
    if (acao.restrita) li.classList.add("ec-restrita");
    if (acao.externa) li.classList.add("ec-externa");
    if (acao.id === this.estado.selecionada) li.classList.add("ec-selecionada");
    const pedra = Boolean(acao.externa || acao.pedra);
    const ponto = no("span", `ec-ponto ${pedra ? "ec-pedra" : (acao.melhor === null) ? "ec-sem" : `ec-n${acao.melhor}`}`);
    if (pedra) ponto.dataset.tooltipText = this.t("Visual.Pedra");
    else if (acao.melhor !== null) ponto.dataset.tooltipText = this.#dicaNivel(acao.melhor);
    const nome = no("span", "ec-nome", [acao.nome]);
    if (acao.dica) nome.dataset.tooltipText = acao.dica;
    const uso = acao.vezes ? no("span", "ec-uso", [this.#numero(acao.vezes)]) : null;
    if (uso) uso.dataset.tooltipText = this.#usada(acao.vezes);
    const atalhos = no("span", "ec-atalhos");
    for (const atalho of acao.atalhos) atalhos.append(this.#chip(acao, atalho));
    const capturandoNova = (this.captura?.acaoId === acao.id) && (this.captura.indice === null);
    if (capturandoNova) atalhos.append(no("span", "ec-atalho ec-capturando-chip", [this.t("Captura.Aperte")]));
    else if (!acao.externa || acao.editavel) atalhos.append(botao("ec-mais", [icone("fa-solid fa-plus")], { acaoId: acao.id }, this.t("Lista.Novo")));
    if (acao.alterada) {
      const padrao = acao.padrao.map((b) => this.fonte.rotulo(b)).join(", ") || this.t("Lista.Nenhum");
      atalhos.append(botao("ec-resetar", [icone("fa-solid fa-rotate-left")], { acaoId: acao.id },
        this.t("Lista.Padrao", { atalhos: padrao })));
    }
    li.append(ponto, nome, uso ?? "", atalhos);
    return li;
  }

  /**
   * Rótulo de um atalho na lista e na avaliação, com balão: toques seguidos numa tecla ("Q" com ×2), segurar uma tecla
   * por um tempo ("H" com ↓; o tempo fica na avaliação) e ação que age enquanto a tecla fica apertada (↓; menos
   * movimento e câmera, que são contínuos). Outros compostos (juntas, sequência) ficam no texto.
   */
  #conteudoAtalho(binding, acao) {
    const gesto = lerGesto(binding.key);
    const modifiers = binding.modifiers ?? [];
    let balao = null;
    let texto = this.fonte.rotulo(binding);
    if (gesto) {
      const p = gesto.pressoes;
      const uma = p.every((x) => (x.teclas.length === 1) && (x.teclas[0] === p[0].teclas[0]));
      if (uma && (p.length >= 2) && p.every((x) => !x.segurar)) {
        texto = this.fonte.rotulo({ key: p[0].teclas[0], modifiers });
        balao = `×${p.length}`;
      }
      else if ((p.length === 1) && (p[0].teclas.length === 1) && p[0].segurar) {
        texto = this.fonte.rotulo({ key: p[0].teclas[0], modifiers });
        balao = "↓";
      }
    }
    else if (acao?.segurar && !acao.movimento) balao = "↓";
    return { texto, balao: balao ? no("span", "ec-balao", [balao]) : null };
  }

  #chip(acao, atalho) {
    const nivel = atalho.avaliacao.nivel;
    const chave = chaveAtalho(atalho.binding);
    const capturando = (this.captura?.acaoId === acao.id) && (this.captura.indice === atalho.indice) && !atalho.fixo;
    if (capturando) return no("span", "ec-atalho ec-capturando-chip", [this.t("Captura.Aperte")]);
    const pedra = atalho.avaliacao.pedra || Boolean(acao.externa);
    const chip = no("span", `ec-atalho ${pedra ? "ec-pedra" : `ec-n${nivel}`}`);
    Object.assign(chip.dataset, { acaoId: acao.id, chave, key: atalho.binding.key,
      mods: (atalho.binding.modifiers ?? []).join(",") });
    if (atalho.fixo) chip.classList.add("ec-fixo");
    if (atalho.colisoes?.size || atalho.conflitoExterno) chip.classList.add("ec-colide");
    const foco = this.estado.foco;
    if (foco && (foco.acaoId === acao.id) && (foco.chave === chave)) chip.classList.add("ec-foco");
    const { texto, balao } = this.#conteudoAtalho(atalho.binding, acao);
    const rotulo = botao("ec-rotulo", [texto], { acaoId: acao.id, chave });
    rotulo.dataset.tooltipText = pedra ? this.t("Visual.Pedra") : this.#dicaNivel(nivel);
    chip.append(rotulo);
    if (balao) {
      chip.classList.add("ec-com-balao");
      chip.append(balao);
    }
    if (!atalho.fixo) {
      chip.append(
        botao("ec-mini", [icone("fa-solid fa-pen")], { chipAcao: "trocar", acaoId: acao.id, indice: atalho.indice },
          this.t("Lista.Trocar")),
        botao("ec-mini", [icone("fa-solid fa-xmark")], { chipAcao: "tirar", acaoId: acao.id, indice: atalho.indice },
          this.t("Lista.Tirar"))
      );
    }
    return chip;
  }

  #renderVisual() {
    if (!this.#dados) return;
    this.abas.replaceChildren(...["teclado", "controle"].map((aba) => botao(
      `ec-aba${this.estado.aba === aba ? " ec-ativa" : ""}`, [this.t(`Visual.${aba}`)], { aba })));
    this.#renderDesenho();
    const item = (classe, texto, dica) => {
      const e = no("span", `ec-nivel-legenda ${classe}`, [no("span", "ec-amostra"), texto]);
      if (dica) e.dataset.tooltipText = dica;
      return e;
    };
    this.legenda.replaceChildren(
      ...NIVEIS.map((n, i) => item(`ec-n${i}`, this.t(`Niveis.${n}`), this.#dicaNivel(i))),
      no("span", "ec-legenda-separador"),
      item("ec-legenda-sobre", this.t("Visual.Sobreposta")),
      item("ec-legenda-composta", this.t("Visual.Composta")),
      item("ec-legenda-pedra", this.t("Visual.Pedra"))
    );
    this.#renderAvaliacao();
  }

  /** Teclado e mouse, ou controle, conforme a aba. */
  #renderDesenho() {
    if (!this.#dados) return;
    this.dispositivos.className = `ec-dispositivos${this.captura ? " ec-capturando" : ""}`;
    if (this.estado.aba === "teclado") {
      this.dispositivos.replaceChildren(no("div", "ec-teclado-mouse", [this.#teclado(), this.#mouse()]));
      if (!this.captura) {
        for (const code of this.#apertadas) {
          for (const el of this.dispositivos.querySelectorAll(`[data-code="${CSS.escape(code)}"]`)) el.classList.add("ec-viva");
        }
      }
    }
    else this.dispositivos.replaceChildren(this.#desenhoControle());
  }

  /** Teclas a destacar: as do atalho em foco e as da ação selecionada, com seus modificadores. */
  #destaques() {
    const sel = new Set();
    const mods = new Set();
    const foco = this.#focoAtual();
    const acao = foco?.acao ?? this.#dados.porId.get(this.estado.selecionada);
    for (const atalho of acao?.atalhos ?? []) {
      for (const k of teclasDe(atalho.binding.key)) sel.add(k);
      for (const m of atalho.binding.modifiers ?? []) if (TECLA_DO_MODIFICADOR[m]) mods.add(TECLA_DO_MODIFICADOR[m]);
    }
    return { sel, mods, focos: new Set(foco ? teclasDe(foco.atalho.binding.key) : []) };
  }

  /**
   * Usos de uma entrada na camada de modificadores mostrada, e se ela é stone key nessa camada: movimento do token,
   * tecla do sistema ou recusada pelo Foundry, ou só do navegador e do sistema.
   */
  #usosDaEntrada(code) {
    const camada = this.#camadaAtual();
    const usados = (this.#dados.porTecla.get(code) ?? []).filter((a) => daCamada(a.binding, camada));
    const externos = (this.#dados.externosPorTecla.get(code) ?? []).filter((x) => daCamada(x.binding, camada));
    const pedra = usados.some((a) => a.acao.pedra && !a.gesto) || ehDoSistema(code) || this.#dados.protegidas.includes(code)
      || (externos.length > 0 && !usados.length) || Boolean(lerControle(code) && infoEntrada(code).pedra);
    return { camada, usados, externos, pedra };
  }

  #marcarEntrada(el, code, destaques) {
    el.dataset.code = code;
    const { camada, usados, externos, pedra } = this.#usosDaEntrada(code);
    if (usados.length) el.classList.add("ec-ocupada");
    if (pedra) el.classList.add("ec-pedra");
    if (externos.length) {
      el.classList.add("ec-externa");
      if (!usados.length) el.classList.add("ec-ocupada");
      const id = externos[0].ocupacao.grupo ? null : externos[0].ocupacao.id;
      el.append(no("span", "ec-marca", [icone(`fa-solid ${ICONE_DA_FUNCAO[id] ?? "fa-globe"}`)]));
    }
    // Tecla usada num composto: ponto no canto.
    if (usados.some((a) => a.gesto)) el.classList.add("ec-composta");
    // Funções diferentes no mesmo aperto desta camada (Foundry, navegador e sistema).
    const funcoes = new Set(usados.map((a) => a.acao.id)).size
      + new Set(externos.map((x) => x.ocupacao.chave ?? x.ocupacao.id)).size;
    if (funcoes >= 2) {
      el.classList.add("ec-sobreposta");
      if (funcoes >= 3) el.classList.add("ec-sobreposta-forte");
      el.append(no("span", "ec-qtd", [this.#numero(funcoes)]));
    }
    const mod = MODIFICADOR_DA_TECLA[code];
    if (mod && camada.has(mod)) el.classList.add("ec-camada");
    if (destaques.sel.has(code)) el.classList.add("ec-sel");
    if (destaques.mods.has(code)) el.classList.add("ec-mod");
    if (destaques.focos.has(code)) el.classList.add("ec-foco");
    const entrada = this.estado.entrada;
    if (entrada && (entrada.key === code) && (!entrada.camada || daCamada(entrada, camada))) el.classList.add("ec-filtrada");
    el.dataset.tooltipHtml = this.#dicaEntrada(code);
  }

  /** Dica de uma tecla: alcance e tudo que a usa, com e sem modificadores, no Foundry, no navegador e no sistema. */
  #dicaEntrada(code) {
    const { camada, pedra } = this.#usosDaEntrada(code);
    const cab = pedra ? this.t("Visual.Pedra") : this.#dicaNivel(infoEntrada(code, {}, this.#dados.maos).nivel);
    const linhas = [`<strong>${escapar(this.#rotuloEntrada(code))}</strong> · ${escapar(cab)}`];
    const primeiro = (a, b) => Number(daCamada(b.binding, camada)) - Number(daCamada(a.binding, camada));
    const usados = [...(this.#dados.porTecla.get(code) ?? [])].sort(primeiro);
    for (const atalho of usados.slice(0, 8)) {
      linhas.push(`${escapar(this.fonte.rotulo(atalho.binding))} — ${escapar(atalho.acao.nome)}`);
    }
    if (usados.length > 8) linhas.push(`+${usados.length - 8}`);
    const donos = this.fonte.donos?.() ?? {};
    for (const { ocupacao, binding } of [...(this.#dados.externosPorTecla.get(code) ?? [])].sort(primeiro)) {
      const dono = donos[ocupacao.dono] ? ` · ${donos[ocupacao.dono]}` : "";
      linhas.push(`<span class="ec-dica-externa">${escapar(this.fonte.rotulo(binding))} — ${escapar(ocupacao.nome)}${escapar(dono)}</span>`);
    }
    return linhas.join("<br>");
  }

  #rotuloEntrada(code) {
    return this.fonte.rotulo({ key: code, modifiers: [] });
  }

  /** Dica de um nível de alcance: o nome e o que ele quer dizer. */
  #dicaNivel(nivel) {
    return this.t(`Dicas.${NIVEIS[nivel]}`);
  }

  #teclado() {
    const caixa = no("div", "ec-teclado");
    const destaques = this.#destaques();
    for (const tecla of TECLADO) {
      const rotulo = rotuloTecla(tecla.code, this.layout || null);
      const tamanho = (rotulo.length >= 4) ? " ec-longo" : (rotulo.length === 3) ? " ec-medio" : "";
      const b = botao(`ec-tecla ec-z${infoEntrada(tecla.code, {}, this.#dados.maos).nivel}${tamanho}`, [no("span", "ec-rot", [rotulo])]);
      b.style.cssText = `--x:${tecla.x};--y:${tecla.y};--w:${tecla.w};--h:${tecla.h}`;
      this.#marcarEntrada(b, tecla.code, destaques);
      caixa.append(b);
    }
    return caixa;
  }

  #mouse() {
    const ponteiro = this.fonte.ponteiro?.() ?? {};
    const destaques = this.#destaques();
    const corpo = no("div", "ec-mouse-corpo");
    const foundry = (classe, titulo, usos = []) => {
      const d = no("div", `ec-mbotao ${classe} ec-foundry ec-pedra`);
      d.dataset.tooltipHtml = [`<strong>${escapar(titulo)}</strong> · ${escapar(this.t("Visual.Pedra"))}`, ...usos.map(escapar)].join("<br>");
      return d;
    };
    corpo.append(
      foundry("ec-mesq", this.t("Visual.Esquerdo"), ponteiro.esquerdo),
      foundry("ec-mdir", this.t("Visual.Direito"), ponteiro.direito)
    );
    for (const { code } of MOUSE) {
      const b = botao(`ec-mbotao ec-${code.toLowerCase()} ec-z${infoEntrada(code, {}, this.#dados.maos).nivel}`, [no("span", "ec-rot", [code.slice(-1)])]);
      this.#marcarEntrada(b, code, destaques);
      const usos = (code === "Mouse3") ? [...(ponteiro.meio ?? []), ...(ponteiro.rodinha ?? [])] : [];
      if (usos.length) b.dataset.tooltipHtml += `<br>${usos.map(escapar).join("<br>")}`;
      corpo.append(b);
    }
    return no("div", "ec-mouse", [corpo]);
  }

  /** Controle conectado, ou o que aparece nos atalhos salvos. */
  #controle() {
    const conectados = this.fonte.controles?.() ?? [];
    if (conectados.length) return { ...conectados[0], conectado: true };
    for (const code of this.#dados.porTecla.keys()) {
      const c = lerControle(code);
      if (c) return { id: c.id, nome: c.id, conectado: false };
    }
    return null;
  }

  #desenhoControle() {
    const controle = this.#controle();
    const id = controle?.id ?? "";
    const destaques = this.#destaques();
    const caixa = no("div", `ec-controle${controle?.conectado ? "" : " ec-desligado"}`);
    const corpo = no("div", "ec-controle-corpo");
    caixa.append(corpo);
    for (const [indice, x, y, w, h, forma] of CONTROLE_DESENHO) {
      const code = codigoBotao(id || "X", indice);
      const rotulo = rotuloControle({ tipo: "botao", id, indice });
      const info = infoEntrada(code);
      const b = botao(`ec-cbotao ec-${forma} ec-z${info.nivel}${info.pedra ? " ec-pedra" : ""}`, [no("span", "ec-rot", [rotulo])]);
      b.style.cssText = `--x:${x};--y:${y};--w:${w};--h:${h}`;
      if (id) this.#marcarEntrada(b, code, destaques);
      else b.dataset.tooltipText = rotulo;
      corpo.append(b);
    }
    for (const a of ANALOGICOS) {
      const anel = no("div", "ec-analogico");
      anel.style.cssText = `--x:${a.x};--y:${a.y}`;
      const centro = codigoBotao(id || "X", a.botao);
      const clique = botao(`ec-cbotao ec-clique ec-z${infoEntrada(centro).nivel}`,
        [no("span", "ec-rot", [rotuloControle({ tipo: "botao", id, indice: a.botao })])]);
      if (id) this.#marcarEntrada(clique, centro, destaques);
      anel.append(clique);
      const sentidos = [[a.eixoY, "NEGATIVE", "cima"], [a.eixoY, "POSITIVE", "baixo"], [a.eixoX, "NEGATIVE", "esq"],
        [a.eixoX, "POSITIVE", "dir"]];
      for (const [eixo, sentido, lado] of sentidos) {
        const code = codigoEixo(id || "X", eixo, sentido);
        const seta = botao(`ec-eixo ec-eixo-${lado} ec-z${infoEntrada(code, { repeticao: true }).nivel}`,
          [no("span", "ec-rot", [rotuloControle({ tipo: "eixo", id, indice: eixo, sentido }).split(" ").pop()])]);
        if (id) this.#marcarEntrada(seta, code, destaques);
        anel.append(seta);
      }
      corpo.append(anel);
    }
    caixa.append(no("p", "ec-controle-nome", [controle ? controle.nome : this.t("Visual.SemControle")]));
    return caixa;
  }

  #renderAvaliacao() {
    const foco = this.#focoAtual();
    if (!foco) {
      this.avaliacao.replaceChildren(this.#resumo());
      return;
    }
    const { acao, atalho } = foco;
    const av = atalho.avaliacao;
    const pedra = av.pedra || Boolean(acao.externa);
    const nome = no("span", `ec-av-nome${acao.restrita ? " ec-restrita" : ""}`, [acao.nome]);
    const { texto, balao } = this.#conteudoAtalho(atalho.binding, acao);
    const chip = no("span", `ec-atalho ${pedra ? "ec-pedra" : `ec-n${av.nivel}`} ec-av-atalho${balao ? " ec-com-balao" : ""}`, [texto, balao]);
    chip.dataset.tooltipText = pedra ? this.t("Visual.Pedra") : this.#dicaNivel(av.nivel);
    const topo = no("div", "ec-av-topo", [nome, chip,
      pedra ? no("span", "ec-av-nivel ec-pedra", [this.t("Visual.Pedra")]) : null]);
    const partes = [topo];
    const motivos = no("ul", "ec-motivos", av.motivos.map((m) => no("li", `ec-motivo ec-m-${m.id}`, [this.#motivo(m)])));
    if (acao.vezes) motivos.append(no("li", "ec-motivo ec-m-uso", [this.#usada(acao.vezes)]));
    if (motivos.childElementCount) partes.push(motivos);
    if (!atalho.fixo && !acao.externa && !pedra && ((av.nivel >= NIVEL.ESTICAR) || atalho.colisoes?.size)) {
      const controle = lerControle(teclasDe(atalho.binding.key)[0])?.id ?? null;
      const livres = sugerir((b) => this.#ocupada(b), 6, controle, this.#dados.maos);
      if (livres.length) {
        partes.push(no("div", "ec-sugestoes", [
          no("span", "ec-sugestoes-rotulo", [this.t("Avaliacao.Livres")]),
          ...livres.map((b) => botao(`ec-sugestao ec-atalho ec-n${infoEntrada(b.key, {}, this.#dados.maos).nivel}`, [this.fonte.rotulo(b)],
            { key: b.key, mods: b.modifiers.join(",") }))
        ]));
      }
    }
    this.avaliacao.replaceChildren(...partes);
  }

  #motivo(m) {
    const d = m.dados ?? {};
    const dados = {};
    if (d.s !== undefined) dados.s = this.#numero(d.s);
    if (d.n !== undefined) dados.n = this.#numero(d.n);
    if (d.vezes !== undefined) dados.vezes = this.#numero(d.vezes);
    if (d.nomes) dados.nomes = this.fonte.lista?.(d.nomes) ?? d.nomes.join(", ");
    if (d.funcao !== undefined) dados.funcao = d.funcao;
    for (const k of ["tecla", "gesto", "nome"]) if (d[k] !== undefined) dados[k] = d[k];
    return this.t(`Ergonomia.${m.id}`, dados);
  }

  #resumo() {
    const d = this.#dados;
    const barra = no("div", "ec-resumo-barra");
    d.niveis.forEach((n, i) => {
      if (!n) return;
      const seg = no("span", `ec-resumo-seg ec-n${i}`, [this.#numero(n)]);
      seg.style.flexGrow = String(n);
      seg.dataset.tooltipText = this.#dicaNivel(i);
      barra.append(seg);
    });
    const entradas = [...d.porTecla].filter(([k, l]) => l.length && !ehGesto(k)).length;
    const numeros = no("p", "ec-resumo-numeros", [
      this.t("Resumo.Atalhos", { acoes: this.#numero(d.contagem.comAtalho), entradas: this.#numero(entradas) })
    ]);
    if (d.contagem.colisoes) numeros.append(" · ", this.t("Resumo.Colisoes", { n: this.#numero(d.contagem.colisoes) }));
    // Veredito: quantas ações com atalho fazem trocar de mão (ou tirar a mão do mouse), fora as só em stone keys.
    const longe = d.niveis[NIVEL.TROCA] + d.niveis[NIVEL.EVITAR];
    const total = d.niveis.reduce((s, n) => s + n, 0);
    let veredito = null;
    if (total) {
      if (!longe) veredito = this.t("Resumo.Perto");
      else if ((longe * 2) >= total) veredito = this.t("Resumo.Longe");
      else veredito = this.t("Resumo.Algumas", { n: this.#numero(longe) });
    }
    return no("div", "ec-resumo", [barra, numeros, veredito ? no("p", "ec-resumo-veredito", [veredito]) : null]);
  }

  /* -------------------------------------------- */
  /*  Eventos                                     */
  /* -------------------------------------------- */

  async #aoClicar(event) {
    const alvo = event.target.closest("button, .ec-acao");
    if (!alvo || !this.el.contains(alvo)) return;
    const d = alvo.dataset;
    if (d.acao) return this.#acaoDaBarra(d.acao);
    if (d.filtro) {
      this.estado.filtro = d.filtro;
      if (this.estado.entrada) {
        this.estado.entrada = null;
        this.busca.value = this.estado.busca;
        this.#renderVisual();
      }
      this.#renderFiltros();
      return this.#renderLista();
    }
    if (d.aba) {
      this.estado.aba = d.aba;
      return this.#renderVisual();
    }
    if (d.grupo) {
      const r = this.estado.recolhidas;
      if (r.has(d.grupo)) r.delete(d.grupo);
      else r.add(d.grupo);
      return this.#renderLista();
    }
    if (d.limparGrupo) return this.#limparGrupo(d.limparGrupo);
    if (alvo.classList.contains("ec-mais")) return this.#capturar(d.acaoId, null);
    if (d.chipAcao === "trocar") return this.#capturar(d.acaoId, Number(d.indice));
    if (d.chipAcao === "tirar") return this.#tirar(d.acaoId, Number(d.indice));
    if (alvo.classList.contains("ec-resetar")) return this.#definir(d.acaoId, undefined);
    if (alvo.classList.contains("ec-rotulo")) {
      this.estado.selecionada = d.acaoId;
      this.estado.foco = { acaoId: d.acaoId, chave: d.chave };
      const atalho = this.#dados.porId.get(d.acaoId)?.atalhos.find((a) => chaveAtalho(a.binding) === d.chave);
      if (atalho) this.estado.camada = new Set(modificadoresDoAtalho(atalho.binding));
      this.#renderLista();
      return this.#renderVisual();
    }
    if (alvo.classList.contains("ec-sugestao")) {
      return this.#substituirFoco({ key: d.key, modifiers: d.mods ? d.mods.split(",") : [] });
    }
    if (d.code) {
      if (this.captura) return this.#concluir({ key: d.code, modifiers: lerControle(d.code) ? [] : modificadoresDo(event) });
      const mod = MODIFICADOR_DA_TECLA[d.code];
      if (mod) {
        const camada = new Set(this.estado.camada);
        if (camada.has(mod)) camada.delete(mod);
        else camada.add(mod);
        this.estado.camada = camada;
        return this.#renderDesenho();
      }
      // A tecla vai para a busca da lista: tudo o que a usa, em qualquer camada (ou só na de modificadores escolhida).
      const camada = this.#camadaAtual();
      const nova = { key: d.code, modifiers: [...camada], camada: camada.size > 0 };
      const atual = this.estado.entrada;
      const mesma = atual && (chaveAtalho(atual) === chaveAtalho(nova));
      this.estado.entrada = mesma ? null : nova;
      this.estado.busca = "";
      this.busca.value = this.estado.entrada ? this.fonte.rotulo(nova.camada ? nova : { key: nova.key, modifiers: [] }) : "";
      this.#renderFiltros();
      this.#renderLista();
      return this.#renderVisual();
    }
    if (alvo.classList.contains("ec-acao")) {
      this.estado.selecionada = alvo.dataset.acaoId;
      this.estado.foco = null;
      this.#renderLista();
      this.#renderVisual();
    }
  }

  async #aoMudarCampo(event) {
    if (event.target.dataset.campo !== "perfil") return;
    this.#pararCaptura(false);
    this.estado.foco = null;
    await this.fonte.ativar(event.target.value);
  }

  /** Passar o mouse num atalho da lista acende as teclas dele no desenho. */
  #aoPassar(event, saindo = false) {
    const chip = event.target.closest?.(".ec-atalho[data-key]");
    if (!chip || !this.el.contains(chip)) return;
    const codes = [...teclasDe(chip.dataset.key), ...(chip.dataset.mods ? chip.dataset.mods.split(",") : [])
      .map((m) => TECLA_DO_MODIFICADOR[m]).filter(Boolean)];
    for (const code of codes) {
      for (const el of this.dispositivos.querySelectorAll(`[data-code="${CSS.escape(code)}"]`)) {
        el.classList.toggle("ec-passando", !saindo);
      }
    }
  }

  /** Tecla, botão do mouse ou do controle apertado agora acende no desenho. */
  #acender(code, aceso) {
    if (!code) return;
    this.#registrarTecla(code, aceso);
    if (this.captura) return;
    for (const el of this.dispositivos.querySelectorAll(`[data-code="${CSS.escape(code)}"]`)) {
      el.classList.toggle("ec-viva", aceso);
    }
  }

  async #acaoDaBarra(acao) {
    const f = this.fonte;
    const { ativo, lista } = f.perfis();
    const atual = lista.find((p) => p.id === ativo);
    this.estado.foco = null;
    if (acao === "novo") {
      const nome = await f.pedirNome(this.t("Perfis.Novo"), "");
      if (nome !== null) await f.criar(nome);
    }
    else if (acao === "duplicar") {
      const nome = await f.pedirNome(this.t("Perfis.Duplicar"), atual?.nome ?? "");
      if (nome !== null) await f.duplicar(ativo, nome);
    }
    else if (acao === "renomear") {
      const nome = await f.pedirNome(this.t("Perfis.Renomear"), atual?.nome ?? "");
      if (nome) await f.renomear(ativo, nome);
    }
    else if (acao === "apagar") {
      if ((lista.length > 1) && await f.confirmar(this.t("Perfis.Apagar"), this.t("Perfis.ConfirmarApagar", { nome: atual?.nome ?? "" }))) {
        await f.apagar(ativo);
      }
    }
    else if (acao === "exportar") f.exportar(ativo);
    else if (acao === "importar") await f.importar();
    else if (acao === "padrao") {
      if (await f.confirmar(this.t("Perfis.Padrao"), this.t("Perfis.ConfirmarPadrao"))) await f.restaurarPadrao();
    }
    await this.render();
  }

  async #limparGrupo(id) {
    const acoes = this.#dados.acoes.filter((a) => (a.categoria.id === id) && a.editaveis.length);
    if (!acoes.length) return;
    const titulo = acoes[0].categoria.titulo;
    if (!await this.fonte.confirmar(this.t("Lista.LimparGrupo"), this.t("Lista.ConfirmarLimpar", { grupo: titulo, n: acoes.length }))) return;
    await this.fonte.definirVarios(Object.fromEntries(acoes.map((a) => [a.id, []])));
    this.estado.foco = null;
    await this.render();
  }

  /**
   * @param {string} acaoId
   * @param {object[]|undefined} editaveis  undefined volta ao padrão.
   */
  async #definir(acaoId, editaveis) {
    const acao = this.#dados.porId.get(acaoId);
    try {
      if (acao?.externa) {
        // Igual ao padrão do navegador ou do sistema: sem mudança guardada.
        const igual = editaveis && (editaveis.map(chaveAtalho).join("|") === acao.padrao.map(chaveAtalho).join("|"));
        await this.fonte.definirPedra(acao.ocupacao.chave, igual ? undefined : editaveis);
      }
      else await this.fonte.definir(acaoId, editaveis);
    }
    catch (err) {
      this.fonte.aviso?.(err.message, "error");
    }
    await this.render();
  }

  async #tirar(acaoId, indice) {
    const acao = this.#dados.porId.get(acaoId);
    if (!acao) return;
    const editaveis = acao.editaveis.filter((_, i) => i !== indice);
    if (this.estado.foco?.acaoId === acaoId) this.estado.foco = null;
    await this.#definir(acaoId, editaveis);
  }

  async #substituirFoco(binding) {
    const foco = this.#focoAtual();
    if (!foco || foco.atalho.fixo) return;
    const editaveis = foco.acao.editaveis.map((b) => ({ ...b }));
    editaveis[foco.atalho.indice] = binding;
    this.estado.foco = { acaoId: foco.acao.id, chave: chaveAtalho(binding) };
    this.estado.camada = new Set(modificadoresDoAtalho(binding));
    await this.#definir(foco.acao.id, editaveis);
  }

  /* -------------------------------------------- */
  /*  Captura                                     */
  /* -------------------------------------------- */

  /**
   * Espera a próxima entrada: tecla, botão do mouse (3, 4, 5, que o módulo converte em tecla) ou do controle (que o
   * Foundry converte em tecla), sozinha ou composta. O que for feito vira o atalho:
   * - apertar e soltar: a tecla (com os modificadores segurados);
   * - apertar de novo até TEMPOS.sequencia depois de soltar: toques seguidos ou sequência (até LIMITES.pressoes);
   * - segurar a partir de TEMPOS.segurar: segurado, em passos de 0,5 s;
   * - apertar outra enquanto a primeira está apertada: juntas (até LIMITES.teclas).
   * Termina depois que tudo foi solto e a janela da sequência passou. Modificador sozinho vale como tecla. Esc,
   * clique fora ou a janela perder o foco cancelam.
   * @param {string} acaoId
   * @param {number|null} indice  Atalho editável a trocar; null acrescenta.
   */
  #capturar(acaoId, indice) {
    this.#pararCaptura(false);
    this.captura = { acaoId, indice, inicio: performance.now(), ignorar: new Set(), eventos: [], apertadas: new Set(),
      timer: null, relogio: null };
    const parar = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const teclar = (e) => {
      if (DO_NAVEGADOR.has(e.code)) return;
      parar(e);
      const c = this.captura;
      if (!c || !e.code) return;
      if (lerControle(e.code)) {
        if (c.ignorar.has(e.code)) return;
        if ((performance.now() - c.inicio) < JA_ATIVA_MS) {
          c.ignorar.add(e.code);
          return;
        }
      }
      // Repetição do teclado e reenvio do controle enquanto o botão segue apertado.
      if (e.repeat || c.apertadas.has(e.code)) return;
      if (e.code === "Escape") return this.#pararCaptura(true);
      if (MODIFICADOR_DA_TECLA[e.code]) this.#registrarTecla(e.code, true);
      this.#gravar(e.code, false, e);
    };
    const soltar = (e) => {
      if (DO_NAVEGADOR.has(e.code)) return;
      parar(e);
      this.#registrarTecla(e.code, false);
      const c = this.captura;
      if (!c) return;
      c.ignorar.delete(e.code);
      if (c.apertadas.has(e.code)) this.#gravar(e.code, true, e);
    };
    const fora = (e) => {
      if (!this.captura || ((e.button !== 0) && (e.button !== 2))) return;
      if (e.target.closest?.("[data-code], .ec-capturando-chip")) return;
      this.#pararCaptura(true);
    };
    const desfoco = () => this.#pararCaptura(true);
    window.addEventListener("keydown", teclar, true);
    window.addEventListener("keyup", soltar, true);
    window.addEventListener("pointerdown", fora, true);
    window.addEventListener("blur", desfoco);
    this.#fimDaCaptura = () => {
      window.removeEventListener("keydown", teclar, true);
      window.removeEventListener("keyup", soltar, true);
      window.removeEventListener("pointerdown", fora, true);
      window.removeEventListener("blur", desfoco);
    };
    this.#renderLista();
    this.#renderVisual();
    this.sumidouro.focus({ preventScroll: true });
  }

  /**
   * Um aperto ou uma soltura durante a captura.
   * @param {string} code
   * @param {boolean} up
   * @param {KeyboardEvent} e
   */
  #gravar(code, up, e) {
    const c = this.captura;
    clearTimeout(c.timer);
    c.timer = null;
    if (up) c.apertadas.delete(code);
    else c.apertadas.add(code);
    c.eventos.push({ code, up, t: performance.now(), mods: lerControle(code) ? [] : modificadoresDo(e) });
    this.#mostrarGravacao();
    if (c.apertadas.size) {
      c.relogio ??= setInterval(() => this.#mostrarGravacao(), 100);
      return;
    }
    clearInterval(c.relogio);
    c.relogio = null;
    const pressoes = this.#gravado()?.pressoes ?? 0;
    if (pressoes >= LIMITES.pressoes) return this.#concluirGravacao();
    c.timer = setTimeout(() => this.#concluirGravacao(), TEMPOS.sequencia + 20);
  }

  /**
   * O atalho que a captura gravou até agora (teclas ainda apertadas contam até este momento).
   * @returns {{binding: {key: string, modifiers: string[]}, pressoes: number}|null}
   */
  #gravado() {
    const c = this.captura;
    if (!c?.eventos.length) return null;
    // Modificadores apertados junto com outras teclas são modificadores do atalho, não pressões.
    const outras = c.eventos.filter((ev) => !ehModificador(ev.code));
    const usar = outras.length ? outras : c.eventos;
    const agora = performance.now();
    const pressoes = montarPressoes(usar, Infinity).slice(0, LIMITES.pressoes).map((p) => {
      const dur = (p.fim ?? agora) - p.inicio;
      return { teclas: [...p.teclas].slice(0, LIMITES.teclas), segurar: (dur >= TEMPOS.segurar) ? arredondarSegurar(dur) : 0 };
    });
    const modifiers = outras.length ? (outras.find((ev) => !ev.up)?.mods ?? []) : [];
    const simples = (pressoes.length === 1) && (pressoes[0].teclas.length === 1) && !pressoes[0].segurar;
    const key = simples ? pressoes[0].teclas[0] : escreverGesto(pressoes);
    return { binding: { key, modifiers }, pressoes: pressoes.length };
  }

  /** Mostra no chip da captura o que já foi gravado. */
  #mostrarGravacao() {
    const g = this.#gravado();
    if (!g) return;
    for (const chip of this.grupos.querySelectorAll(".ec-capturando-chip")) chip.textContent = `${this.fonte.rotulo(g.binding)}…`;
  }

  #concluirGravacao() {
    const g = this.#gravado();
    if (!g || !this.captura) return;
    this.#concluir(g.binding);
  }

  /** @param {boolean} renderizar */
  #pararCaptura(renderizar) {
    this.#fimDaCaptura?.();
    this.#fimDaCaptura = null;
    if (this.captura) {
      clearTimeout(this.captura.timer);
      clearInterval(this.captura.relogio);
    }
    this.#soltarFoco();
    if (!this.captura) return;
    this.captura = null;
    if (renderizar) {
      this.#renderLista();
      this.#renderVisual();
    }
  }

  #soltarFoco() {
    if (this.sumidouro.ownerDocument.activeElement === this.sumidouro) this.sumidouro.blur();
  }

  /** @param {{key: string, modifiers: string[]}} binding */
  async #concluir(binding) {
    if (!this.captura) return;
    const { acaoId, indice } = this.captura;
    this.#pararCaptura(false);
    const acao = this.#dados.porId.get(acaoId);
    if (!acao) return this.render();
    // O navegador e o sistema não leem o controle nem teclas compostas.
    if (acao.externa && (lerControle(binding.key) || ehGesto(binding.key))) return this.render();
    const recusada = acao.externa ? null : teclasDe(binding.key).find((k) => this.#dados.protegidas.includes(k));
    if (recusada) {
      this.fonte.aviso?.(this.t("Captura.Protegida", { tecla: this.fonte.rotulo({ key: recusada, modifiers: [] }) }), "warn");
      return this.render();
    }
    const chave = chaveAtalho(binding);
    let editaveis = acao.editaveis.map((b) => ({ ...b }));
    if ((indice !== null) && (indice >= 0)) editaveis[indice] = binding;
    else editaveis.push(binding);
    const vistas = new Set(acao.fixos.map(chaveAtalho));
    editaveis = editaveis.filter((b) => {
      const k = chaveAtalho(b);
      if (vistas.has(k)) return false;
      vistas.add(k);
      return true;
    });
    this.estado.selecionada = acaoId;
    this.estado.foco = { acaoId, chave };
    this.estado.camada = new Set(modificadoresDoAtalho(binding));
    await this.#definir(acaoId, editaveis);
  }
}
