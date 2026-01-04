# Guía de Ejecución - Actividad 2

## Requisitos
- Node.js >= 18
- npm

## Instalación
```bash
npm install
```

## Experimentos Completos

### 1. Correr todos los algoritmos en todas las instancias
```bash
make exp
```
Esto ejecuta:
- `exact_bb` en n10, n15, n20, n25 (1 réplica, 8s límite)
- `geo_heuristic` en todas (5 réplicas)
- `metaheuristic` en todas (5 réplicas)

Resultados guardados en `data/results/*.json`

### 2. Generar gráficas y métricas
```bash
npm run analyze

```
Genera en `report/figs/`:
- `time_vs_n.svg`: tiempo promedio vs N (log scale)
- `hypervolume.svg`: hipervolumen por algoritmo
- `diversity.svg`: diversidad de frontera vs N

### 3. Visualizar el mapa de nodos
```bash
node scripts/plot.js --inst data/instances/n15.json --out plot_n15.svg
```
Y abrir el gráfico generado

## Ejecución Individual

### Algoritmo específico
```bash
# Geo-heurística en n10, 3 réplicas
node run.js --inst data/instances/n10.json --algo geo_heuristic --reps 3

# Metaheurística con 150 generaciones
node run.js --inst data/instances/n20.json --algo metaheuristic --reps 5 --generations 150

# Exacto con timeout de 15s
node run.js --inst data/instances/n15.json --algo exact_bb --time-limit 15000
```

### Guardar resultados
```bash
node run.js --inst data/instances/n10.json --algo metaheuristic --reps 3 --out resultado.json
```

## Estructura de Resultados

Cada archivo JSON en `data/results/` contiene:
```json
{
  "algo": "metaheuristic",
  "instance": "n15.json",
  "reps": 5,
  "time_avg_ms": 1234.5,
  "time_all_ms": [1200, 1300, ...],
  "frontier": [
    {
      "dist": 69.5,
      "risk": 10.9,
      "recharges": 1,
      "path": [0, 13, 11, ...]
    }
  ]
}
```


## Parámetros Disponibles

### `run.js`
- `--inst <path>`: archivo de instancia (requerido)
- `--algo <name>`: exact_bb | geo_heuristic | metaheuristic (default: geo_heuristic)
- `--reps <n>`: número de réplicas (default: 1)
- `--start <id>`: índice del hub (default: 0)
- `--time-limit <ms>`: límite para exact_bb (default: 10000)
- `--generations <n>`: generaciones para metaheuristic (default: 60)
- `--out <path>`: guardar JSON resultado

### Instancias
- `data/instances/n10.json`: 10 nodos, battery=40
- `data/instances/n15.json`: 15 nodos, battery=60
- `data/instances/n20.json`: 20 nodos, battery=70
- `data/instances/n25.json`: 25 nodos, battery=80

Todas con 3 poñigonos no-fly
