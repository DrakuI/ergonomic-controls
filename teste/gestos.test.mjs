// Testes do reconhecedor de teclas compostas (sem Foundry, relógio falso).
import { Reconhecedor, lerGesto, escreverGesto, teclasDe, arredondarSegurar, montarPressoes, comparar, TEMPOS } from "../scripts/gestos.mjs";

let ok = 0;
const falhas = [];
function conferir(nome, cond, extra = "") {
  if (cond) ok++;
  else falhas.push(`${nome}${extra ? ` — ${extra}` : ""}`);
}

function criar(codigos, { discretas = [], modificadores = null } = {}) {
  let agora = 0;
  const timers = [];
  const saida = [];
  const gestos = codigos.map((code) => ({ code, ...lerGesto(code) }));
  const ret = new Set(discretas);
  const r = new Reconhecedor({
    seguir: (c) => saida.push(`${c.up ? "↑" : "↓"}${c.key}${c.repeat ? "(r)" : ""}${c.isShift ? "(S)" : ""}@${agora}`),
    iniciais: (c) => gestos.filter((g) => g.pressoes[0].teclas.includes(c.key) && (!modificadores || modificadores(g, c))),
    reter: (c) => ret.has(c.key),
    sintetico: (code, up, base, repeat = false) => ({ key: code, up, repeat, isShift: Boolean(base.isShift) }),
    agora: () => agora,
    agendar: (fn, ms) => {
      const id = { fn, quando: agora + ms };
      timers.push(id);
      return id;
    },
    cancelar: (id) => {
      const i = timers.indexOf(id);
      if (i >= 0) timers.splice(i, 1);
    }
  });
  const passar = (ms) => {
    const alvo = agora + ms;
    for (;;) {
      timers.sort((a, b) => a.quando - b.quando);
      const prox = timers[0];
      if (!prox || (prox.quando > alvo)) break;
      timers.shift();
      agora = prox.quando;
      prox.fn();
    }
    agora = alvo;
  };
  const ir = (t) => passar(t - agora);
  const ev = (key, up, extra = {}) => r.receber({ key, up, repeat: false, ...extra });
  return {
    r, saida, ir,
    ap: (key, t, extra) => { ir(t); ev(key, false, extra); },
    so: (key, t, extra) => { ir(t); ev(key, true, extra); },
    rep: (key, t) => { ir(t); r.receber({ key, up: false, repeat: true }); },
    get texto() { return saida.join(" "); }
  };
}

// Leitura e escrita.
{
  const casos = {
    "Gesto:KeyQ,KeyQ": [[["KeyQ"], 0], [["KeyQ"], 0]],
    "Gesto:KeyQ@1000": [[["KeyQ"], 1000]],
    "Gesto:KeyE+KeyQ": [[["KeyE", "KeyQ"], 0]],
    "Gesto:KeyQ,KeyQ@500": [[["KeyQ"], 0], [["KeyQ"], 500]]
  };
  for (const [code, esperado] of Object.entries(casos)) {
    const g = lerGesto(code);
    conferir(`ler ${code}`, JSON.stringify(g?.pressoes.map((p) => [p.teclas, p.segurar])) === JSON.stringify(esperado), JSON.stringify(g));
    conferir(`escrever ${code}`, escreverGesto(g.pressoes) === code);
  }
  conferir("acorde em ordem alfabética", escreverGesto([{ teclas: ["KeyQ", "KeyE"], segurar: 0 }]) === "Gesto:KeyE+KeyQ");
  const controle = "8BITDOPRO+(STANDARDGAMEPAD)_BUTTON0_PRESSED";
  const codigo = escreverGesto([{ teclas: [controle], segurar: 0 }, { teclas: [controle], segurar: 0 }]);
  conferir("id de controle com + codificado", codigo === "Gesto:8BITDOPRO%2B(STANDARDGAMEPAD)_BUTTON0_PRESSED,8BITDOPRO%2B(STANDARDGAMEPAD)_BUTTON0_PRESSED" && lerGesto(codigo)?.pressoes[0].teclas[0] === controle, codigo);
  for (const ruim of ["Gesto:KeyQ", "Gesto:", "Gesto:KeyQ@100", "Gesto:KeyQ@9000", "Gesto:KeyQ,KeyQ,KeyQ,KeyQ,KeyQ", "Gesto:KeyA+KeyB+KeyC+KeyD", "Gesto:KeyQ+KeyQ", "Gesto:KeyQ,,KeyQ", "KeyQ"]) {
    conferir(`inválido ${ruim}`, lerGesto(ruim) === null);
  }
  conferir("tecla comum: teclasDe", JSON.stringify(teclasDe("KeyQ")) === '["KeyQ"]');
  conferir("composto: teclasDe", JSON.stringify(teclasDe("Gesto:KeyE+KeyQ,KeyR").sort()) === '["KeyE","KeyQ","KeyR"]');
  conferir("segurar em passos de 0,5 s", [arredondarSegurar(420), arredondarSegurar(740), arredondarSegurar(760), arredondarSegurar(1300), arredondarSegurar(9000)].join() === "500,500,1000,1500,5000");
}

// Pressões e comparação.
{
  const p = montarPressoes([{ code: "KeyQ", up: false, t: 0 }, { code: "KeyE", up: false, t: 50 }, { code: "KeyQ", up: true, t: 120 }, { code: "KeyE", up: true, t: 130 }]);
  conferir("acorde numa pressão", p.length === 1 && p[0].teclas.size === 2 && p[0].fim === 130);
  const p2 = montarPressoes([{ code: "KeyQ", up: false, t: 0 }, { code: "KeyE", up: false, t: 200 }]);
  conferir("fora da janela: duas pressões", p2.length === 2);
  const g = lerGesto("Gesto:KeyQ,KeyQ");
  conferir("prefixo do toque duplo", comparar(g, montarPressoes([{ code: "KeyQ", up: false, t: 0 }, { code: "KeyQ", up: true, t: 90 }]), 100).possivel);
  conferir("janela da sequência fecha", !comparar(g, montarPressoes([{ code: "KeyQ", up: false, t: 0 }, { code: "KeyQ", up: true, t: 90 }]), 90 + TEMPOS.sequencia + 1).possivel);
}

// Tecla sem composto passa direto.
{
  const x = criar(["Gesto:KeyQ,KeyQ"], { discretas: ["KeyQ", "KeyX"] });
  x.ap("KeyX", 0);
  x.so("KeyX", 50);
  conferir("tecla fora dos compostos sem atraso", x.texto === "↓KeyX@0 ↑KeyX@50", x.texto);
}

// Toque duplo numa tecla de um toque.
{
  const x = criar(["Gesto:KeyQ,KeyQ"], { discretas: ["KeyQ"] });
  x.ap("KeyQ", 0);
  x.so("KeyQ", 90);
  x.ap("KeyQ", 200);
  conferir("toque duplo dispara no segundo aperto", x.texto === "↓Gesto:KeyQ,KeyQ@200", x.texto);
  x.so("KeyQ", 260);
  conferir("e solta junto com a tecla", x.texto === "↓Gesto:KeyQ,KeyQ@200 ↑Gesto:KeyQ,KeyQ@260", x.texto);
  conferir("ocioso no fim", x.r.ocioso);
  const y = criar(["Gesto:KeyQ,KeyQ"], { discretas: ["KeyQ"] });
  y.ap("KeyQ", 0);
  y.so("KeyQ", 90);
  y.ir(1000);
  conferir("um toque só: Q sai depois da janela", y.texto === `↓KeyQ@${90 + TEMPOS.sequencia + 1} ↑KeyQ@${90 + TEMPOS.sequencia + 1}`, y.texto);
  const z = criar(["Gesto:KeyQ,KeyQ"], { discretas: ["KeyQ"] });
  z.ap("KeyQ", 0);
  z.so("KeyQ", 90);
  z.ap("KeyQ", 90 + TEMPOS.sequencia + 50);
  conferir("segundo toque tarde: dois Q comuns", z.texto === `↓KeyQ@${90 + TEMPOS.sequencia + 1} ↑KeyQ@${90 + TEMPOS.sequencia + 1}`, z.texto);
  z.so("KeyQ", 500);
  z.ir(2000);
  conferir("o segundo Q também sai", (z.saida.filter((s) => s.startsWith("↓KeyQ")).length === 2) && (z.saida.filter((s) => s.startsWith("↑KeyQ")).length === 2), z.texto);
}

// Toque duplo em tecla de movimento: o movimento não espera.
{
  const x = criar(["Gesto:KeyW,KeyW"]);
  x.ap("KeyW", 0);
  x.so("KeyW", 80);
  x.ap("KeyW", 200);
  x.so("KeyW", 260);
  conferir("movimento na hora e composto junto", x.texto === "↓KeyW@0 ↑KeyW@80 ↓KeyW@200 ↓Gesto:KeyW,KeyW@200 ↑KeyW@260 ↑Gesto:KeyW,KeyW@260", x.texto);
  const y = criar(["Gesto:KeyW,KeyW"]);
  y.ap("KeyW", 0);
  y.rep("KeyW", 300);
  y.rep("KeyW", 340);
  y.so("KeyW", 900);
  y.ir(2000);
  conferir("segurar W: repetições passam, sem composto", y.texto === "↓KeyW@0 ↓KeyW(r)@300 ↓KeyW(r)@340 ↑KeyW@900", y.texto);
}

// Segurar.
{
  const x = criar(["Gesto:KeyQ@1000"], { discretas: ["KeyQ"] });
  x.ap("KeyQ", 0);
  x.rep("KeyQ", 500);
  x.ir(1001);
  conferir("segurar 1 s dispara ao atingir o tempo", x.texto === "↓Gesto:KeyQ@1000@1001", x.texto);
  x.rep("KeyQ", 1100);
  x.so("KeyQ", 1500);
  conferir("repetição e soltura do composto", x.texto === "↓Gesto:KeyQ@1000@1001 ↓Gesto:KeyQ@1000(r)@1100 ↑Gesto:KeyQ@1000@1500", x.texto);
  const y = criar(["Gesto:KeyQ@1000"], { discretas: ["KeyQ"] });
  y.ap("KeyQ", 0);
  y.so("KeyQ", 150);
  conferir("toque curto: Q na soltura", y.texto === "↓KeyQ@150 ↑KeyQ@150", y.texto);
  const z = criar(["Gesto:KeyQ@500", "Gesto:KeyQ@1000"], { discretas: ["KeyQ"] });
  z.ap("KeyQ", 0);
  z.so("KeyQ", 800);
  conferir("dois tempos: decide na soltura (0,5 s)", z.texto === "↓Gesto:KeyQ@500@800 ↑Gesto:KeyQ@500@800", z.texto);
  const w = criar(["Gesto:KeyQ@500", "Gesto:KeyQ@1000"], { discretas: ["KeyQ"] });
  w.ap("KeyQ", 0);
  w.ir(1200);
  conferir("dois tempos: o maior dispara ao atingir", w.texto === "↓Gesto:KeyQ@1000@1001", w.texto);
}

// Teclas juntas.
{
  const x = criar(["Gesto:KeyE+KeyQ"], { discretas: ["KeyQ", "KeyE"] });
  x.ap("KeyQ", 0);
  x.ap("KeyE", 30);
  x.so("KeyQ", 100);
  x.so("KeyE", 120);
  conferir("juntas dispara no segundo aperto, solta no último", x.texto === "↓Gesto:KeyE+KeyQ@30 ↑Gesto:KeyE+KeyQ@120", x.texto);
  const y = criar(["Gesto:KeyE+KeyQ"], { discretas: ["KeyQ", "KeyE"] });
  y.ap("KeyQ", 0);
  y.ir(200);
  y.so("KeyQ", 250);
  conferir("Q sozinho espera só a janela", y.texto === `↓KeyQ@${TEMPOS.juntas + 1} ↑KeyQ@250`, y.texto);
  const z = criar(["Gesto:KeyE+KeyQ"], { discretas: ["KeyQ"] });
  z.ap("KeyE", 0);
  z.ap("KeyQ", 40);
  conferir("começar por E (sem ação própria): E na hora", z.texto.startsWith("↓KeyE@0 ↓Gesto:KeyE+KeyQ@40"), z.texto);
}

// Outra tecla no meio decide na hora.
{
  const x = criar(["Gesto:KeyQ,KeyQ"], { discretas: ["KeyQ"] });
  x.ap("KeyQ", 0);
  x.so("KeyQ", 90);
  x.ap("KeyX", 150);
  conferir("interrupção: Q sai antes do X", x.texto === "↓KeyQ@150 ↑KeyQ@150 ↓KeyX@150", x.texto);
}

// Sequência de teclas diferentes.
{
  const x = criar(["Gesto:KeyE,KeyQ"], { discretas: ["KeyQ", "KeyE"] });
  x.ap("KeyQ", 0);
  conferir("Q não começa a sequência E, Q", x.texto === "↓KeyQ@0", x.texto);
  x.so("KeyQ", 50);
  x.ap("KeyE", 100);
  x.so("KeyE", 150);
  x.ap("KeyQ", 300);
  conferir("E depois Q", x.texto === "↓KeyQ@0 ↑KeyQ@50 ↓Gesto:KeyE,KeyQ@300", x.texto);
}

// O mais longo vence; o mais curto vale quando o longo falha.
{
  const x = criar(["Gesto:KeyQ,KeyQ", "Gesto:KeyQ,KeyQ,KeyQ"], { discretas: ["KeyQ"] });
  x.ap("KeyQ", 0); x.so("KeyQ", 60); x.ap("KeyQ", 150); x.so("KeyQ", 210);
  x.ir(2000);
  conferir("dois toques: o duplo depois da janela", x.texto === `↓Gesto:KeyQ,KeyQ@${210 + TEMPOS.sequencia + 1} ↑Gesto:KeyQ,KeyQ@${210 + TEMPOS.sequencia + 1}`, x.texto);
  const y = criar(["Gesto:KeyQ,KeyQ", "Gesto:KeyQ,KeyQ,KeyQ"], { discretas: ["KeyQ"] });
  y.ap("KeyQ", 0); y.so("KeyQ", 60); y.ap("KeyQ", 150); y.so("KeyQ", 210); y.ap("KeyQ", 300);
  conferir("três toques: o triplo no terceiro aperto", y.texto === "↓Gesto:KeyQ,KeyQ,KeyQ@300", y.texto);
  const z = criar(["Gesto:KeyQ,KeyQ", "Gesto:KeyQ,KeyQ,KeyQ"], { discretas: ["KeyQ"] });
  z.ap("KeyQ", 0); z.so("KeyQ", 60); z.ap("KeyQ", 150); z.so("KeyQ", 210); z.ap("KeyQ", 300);
  z.so("KeyQ", 400);
  conferir("terceiro toque dispara o triplo mesmo solto depois", z.texto === "↓Gesto:KeyQ,KeyQ,KeyQ@300 ↑Gesto:KeyQ,KeyQ,KeyQ@400", z.texto);
  const w = criar(["Gesto:KeyQ,KeyQ", "Gesto:KeyQ,KeyQ,KeyQ@500"], { discretas: ["KeyQ"] });
  w.ap("KeyQ", 0); w.so("KeyQ", 60); w.ap("KeyQ", 150); w.so("KeyQ", 210); w.ap("KeyQ", 300); w.so("KeyQ", 420);
  conferir("terceiro curto demais para o segurar: duplo e um Q", w.texto === "↓Gesto:KeyQ,KeyQ@420 ↑Gesto:KeyQ,KeyQ@420 ↓KeyQ@420 ↑KeyQ@420", w.texto);
}

// Repetições enquanto retido; controle reenviando keydown.
{
  const x = criar(["Gesto:KeyQ@1000"], { discretas: ["KeyQ"] });
  x.ap("KeyQ", 0);
  x.rep("KeyQ", 300);
  x.ap("KeyQ", 400);
  x.so("KeyQ", 600);
  conferir("repetição e reenvio engolidos enquanto retido", x.texto === "↓KeyQ@600 ↑KeyQ@600", x.texto);
}

// Modificadores do evento vão para o composto.
{
  const x = criar(["Gesto:KeyQ,KeyQ"], { discretas: ["KeyQ"] });
  x.ap("KeyQ", 0, { isShift: true });
  x.so("KeyQ", 50, { isShift: true });
  x.ap("KeyQ", 120, { isShift: true });
  conferir("Shift vai junto", x.texto === "↓Gesto:KeyQ,KeyQ(S)@120", x.texto);
  const y = criar(["Gesto:KeyQ,KeyQ"], { discretas: ["KeyQ"], modificadores: (g, c) => !c.isShift });
  y.ap("KeyQ", 0, { isShift: true });
  conferir("composto que não aceita os modificadores: tecla comum na hora", y.texto === "↓KeyQ(S)@0", y.texto);
}

// Perder o foco.
{
  const x = criar(["Gesto:KeyQ@500"], { discretas: ["KeyQ"] });
  x.ap("KeyQ", 0);
  x.ir(600);
  x.r.abandonar();
  conferir("abandonar solta o composto aberto", x.texto === "↓Gesto:KeyQ@500@501 ↑Gesto:KeyQ@500@600" && x.r.ocioso, x.texto);
  const y = criar(["Gesto:KeyQ,KeyQ"], { discretas: ["KeyQ"] });
  y.ap("KeyQ", 0);
  y.r.abandonar();
  y.so("KeyQ", 50);
  y.ir(1000);
  conferir("abandonar descarta o retido", y.texto === "↑KeyQ@50", y.texto);
  const z = criar(["Gesto:KeyQ,KeyQ"], { discretas: ["KeyQ"] });
  z.ap("KeyQ", 0);
  z.so("KeyQ", 50);
  z.r.esvaziar();
  conferir("esvaziar entrega o retido", z.texto === "↓KeyQ@50 ↑KeyQ@50", z.texto);
}

console.log(`${ok} ok, ${falhas.length} falha(s)`);
for (const f of falhas) console.log(`FALHA: ${f}`);
process.exitCode = falhas.length ? 1 : 0;
