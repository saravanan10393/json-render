# Benchmark report — fragments vs baseline

Generated from 13 runs (1 failed/excluded).

| Prompt | Mode | Runs | Median app s | Mean page s | Mean tokens | Total retries |
|---|---|---|---|---|---|---|
| crm | baseline | 2 | 134.2 | 39.6 | 182015 | 3 |
| crm | fragments | 2 | 60.0 | 15.7 | 179487 | 0 |
| inventory | baseline | 2 | 133.5 | 47.3 | 220610 | 7 |
| inventory | fragments | 2 | 91.0 | 37.7 | 238897 | 5 |
| task | baseline | 2 | 105.8 | 45.2 | 149974 | 3 |
| task | fragments | 2 | 54.0 | 19.5 | 152704 | 1 |

**Overall speedup (median baseline / median fragments):** time ×2.01, tokens ×0.98

## Failed runs

- baseline/inventory/r2: run produced no clean page saves — build failed
