"""
Gera os graficos do relatorio a partir de resultados/benchmark.csv e dados/dados.txt.
Uso (na raiz do repositorio):  python3 scripts/graficos.py
Requer: matplotlib
"""
import csv
import math
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mt

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, "resultados", "graficos")
os.makedirs(SAIDA, exist_ok=True)

plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10})
virgula = mt.FuncFormatter(lambda v, p: f"{v:g}".replace(".", ","))
CORES = {"seq": "#1f4e79", 1: "#8c8c8c", 2: "#d9822b", 4: "#7a9a01"}
ROTULOS_N = {1000: "1 mil", 10000: "10 mil", 100000: "100 mil", 1000000: "1 milhão", 10000000: "10 milhões"}

# ---------- leitura do benchmark ----------
linhas = list(csv.DictReader(open(os.path.join(RAIZ, "resultados", "benchmark.csv"))))
Ns = sorted({int(l["N"]) for l in linhas})


def serie(versao, threads=None, campo="media_ms"):
    return [float(l[campo]) for n in Ns for l in linhas
            if int(l["N"]) == n and l["versao"] == versao and (threads is None or int(l["threads"]) == threads)]


rotulos = [ROTULOS_N.get(n, str(n)) for n in Ns]

# ---------- Grafico 1: tempos ----------
fig, ax = plt.subplots(figsize=(7, 4))
ax.errorbar(Ns, serie("sequencial"), yerr=serie("sequencial", campo="desvio_ms"), fmt="o-", lw=2,
            capsize=3, color=CORES["seq"], label="Sequencial")
for t, m in ((2, "s"), (4, "^")):
    ax.errorbar(Ns, serie("paralelo", t), yerr=serie("paralelo", t, "desvio_ms"), fmt=m + "-", lw=2,
                capsize=3, color=CORES[t], label=f"Paralelo ({t} threads)")
ax.set_xscale("log"); ax.set_yscale("log")
ax.set_xticks(Ns); ax.set_xticklabels(rotulos)
ax.set_xlabel("Quantidade de registros (N) — escala log")
ax.set_ylabel("Tempo médio por execução (ms) — escala log")
ax.set_title("Gráfico 2 — Tempo de execução: sequencial × paralelo")
ax.grid(which="both", alpha=.25); ax.legend(frameon=False)
fig.tight_layout(); fig.savefig(os.path.join(SAIDA, "grafico2_tempos.png"), dpi=250); plt.close(fig)

# ---------- Grafico 2: speedup ----------
fig, ax = plt.subplots(figsize=(7, 4))
ax.axhline(2, color="#999999", ls=":", lw=1.4, label="Ideal com 2 núcleos (2,0x)")
ax.axhline(1, color="#555555", ls="--", lw=1.1, label="Sem ganho (1,0x)")
for t, m in ((1, "o"), (2, "s"), (4, "^")):
    sp = serie("paralelo", t, "speedup")
    ax.plot(Ns, sp, m + "-", lw=2, color=CORES[t], label=f"{t} thread" + ("s" if t > 1 else ""))
    if t == 2:
        for x, y in zip(Ns, sp):
            ax.annotate(f"{y:.2f}x".replace(".", ","), (x, y), textcoords="offset points",
                        xytext=(0, -15 if y > 1.8 else 8), ha="center", fontsize=8.5, color=CORES[t])
ax.set_xscale("log"); ax.set_xticks(Ns); ax.set_xticklabels(rotulos)
ax.set_ylim(0, 2.4); ax.yaxis.set_major_formatter(virgula)
ax.set_xlabel("Quantidade de registros (N) — escala log")
ax.set_ylabel("Speedup = T_seq / T_par (adimensional)")
ax.set_title("Gráfico 3 — Speedup em função da quantidade de registros")
ax.grid(alpha=.25); ax.legend(frameon=True, framealpha=.95, edgecolor="#dddddd", loc="lower right", fontsize=8.5, ncol=2)
fig.tight_layout(); fig.savefig(os.path.join(SAIDA, "grafico3_speedup.png"), dpi=250); plt.close(fig)

# ---------- Grafico 1: histogramas das classes ----------
est, peso = [], []
for linha in open(os.path.join(RAIZ, "dados", "dados.txt")):
    if linha.strip() and not linha.startswith("#"):
        e, p = map(float, linha.split()); est.append(e); peso.append(p)


def classes(v, h):
    ini = math.floor(min(v)); k = int((max(v) - ini) // h) + 1
    f = [0] * k
    for x in v:
        f[min(int((x - ini) // h), k - 1)] += 1
    return [ini + i * h for i in range(k)], f


fig, axs = plt.subplots(1, 2, figsize=(9, 3.6))
for ax, v, h, un, nome, cor in ((axs[0], est, 8, "cm", "Estatura", "#1f4e79"),
                                (axs[1], peso, 4, "kg", "Peso", "#d9822b")):
    lim, f = classes(v, h)
    ax.bar(lim, f, width=h, align="edge", color=cor, edgecolor="white", alpha=.9)
    ax.set_title(f"{nome} — classes de {h} {un}")
    ax.set_xlabel(f"{nome} ({un})"); ax.set_ylabel("Frequência (pessoas)")
    ax.grid(axis="y", alpha=.25)
fig.suptitle("Gráfico 1 — Distribuição de frequências por classe (N = 1.000)", fontsize=11)
fig.tight_layout(); fig.savefig(os.path.join(SAIDA, "grafico1_distribuicao.png"), dpi=250); plt.close(fig)
print("Graficos gerados em", SAIDA)
