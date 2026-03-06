# Capacity WFM - MVP Implementation

Este es el esqueleto de implementación local para la herramienta de gestión de capacidad.

## Estructura del Proyecto
```text
/workforce
  /server           # Backend Node.js + Express
    /src
      /models       # Modelos Sequelize (Pool, Config, WeeklyPlan, AuditLog)
      /routes       # API Endpoints (Pools, Config, Plans, Audit)
      /services     # Lógica de Negocio (Zero Sum Logic)
      /database.js  # Configuración SQLite
    /tests          # Pruebas Unitarias (Jest)
  /client           # Frontend React (Pendiente)
  /docs             # Documentación de Especificaciones
  /shared           # Tipos compartidos
```

## Requisitos
- Node.js v20+
- npm

## Ejecución Local (Server)
1. Navega a la carpeta `server`:
   ```bash
   cd server
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia el servidor en modo desarrollo:
   ```bash
   npm run dev
   ```
   El servidor estará disponible en `http://localhost:5000`.

## Endpoints Principales
- `GET /api/pools`: Lista los pools iniciales (Residencial/Móvil).
- `GET /api/config`: Obtiene la configuración de Shrinkage y Ocupación.
- `POST /api/simulate`: Simula el balance de suma cero enviando una distribución.
- `POST /api/plans`: Guarda un plan de capacidad y genera un log de auditoría.
- `GET /api/audit`: Consulta el historial de cambios realizados.

## Regla de Suma Cero
La lógica reside en `server/src/services/WfmService.js`. 
Calcula la capacidad basada en un descanso semanal (1 día), lo que significa que cada agente contratado debe cubrir 6 jornadas a la semana. Cualquier desviación se marca como un desbalance.
