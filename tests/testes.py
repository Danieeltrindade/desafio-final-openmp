"""
Testes automatizados do Exercicio Final (OpenMP).

Executar na raiz do repositorio, depois de compilar (make):
    python3 tests/testes.py

O que e verificado:
  1. Os resultados do programa batem com uma implementacao de referencia
     independente, escrita em Python, para o arquivo dados/dados.txt e para
     casos controlados (fronteiras de classe, valor unico, poucos registros).
  2. A versao OpenMP produz exatamente o mesmo resultado com 1, 2 e 4 threads
     (varias execucoes) e o mesmo resultado da versao sequencial pura.
  3. A soma das frequencias e igual ao numero de registros.
  4. Entradas invalidas (arquivo inexistente, vazio, linha malformada,
     valor negativo) sao rejeitadas com erro.
"""
import math
import os
import subprocess
import sys
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXT = ".exe" if os.name == "nt" else ""
OMP = os.path.join(RAIZ, "cv_openmp" + EXT)
SEQ = os.path.join(RAIZ, "cv_sequencial" + EXT)
CASOS = os.path.join(RAIZ, "tests", "casos")
DADOS = os.path.join(RAIZ, "dados", "dados.txt")

falhas = 0
total = 0


def verificar(cond, msg):
    global falhas, total
    total += 1
    print(("  [OK]   " if cond else "  [FALHA] ") + msg)
    if not cond:
        falhas += 1


# ---------------- referencia independente ----------------
def referencia(valores, h):
    inicio = math.floor(min(valores))
    k = int((max(valores) - inicio) // h) + 1
    f = [0] * k
    for v in valores:
        f[min(int((v - inicio) // h), k - 1)] += 1
    n = sum(f)
    pm = [inicio + (i + 0.5) * h for i in range(k)]
    mu = sum(x * fi for x, fi in zip(pm, f)) / n
    sd = math.sqrt(sum(fi * (x - mu) ** 2 for x, fi in zip(pm, f)) / n)
    return mu, sd, sd / mu * 100, f


def ler(caminho):
    est, peso = [], []
    with open(caminho) as arq:
        for linha in arq:
            linha = linha.strip()
            if linha and not linha.startswith("#"):
                e, p = map(float, linha.split())
                est.append(e)
                peso.append(p)
    return est, peso


def executar(binario, arquivo, threads=None):
    env = dict(os.environ)
    if threads:
        env["OMP_NUM_THREADS"] = str(threads)
    r = subprocess.run([binario, arquivo, "1"], capture_output=True, text=True, env=env)
    res, totais = {}, []
    for linha in r.stdout.splitlines():
        if linha.startswith("RESULTADO;"):
            _, var, mu, sd, cv = linha.split(";")
            res[var] = (float(mu), float(sd), float(cv))
        if linha.strip().startswith("Total"):
            totais.append(int(linha.split()[-1]))
    return r.returncode, res, totais


def proximo(a, b):
    return all(math.isclose(x, y, rel_tol=1e-6, abs_tol=1e-6) for x, y in zip(a, b))


def testar_arquivo(nome, caminho):
    print(f"\n- {nome}")
    est, peso = ler(caminho)
    ref = {"estatura": referencia(est, 8.0)[:3], "peso": referencia(peso, 4.0)[:3]}
    cod, res, totais = executar(OMP, caminho)
    verificar(cod == 0, "programa executou sem erro")
    for var in ("estatura", "peso"):
        verificar(var in res and proximo(res[var], ref[var]),
                  f"{var}: programa {res.get(var)} = referencia "
                  f"({ref[var][0]:.6f}, {ref[var][1]:.6f}, {ref[var][2]:.6f})")
    verificar(totais == [len(est), len(est)], f"frequencias somam {len(est)} nas duas variaveis")
    _, res_seq, _ = executar(SEQ, caminho)
    verificar(res_seq == res, "versao sequencial pura = versao OpenMP")
    iguais = all(executar(OMP, caminho, t)[1] == res for t in (1, 2, 4) for _ in range(5))
    verificar(iguais, "OpenMP com 1, 2 e 4 threads (5 execucoes cada): resultados identicos")


def escrever(nome, conteudo):
    caminho = os.path.join(tempfile.gettempdir(), nome)
    with open(caminho, "w") as arq:
        arq.write(conteudo)
    return caminho


def main():
    for b in (OMP, SEQ):
        if not os.path.exists(b):
            sys.exit(f"Binario {b} nao encontrado. Compile antes (make).")

    print("=== Corretude ===")
    testar_arquivo("dados/dados.txt (1000 pessoas)", DADOS)
    for nome in sorted(os.listdir(CASOS)):
        testar_arquivo(f"tests/casos/{nome}", os.path.join(CASOS, nome))

    print("\n- Distribuicao de frequencias conhecida (fronteiras)")
    # 140,0 e 147,9 -> [140,148); 148,0 (fronteira) -> [148,156); 155,9 -> [148,156)
    est, _ = ler(os.path.join(CASOS, "fronteiras.txt"))
    verificar(referencia(est, 8.0)[3] == [2, 2, 1], "referencia classifica fronteiras como [a, a+h)")
    r = subprocess.run([OMP, os.path.join(CASOS, "fronteiras.txt"), "1"], capture_output=True, text=True)
    bloco = r.stdout.split("=== ESTATURA")[1].split("Total")[0]
    freq = [int(l.split()[-1]) for l in bloco.splitlines() if l.strip().startswith("[")]
    verificar(freq == [2, 2, 1], f"programa classifica fronteiras como [a, a+h): {freq}")

    print("\n=== Entradas invalidas (devem gerar erro) ===")
    invalidos = {
        "arquivo inexistente": os.path.join(RAIZ, "nao_existe.txt"),
        "arquivo vazio": escrever("vazio.txt", ""),
        "linha com um valor": escrever("um_valor.txt", "170.0 70.0\n165.0\n"),
        "texto no lugar de numero": escrever("texto.txt", "170.0 setenta\n"),
        "valor negativo": escrever("negativo.txt", "170.0 70.0\n-160.0 60.0\n"),
        "tres colunas": escrever("tres.txt", "170.0 70.0 5\n"),
    }
    for nome, caminho in invalidos.items():
        cod, _, _ = executar(OMP, caminho)
        verificar(cod != 0, f"{nome}: rejeitado (codigo {cod})")

    print(f"\n{total - falhas}/{total} verificacoes aprovadas.")
    sys.exit(1 if falhas else 0)


if __name__ == "__main__":
    main()
