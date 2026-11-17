import * as E from "../scripts/ergonomia.mjs";
let ok = 0; const falhas = [];
const conferir = (nome, cond, det = "") => { if (cond) ok++; else falhas.push(`${nome} ${det}`); };
const ids = (av) => av.motivos.map((m) => m.id);
const av = (key, modifiers = [], opcoes = {}) => E.avaliar({ key, modifiers }, opcoes);

// Teclado
let r = av("KeyQ"); conferir("Q na mão", r.nivel === 0 && ids(r).includes("esquerda0"), JSON.stringify(r));
r = av("KeyT"); conferir("T perto", r.nivel === 1 && ids(r).includes("esquerda1"));
r = av("KeyH"); conferir("H esticar", r.nivel === 2 && ids(r).includes("esquerda2"));
r = av("Numpad2"); conferir("Numpad2 troca de mão", r.nivel === 3 && ids(r).includes("numerico") && r.motivos[0].dados.s === 0.8, JSON.stringify(r));
r = av("KeyK"); conferir("K troca (direita)", r.nivel === 3 && ids(r).includes("direita"));
r = av("ArrowUp"); conferir("seta troca (navegação)", r.nivel === 3 && ids(r).includes("navegacao"));
r = av("F9"); conferir("F9 troca (função)", r.nivel === 3 && ids(r).includes("funcao"));
r = av("MetaLeft"); conferir("Win evitar", r.nivel === 4 && ids(r).includes("sistema") && ids(r).includes("teclaWindows"));
r = av("F11", [], { protegidas: ["F5", "F11", "F12"] }); conferir("F11 protegida", r.invalida && r.nivel === 4 && ids(r).includes("protegida"));
r = av("Numpad2", ["Control"]); conferir("Ctrl+Numpad2 duas mãos", r.nivel === 3 && ids(r).includes("duasMaos"));
r = av("KeyQ", ["Control", "Shift"]); conferir("Ctrl+Shift+Q simultâneas", r.nivel === 2 && ids(r).includes("simultaneas") && r.motivos.find((m) => m.id === "simultaneas").dados.n === 3);
r = av("KeyH", ["Control"]); conferir("Ctrl+H estica combo", r.nivel === 3 && ids(r).includes("esticaCombo"));
r = av("KeyQ", ["Control"]); conferir("Ctrl+Q continua na mão", r.nivel === 0 && !ids(r).includes("duasMaos"));
r = av("ShiftLeft", ["Shift"]); conferir("modificador sozinho ignora modificadores", r.nivel === 0 && !ids(r).includes("simultaneas"));
r = av("KeyH", [], { acao: { segurar: true } }); conferir("segurar longe", r.nivel === 3 && ids(r).includes("segurarLonge"));
r = av("KeyQ", [], { acao: { segurar: true } }); conferir("segurar perto ok", r.nivel === 0 && !ids(r).includes("segurarLonge"));
const chrome = (nome, extra = {}) => ({ nome, dono: "navegador", donoNome: "Chrome", ...extra });
r = av("KeyW", ["Control"], { ocupacoes: [chrome("Fechar aba", { reservada: true })] });
conferir("Ctrl+W reservada", r.nivel === 4 && ids(r).includes("navegadorReservada") && r.motivos.find((m) => m.id === "navegadorReservada").dados.funcao === "Fechar aba", JSON.stringify(r));
r = av("KeyR", ["Control"], { ocupacoes: [chrome("Recarregar", { essencial: true })] });
conferir("Ctrl+R essencial evitar", r.nivel === 4 && ids(r).includes("navegadorUsa") && r.motivos.find((m) => m.id === "navegadorUsa").dados.dono === "Chrome");
r = av("KeyC", ["Control"], { ocupacoes: [chrome("Copiar")] });
conferir("Ctrl+C só avisa", r.nivel === 0 && ids(r).includes("navegadorUsa"), JSON.stringify(r));
r = av("Tab", ["Alt"], { ocupacoes: [{ nome: "Trocar de janela", dono: "sistema", donoNome: "Windows" }] });
conferir("Alt+Tab do sistema", r.nivel === 4 && ids(r).includes("sistemaUsa"));
r = av("KeyQ", [], { colisoes: ["Montar"] }); conferir("colisão", ids(r).includes("colisao") && r.motivos.find((m) => m.id === "colisao").dados.nomes[0] === "Montar");
r = av("Numpad2", [], { frequente: true, vezes: 40 }); conferir("frequente longe", ids(r).includes("frequenteLonge"));
r = av("KeyQ", [], { semUso: true }); conferir("sem uso", ids(r).includes("semUso"));
r = av("r"); conferir("caractere solto: evitar e inválido", r.nivel === 4 && r.invalida && ids(r)[0] === "caractere", JSON.stringify(r));
r = av("["); conferir("colchete como caractere", r.nivel === 4 && ids(r)[0] === "caractere");
r = av("F13"); conferir("F13 desconhecida", r.nivel === 3 && ids(r)[0] === "desconhecida");
// Mouse
r = av("Mouse4"); conferir("Mouse4 na mão", r.nivel === 0 && r.info.dispositivo === "mouse" && ids(r).includes("mouse"));
r = av("Mouse3"); conferir("Mouse3 perto + dica", r.nivel === 1 && ids(r).includes("rodinha") && ids(r).includes("dicaMeio"));
r = av("Mouse5", ["Control"]); conferir("Ctrl+Mouse5 sem duas mãos", r.nivel === 0 && !ids(r).includes("duasMaos"));
// Controle
const ID = "XBOXWIRELESSCONTROLLER(STANDARDGAMEPADVENDOR:045EPRODUCT:0B13)";
conferir("ler botão", JSON.stringify(E.lerControle(`${ID}_BUTTON0_PRESSED`)) === JSON.stringify({ tipo: "botao", id: ID, indice: 0 }));
conferir("ler eixo", E.lerControle(`${ID}_AXIS2_NEGATIVE`)?.sentido === "NEGATIVE");
conferir("não é controle", E.lerControle("KeyQ") === null);
r = av(`${ID}_BUTTON0_PRESSED`); conferir("A: polegar sai", r.nivel === 1 && ids(r).includes("face"));
r = av(`${ID}_BUTTON4_PRESSED`); conferir("LB na mão", r.nivel === 0 && ids(r).includes("gatilho"));
r = av(`${ID}_BUTTON12_PRESSED`); conferir("d-pad", r.nivel === 1 && ids(r).includes("direcional"));
r = av(`${ID}_BUTTON10_PRESSED`); conferir("L3", r.nivel === 2 && ids(r).includes("cliqueAnalogico"));
r = av(`${ID}_BUTTON16_PRESSED`); conferir("Guide evitar", r.nivel === 4 && ids(r).includes("botaoSistema"));
r = av(`${ID}_AXIS1_NEGATIVE`, [], { acao: { repeticao: true } }); conferir("eixo mover", r.nivel === 0 && ids(r).includes("eixoMover"));
r = av(`${ID}_AXIS1_NEGATIVE`); conferir("eixo toque", r.nivel === 2 && ids(r).includes("eixoToque"));
conferir("rótulo Xbox", E.rotuloControle(E.lerControle(`${ID}_BUTTON4_PRESSED`)) === "LB");
conferir("rótulo PS", E.rotuloControle(E.lerControle("DUALSENSEWIRELESSCONTROLLER(STANDARDGAMEPADVENDOR:054CPRODUCT:0CE6)_BUTTON0_PRESSED")) === "✕");
conferir("rótulo eixo", E.rotuloControle(E.lerControle(`${ID}_AXIS0_NEGATIVE`)) === "LS ←");
conferir("idControle", E.idControle("Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)") === ID);
// Colisões (regra do KeyboardManager)
conferir("mesma tecla sem mod colide", E.colidem({ key: "KeyJ", modifiers: [] }, [], { key: "KeyJ", modifiers: [] }, []));
conferir("Ctrl+J x J não colide", !E.colidem({ key: "KeyJ", modifiers: ["Control"] }, [], { key: "KeyJ", modifiers: [] }, []));
conferir("Shift opcional colide", E.colidem({ key: "KeyT", modifiers: ["Shift"] }, [], { key: "KeyT", modifiers: [] }, ["Shift"]));
conferir("teclas diferentes", !E.colidem({ key: "KeyJ" }, [], { key: "KeyK" }, []));
// Sugestões
const ocupadas = new Set(["KeyQ", "KeyE", "Mouse4"]);
const sug = E.sugerir((b) => !b.modifiers.length && ocupadas.has(b.key), 4);
conferir("sugere livres na ordem", JSON.stringify(sug.map((b) => b.key)) === JSON.stringify(["KeyR", "KeyF", "Mouse5", "KeyZ"]), JSON.stringify(sug));
// Geometria
const mainRows = {};
for (const t of E.TECLADO) if (t.x < 15) for (let y = t.y; y < t.y + t.h; y += 1) mainRows[y] = Math.max(mainRows[y] ?? 0, t.x + t.w);
conferir("bloco principal com 15u", Object.entries(mainRows).filter(([y]) => Number(y) > 0).every(([, x]) => Math.abs(x - 15) < 1e-9), JSON.stringify(mainRows));
conferir("sem códigos repetidos", new Set(E.TECLADO.map((t) => t.code)).size === E.TECLADO.length);
conferir("toda tecla tem zona", E.TECLADO.every((t) => E.infoEntrada(t.code).regiao !== "desconhecida"), E.TECLADO.filter((t) => E.infoEntrada(t.code).regiao === "desconhecida").map((t) => t.code).join(","));
conferir("rótulo layout", E.rotuloTecla("Semicolon", new Map([["Semicolon", "ç"]])) === "Ç" && E.rotuloTecla("Semicolon") === ";");
console.log(`${ok} ok, ${falhas.length} falha(s)`); for (const f of falhas) console.log("FALHA:", f);
process.exitCode = falhas.length ? 1 : 0;
