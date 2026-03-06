# Capacity WFM — Especificación Funcional Completa

> **Versión:** 1.0 — MVP  
> **Estado:** Especificación Completa  
> **Pools:** Residencial (98 agentes) · Móvil (26 agentes)  
> **Meta Diaria:** 3,195 llamadas / día  
> **Stack:** Node.js + Express · React + Vite + TypeScript · SQLite + Sequelize · Tailwind CSS

---

## 1. Información General

Capacity WFM es una herramienta local de control operativo de workforce management. Su propósito es permitir a los planificadores distribuir agentes por día y turno, validar el cumplimiento de la meta contractual de llamadas diarias, y registrar la asistencia real vs. lo planeado. Toda la lógica de validación opera bajo el principio de **Suma Cero**: la dotación asignada debe cuadrar exactamente con los agentes disponibles (contratados menos descansos y vacaciones).

### 1.1 Contexto Operativo

| Parámetro | Valor / Descripción |
|---|---|
| **Pools** | Residencial: 98 agentes contratados · Móvil: 26 agentes contratados |
| **Meta contractual** | 3,195 llamadas **DIARIAS** (suma de todos los pools activos) |
| **Duración de turno** | 9 horas brutas. 1 hora de comida (no productiva). Horas productivas efectivas: **8h** |
| **Turnos disponibles** | Turno A: 09:00–18:00 · Turno B: 10:00–19:00 · Turno C: 12:00–21:00 · **Aplican para ambos pools (Residencial y Móvil)** |
| **AHT objetivo** | 11.0 minutos (ideal) · **11.5 minutos** (promedio operativo, usado para cálculos) |
| **Shrinkage default** | 20% (configurable) |
| **Ocupación default** | 90% (configurable) |
| **Descansos** | 1 día de descanso semanal por agente (obligatorio). Máximo configurable por día. |
| **Vacaciones** | Categoría **separada** al descanso. Máximo configurable de agentes en vacaciones por día. |

---

## 2. Fórmula de Capacidad — Definición Técnica

Esta es la regla de negocio central del sistema. Toda la lógica de validación, semáforos y suma cero se deriva de esta fórmula.

### 2.1 Capacidad Real por Agente por Día

```
Llamadas_por_agente = (Horas_productivas × 60 minutos × Ocupación) / AHT

Con parámetros default:
  Llamadas_por_agente = (8 × 60 × 0.90) / 11.5 = 37.57 llamadas/agente/día
```

> **Nota:** Se usa AHT = 11.5 como valor de cálculo base. El AHT ideal (11.0) se muestra como referencia para comparativas de simulación en el sidebar de parámetros.

### 2.2 Capacidad Real del Pool por Día

```
Agentes_disponibles   = Agentes_asignados_al_día × (1 - Shrinkage)
Capacidad_diaria_pool = Agentes_disponibles × Llamadas_por_agente

Ejemplo — Pool Residencial (50 agentes asignados al lunes):
  Agentes_disponibles = 50 × (1 - 0.20) = 40 agentes efectivos
  Capacidad_diaria    = 40 × 37.57      = 1,502.8 ≈ 1,503 llamadas

Capacidad total del día = Suma de capacidad de TODOS los pools en ese día
```

### 2.3 Umbrales del Semáforo

El semáforo opera sobre: `(Capacidad_real_día / Meta_diaria) × 100`

| Color | Rango | Interpretación |
|---|---|---|
| 🟢 **VERDE** | ≥ 95% de la meta | Dotación suficiente. Plan viable. |
| 🟡 **AMARILLO** | 80% – 94% de la meta | Riesgo moderado. Revisar distribución. |
| 🔴 **ROJO** | < 80% de la meta | Desbalance crítico. Reasignación obligatoria. |

---

## 3. Lógica de Suma Cero — Regla de Negocio

La suma cero garantiza que ningún agente quede "perdido" en la planificación. La distribución semanal debe ser contablemente exacta.

### 3.1 Definición de la Regla

```
Para cada pool en una semana dada:

  Σ(agentes_lun + mar + mié + jue + vie + sáb + dom)
    + agentes_en_descanso_semana
    + agentes_en_vacaciones_semana
  = Total_agentes_contratados_del_pool × 7

Si NO es igual → Estado: DESBALANCE  🔴
Si ES igual    → Estado: BALANCEADO  🟢
```

### 3.2 Restricciones de Negocio

- Cada agente debe tener exactamente **1 día de descanso por semana**. El sistema advertirá si la suma no cuadra.
- El sistema **no bloquea** la edición de un plan publicado, pero registra cada cambio en el log de auditoría.
- `max_descansos_dia`: máximo de agentes en descanso en el mismo día. Si se supera → advertencia amarilla, no bloqueo.
- `max_vacaciones_dia`: máximo de agentes en vacaciones en el mismo día. Si se supera → advertencia amarilla, no bloqueo.
- Vacaciones y descanso semanal son **mutuamente excluyentes**: un agente no puede estar en ambas categorías el mismo día.

---

## 4. Modelo de Datos Completo

### 4.1 Entidad: Pool

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único del pool |
| `name` | string | `'Residencial'` o `'Móvil'` |
| `total_agents` | integer | Total de agentes contratados en el pool |
| `capacity_goal` | integer | Meta de llamadas diarias del pool. Default: 3195 (suma total) |
| `allowed_shifts` | array | Turnos habilitados para el pool. Residencial: `['A','B','C']` · Móvil: `['A','B','C']` |
| `is_active` | boolean | Permite desactivar un pool sin eliminarlo |

### 4.2 Entidad: Config

| Campo | Tipo | Default | Descripción |
|---|---|---|---|
| `shrinkage` | float | `0.20` | % de agentes no productivos (ausentismo, capacitación, etc.) |
| `occupancy` | float | `0.90` | % de tiempo productivo en llamadas sobre tiempo disponible |
| `aht_minutes` | float | `11.5` | Average Handle Time en minutos. Usado para cálculo de capacidad. |
| `shift_hours` | float | `8.0` | Horas productivas por turno (9h turno - 1h comida) |
| `rest_days_per_week` | integer | `1` | Días de descanso obligatorios por agente por semana |
| `max_descansos_dia` | integer | `null` | Máximo de agentes en descanso en un mismo día. Null = sin límite. |
| `max_vacaciones_dia` | integer | `null` | Máximo de agentes en vacaciones en un mismo día. Null = sin límite. |
| `daily_goal` | integer | `3195` | Meta diaria global de llamadas (suma de todos los pools) |

### 4.3 Entidad: WeeklyPlan

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único del plan semanal |
| `pool_id` | UUID FK | Referencia al pool al que pertenece este plan |
| `year` | integer | Año del plan (ej. 2025) |
| `week_number` | integer | Número de semana ISO (1–53). Permite planear meses enteros. |
| `status` | enum | `'Draft'` \| `'Published'`. Los planes publicados se pueden editar pero cada cambio queda auditado. |
| `distribution` | JSON | Almacena el desglose por día (headcount, descansos, vacaciones, turnos) |
| `created_at` | datetime | Fecha y hora de creación del plan |
| `updated_at` | datetime | Última actualización |

---

## 7. Decission Log (Implementado)
- **D01-D06:** Definiciones de stack técnico (React, Node, SQLite, Tailwind v4).
- **D07-D10:** Incorporación de reglas de negocio oficiales (Spec 1.0).
- **D11:** Migración a sistema de **Triple Control** (Asignados + Descansos + Vacaciones).
