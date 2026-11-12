/* Uso: ./gerar_dados [arquivo] [quantidade]   (padrao: dados/dados.txt 1000)
   Gera o arquivo com 1000 pessoas: "estatura(cm) peso(kg)" por linha.
   Distribuicoes aproximadamente normais (Box-Muller), semente fixa. */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

static double normal(double mu, double sigma) {
    double u1 = (rand() + 1.0) / (RAND_MAX + 2.0);
    double u2 = (rand() + 1.0) / (RAND_MAX + 2.0);
    return mu + sigma * sqrt(-2.0 * log(u1)) * cos(2.0 * M_PI * u2);
}

int main(int argc, char **argv) {
    const char *arq = argc > 1 ? argv[1] : "dados/dados.txt";
    int n = argc > 2 ? atoi(argv[2]) : 1000;
    FILE *f = fopen(arq, "w");
    if (!f) { perror(arq); return 1; }
    srand(2025);
    for (int i = 0; i < n; i++) {
        double est = normal(170.0, 10.0);
        if (est < 140) est = 140;
        if (est > 205) est = 205;
        /* peso correlacionado com a estatura */
        double peso = 70.0 + 0.6 * (est - 170.0) + normal(0.0, 10.0);
        if (peso < 40) peso = 40;
        if (peso > 130) peso = 130;
        fprintf(f, "%.1f %.1f\n", est, peso);
    }
    fclose(f);
    printf("Gerado %s com %d pessoas\n", arq, n);
    return 0;
}
