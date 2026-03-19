class WfmService {
    /**
     * Calcula el balance de suma cero según la Spec 1.0
     * Regla: Σ(asignados + descansos + vacaciones) = Total_Agentes * 7
     */
    static calculateZeroSumBalance(totalAgents, distribution) {
        let totalAllocated = 0;

        // Iterar por los 7 días
        for (const [day, data] of Object.entries(distribution)) {
            // REGLA: Lunes y Martes NO HAY DESCANSOS ni VACACIONES (Spec 1.2)
            if ((day === 'Monday' || day === 'Tuesday') && (data.rest > 0 || data.vacation > 0)) {
                return {
                    isBalanced: false,
                    totalAllocated,
                    weeklyTotalCapacity,
                    delta: 0,
                    message: `ERROR: No está permitido asignar DESCANSOS ni VACACIONES los días Lunes o Martes.`
                };
            }
            totalAllocated += (data.planned || 0) + (data.rest || 0) + (data.vacation || 0);
        }

        const weeklyTotalCapacity = totalAgents * 7;
        const delta = weeklyTotalCapacity - totalAllocated;

        return {
            isBalanced: delta === 0,
            totalAllocated,
            weeklyTotalCapacity,
            delta,
            message: delta === 0 ? "Perfectamente balanceado" : (delta > 0 ? `Faltan ${delta} jornadas por asignar` : `Sobrecarga de ${Math.abs(delta)} jornadas`)
        };
    }

    /**
     * Calcula capacidad de llamadas según Spec 1.0
     * Formula: (Agentes_efectivos * Horas * 60 * Ocupación) / AHT
     */
    static calculateCallCapacity(headcount, config) {
        const { shrinkage, occupancy, ahtMinutes, shiftHours } = config;
        const effectiveStaff = headcount * (1 - shrinkage);
        const capacity = (effectiveStaff * shiftHours * 60 * occupancy) / ahtMinutes;
        return Math.round(capacity);
    }

    static getSemaphoreStatus(capacity, goal) {
        const pct = (capacity / goal) * 100;
        if (pct >= 95) return 'GREEN';
        if (pct >= 80) return 'YELLOW';
        return 'RED';
    }
}

module.exports = WfmService;
