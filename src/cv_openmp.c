/*
 * Exercicio Final - Analise de Dados com OpenMP
 * Coeficiente de variacao (CV) para dados agrupados em classes.
 *   Estatura: classes de 8 cm | Peso: classes de 4 kg
 *
 * Compilacao:
 *   gcc -O2 -Wall -Wextra -fopenmp src/cv_openmp.c -o cv_openmp -lm    (versao OpenMP)
 *   gcc -O2 -Wall -Wextra          src/cv_openmp.c -o cv_sequencial -lm (sequencial pura)
 *
 * Uso:
 *   ./cv_openmp [arquivo] [repeticoes] [fator]   resultados + tempo seq x par
 *   ./cv_openmp [arquivo] --benchmark [saida.csv] benchmark completo (escala e threads)
 *
 *   arquivo     arquivo texto com "estatura peso" por linha (padrao: dados/dados.txt)
 *   repeticoes  quantas vezes a analise e repetida para medir o tempo (padrao: 1000)
 *   fator       replica os dados em memoria para teste de escala (padrao: 1)
 *
 * O mesmo codigo roda em modo sequencial ou paralelo: cada regiao OpenMP usa
 * a clausula if(paralelo). Assim a comparacao de tempos usa o mesmo algoritmo
 * e a mesma compilacao. Compilado sem -fopenmp, as diretivas sao ignoradas e
 * o resultado e uma versao sequencial pura, usada para validar os resultados.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <float.h>
#include <time.h>

#ifdef _OPENMP
#include <omp.h>
#else
/* Substitutos para compilar sem OpenMP (versao sequencial pura). */
static double omp_get_wtime(void) {
    struct timespec t;
    timespec_get(&t, TIME_UTC);
    return (double)t.tv_sec + t.tv_nsec * 1e-9;
}
static int  omp_get_max_threads(void) { return 1; }
static void omp_set_num_threads(int n) { (void)n; }
#endif

#define LARGURA_ESTATURA 8.0   /* cm */
#define LARGURA_PESO     4.0   /* kg */

typedef struct {
    double inicio;      /* limite inferior da 1a classe     */
    double largura;     /* amplitude da classe (h)          */
    int    k;           /* numero de classes                */
    long  *freq;        /* f_i                              */
    long   n;           /* total de observacoes (soma f_i)  */
    double media, desvio, cv;
} Resultado;

/* ---------- 1) Minimo e maximo (reducao paralela) ---------- */
static void min_max(const double *x, long n, double *mn, double *mx, int paralelo) {
    double a = DBL_MAX, b = -DBL_MAX;
    (void)paralelo;
    #pragma omp parallel for reduction(min:a) reduction(max:b) if(paralelo)
    for (long i = 0; i < n; i++) {
        if (x[i] < a) a = x[i];
        if (x[i] > b) b = x[i];
    }
    *mn = a; *mx = b;
}

/* ---------- 2) Frequencias por classe (histograma paralelo) ----------
 * Cada thread conta em um histograma local (sem condicao de corrida)
 * e no fim os histogramas sao somados. Evita 'atomic' a cada elemento. */
static void frequencias(const double *x, long n, Resultado *r, int paralelo) {
    int k = r->k;
    (void)paralelo;
    memset(r->freq, 0, k * sizeof(long));
    #pragma omp parallel if(paralelo)
    {
        long *local = calloc(k, sizeof(long));
        #pragma omp for nowait
        for (long i = 0; i < n; i++) {
            int c = (int)((x[i] - r->inicio) / r->largura);
            if (c >= k) c = k - 1;          /* seguranca para o valor maximo */
            local[c]++;
        }
        #pragma omp critical
        for (int c = 0; c < k; c++) r->freq[c] += local[c];
        free(local);
    }
}

/* ---------- 3) Media ponderada: mu = sum(xi*fi) / N ---------- */
static double media_ponderada(const Resultado *r, int paralelo) {
    double soma_xf = 0.0; long soma_f = 0;
    (void)paralelo;
    #pragma omp parallel for reduction(+:soma_xf, soma_f) if(paralelo)
    for (int c = 0; c < r->k; c++) {
        double xi = r->inicio + (c + 0.5) * r->largura;   /* ponto medio */
        soma_xf += xi * r->freq[c];
        soma_f  += r->freq[c];
    }
    return soma_xf / soma_f;
}

/* ---------- 4) Desvio padrao populacional ---------- */
static double desvio_padrao(const Resultado *r, double mu, int paralelo) {
    double soma = 0.0; long soma_f = 0;
    (void)paralelo;
    #pragma omp parallel for reduction(+:soma, soma_f) if(paralelo)
    for (int c = 0; c < r->k; c++) {
        double xi = r->inicio + (c + 0.5) * r->largura;
        soma   += r->freq[c] * (xi - mu) * (xi - mu);
        soma_f += r->freq[c];
    }
    return sqrt(soma / soma_f);
}

/* Analise completa de uma variavel. */
static void analisar(const double *x, long n, double largura, Resultado *r, int paralelo) {
    double mn, mx;
    min_max(x, n, &mn, &mx, paralelo);
    r->largura = largura;
    r->inicio  = floor(mn);                       /* 1a classe comeca no inteiro abaixo do minimo */
    r->k       = (int)((mx - r->inicio) / largura) + 1;
    r->freq    = realloc(r->freq, r->k * sizeof(long));
    r->n       = n;
    frequencias(x, n, r, paralelo);
    r->media  = media_ponderada(r, paralelo);
    r->desvio = desvio_padrao(r, r->media, paralelo);
    r->cv     = r->desvio / r->media * 100.0;     /* CV = sigma / mu * 100 % */
}

/* Confere se as frequencias somam N (protege contra erros de classe). */
static void conferir(const Resultado *r, const char *nome) {
    long soma = 0;
    for (int c = 0; c < r->k; c++) soma += r->freq[c];
    if (soma != r->n) {
        fprintf(stderr, "ERRO: frequencias de %s somam %ld, esperado %ld\n", nome, soma, r->n);
        exit(2);
    }
}

static void imprimir(const char *nome, const char *un, const Resultado *r) {
    printf("\n=== %s (classes de %.0f %s) ===\n", nome, r->largura, un);
    printf("  Classe              Ponto medio   Freq.\n");
    for (int c = 0; c < r->k; c++) {
        double a = r->inicio + c * r->largura;
        printf("  [%6.1f, %6.1f)     %8.1f   %6ld\n", a, a + r->largura,
               a + r->largura / 2, r->freq[c]);
    }
    printf("  Total                            %6ld\n", r->n);
    printf("  Media ponderada (mu)  = %.4f %s\n", r->media, un);
    printf("  Desvio padrao (sigma) = %.4f %s\n", r->desvio, un);
    printf("  Coef. de variacao     = %.4f %%\n", r->cv);
}

/* ---------- Leitura validada do arquivo ---------- */
static long ler_arquivo(const char *arq, double **est, double **peso) {
    FILE *f = fopen(arq, "r");
    if (!f) { perror(arq); exit(1); }
    long cap = 1024, n = 0, linha = 0;
    *est = malloc(cap * sizeof(double));
    *peso = malloc(cap * sizeof(double));
    char buf[256];
    while (fgets(buf, sizeof buf, f)) {
        linha++;
        char *p = buf;
        while (*p == ' ' || *p == '\t' || *p == '\r' || *p == '\n') p++;
        if (*p == '\0' || *p == '#') continue;            /* linha vazia ou comentario */
        double e, w; char extra;
        if (sscanf(p, "%lf %lf %c", &e, &w, &extra) != 2) {
            fprintf(stderr, "ERRO: linha %ld invalida (esperado \"estatura peso\"): %s", linha, buf);
            exit(1);
        }
        if (!isfinite(e) || !isfinite(w) || e <= 0 || w <= 0) {
            fprintf(stderr, "ERRO: linha %ld com valor nao positivo ou invalido\n", linha);
            exit(1);
        }
        if (n == cap) {
            cap *= 2;
            *est = realloc(*est, cap * sizeof(double));
            *peso = realloc(*peso, cap * sizeof(double));
        }
        (*est)[n] = e; (*peso)[n] = w; n++;
    }
    fclose(f);
    if (n == 0) { fprintf(stderr, "ERRO: arquivo sem registros.\n"); exit(1); }
    return n;
}

/* Replica os dados em memoria (teste de escalabilidade). */
static long replicar(double **est, double **peso, long n, long fator) {
    if (fator <= 1) return n;
    *est  = realloc(*est,  n * fator * sizeof(double));
    *peso = realloc(*peso, n * fator * sizeof(double));
    if (!*est || !*peso) { fprintf(stderr, "ERRO: memoria insuficiente\n"); exit(1); }
    for (long r = 1; r < fator; r++) {
        memcpy(*est + r * n,  *est,  n * sizeof(double));
        memcpy(*peso + r * n, *peso, n * sizeof(double));
    }
    return n * fator;
}

/* Tempo medio (s) de 'reps' analises completas das duas variaveis. */
static double medir(const double *est, const double *peso, long n, int reps,
                    Resultado *rE, Resultado *rP, int paralelo) {
    double t0 = omp_get_wtime();
    for (int i = 0; i < reps; i++) {
        analisar(est,  n, LARGURA_ESTATURA, rE, paralelo);
        analisar(peso, n, LARGURA_PESO,     rP, paralelo);
    }
    return (omp_get_wtime() - t0) / reps;
}

/* ---------- Benchmark completo ----------
 * Para cada tamanho N: 1 aquecimento + RODADAS rodadas. Em cada rodada mede-se
 * a versao sequencial e a paralela com 1, 2 e 4 threads (e o maximo da maquina,
 * se for maior), alternando a ordem entre rodadas para reduzir vies.
 * Cada medicao e a media de 'reps' repeticoes. Saida em CSV. */
#define RODADAS 7
static void benchmark(const double *est0, const double *peso0, long n0, const char *saida) {
    const long fatores[] = {1, 10, 100, 1000, 10000};
    int maxt = omp_get_max_threads();
    int threads[8], nt = 0;
    threads[nt++] = 0;                      /* 0 = sequencial */
    threads[nt++] = 1; threads[nt++] = 2; threads[nt++] = 4;
    if (maxt > 4) threads[nt++] = maxt;

    FILE *out = saida ? fopen(saida, "w") : stdout;
    if (!out) { perror(saida); exit(1); }
    fprintf(out, "N,versao,threads,rodadas,repeticoes,media_ms,desvio_ms,min_ms,speedup\n");
    fprintf(stderr, "Benchmark: %d rodadas por configuracao, threads disponiveis = %d\n", RODADAS, maxt);

    Resultado rE = {0}, rP = {0};
    for (unsigned f = 0; f < sizeof fatores / sizeof *fatores; f++) {
        double *est = malloc(n0 * sizeof(double)), *peso = malloc(n0 * sizeof(double));
        memcpy(est, est0, n0 * sizeof(double)); memcpy(peso, peso0, n0 * sizeof(double));
        long n = replicar(&est, &peso, n0, fatores[f]);
        int reps = (int)(20000 / fatores[f]); if (reps < 5) reps = 5;

        double t[8][RODADAS];
        for (int j = 0; j < nt; j++) {            /* aquecimento */
            omp_set_num_threads(threads[j] ? threads[j] : 1);
            medir(est, peso, n, 1, &rE, &rP, threads[j] != 0);
        }
        for (int r = 0; r < RODADAS; r++)
            for (int jj = 0; jj < nt; jj++) {
                int j = (r % 2 == 0) ? jj : nt - 1 - jj;   /* alterna a ordem */
                omp_set_num_threads(threads[j] ? threads[j] : 1);
                t[j][r] = medir(est, peso, n, reps, &rE, &rP, threads[j] != 0);
            }
        double media_seq = 0;
        for (int j = 0; j < nt; j++) {
            double m = 0, s = 0, mn = 1e30;
            for (int r = 0; r < RODADAS; r++) { m += t[j][r]; if (t[j][r] < mn) mn = t[j][r]; }
            m /= RODADAS;
            for (int r = 0; r < RODADAS; r++) s += (t[j][r] - m) * (t[j][r] - m);
            s = sqrt(s / (RODADAS - 1));                    /* desvio amostral entre rodadas */
            if (j == 0) media_seq = m;
            fprintf(out, "%ld,%s,%d,%d,%d,%.6f,%.6f,%.6f,%.4f\n", n,
                    threads[j] ? "paralelo" : "sequencial", threads[j] ? threads[j] : 1,
                    RODADAS, reps, m * 1e3, s * 1e3, mn * 1e3, media_seq / m);
        }
        fflush(out);
        fprintf(stderr, "  N = %ld concluido\n", n);
        free(est); free(peso);
    }
    omp_set_num_threads(maxt);
    if (saida) { fclose(out); fprintf(stderr, "Resultados gravados em %s\n", saida); }
    free(rE.freq); free(rP.freq);
}

int main(int argc, char **argv) {
    const char *arq = argc > 1 ? argv[1] : "dados/dados.txt";
    double *est, *peso;
    long n = ler_arquivo(arq, &est, &peso);

    if (argc > 2 && strcmp(argv[2], "--benchmark") == 0) {
        benchmark(est, peso, n, argc > 3 ? argv[3] : NULL);
        free(est); free(peso);
        return 0;
    }

    int  reps  = argc > 2 ? atoi(argv[2]) : 1000;
    long fator = argc > 3 ? atol(argv[3]) : 1;
    if (reps < 1) reps = 1;
    n = replicar(&est, &peso, n, fator);

#ifdef _OPENMP
    printf("Versao OpenMP | Registros: %ld | Threads disponiveis: %d\n", n, omp_get_max_threads());
#else
    printf("Versao sequencial (sem OpenMP) | Registros: %ld\n", n);
#endif

    Resultado rE = {0}, rP = {0};
    analisar(est,  n, LARGURA_ESTATURA, &rE, 1);
    analisar(peso, n, LARGURA_PESO,     &rP, 1);
    conferir(&rE, "estatura");
    conferir(&rP, "peso");
    imprimir("ESTATURA", "cm", &rE);
    imprimir("PESO",     "kg", &rP);
    /* linhas em formato fixo, usadas pelos testes automatizados */
    printf("\nRESULTADO;estatura;%.6f;%.6f;%.6f\n", rE.media, rE.desvio, rE.cv);
    printf("RESULTADO;peso;%.6f;%.6f;%.6f\n", rP.media, rP.desvio, rP.cv);

    /* ---- Comparacao sequencial x paralelo (mesmo binario) ---- */
    double t_seq = medir(est, peso, n, reps, &rE, &rP, 0);
    double t_par = medir(est, peso, n, reps, &rE, &rP, 1);
    printf("\n=== DESEMPENHO (media de %d execucoes) ===\n", reps);
    printf("  Sequencial: %.6f ms\n", t_seq * 1e3);
    printf("  Paralelo  : %.6f ms (%d threads)\n", t_par * 1e3, omp_get_max_threads());
    printf("  Speedup   : %.2fx\n", t_seq / t_par);
    printf("CSV;%ld;%d;%.9f;%.9f\n", n, omp_get_max_threads(), t_seq, t_par);

    free(est); free(peso); free(rE.freq); free(rP.freq);
    return 0;
}
