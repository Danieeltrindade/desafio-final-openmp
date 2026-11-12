# Exercício Final — Análise de Dados com OpenMP

**IESB · Ciência da Computação · Programação Paralela**
Professor: Rodrigo Gonçalves Pinto · Aluno: Daniel Trindade

Programa em C com OpenMP que calcula o **coeficiente de variação (CV)** da estatura e do
peso de 1.000 pessoas a partir de **dados agrupados em classes** (8 cm para estatura e
4 kg para peso) e compara o desempenho das versões sequencial e paralela.

🔗 **Repositório:** https://github.com/Danieeltrindade/desafio-final-openmp

📄 **Relatório:** [`docs/relatorio_final.pdf`](docs/relatorio_final.pdf)

## Resultados

| Variável | Classes | Média ponderada (µ) | Desvio padrão (σ) | **CV** |
|---|---|---:|---:|---:|
| Estatura | 9 classes de 8 cm | 169,76 cm | 10,39 cm | **6,12 %** |
| Peso | 17 classes de 4 kg | 69,64 kg | 11,40 kg | **16,36 %** |

Fórmulas (dados agrupados, xᵢ = ponto médio, fᵢ = frequência, N = 1.000):

- µ = Σ(xᵢ·fᵢ) / N
- σ = √( Σ fᵢ·(xᵢ − µ)² / N )  (desvio padrão populacional)
- CV = σ / µ × 100 %

Desempenho (2 núcleos, média de 7 rodadas — detalhes em [`resultados/benchmark.csv`](resultados/benchmark.csv)):

| Registros | Sequencial | Paralelo (2 threads) | Speedup |
|---:|---:|---:|---:|
| 1.000 | 0,0079 ms | 0,0112 ms | 0,70x |
| 10.000 | 0,058 ms | 0,038 ms | 1,52x |
| 100.000 | 0,54 ms | 0,29 ms | 1,89x |
| 1.000.000 | 5,63 ms | 2,85 ms | 1,98x |
| 10.000.000 | 69,4 ms | 37,1 ms | 1,87x |

Com os 1.000 registros do enunciado o paralelo é mais lento (o custo de criar e
sincronizar threads é maior que o próprio cálculo). A partir de 10 mil registros o
paralelismo compensa e se aproxima do ideal de 2x.

## O que foi paralelizado

| Etapa | Diretiva OpenMP | Por quê |
|---|---|---|
| Mínimo e máximo | `parallel for reduction(min/max)` | Percorre os N registros |
| Frequência por classe | `parallel` + `for nowait` + histograma local + `critical` | Etapa mais pesada; cada thread conta no próprio histograma, sem condição de corrida |
| Média ponderada | `parallel for reduction(+)` | Somatórios independentes por classe |
| Desvio padrão | `parallel for reduction(+)` | Somatório independente por classe |

## Estrutura

```
src/cv_openmp.c          programa principal (OpenMP; sem -fopenmp vira a versão sequencial)
src/gerar_dados.c        gera dados/dados.txt (1.000 pessoas, semente fixa)
dados/dados.txt          dados de entrada: "estatura peso" por linha
tests/testes.py          testes automatizados (32 verificações)
tests/casos/             casos controlados (fronteiras de classe, valor único, etc.)
scripts/graficos.py      gera os gráficos do relatório
resultados/              saídas, benchmark, ambiente e gráficos
docs/                    relatório (PDF e DOCX editável)
.vscode/                 tarefas prontas para o VS Code
```

## Como compilar e executar

Requisitos: **GCC com suporte a OpenMP**. Python 3 é necessário apenas para testes e
gráficos (gráficos também precisam de `matplotlib`).

### Linux / WSL / macOS (com make)

```bash
make            # compila cv_openmp, cv_sequencial e gerar_dados
make run        # resultados + comparação de tempo com 1.000 pessoas
make run-seq    # versão sequencial pura
make test       # testes automatizados
make benchmark  # benchmark completo (leva ~1 min)
make graficos   # recria os gráficos
make dados      # recria dados/dados.txt
```

### Sem make (Windows/PowerShell ou qualquer terminal)

```bash
gcc -O2 -Wall -Wextra -fopenmp src/cv_openmp.c -o cv_openmp -lm
gcc -O2 -Wall -Wextra -Wno-unknown-pragmas src/cv_openmp.c -o cv_sequencial -lm
./cv_openmp dados/dados.txt
```

### Argumentos

```
./cv_openmp [arquivo] [repeticoes] [fator]
./cv_openmp [arquivo] --benchmark [saida.csv]
```

- `repeticoes`: quantas vezes a análise é repetida para medir o tempo (padrão 1000)
- `fator`: replica os dados em memória para testar escala (ex.: `./cv_openmp dados/dados.txt 5 10000` → 10 milhões)
- número de threads: variável `OMP_NUM_THREADS` (ex.: `OMP_NUM_THREADS=4 ./cv_openmp dados/dados.txt`;
  no PowerShell: `$env:OMP_NUM_THREADS=4`)

### No VS Code

Abra a pasta do projeto e use **Terminal → Run Task…** (ou `Ctrl+Shift+B` para compilar).
Tarefas disponíveis: *Compilar*, *Executar (1000 pessoas)*, *Executar sequencial*,
*Testes*, *Benchmark completo* e *Gerar gráficos*.

## Observações

- O enunciado não fornece arquivo de dados; `dados/dados.txt` foi gerado por
  `src/gerar_dados.c` com semente fixa (estatura ~ N(170, 10) cm; peso correlacionado
  com a estatura). Para usar outro arquivo, basta passá-lo como primeiro argumento.
- Os tempos dependem da máquina. Os valores acima foram medidos em uma máquina virtual
  com 2 vCPUs (ver [`resultados/ambiente.txt`](resultados/ambiente.txt)).
