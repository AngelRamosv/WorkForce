## [1.1.0] - 2026-02-19

### Changed
- Migración del motor de base de datos de SQLite a MySQL.
- Actualización de `database.js` para usar dialecto MySQL y pool de conexiones.
- Configuración de variables de entorno en `.env` para credenciales de MySQL.

## [1.0.0] - 2026-02-19

### Added
- Implementación de la Spec 1.0 oficial.
- Nueva fórmula de capacidad basada en AHT (11.5 min), Ocupación (90%) y Shrinkage (20%).
- Módulo de **Vacaciones** integrado en la lógica de Suma Cero.
- Selector de **Turnos (A, B, C)** en el Simulador.
- Recálculo de capacidad en tiempo real con semáforo de cumplimiento.
- Rediseño de la página de **Setup** para gestión de parámetros avanzados.

### Fixed
- Base de datos relineada con el modelo definitivo V1.

## [0.4.0] - 2026-02-19

### Added
- Funcionalidad de exportación a CSV en el Registro de Auditoría.
- Validación completa del flujo de "Suma Cero" en el Simulador.
- Botón de descarga dinámica en la UI de Auditoría.

## [0.3.1] - 2026-02-19

### Fixed
- Error de PostCSS con Tailwind v4 mediante la instalación y configuración de `@tailwindcss/postcss`.

## [0.3.0] - 2026-02-18

### Added
- Frontend MVP con React + TypeScript + Vite.
- Sistema de Routing (Setup, Plan, Simulator, Audit).
- Integración con Tailwind CSS para diseño moderno.
- Consumo de API centralizado vía Axios.
- Página Simulador con lógica interactiva de Suma Cero.
- Página Auditoría con historial de cambios.

## [0.2.0] - 2026-02-18

### Added
- Esqueleto de implementación Backend (Node.js/Express).
- Modelos de base de datos (Pool, Config, WeeklyPlan, AuditLog).
- Servicio `WfmService` con lógica de "Suma Cero".
- Endpoints de API para gestión de capacidad y auditoría.
- Persistencia local con SQLite.
- README con instrucciones de ejecución local.

## [0.1.0] - 2026-02-18

