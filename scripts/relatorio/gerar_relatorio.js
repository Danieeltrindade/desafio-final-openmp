// Gera docs/relatorio_final.docx a partir dos arquivos em resultados/. Uso: node scripts/relatorio/gerar_relatorio.js (requer: npm install docx)
const fs = require("fs");
const D = require("docx");
const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, HeadingLevel, Header, Footer, PageNumber, BorderStyle, LevelFormat, VerticalAlign, PageBreak,
  TabStopType } = D;

const DIR = require("path").resolve(__dirname, "../..") + "/";
const FONT = "Times New Roman", MONO = "Courier New";
const W = 9071; // largura útil (A4, margens 3/2 cm)
const BLUE = "1F4E79", LIGHT = "EAF1F8";

const br = (x, d) => x.toFixed(d).replace(".", ",");
const nfmt = n => Number(n).toLocaleString("pt-BR");
// ---------- helpers ----------
const run = (t, o = {}) => new TextRun({ text: t, font: FONT, size: 24, ...o });
function rich(s, o = {}) { // **negrito**, `codigo`, *itálico*
  const out = [];
  s.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\b[xf]ᵢ)/).forEach(p => {
    if (!p) return;
    if (p.startsWith("**")) out.push(run(p.slice(2, -2), { bold: true, ...o }));
    else if (p.startsWith("`")) out.push(new TextRun({ text: p.slice(1, -1), font: MONO, size: 20, ...o }));
    else if (p.startsWith("*")) out.push(run(p.slice(1, -1), { italics: true, ...o }));
    else if (/^[xf]ᵢ$/.test(p)) { out.push(run(p[0], { italics: true, ...o })); out.push(run("i", { italics: true, subScript: true, ...o })); }
    else out.push(run(p, o));
  });
  return out;
}
const P = (s, o = {}) => new Paragraph({ children: rich(s), alignment: AlignmentType.JUSTIFIED,
  spacing: { after: 120, line: 300 }, ...o });
const H1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const bullet = (s, kn) => new Paragraph({ keepNext: !!kn, numbering: { reference: "bul", level: 0 }, children: rich(s),
  alignment: AlignmentType.JUSTIFIED, spacing: { after: 60, line: 288 } });
const caption = t => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 200 },
  keepLines: true, children: [run(t, { size: 20, italics: true })] });
const capTop = t => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 80 }, keepNext: true,
  children: [run(t, { size: 20, bold: true })] });

function pngSize(f) { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }
function img(file, widthPx, extra = {}) {
  const [w, h] = pngSize(file);
  return new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 80, after: 80 }, ...extra,
    children: [new ImageRun({ type: "png", data: fs.readFileSync(file),
      transformation: { width: widthPx, height: Math.round(widthPx * h / w) },
      altText: { title: file, description: file, name: file } })] });
}
const formula = (f, scale) => { const [w] = pngSize(f); return img(f, Math.round(w * scale), { keepNext: false }); };

const border = { style: BorderStyle.SINGLE, size: 4, color: "8EA9C1" };
const borders = { top: border, bottom: border, left: border, right: border };
function table(rows, widths, opts = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths, alignment: AlignmentType.CENTER,
    rows: rows.map((r, i) => new TableRow({ tableHeader: i === 0, cantSplit: true,
      children: r.map((c, j) => new TableCell({
        borders, width: { size: widths[j], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
        margins: { top: 50, bottom: 50, left: 90, right: 90 },
        shading: i === 0 ? { fill: BLUE, type: ShadingType.CLEAR, color: "auto" }
          : (i % 2 === 0 ? { fill: LIGHT, type: ShadingType.CLEAR, color: "auto" } : undefined),
        children: [new Paragraph({ keepNext: i < rows.length - 1,
          alignment: (opts.left || []).includes(j) ? AlignmentType.LEFT : AlignmentType.CENTER,
          children: rich(String(c), { size: 20, ...(i === 0 ? { bold: true, color: "FFFFFF" } : {}) }) })]
      })) }))
  });
}
function code(lines) {
  return lines.map((l, i) => new Paragraph({ keepNext: i < lines.length - 1, keepLines: true,
    shading: { fill: "F2F2F2", type: ShadingType.CLEAR, color: "auto" },
    spacing: { after: 0, line: 240 }, indent: { left: 200, right: 200 },
    children: [new TextRun({ text: l.length ? l : " ", font: MONO, size: 17 })] }));
}
const space = (n = 120) => new Paragraph({ spacing: { after: n }, children: [] });

// ---------- capa ----------
const cl = (t, o = {}, sp = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, ...sp }, children: [run(t, o)] });
const coverField = (k, v) => new Paragraph({ spacing: { after: 100 }, indent: { left: 2600 },
  children: [run(k + " ", { bold: true }), run(v)] });

// ================= dados lidos dos arquivos de resultados =================
const F = n => DIR + "scripts/relatorio/" + n + ".png";
const G = n => DIR + "resultados/graficos/" + n + ".png";
const saida = fs.readFileSync(DIR + "resultados/saida_openmp.txt", "utf8");
function classes(nome) {
  const blk = saida.split("=== " + nome)[1].split("Total")[0];
  return [...blk.matchAll(/\[\s*([\d.]+),\s*([\d.]+)\)\s+([\d.]+)\s+(\d+)/g)].map(m => [m[1], m[2], m[3], m[4]]);
}
const resultado = Object.fromEntries([...saida.matchAll(/RESULTADO;(\w+);([\d.]+);([\d.]+);([\d.]+)/g)]
  .map(m => [m[1], { mu: +m[2], sd: +m[3], cv: +m[4] }]));
const testesLog = fs.readFileSync(DIR + "resultados/testes.txt", "utf8");
const testesOK = testesLog.match(/(\d+)\/(\d+) verificacoes aprovadas/);

const csv = fs.readFileSync(DIR + "resultados/benchmark.csv", "utf8").trim().split("\n").slice(1).map(l => l.split(","));
const Ns = [...new Set(csv.map(r => +r[0]))];
const get = (n, versao, t) => { const r = csv.find(r => +r[0] === n && r[1] === versao && +r[2] === t);
  return { m: +r[5], sd: +r[6], min: +r[7], sp: +r[8], reps: +r[4] }; };
const dec = v => v < 0.1 ? 4 : v < 10 ? 3 : 2;
const ms = (m, sd) => `${br(m, dec(m))} ± ${br(sd, dec(m))}`;
const S = (n, t) => get(n, "paralelo", t).sp;
const s2 = Ns.map(n => S(n, 2));
const N1k = 1000, N10M = 10000000;

// ================= capa =================
const capa = [
  cl("IESB", { bold: true, size: 32 }),
  cl("Curso de Ciência da Computação", { size: 26 }, { before: 80 }),
  cl("Programação Paralela", { size: 24, color: "555555" }, { before: 60 }),
  new Paragraph({ spacing: { before: 3000, after: 0 }, children: [] }),
  cl("Exercício Final — Análise de Dados com OpenMP", { bold: true, size: 36, color: BLUE }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 0 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 8 } }, indent: { left: 1800, right: 1800 }, children: [] }),
  cl("Cálculo do Coeficiente de Variação para Dados Agrupados em Classes", { size: 26, italics: true }, { before: 200 }),
  new Paragraph({ spacing: { before: 3200, after: 0 }, children: [] }),
  coverField("Aluno:", "Daniel Trindade"),
  coverField("Professor:", "Rodrigo Gonçalves Pinto"),
  coverField("Repositório:", "github.com/Danieeltrindade/desafio-final-openmp"),
  coverField("Data de entrega:", "____ / ____ / ________"),
  new Paragraph({ spacing: { before: 1400, after: 0 }, children: [] }),
  cl("Brasília – DF", { size: 22 }),
  cl("2026", { size: 22 }, { before: 40 }),
];

// ================= corpo =================
const est = classes("ESTATURA"), pes = classes("PESO");
const freqTable = rows => table([["Classe", "Ponto médio (xᵢ)", "Frequência (fᵢ)"],
  ...rows.map(r => [`[${br(+r[0], 0)} ; ${br(+r[1], 0)})`, br(+r[2], 0), r[3]]),
  ["**Total**", "—", "**" + rows.reduce((a, r) => a + +r[3], 0) + "**"]], [1700, 1500, 1500]);
const sideBySide = (a, b, ta, tb) => new Table({
  width: { size: 9071, type: WidthType.DXA }, columnWidths: [4535, 4536], alignment: AlignmentType.CENTER,
  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
  rows: [new TableRow({ cantSplit: true, children: [[a, ta], [b, tb]].map(([t, titulo]) => new TableCell({
    width: { size: 4535, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP,
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    children: [capTop(titulo), t] })) })] });

const body = [
  H1("1. Introdução"),
  P("Este relatório descreve a implementação, em linguagem C com OpenMP, de um programa que calcula o coeficiente de variação (CV) da estatura e do peso de 1.000 pessoas a partir de dados agrupados em intervalos de classe. São apresentadas as partes do código paralelizadas e a justificativa de cada uma, os resultados estatísticos, a validação desses resultados e uma análise de desempenho comparando as versões sequencial e paralela."),
  P("Os quatro itens pedidos no enunciado estão organizados da seguinte forma:", { keepNext: true }),
  capTop("Tabela 1 — Localização dos entregáveis"),
  table([["Entregável", "Onde encontrar"],
    ["1. Código-fonte em C com diretivas OpenMP", "`src/cv_openmp.c` no repositório (Seção 3)"],
    ["2. Relatório explicando o que foi paralelizado e por quê", "Este documento, Seção 3"],
    ["3. Coeficiente de variação da estatura e do peso", "Seção 4.2 (Tabela 5)"],
    ["4. Análise de desempenho sequencial × paralelo", "Seção 5"]], [4400, 4671], { left: [0, 1] }),
  space(60),

  H1("2. Metodologia"),
  H2("2.1 Dados de entrada"),
  P("O enunciado não fornece um arquivo de dados. Por isso, o arquivo `dados/dados.txt` foi gerado pelo programa `src/gerar_dados.c`, com semente fixa (2025), o que torna o arquivo reproduzível. A estatura segue distribuição aproximadamente normal (média 170 cm, desvio 10 cm), limitada ao intervalo de 140 a 205 cm. O peso é correlacionado com a estatura (70 kg + 0,6·(estatura − 170) + ruído normal de desvio 10 kg), limitado a 40–130 kg. Cada linha contém a estatura e o peso separados por espaço, conforme o enunciado. Os dados são sintéticos e não representam pessoas reais; qualquer outro arquivo no mesmo formato pode ser usado sem alterar o código."),
  H2("2.2 Construção das classes"),
  P("A amplitude das classes é de **8 cm** para a estatura e de **4 kg** para o peso. O limite inferior da primeira classe é o maior inteiro menor ou igual ao menor valor observado (função `floor`). O número de classes é k = ⌊(máximo − início) / h⌋ + 1, e cada classe é um intervalo fechado à esquerda e aberto à direita, [a ; a + h). O ponto médio de cada classe é xᵢ = a + h/2. Um valor exatamente na fronteira (por exemplo, 148,0 cm) pertence à classe que começa nele."),
  H2("2.3 Fórmulas utilizadas"),
  P("**Média ponderada** — soma dos produtos entre o ponto médio de cada classe e sua frequência, dividida pelo total de observações:", { keepNext: true }),
  formula(F("f_media"), 0.30),
  P("**Desvio padrão populacional** — dispersão dos dados em torno da média, ponderada pelas frequências:", { keepNext: true }),
  formula(F("f_desvio"), 0.30),
  P("**Coeficiente de variação** — dispersão relativa, expressa como porcentagem da média:", { keepNext: true }),
  formula(F("f_cv"), 0.30),
  P("Nas fórmulas, xᵢ é o ponto médio da classe i, fᵢ a frequência da classe, k o número de classes e N = 1.000 o total de pessoas."),

  H1("3. Implementação e paralelização"),
  H2("3.1 Estrutura do programa"),
  P("O programa lê e valida o arquivo (linhas malformadas, valores não numéricos ou não positivos geram erro), executa a análise das duas variáveis e mede o tempo nos modos sequencial e paralelo. A análise de cada variável segue quatro etapas: (1) mínimo e máximo; (2) frequências por classe; (3) média ponderada; (4) desvio padrão. O CV é calculado ao final. O programa também confere se a soma das frequências é igual ao número de registros."),
  P("As versões sequencial e paralela usam **o mesmo código-fonte**, de duas formas complementares:"),
  bullet("**Comparação de tempo:** todas as regiões OpenMP têm a cláusula `if(paralelo)`. Com `paralelo = 0`, cada região é executada por uma única thread; com `paralelo = 1`, pelo número de threads configurado. Assim, a diferença de tempo não vem de diferenças de algoritmo ou de compilação."),
  bullet("**Versão sequencial pura:** compilado sem `-fopenmp`, o compilador ignora as diretivas e gera o executável `cv_sequencial`, sem nenhuma dependência do OpenMP. Essa versão é usada para confirmar que o paralelismo não altera os resultados."),
  H2("3.2 Mínimo e máximo"),
  P("O laço percorre os N registros. Foi paralelizado com `#pragma omp parallel for reduction(min:a) reduction(max:b)`: cada thread calcula o mínimo e o máximo da sua parte dos dados em cópias privadas, e o OpenMP combina essas cópias ao final. Sem a redução, duas threads poderiam atualizar a mesma variável ao mesmo tempo (condição de corrida)."),
  H2("3.3 Histograma de frequências com histogramas locais"),
  P("A contagem de frequências é a etapa mais custosa, pois também percorre os N registros. Para cada valor, calcula-se o índice da classe, c = ⌊(x − início) / h⌋, e incrementa-se o contador correspondente. Se todas as threads incrementassem diretamente o vetor global, haveria condição de corrida. A solução adotada foi criar, dentro da região paralela, **um histograma local por thread** (alocado com `calloc`). O laço é dividido entre as threads com `#pragma omp for nowait`, e cada thread conta apenas no seu histograma local, sem sincronização."),
  H2("3.4 Redução das frequências"),
  P("Ao terminar sua parte do laço, cada thread soma seu histograma local ao histograma global dentro de um bloco `#pragma omp critical`, que garante que apenas uma thread por vez altere o vetor global. A cláusula `nowait` permite que cada thread passe para essa soma sem esperar as demais. Essa abordagem exige apenas k operações sincronizadas por thread, em vez de uma operação atômica por registro (N operações), o que reduz bastante o custo de sincronização.", { keepNext: true }),
  ...code([
    "#pragma omp parallel if(paralelo)",
    "{",
    "    long *local = calloc(k, sizeof(long));       /* histograma da thread */",
    "    #pragma omp for nowait",
    "    for (long i = 0; i < n; i++) {",
    "        int c = (int)((x[i] - r->inicio) / r->largura);",
    "        if (c >= k) c = k - 1;",
    "        local[c]++;",
    "    }",
    "    #pragma omp critical                          /* reducao das frequencias */",
    "    for (int c = 0; c < k; c++) r->freq[c] += local[c];",
    "    free(local);",
    "}"]),
  space(80),
  H2("3.5 Média ponderada e desvio padrão"),
  P("A média calcula os somatórios Σ xᵢ·fᵢ e Σ fᵢ; o desvio calcula Σ fᵢ·(xᵢ − µ)². Como cada termo depende apenas da sua classe, os laços foram paralelizados com `#pragma omp parallel for reduction(+: ...)`. O desvio depende da média já calculada, por isso as duas etapas são executadas em sequência. Esses laços percorrem apenas as k classes (9 para estatura e 17 para peso), e não os 1.000 registros; foram paralelizados por exigência do enunciado, mas seu impacto no tempo total é pequeno."),
  H2("3.6 Coeficiente de variação"),
  P("O CV é uma única divisão (σ / µ × 100) e não possui laço; por isso, não há o que paralelizar nessa etapa."),
  capTop("Tabela 2 — Resumo das etapas paralelizadas"),
  table([["Etapa", "Diretiva OpenMP", "Custo", "Justificativa"],
    ["Mínimo e máximo", "`parallel for reduction(min/max)`", "O(N)", "Percorre todos os registros; redução evita condição de corrida."],
    ["Frequências", "`parallel` + `for nowait` + histograma local", "O(N)", "Etapa mais pesada; cada thread conta sem sincronização."],
    ["Redução das frequências", "`critical`", "O(k) por thread", "Soma segura dos histogramas locais no global."],
    ["Média ponderada", "`parallel for reduction(+)`", "O(k)", "Somatórios independentes por classe."],
    ["Desvio padrão", "`parallel for reduction(+)`", "O(k)", "Somatório independente por classe."],
    ["Coef. de variação", "— (sequencial)", "O(1)", "Operação única, sem laço."]],
    [1700, 2600, 1100, 3671], { left: [0, 1, 3] }),
  space(80),

  H1("4. Resultados"),
  H2("4.1 Distribuição de frequências"),
  P("O Gráfico 1 e as Tabelas 3 e 4 mostram a distribuição das 1.000 pessoas nas classes."),
  img(G("grafico1_distribuicao"), 600),
  caption("Gráfico 1 — Distribuição de frequências por classe."),
  sideBySide(freqTable(est), freqTable(pes), "Tabela 3 — Estatura (8 cm)", "Tabela 4 — Peso (4 kg)"),
  space(60),
  H2("4.2 Coeficiente de variação"),
  capTop("Tabela 5 — Medidas obtidas (dados agrupados)"),
  table([["Variável", "Classes", "Média (µ)", "Desvio padrão (σ)", "CV"],
    ["Estatura", `${est.length} classes de 8 cm`, br(resultado.estatura.mu, 2) + " cm", br(resultado.estatura.sd, 2) + " cm", "**" + br(resultado.estatura.cv, 2) + " %**"],
    ["Peso", `${pes.length} classes de 4 kg`, br(resultado.peso.mu, 2) + " kg", br(resultado.peso.sd, 2) + " kg", "**" + br(resultado.peso.cv, 2) + " %**"]],
    [1500, 2100, 1700, 2000, 1300]),
  space(60),
  P(`A estatura apresenta CV de ${br(resultado.estatura.cv, 2)} %, o que indica um conjunto bastante homogêneo em relação à sua média. O peso apresenta CV de ${br(resultado.peso.cv, 2)} %, ou seja, uma dispersão relativa cerca de ${br(resultado.peso.cv / resultado.estatura.cv, 1)} vezes maior. Como o CV não depende da unidade de medida, essa comparação entre centímetros e quilogramas é válida.`),
  H2("4.3 Validação dos resultados"),
  P(`O repositório inclui um conjunto de testes automatizados (\`tests/testes.py\`), executados com \`make test\`. Na última execução, **${testesOK[1]} de ${testesOK[2]} verificações foram aprovadas**:`),
  bullet("**Referência independente:** uma implementação em Python das mesmas regras de classe e fórmulas produz os mesmos valores de média, desvio e CV que o programa, para `dados.txt` e para três casos controlados (valores nas fronteiras de classe, todas as pessoas iguais e um exemplo pequeno conferível à mão)."),
  bullet("**Fronteiras de classe:** valores como 148,0 cm são classificados na classe [148 ; 156), confirmando os intervalos fechados à esquerda."),
  bullet("**Soma das frequências** igual ao número de registros em todas as variáveis e casos."),
  bullet("**Equivalência entre versões:** a versão sequencial pura e a versão OpenMP com 1, 2 e 4 threads (5 execuções cada) produzem resultados idênticos."),
  bullet("**Entradas inválidas** (arquivo inexistente ou vazio, linha com um valor, texto no lugar de número, valor negativo, três colunas) são rejeitadas com erro."),
  P("Como verificação adicional, as medidas também foram calculadas sobre os dados brutos, sem agrupamento: CV de 5,96 % para a estatura e 16,34 % para o peso. A pequena diferença em relação aos dados agrupados é esperada, pois o agrupamento substitui cada valor pelo ponto médio da sua classe."),

  H1("5. Análise de desempenho"),
  H2("5.1 Ambiente de execução"),
  capTop("Tabela 6 — Ambiente utilizado nas medições"),
  table([["Item", "Valor"],
    ["Compilador", "GCC 13.3.0"],
    ["Flags de compilação", "`-O2 -Wall -Wextra -fopenmp` (e `-lm` na ligação)"],
    ["Processador", "Intel Xeon @ 2,10 GHz (modelo exato não informado pelo sistema)"],
    ["Núcleos", "2 vCPUs em máquina virtual (KVM), 1 thread por núcleo; núcleos físicos do hospedeiro não confirmados"],
    ["Threads testadas", "1, 2 e 4 (definidas com `omp_set_num_threads`)"],
    ["Sistema operacional", "Ubuntu 24.04.5 LTS (Linux, ambiente em nuvem)"],
    ["Medição de tempo", "`omp_get_wtime()`"]], [2700, 6371], { left: [0, 1] }),
  space(60),
  H2("5.2 Metodologia de medição"),
  P("O benchmark é executado pelo próprio programa (`./cv_openmp dados/dados.txt --benchmark`) e grava os resultados em `resultados/benchmark.csv`."),
  bullet("O tempo medido corresponde à análise completa das **duas variáveis**: mínimo/máximo, frequências, média, desvio e CV. A leitura do arquivo não é incluída, para que o tempo reflita apenas a parte paralelizada."),
  bullet("Para avaliar a escalabilidade, o conjunto de 1.000 pessoas foi replicado em memória até 10 milhões de registros. Como a replicação não muda a distribuição, os CVs permanecem iguais em todos os tamanhos."),
  bullet(`Cada configuração foi medida em **7 rodadas**, após uma execução de aquecimento. Em cada rodada, o tempo é a média de várias repetições (${Ns.map(n => get(n, "sequencial", 1).reps.toLocaleString("pt-BR")).join(", ")} repetições, do menor ao maior N). A ordem das configurações é invertida a cada rodada para reduzir vieses.`),
  bullet("São apresentados a média e o desvio padrão entre as 7 rodadas. O speedup é calculado pela razão entre os tempos médios:", true),
  formula(F("f_speedup"), 0.28),
  H2("5.3 Resultados medidos"),
  capTop("Tabela 7 — Tempo médio por execução, em ms (média ± desvio padrão de 7 rodadas)"),
  table([["Registros (N)", "Sequencial", "1 thread", "2 threads", "4 threads"],
    ...Ns.map(n => [n.toLocaleString("pt-BR"), ms(get(n, "sequencial", 1).m, get(n, "sequencial", 1).sd),
      ...[1, 2, 4].map(t => ms(get(n, "paralelo", t).m, get(n, "paralelo", t).sd))])],
    [1500, 1900, 1900, 1900, 1871]),
  space(60),
  capTop("Tabela 8 — Speedup e eficiência"),
  table([["Registros (N)", "Speedup 1 thread", "Speedup 2 threads", "Eficiência 2 threads", "Speedup 4 threads"],
    ...Ns.map(n => [n.toLocaleString("pt-BR"), br(S(n, 1), 2) + "x", "**" + br(S(n, 2), 2) + "x**", br(S(n, 2) / 2 * 100, 0) + " %", br(S(n, 4), 2) + "x"])],
    [1500, 1850, 1900, 1900, 1921]),
  space(60),
  P("A eficiência é o speedup dividido pelo número de threads (E = S / p) e indica quanto do potencial dos núcleos foi aproveitado. Os Gráficos 2 e 3 usam escala logarítmica no eixo horizontal (e também no vertical, no Gráfico 2), porque os tempos variam de milésimos a dezenas de milissegundos; em escala linear, os pontos menores ficariam colados ao eixo."),
  img(G("grafico2_tempos"), 490),
  caption("Gráfico 2 — Tempo médio por execução (barras de erro: desvio padrão entre rodadas)."),
  img(G("grafico3_speedup"), 490),
  caption("Gráfico 3 — Speedup em função da quantidade de registros, para 1, 2 e 4 threads."),
  H2("5.4 Discussão"),
  P(`**1 thread.** O speedup fica próximo de 1,0x em todos os tamanhos (${br(Math.min(...Ns.map(n => S(n, 1))), 2)}x a ${br(Math.max(...Ns.map(n => S(n, 1))), 2)}x). Isso mostra que o código OpenMP, quando executado com uma única thread, praticamente não acrescenta custo em relação à versão sequencial; as pequenas diferenças estão dentro da variação das medições.`),
  P(`**2 threads.** Com os 1.000 registros do enunciado, a versão paralela foi mais lenta (${br(S(N1k, 2), 2)}x). A partir de 10 mil registros ela passa a ser mais rápida (${br(S(10000, 2), 2)}x), e entre 100 mil e 10 milhões o speedup fica entre ${br(Math.min(...s2.slice(2)), 2)}x e ${br(Math.max(...s2.slice(2)), 2)}x, próximo do ideal de 2,0x. A pequena queda em 10 milhões (${br(S(N10M, 2), 2)}x) está próxima da variação observada entre rodadas; uma possível causa é que, nesse tamanho, os dados (cerca de 160 MB) não cabem na memória cache e o acesso à memória passa a limitar o ganho, mas essa hipótese não foi medida diretamente.`),
  P(`**4 threads.** A máquina tem apenas 2 núcleos, então 4 threads disputam os mesmos processadores. Para poucos dados o resultado é muito pior que o sequencial (${br(S(N1k, 4), 2)}x com 1.000 registros): as threads que esperam nas barreiras e no \`critical\` ocupam núcleos que as outras precisam. Com 10 milhões de registros, o trabalho útil domina e o speedup (${br(S(N10M, 4), 2)}x) fica equivalente ao de 2 threads. Usar mais threads do que núcleos, portanto, não traz ganho e pode prejudicar bastante o desempenho.`),

  H1("6. Conclusão"),
  P(`O programa calculou o coeficiente de variação para dados agrupados: **${br(resultado.estatura.cv, 2)} %** para a estatura e **${br(resultado.peso.cv, 2)} %** para o peso. Os resultados foram confirmados por uma implementação de referência independente, pela soma das frequências e pela equivalência entre a versão sequencial e a versão paralela com diferentes números de threads.`),
  P(`Com os 1.000 registros do enunciado, a versão paralela com 2 threads foi **mais lenta** que a sequencial (${br(S(N1k, 2), 2)}x). A análise completa leva cerca de ${br(get(N1k, "sequencial", 1).m * 1000, 1)} µs, e nesse intervalo o custo fixo do paralelismo — ativar as threads em cada região paralela, dividir o laço, alocar os histogramas locais e sincronizar no \`critical\` e nas reduções — supera o tempo economizado ao dividir o trabalho. Esse custo fixo é o *overhead* das threads: ele praticamente não depende do tamanho dos dados, enquanto o trabalho útil cresce proporcionalmente a N.`),
  P(`Por isso, o paralelismo passou a compensar quando os dados aumentaram: nos testes, a versão com 2 threads foi mais rápida **a partir de 10 mil registros** (${br(S(10000, 2), 2)}x); o ponto exato de equilíbrio fica entre 1 mil e 10 mil registros e não foi medido. Com 1 milhão de registros, o speedup de ${br(S(1000000, 2), 2)}x corresponde a uma eficiência de ${br(S(1000000, 2) / 2 * 100, 0)} %, muito próxima do ideal teórico de 2,0x. A diferença restante vem das partes que não se dividem entre as threads (sincronização, alocações e trechos sequenciais), conforme a Lei de Amdahl.`),
  P("Os testes têm limitações que devem ser consideradas:", { keepNext: true }),
  bullet("A máquina possui apenas **2 núcleos** (vCPUs de uma máquina virtual). Não é possível afirmar, a partir desses dados, como o programa escalaria em um computador com mais núcleos; em teoria o ganho pode aumentar, mas também crescem os custos de sincronização."),
  bullet("O ambiente virtualizado e compartilhado pode introduzir variações; o desvio padrão entre rodadas é apresentado para dar a dimensão dessa variação."),
  bullet("Os volumes maiores foram obtidos replicando os mesmos 1.000 registros, e não com dados novos."),
  P("Em resumo, para o volume de dados pedido no exercício, o OpenMP não traz ganho de desempenho. A implementação, porém, se mostrou correta e escalável: quando há trabalho suficiente para amortizar o overhead e o número de threads respeita o número de núcleos, o desempenho se aproxima do limite teórico."),

  H1("7. Reprodutibilidade"),
  P("Todo o trabalho está no repositório indicado na capa, com instruções detalhadas no arquivo `README.md`. Os principais comandos são:", { keepNext: true }),
  ...code([
    "make              # compila cv_openmp, cv_sequencial e gerar_dados",
    "make run          # resultados + tempo com as 1.000 pessoas",
    "make run-seq      # versao sequencial pura (sem OpenMP)",
    "make test         # testes automatizados",
    "make benchmark    # benchmark completo -> resultados/benchmark.csv",
    "make graficos     # recria os graficos",
    "",
    "# sem make:",
    "gcc -O2 -Wall -Wextra -fopenmp src/cv_openmp.c -o cv_openmp -lm",
    "./cv_openmp dados/dados.txt                  # 1.000 pessoas",
    "./cv_openmp dados/dados.txt 5 10000          # 10 milhoes de registros",
    "OMP_NUM_THREADS=4 ./cv_openmp dados/dados.txt  # numero de threads"]),
];

// ================= documento =================
const hf = { font: FONT, size: 18, color: "666666" };
const pagina = { size: { width: 11906, height: 16838 } };
const doc = new Document({
  creator: "Daniel Trindade", title: "Exercício Final — Análise de Dados com OpenMP",
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 30, bold: true, color: BLUE },
        paragraph: { spacing: { before: 360, after: 160 }, keepNext: true, keepLines: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 25, bold: true, color: "333333" },
        paragraph: { spacing: { before: 220, after: 100 }, keepNext: true, keepLines: true, outlineLevel: 1 } },
    ]
  },
  numbering: { config: [{ reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•",
    alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 283 } } } }] }] },
  sections: [
    { properties: { page: { ...pagina, margin: { top: 1701, left: 1701, bottom: 1134, right: 1134 } } }, children: capa },
    { properties: { page: { ...pagina, margin: { top: 1701, left: 1701, bottom: 1134, right: 1134, header: 700, footer: 500 },
        pageNumbers: { start: 2 } } },
      headers: { default: new Header({ children: [new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA", space: 4 } },
        tabStops: [{ type: TabStopType.RIGHT, position: W }],
        children: [new TextRun({ text: "Exercício Final — Análise de Dados com OpenMP", ...hf }),
          new TextRun({ text: "\tIESB · Ciência da Computação", ...hf })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT], ...hf })] })] }) },
      children: body }
  ]
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync(DIR + "docs/relatorio_final.docx", b); console.log("docs/relatorio_final.docx gerado"); });
