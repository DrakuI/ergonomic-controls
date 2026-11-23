/**
 * Perfis de controle: cópias nomeadas do mapeamento de atalhos do Foundry (configuração de cliente
 * `core.keybindings`, que guarda só o que difere do padrão de cada ação), guardadas por usuário no servidor
 * (configuração `perfis`, escopo user). O perfil ativo acompanha toda mudança de atalho, venha de onde vier, e é
 * aplicado ao carregar quando o mapeamento do navegador difere dele (outro computador, dados do navegador limpos).
 *
 * Contagem de uso (configuração `uso`, escopo user): cada ação conta os acionamentos sem repetição, contados sozinhos
 * desde a primeira carga do módulo, para mostrar quantas vezes cada ação foi usada e o que é mais usado.
 */

import { MODULE_ID, LANG } from "./navegador.mjs";
import { lerControle } from "./ergonomia.mjs";
import { teclasDe } from "./gestos.mjs";

const MODIFICADORES = new Set(["Control", "Shift", "Alt"]);
const FORMATO = "ergonomic-controls.perfil";

const t = (chave, dados) => (dados ? game.i18n.format(`${LANG}.${chave}`, dados) : game.i18n.localize(`${LANG}.${chave}`));

/* -------------------------------------------- */
/*  Leitura e gravação                          */
/* -------------------------------------------- */

/** @returns {{ativo: string|null, lista: {id: string, nome: string, mapeamento: object, alterado: number}[]}} */
export function lerPerfis() {
  const dados = foundry.utils.deepClone(game.settings.get(MODULE_ID, "perfis") ?? {});
  return { ativo: dados.ativo ?? null, lista: Array.isArray(dados.lista) ? dados.lista : [] };
}

async function gravarPerfis(dados) {
  await game.settings.set(MODULE_ID, "perfis", dados);
  avisarMudanca();
}

export const mapeamentoAtual = () => foundry.utils.deepClone(game.settings.get("core", "keybindings") ?? {});

export function perfilAtivo(dados = lerPerfis()) {
  return dados.lista.find((p) => p.id === dados.ativo) ?? null;
}

/**
 * Mapeamento só com atalhos válidos: listas de {key, modifiers}, modificadores aceitos pelo Foundry, sem tecla
 * protegida (nem dentro de tecla composta). Ações que não existem neste mundo ficam (o Foundry ignora; servem a
 * outro mundo).
 * @param {object} mapeamento
 */
export function sanitizarMapeamento(mapeamento) {
  const protegidas = new Set(game.keyboard?.constructor?.PROTECTED_KEYS ?? []);
  const limpo = {};
  if (!mapeamento || (typeof mapeamento !== "object")) return limpo;
  for (const [acao, lista] of Object.entries(mapeamento)) {
    if (!Array.isArray(lista)) continue;
    limpo[acao] = lista
      .filter((b) => b && (typeof b.key === "string") && b.key && !teclasDe(b.key).some((k) => protegidas.has(k)))
      .map((b) => ({ key: b.key, modifiers: (Array.isArray(b.modifiers) ? b.modifiers : []).filter((m) => MODIFICADORES.has(m)) }));
  }
  return limpo;
}

/** Troca todos os atalhos deste navegador pelo mapeamento. */
export async function aplicarMapeamento(mapeamento) {
  await game.settings.set("core", "keybindings", sanitizarMapeamento(mapeamento));
}

/* -------------------------------------------- */
/*  Sincronização                               */
/* -------------------------------------------- */

const ouvintes = new Set();
/** Avisa a interface de mudança em perfis ou atalhos. */
export function aoMudar(callback) {
  ouvintes.add(callback);
  return () => ouvintes.delete(callback);
}
export function avisarMudanca() {
  for (const cb of ouvintes) {
    try { cb(); }
    catch (err) { console.error(`${MODULE_ID} |`, err); }
  }
}

let gravacao = null;

/** O perfil ativo passa a ser o mapeamento atual. */
async function gravarAtual() {
  const dados = lerPerfis();
  const ativo = perfilAtivo(dados);
  if (!ativo) return;
  const atual = mapeamentoAtual();
  if (foundry.utils.objectsEqual(ativo.mapeamento ?? {}, atual)) return;
  ativo.mapeamento = atual;
  ativo.alterado = Date.now();
  await gravarPerfis(dados);
}

/** Atalho mudou (de qualquer lugar): grava no perfil ativo depois de um intervalo curto. */
export function sincronizar() {
  avisarMudanca();
  clearTimeout(gravacao);
  gravacao = setTimeout(() => {
    gravacao = null;
    gravarAtual();
  }, 400);
}

/** Grava já a mudança pendente, antes de trocar o perfil ativo ou de sair da página. */
export async function descarregar() {
  if (gravacao === null) return;
  clearTimeout(gravacao);
  gravacao = null;
  await gravarAtual();
}

/** No ready: cria o primeiro perfil com os atalhos atuais, ou aplica o ativo se o navegador estiver diferente. */
export async function prepararPerfis() {
  const dados = lerPerfis();
  if (!dados.lista.length) {
    const perfil = { id: foundry.utils.randomID(), nome: t("Perfis.Principal"), mapeamento: mapeamentoAtual(),
      alterado: Date.now() };
    dados.lista.push(perfil);
    dados.ativo = perfil.id;
    await gravarPerfis(dados);
    return;
  }
  let ativo = perfilAtivo(dados);
  if (!ativo) {
    ativo = dados.lista[0];
    dados.ativo = ativo.id;
    await gravarPerfis(dados);
  }
  const alvo = sanitizarMapeamento(ativo.mapeamento);
  if (!foundry.utils.objectsEqual(alvo, mapeamentoAtual())) await aplicarMapeamento(alvo);
}

/* -------------------------------------------- */
/*  Operações                                   */
/* -------------------------------------------- */

function nomeLivre(nome, lista) {
  const base = (nome || t("Perfis.SemNome")).trim();
  const usados = new Set(lista.map((p) => p.nome));
  if (!usados.has(base)) return base;
  for (let i = 2; ; i++) if (!usados.has(`${base} (${i})`)) return `${base} (${i})`;
}

/** Ativa um perfil e aplica os atalhos dele. */
export async function ativarPerfil(id) {
  await descarregar();
  const dados = lerPerfis();
  const perfil = dados.lista.find((p) => p.id === id);
  if (!perfil) return;
  dados.ativo = id;
  await gravarPerfis(dados);
  await aplicarMapeamento(perfil.mapeamento);
}

/**
 * Cria e ativa um perfil.
 * @param {string} nome
 * @param {object} [mapeamento]  Sem ele, os atalhos padrão do Foundry.
 */
export async function criarPerfil(nome, mapeamento = {}) {
  await descarregar();
  const dados = lerPerfis();
  const perfil = { id: foundry.utils.randomID(), nome: nomeLivre(nome, dados.lista),
    mapeamento: sanitizarMapeamento(mapeamento), alterado: Date.now() };
  dados.lista.push(perfil);
  await gravarPerfis(dados);
  await ativarPerfil(perfil.id);
  return perfil;
}

export async function duplicarPerfil(id, nome) {
  await descarregar();
  const origem = lerPerfis().lista.find((p) => p.id === id);
  if (!origem) return null;
  return criarPerfil(nome || origem.nome, id === lerPerfis().ativo ? mapeamentoAtual() : origem.mapeamento);
}

export async function renomearPerfil(id, nome) {
  await descarregar();
  const dados = lerPerfis();
  const perfil = dados.lista.find((p) => p.id === id);
  if (!perfil || !nome?.trim()) return;
  perfil.nome = nomeLivre(nome, dados.lista.filter((p) => p.id !== id));
  await gravarPerfis(dados);
}

/** Apaga um perfil; o último não é apagado. Apagar o ativo ativa o primeiro que sobrar. */
export async function apagarPerfil(id) {
  await descarregar();
  const dados = lerPerfis();
  if (dados.lista.length <= 1) return false;
  dados.lista = dados.lista.filter((p) => p.id !== id);
  const eraAtivo = dados.ativo === id;
  if (eraAtivo) dados.ativo = dados.lista[0].id;
  await gravarPerfis(dados);
  if (eraAtivo) await aplicarMapeamento(dados.lista[0].mapeamento);
  return true;
}

/** Volta os atalhos do perfil ativo ao padrão do Foundry. */
export async function restaurarPadrao() {
  await aplicarMapeamento({});
}

export function exportarPerfil(id) {
  const dados = lerPerfis();
  const perfil = dados.lista.find((p) => p.id === id);
  if (!perfil) return;
  const mapeamento = id === dados.ativo ? mapeamentoAtual() : perfil.mapeamento;
  const conteudo = { formato: FORMATO, versao: 1, nome: perfil.nome, mapeamento };
  const arquivo = `${perfil.nome.normalize("NFD").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").toLowerCase() || "profile"}.json`;
  foundry.utils.saveDataToFile(JSON.stringify(conteudo, null, 2), "application/json", arquivo);
}

/**
 * Importa um perfil exportado e ativa.
 * @param {string} texto  Conteúdo do arquivo.
 */
export async function importarPerfil(texto) {
  const dados = JSON.parse(texto);
  if ((dados?.formato !== FORMATO) || (typeof dados.mapeamento !== "object")) throw new Error(t("Perfis.ArquivoInvalido"));
  return criarPerfil(dados.nome, dados.mapeamento);
}

/* -------------------------------------------- */
/*  Uso                                         */
/* -------------------------------------------- */

const CONTADA = Symbol.for(`${MODULE_ID}.contada`);
const uso = { contagem: {}, desde: Date.now(), sujo: false, timer: null };

/**
 * Ação e código de controle já contados e ainda apertados: o GamepadManager repete o keydown a cada leitura enquanto
 * o botão ou o analógico está ativo, sem marcar `repeat`.
 */
const seguradas = new Set();

/** Intervalo mínimo entre gravações da contagem. */
const GRAVAR_USO_MS = 30_000;

function gravarUso() {
  clearTimeout(uso.timer);
  uso.timer = null;
  if (!uso.sujo) return;
  uso.sujo = false;
  game.settings.set(MODULE_ID, "uso", { desde: uso.desde, contagem: uso.contagem }).catch((err) => {
    console.warn(`${MODULE_ID} | Usage count not saved`, err);
  });
}

function contar(id) {
  uso.contagem[id] = (uso.contagem[id] ?? 0) + 1;
  uso.sujo = true;
  uso.timer ??= setTimeout(gravarUso, GRAVAR_USO_MS);
}

/**
 * Passa a contar os acionamentos de todas as ações: embrulha onDown de cada ação e reconstrói as teclas ativas
 * (ClientKeybindings#initialize copia onDown para cada tecla).
 */
export function iniciarUso() {
  const salvo = game.settings.get(MODULE_ID, "uso") ?? {};
  uso.contagem = { ...(salvo.contagem ?? {}) };
  uso.desde = salvo.desde ?? Date.now();
  if (!salvo.desde) {
    uso.sujo = true;
    gravarUso();
  }
  for (const [id, acao] of game.keybindings.actions) {
    const original = acao.onDown;
    if ((typeof original !== "function") || original[CONTADA]) continue;
    const contada = function (context, ...resto) {
      const code = context?.key;
      if (code && lerControle(code)) {
        const chave = `${id}|${code}`;
        if (!seguradas.has(chave)) contar(id);
        seguradas.add(chave);
      }
      else if (!context?.repeat) contar(id);
      return original.call(this, context, ...resto);
    };
    contada[CONTADA] = true;
    acao.onDown = contada;
  }
  game.keybindings.initialize();
  window.addEventListener("keyup", (event) => {
    if (!lerControle(event.code)) return;
    for (const chave of seguradas) if (chave.endsWith(`|${event.code}`)) seguradas.delete(chave);
  }, true);
  window.addEventListener("blur", () => seguradas.clear());
  window.addEventListener("pagehide", () => {
    gravarUso();
    descarregar();
  });
}

/** @returns {{contagem: Record<string, number>, total: number, desde: number, frequentes: Set<string>}} */
export function estatisticasUso() {
  const contagem = { ...uso.contagem };
  const valores = Object.values(contagem);
  const total = valores.reduce((s, v) => s + v, 0);
  const minimo = Math.max(10, total * 0.05);
  const frequentes = new Set(Object.entries(contagem).filter(([, v]) => v >= minimo).map(([k]) => k));
  return { contagem, total, desde: uso.desde, frequentes };
}
