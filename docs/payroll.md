# Nómina (México)

Calcula la nómina con sueldo base, horas extra, vacaciones, faltas y ajustes, y retiene ISR, IMSS e INFONAVIT con parámetros fiscales que configura cada empresa. Asistencia y ausencias en [hr.md](hr.md).

**Alcance:** cálculo, recibos y costo patronal. **No** timbra el CFDI de nómina: las líneas guardan la clave SAT para un paso posterior.

## Modelo de datos

Todo lo lee y escribe solo owner/admin, salvo los recibos propios.

| Tabla | Contenido |
|---|---|
| `hr_salary` | Historial de salarios. El trigger calcula diario y mensual (mes de 30 días) y copia el vigente a `employee_private` (`monthly_salary`, `cfdi_contribution_base`, `cfdi_integrated_daily_wage`) |
| `employee_private.infonavit_*` | Crédito INFONAVIT del trabajador: `percentage` (% del SBC), `fixed` (cuota mensual) o `factor` (veces UMA) |
| `payroll_fiscal_config` | Parámetros por empresa y año. Las tablas viajan en JSONB con la forma de `PayrollFiscalParams` |
| `payroll_period` | Periodo con estado y totales |
| `payroll_adjustment` | Percepciones y deducciones manuales del periodo |
| `payroll_slip` / `payroll_slip_line` | Recibo y sus conceptos (`perception`, `deduction`, `employer`) |

Un empleado con usuario ve sus recibos (`v_payroll_slips`) cuando la nómina está `approved` o `paid`. La política usa `payroll_period_status()` y la vista `payroll_period_header()`, ambas `SECURITY DEFINER`, porque el empleado no puede leer `payroll_period` y así no ve los totales de la empresa.

## Flujo

```
draft ──calcular──▶ calculated ──aprobar──▶ approved ──pagar──▶ paid
  │                    │  ▲                     │
  └──── cancelar ◀─────┘  └────── reabrir ──────┘
```

- `payroll_save_calculation(period, slips)` reemplaza los recibos en una transacción y actualiza los totales. Solo con el periodo en `draft` o `calculated`.
- `payroll_set_period_status` aplica las transiciones. El guard `payroll_period_guard` impide cambiar estado o totales con `UPDATE`, y fechas cuando la nómina está cerrada.
- Los ajustes solo se agregan con el periodo abierto.

## Cálculo

El motor es puro y está probado: `app/utils/payroll.ts` (`calculatePayslip`), con pruebas en `tests/utils/payroll.test.ts`. `usePayroll().calculate` reúne los datos y guarda el resultado.

**Entradas por empleado**

- Salario vigente al final del periodo (`hr_salary`). Si no hay, usa `employee_private.monthly_salary / 30`. Sin salario, se omite con aviso.
- SBC del salario o del expediente. Si falta, usa el SDI sugerido (factor de integración).
- Días activos: ingreso o baja a mitad del periodo prorratean.
- Faltas que se descuentan, permisos sin goce, incapacidades y vacaciones aprobadas (días calculados con `hr_count_leave_days` dentro del periodo).
- Horas extra aprobadas por semana; domingos, descansos y festivos laborados (de `hr_attendance_day`).
- Ajustes del periodo.

**Días:** semanal 7, quincenal 15, mensual 30. Se restan faltas, permisos sin goce e incapacidades.

**Percepciones**

| Concepto | Regla | Exento |
|---|---|---|
| Sueldo (001) | Salario diario × días pagados no vacacionales | — |
| Vacaciones (001) | Salario diario × días de vacaciones | — |
| Prima vacacional (021) | % configurable (25% mínimo) | 15 UMA |
| Horas extra dobles (019) | Primeras 9 por semana, ×2 la hora | 50% hasta 5 UMA por semana; 100% con salario mínimo |
| Horas extra triples (019) | Excedente de 9 por semana, ×3 | — |
| Prima dominical (020) | 25% del salario diario por domingo | 1 UMA por domingo |
| Descanso laborado (038) | Doble además del sueldo (art. 73 LFT) | — |
| Festivo laborado (038) | Doble además del sueldo (art. 75 LFT) | — |
| Aguinaldo (002) | Ajuste manual; `computeAguinaldo` lo calcula | 30 UMA |
| Otros ajustes | Según `is_taxable` | — |

El valor de la hora es salario diario ÷ jornada promedio del horario (8 horas si no tiene).

**ISR:** tarifa mensual proporcional a los días pagados (`límite y cuota × días / 30.4`). **Subsidio para el empleo** (decreto 2024): `UMA × tasa% × días` si el ingreso mensual equivalente no supera el límite. Se acredita contra el ISR y no se paga en efectivo.

**IMSS** (topado a `sbc_cap_umas` × UMA):

| Ramo | Base | Días |
|---|---|---|
| EyM cuota fija | UMA | Activos − incapacidades |
| EyM excedente, dinero, pensionados | Excedente de 3 UMA / SBC | Activos − incapacidades |
| Invalidez y vida, cesantía, riesgo, guarderías | SBC | Activos − incapacidades − faltas |
| Retiro, INFONAVIT 5% | SBC | Activos − faltas |

La cesantía patronal es progresiva por veces UMA. Con salario mínimo, el patrón absorbe la cuota obrera (art. 36 LSS).

**ISN:** tasa estatal × total de percepciones.

**Costo empresa** = percepciones + IMSS patronal + INFONAVIT + ISN.

## Parámetros de referencia

`defaultFiscalParams(year)` precarga UMA 117.31, salario mínimo 315.04 / 440.87 (frontera), la tarifa ISR del Anexo 8 vigente 2023–2025, subsidio 13.8% con límite de 10,171, la tabla de cesantía 2026, ISN 3% y prima de riesgo 0.54355%.

> **Hay que verificarlos cada año** contra el DOF y el SAT. En particular, la tarifa ISR y el subsidio de 2026 pueden haberse actualizado. Al crear la configuración de un año se copian la prima de riesgo, el ISN y la zona frontera del año anterior.

## Simplificaciones conocidas

- Los topes exentos anuales (prima vacacional, aguinaldo) se aplican por recibo, no acumulados en el año.
- No hay ajuste anual de ISR ni cálculo de finiquito o liquidación.
- No hay FONACOT automático: va como ajuste.
- Las ausencias reducen días del IMSS sin el límite de 7 por bimestre.
- El cálculo corre en el navegador del administrador. La base valida permisos, empresa y estado, pero confía en los importes que recibe.

## Código

| Pieza | Archivo |
|---|---|
| Motor y catálogos | `app/utils/payroll.ts` |
| Composables | `useSalary`, `usePayroll` (+ `configToParams`, `paramsToConfig`) |
| Componentes | `Salary/Form` |
| Páginas | `/admin/salaries`, `/admin/payroll` (+ `create`, `[id]`, `slips/[id]`, `my-payslips`, `settings`) |
