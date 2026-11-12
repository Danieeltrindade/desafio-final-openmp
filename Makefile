# Exercicio Final - Analise de Dados com OpenMP
CC      = gcc
CFLAGS  = -O2 -Wall -Wextra
LDLIBS  = -lm
DADOS   = dados/dados.txt

.PHONY: all run run-seq test benchmark graficos dados clean help

all: cv_openmp cv_sequencial gerar_dados          ## compila tudo

cv_openmp: src/cv_openmp.c                        ## versao OpenMP
	$(CC) $(CFLAGS) -fopenmp $< -o $@ $(LDLIBS)

cv_sequencial: src/cv_openmp.c                    ## mesmo codigo, sem OpenMP
	$(CC) $(CFLAGS) -Wno-unknown-pragmas $< -o $@ $(LDLIBS)

gerar_dados: src/gerar_dados.c
	$(CC) $(CFLAGS) $< -o $@ $(LDLIBS)

dados: gerar_dados                                ## recria dados/dados.txt (semente fixa)
	./gerar_dados $(DADOS) 1000

run: cv_openmp                                    ## resultados + tempo (1000 pessoas)
	./cv_openmp $(DADOS)

run-seq: cv_sequencial                            ## resultados da versao sequencial pura
	./cv_sequencial $(DADOS)

test: cv_openmp cv_sequencial                     ## testes automatizados
	python3 tests/testes.py

benchmark: cv_openmp                              ## benchmark completo -> resultados/benchmark.csv
	./cv_openmp $(DADOS) --benchmark resultados/benchmark.csv

graficos:                                         ## graficos a partir do benchmark
	python3 scripts/graficos.py

clean:
	rm -f cv_openmp cv_sequencial gerar_dados *.exe

help:
	@grep -E '^[a-z-]+:.*## ' Makefile | sed 's/:.*## /\t/'
