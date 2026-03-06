# Manual de Operación: Capacity WFM (Spec 1.0)
## Guía de Usuario para la Gestión de Retención y Móvil

Este documento detalla los procedimientos operativos para el uso de la plataforma **Capacity WFM**, diseñada para optimizar la planificación de staff y el monitoreo en tiempo real de la operación.

---

### 1. Central de Monitoreo (Live Operations Center) 🔴
Es la herramienta de supervisión táctica. Permite ver la "salud" de la operación en el momento exacto.

*   **KPIs de Impacto:** Muestra llamadas ingresadas, tasa de abandono y AHT medio.
*   **Buscador y Filtros:** Permite localizar agentes por nombre o filtrar a todo el equipo de un **Supervisor** específico.
*   **Tiempo en Estado:** Columna crítica que indica cuántos minutos lleva un agente en su estatus actual (Comida, Break, Disponible).
*   **Alertas de Abandono:** Si el recuadro rojo aparece, indica que la operación está en riesgo y se requiere mover agentes de auxiliares a la línea de inmediato.

---

### 2. Simulador de Suma Cero (Planeación Semanal) ⚖️
Garantiza que el presupuesto de horas disponible sea utilizado al 100% sin dejar huecos operativos.

*   **Paso 1: Definir el Staff:** Use el botón **"Usar Staff Real (Live)"** para cargar la cantidad de agentes conectados actualmente, o use la base del **Setup**.
*   **Paso 2: Auto-Plan IA:** El botón amarillo distribuye automáticamente las jornadas de lunes a domingo. El plan es válido solo cuando el **Balance es 0 (Verde)**.
*   **Paso 3: Capacidad Proyectada:** El sistema le dirá cuántas llamadas puede soportar cada día basado en la gente asignada.
*   **Paso 4: Guardar:** Al guardar, el plan se congela, se le asigna un número de semana y se envía al histórico.

---

### 3. Planes de Capacidad (Histórico) 📂
Repositorio oficial de planes entregados al cliente.

*   **Selección de Pool:** Cambie entre **Retención** y **Móvil** para ver sus respectivos planes históricos.
*   **Estado de Plan:** Los planes guardados aparecen con la etiqueta **"DRAFT"** o **"FINAL"**, permitiendo revisar la distribución de agentes día por día de semanas anteriores.

---

### 4. Configuración (Setup) ⚙️
El cerebro matemático del sistema. Solo debe modificarse si cambian las metas de negocio.

*   **Staff Real:** Define el número de agentes contratados (Headcount).
*   **Parámetros:** Aquí se ajusta el **Shrinkage (20%)**, **AHT (11.5m)** y **Ocupación (90%)**. 
*   *Nota: Cambiar estos valores afectará todos los cálculos de capacidad en el Simulador.*

---

### 5. Auditoría 📑
Trazabilidad total. Registra cada vez que un plan es creado o una configuración es modificada. 
*   Registra fecha, hora y el cambio específico realizado, ideal para procesos de control de calidad y revisiones con gerencia.

---
**Capacity WFM - Internal Proprietary Tool**
*Soporte Técnico: Angel @ Workforce*

