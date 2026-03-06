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
| `created_at` | datetime | Fecha y hora de creación del plan |
| `updated_at` | datetime | Última actualización |

### 4.4 Entidad: DayDistribution

Un registro por cada día de la semana dentro de un `WeeklyPlan`. Relación: **1 WeeklyPlan → 7 DayDistribution**.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `plan_id` | UUID FK | Referencia al WeeklyPlan |
| `day_of_week` | integer | `0`=Lunes, `1`=Martes, ..., `6`=Domingo |
| `shift` | enum | `'A'` (09–18) \| `'B'` (10–19) \| `'C'` (12–21) \| `'MIXED'` si hay combinación de turnos |
| `headcount_planned` | integer | Agentes planificados para trabajar ese día |
| `headcount_actual` | integer | Agentes que efectivamente asistieron. `null` hasta que se registre. Solo editable en semanas pasadas. |
| `descansos` | integer | Agentes con descanso ese día |
| `vacaciones` | integer | Agentes en vacaciones ese día |
| `capacity_calls` | float | **Calculado:** llamadas posibles según `headcount_planned` y parámetros config |
| `compliance_pct` | float | **Calculado:** `(capacity_calls / daily_goal) × 100` |
| `semaphore_status` | enum | `'GREEN'` \| `'YELLOW'` \| `'RED'`. Derivado de `compliance_pct`. |

### 4.5 Entidad: AuditLog

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único del registro de auditoría |
| `plan_id` | UUID FK | Plan que fue modificado |
| `changed_by` | string | Nombre libre ingresado por el usuario al momento del cambio |
| `changed_at` | datetime | Timestamp automático del cambio |
| `field_changed` | string | Campo específico que cambió (ej: `'headcount_planned.lunes'`) |
| `old_value` | string | Valor anterior al cambio |
| `new_value` | string | Valor nuevo después del cambio |

---

## 5. Requerimientos Funcionales

### RF1 — Gestión de Capacidad Base

- El sistema debe mostrar el Pool Residencial (98 agentes) y Pool Móvil (26 agentes) como entidades **separadas** con sus métricas individuales.
- Los parámetros de Shrinkage, Ocupación, AHT y meta diaria deben ser editables en tiempo real desde el **Sidebar de Parámetros**.
- Cualquier cambio en los parámetros debe recalcular instantáneamente todos los indicadores de semáforo y capacidad del plan activo.
- El sistema debe mostrar tanto el AHT ideal (11.0 min) como el AHT de cálculo (11.5 min) para referencia del planificador.

### RF2 — Distribución Semanal y Suma Cero

- El planificador puede ingresar el headcount por día para cada pool y turno (A, B o C).
- El indicador de Suma Cero debe actualizarse **en tiempo real** (sin guardar) al modificar cualquier celda del grid.
- El **Delta** de suma cero (diferencia entre asignados + descansos + vacaciones vs. contratados×7) debe mostrarse numéricamente junto al indicador de color.
- El sistema permitirá asignar agentes a múltiples turnos en el mismo día (`shift = 'MIXED'`) con desglose opcional.
- Si `max_descansos_dia` o `max_vacaciones_dia` se superan → advertencia amarilla, sin bloqueo.
- Si `rest_days_per_week` no se cumple (agente sin descanso en la semana) → advertencia al publicar.

### RF3 — Registro de Asistencia Real

- Las semanas pasadas (`Published`) son de **solo lectura** para los campos planeados.
- Se habilita el campo `headcount_actual` en semanas pasadas para registrar la asistencia real sin modificar el plan original.
- El sistema debe mostrar comparativa **Planeado vs. Real** en semanas pasadas con indicador de desviación.

### RF4 — Auditoría

- Cada cambio en `headcount_planned`, `descansos`, `vacaciones` o `shift` genera un registro en `AuditLog`.
- Al editar, el sistema solicita el nombre del responsable mediante un campo de texto (**nombre libre**, no login).
- El Log de Cambios muestra las últimas 20 modificaciones con: nombre, timestamp, campo y valores anterior/nuevo.

### RF5 — Horizonte de Planeación

- El sistema permite crear y editar planes para cualquier semana **futura**, incluyendo meses enteros por adelantado.
- Vista de semana actual y semanas futuras: **modo edición completa**.
- Vista de semanas pasadas: **modo lectura** para campos planeados + edición para `headcount_actual`.
- El sistema debe poder mostrar una vista mensual con resumen de cumplimiento por semana.

---

## 6. UI y Componentes

### 6.1 Dashboard Principal

- Tarjetas de resumen por pool: agentes contratados, capacidad real del día actual, % cumplimiento, semáforo.
- Indicador global consolidado: suma de ambos pools vs. meta de 3,195 llamadas.
- Acceso rápido a la semana actual y navegación a semanas anteriores/futuras.

### 6.2 Grid de Planeación Semanal

- Tabla con filas = pools y columnas = días de la semana (Lunes a Domingo).
- Cada celda contiene: headcount (editable), turno (selector A/B/C), capacidad calculada, descansos y vacaciones.
- Celda de totales al final de cada fila (suma semanal) y al final de cada columna (capacidad total del día).
- Indicador de semáforo por columna (día) y por fila (pool).
- Indicador de **Suma Cero** en el header: muestra `BALANCEADO / DESBALANCE` + delta numérico.

### 6.3 Sidebar de Parámetros

- Panel lateral colapsable con controles para: Shrinkage, Ocupación, AHT.
- **Modo simulación:** los cambios en el sidebar no se guardan en DB, solo recalculan la vista actual.
- Botón **"Aplicar como default"** para persistir los parámetros del sidebar en Config.

### 6.4 Log de Cambios

- Lista scrollable con las últimas 20 entradas del AuditLog para el plan activo.
- Cada entrada muestra: nombre del responsable, timestamp relativo, campo y resumen del cambio.

### 6.5 Vista de Semanas Pasadas

- Celdas de `headcount_planned` en gris (solo lectura).
- Nueva columna `Real` editable para ingresar `headcount_actual`.
- Columna de desviación: `Planeado - Real` con color verde (sin falta) o rojo (hubo faltas).

---

## 7. Requerimientos No Funcionales

| ID | Categoría | Descripción |
|---|---|---|
| RNF1 | Localidad | Corre en `localhost`. Sin dependencias de servicios cloud. Zero-config. |
| RNF2 | Performance UI | El recálculo de suma cero y semáforos debe ocurrir en < 200ms al modificar una celda. |
| RNF3 | Persistencia | SQLite como base de datos local. Sequelize ORM para modelos y seeding estructurado. |
| RNF4 | Simplicidad UI | Interfaz limpia (Tailwind CSS). Semáforos de color como principal mecanismo de alerta. |
| RNF5 | Validación | Lógica de suma cero en Frontend (React) para feedback instantáneo. Validación de persistencia en Backend (WfmService). |
| RNF6 | Escalabilidad | El modelo de datos soporta planificación de meses completos con N semanas sin degradación. |

---

## 8. Arquitectura y Stack Técnico

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend | React + Vite + TypeScript | Tipado fuerte para lógica de capacidad. Hot reload para iteración rápida en MVP. |
| Estilos | Tailwind CSS | Interfaz premium y responsiva. Semáforos con clases de color nativas. |
| Backend | Node.js + Express | Ligero para localhost. `WfmService` desacopla reglas de negocio de controladores. |
| Base de Datos | SQLite + Sequelize | Zero-config. Portabilidad local. Seeding estructurado para datos iniciales. |
| Validación FE | Lógica en React | Feedback instantáneo de suma cero sin roundtrip al servidor. |

### 8.1 Estructura de Carpetas

```
/workforce
  /client                  ← Frontend React + Vite
    /src
      /components          ← Grid, Semáforo, Sidebar, AuditLog
      /hooks               ← useZeroSum, useCapacity, usePlan
      /services            ← API calls al backend
      /types               ← Tipos TypeScript compartidos
  /server                  ← Backend Node.js + Express
    /controllers           ← Endpoints REST
    /services              ← WfmService (lógica de negocio)
    /models                ← Sequelize models
    /seeders               ← Datos iniciales (pools, config)
  /shared                  ← Tipos y constantes comunes (FE + BE)
  /docs                    ← Especificaciones y decision log
```

### 8.2 Endpoints REST (WfmService)

```
GET    /api/pools                          ← Lista todos los pools activos
GET    /api/config                         ← Obtiene configuración global
PUT    /api/config                         ← Actualiza configuración global

GET    /api/plans?pool_id=&year=&week=     ← Obtiene plan semanal
POST   /api/plans                          ← Crea nuevo plan
PUT    /api/plans/:id                      ← Actualiza plan (registra en AuditLog)

GET    /api/plans/:id/days                 ← Obtiene distribución diaria del plan
PUT    /api/plans/:id/days/:day            ← Actualiza un día específico
PUT    /api/plans/:id/days/:day/actual     ← Registra headcount_actual (semanas pasadas)

GET    /api/plans/:id/audit                ← Obtiene log de auditoría del plan
GET    /api/plans/:id/zerosum             ← Calcula y retorna estado de suma cero
```

---

## 9. Criterios de Aceptación del MVP

| # | Criterio | Comportamiento Esperado |
|---|---|---|
| 1 | Visualización de Pools | Pool Residencial (98 ag.) y Móvil (26 ag.) visibles por separado con sus métricas. |
| 2 | Suma Cero en Tiempo Real | Al modificar agentes en cualquier día, el indicador de suma cero se actualiza sin guardar, en < 200ms. |
| 3 | Cálculo de Capacidad | El sistema calcula llamadas posibles: `(headcount × 0.80 × 8h × 60 × 0.90) / 11.5` por día. |
| 4 | Semáforo de Cumplimiento | Verde ≥95%, Amarillo 80–94%, Rojo <80% de los 3,195 llamadas meta. |
| 5 | Registro Real | En semanas pasadas se puede registrar `headcount_actual` sin modificar el plan original. |
| 6 | Auditoría | Cada cambio registra nombre libre, timestamp, campo y valores anterior/nuevo. |
| 7 | Planeación Multi-semana | Se puede crear y navegar planes para semanas futuras (mínimo 8 semanas adelante). |

---

## 10. Decision Log

| ID | Decisión | Detalle |
|---|---|---|
| D01 | SQLite para MVP | Portabilidad local, zero-config. Migración a PostgreSQL es path natural en Fase 2. |
| D02 | Validación en Frontend | Suma cero se valida en React para feedback instantáneo. Backend valida antes de persistir. |
| D03 | WfmService en Node.js | Capa de servicio desacoplada de controladores para testabilidad y mantenimiento. |
| D04 | Sequelize ORM | Gestión de modelos y seeding estructurado. Facilita onboarding de datos iniciales. |
| D05 | React + TypeScript | Tipado fuerte esencial para evitar errores en cálculos de capacidad y manejo de entidades. |
| D06 | Tailwind CSS | Interfaz premium con sistema de colores para semáforos sin overhead de diseño. |
| D07 | AHT de cálculo = 11.5 min | Se usa el promedio operativo real (11.5) para cálculos. El ideal (11.0) es referencia visual. |
| D08 | Meta = 3,195 llamadas/día | Confirmado: la meta es **diaria**, suma de todos los pools activos. |
| D09 | Distribución por Headcount | MVP opera por conteo de agentes, no por nombre individual. |
| D10 | Auditoría sin login | Nombre libre al hacer cambios. Suficiente para MVP local de equipo pequeño. |
| D11 | Semanas pasadas read-only | Plan original no se modifica. `headcount_actual` es el único campo editable retroactivamente. |
| D13 | Turnos iguales en ambos pools | Residencial y Móvil habilitados con los 3 turnos (A, B, C). Configuración almacenada en `allowed_shifts` por pool para flexibilidad futura. |

---

## 11. Preguntas Cerradas ✅

Todas las preguntas del spec han sido respondidas. No hay ambigüedades pendientes.

| ID | Pregunta | Resolución |
|---|---|---|
| Q01 | ¿Valor de `max_descansos_dia`? | **Parámetro configurable desde la UI.** Default `null` (sin límite) en seeding inicial. |
| Q02 | ¿Valor de `max_vacaciones_dia`? | **Parámetro configurable desde la UI.** Default `null` (sin límite) en seeding inicial. |
| Q03 | ¿Turnos distintos por pool? | **Ambos pools usan los 3 turnos (A, B, C).** Campo `allowed_shifts` en entidad Pool para configuración futura. |

---

## 12. Out of Scope (MVP)

- Gestión de nómina o pagos.
- Chat interno entre agentes.
- Forecasting automático basado en IA.
- Integración con PBX/ACD (postergado a Fase 2).
- Distribución nominal por nombre de agente (postergado a iteración futura).
- Login y roles de usuario (MVP usa nombre libre en auditoría).
- Dashboard Live e integración con volumen real (Fase 2).
- Alertas de desviación en tiempo real intradía (Fase 2).

---

## 13. Fases Futuras

### Fase 2: Dashboard Live & Real-Time
- Integración con fuentes de datos externas (Volumen Real).
- Comparativa Intradía (Planeado vs. Real).
- Registro de Incidencias Operativas (Internas/Externas).
- Alertas de desviación automáticas.
- Integración con PBX/ACD.

### Iteraciones Futuras
- Distribución nominal por nombre de agente.
- Roles y login de usuarios.
- Migración a PostgreSQL para equipos más grandes.
- Forecasting basado en histórico.
