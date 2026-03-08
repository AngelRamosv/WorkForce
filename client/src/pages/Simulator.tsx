import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { LayoutDashboard, Save, AlertCircle, CheckCircle2, RotateCcw, Activity, Palmtree } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface DayData {
    matutino: number;
    vespertino: number;
    nocturno: number;
    planned: number;
    rest: number;
    vacation: number;
}

const Simulator: React.FC = () => {
    const [pools, setPools] = useState<any[]>([]);
    const [selectedPoolId, setSelectedPoolId] = useState('');
    const [vacations, setVacations] = useState<any[]>([]);
    const [distribution, setDistribution] = useState<Record<string, DayData>>(
        DAYS.reduce((acc, day) => ({ ...acc, [day]: { matutino: 0, vespertino: 0, nocturno: 0, planned: 0, rest: 0, vacation: 0 } }), {})
    );
    const [balance, setBalance] = useState<any>(null);
    const [config, setConfig] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [poolsRes, configRes, vacRes] = await Promise.all([
                api.get('/pools'),
                api.get('/config'),
                api.get('/vacations')
            ]);
            setPools(poolsRes.data);
            setConfig(configRes.data);
            setVacations(vacRes.data);
            if (poolsRes.data.length > 0) setSelectedPoolId(poolsRes.data[0].id);
        } catch (error) {
            console.error('Error fetching data', error);
        }
    };

    useEffect(() => {
        if (selectedPoolId) {
            simulate();
        }
    }, [distribution, selectedPoolId]);

    const simulate = async () => {
        const pool = pools.find(p => p.id === selectedPoolId);
        if (!pool) return;

        try {
            const res = await api.post('/simulate', {
                totalAgents: pool.totalAgents,
                distribution
            });
            setBalance(res.data);
        } catch (error) {
            console.error('Error simulating', error);
        }
    };

    const handleInputChange = (day: string, field: keyof DayData, value: number) => {
        setDistribution(prev => {
            const currentDay = { ...prev[day], [field]: value };

            if (field === 'matutino' || field === 'vespertino' || field === 'nocturno') {
                currentDay.planned = currentDay.matutino + currentDay.vespertino + currentDay.nocturno;
            }

            return {
                ...prev,
                [day]: currentDay
            };
        });
    };

    const handlePoolChange = (id: string, field: string, value: any) => {
        setPools(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const calculateCapacity = (planned: number) => {
        if (!config) return 0;
        const { shrinkage, occupancy, ahtMinutes, shiftHours } = config;
        const effective = planned * (1 - shrinkage);
        return Math.round((effective * shiftHours * 60 * occupancy) / ahtMinutes);
    };

    const handleSave = async () => {
        if (!balance?.isBalanced) {
            alert('El plan debe estar balanceado (Suma Cero) antes de guardar.');
            return;
        }

        setIsLoading(true);
        try {
            await api.post('/plans', {
                poolId: selectedPoolId,
                weekNumber: 1,
                year: 2026,
                distribution
            });
            alert('Plan guardado y auditado exitosamente conforme a Spec 1.0');
        } catch (error) {
            alert('Error al guardar el plan');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAutoPlan = () => {
        const pool = pools.find(p => p.id === selectedPoolId);
        if (!pool) return;

        // --- LÓGICA DE VACACIONES ---
        // Contamos cuántas vacaciones activas hay para este pool
        // Para Spec 1.0 simplificado, restamos el headcount de vacaciones al pool directamente
        const poolVacations = vacations.filter(v => v.poolId === parseInt(selectedPoolId));
        const totalVacCount = poolVacations.length; // Simplificado: agentes fuera toda la semana

        const totalAgents = pool.totalAgents - totalVacCount;

        // NUEVA LÓGICA IA AVANZADA
        // 1. Descansos: Repartir solo de Miércoles a Domingo (Lunes y Martes 0 descansos)
        const restDaysMap: any = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 };
        const allowedRestDays = ['Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        let remainingRestDays = totalAgents;
        let dayIdx = 0;

        while (remainingRestDays > 0) {
            restDaysMap[allowedRestDays[dayIdx]]++;
            remainingRestDays--;
            dayIdx = (dayIdx + 1) % allowedRestDays.length;
        }

        const newDist = DAYS.reduce((acc, day) => {
            const rest = restDaysMap[day];
            let planned = totalAgents - rest;

            // 2. Turno Nocturno Congelado
            // Prioridad: Leer del Excel cargado (pool.nocturnalAgents), o del valor manual si el Director ya lo escribió
            const noctFromExcel = pool.nocturnalAgents || 0;
            const noctFromTable = distribution[day]?.nocturno || 0;
            let nocturno = Math.max(noctFromExcel, noctFromTable); // Respetar el mayor
            
            // Fines de semana: NO hay turno nocturno (solo Matutino)
            if (day === 'Saturday' || day === 'Sunday') {
                nocturno = 0;
            }
            
            if (nocturno > planned) nocturno = planned; // Evita descuadre

            const remainingToPlan = planned - nocturno;
            let matutino = 0;
            let vespertino = 0;

            // 3. Fines de semana: Solo Matutino (9 a 6)
            if (day === 'Saturday' || day === 'Sunday') {
                matutino = remainingToPlan;
                vespertino = 0;
            } else {
                // Lunes a Viernes: dividir el restante 50/50 entre Matutino y Vespertino
                matutino = Math.round(remainingToPlan * 0.50);
                vespertino = remainingToPlan - matutino;
            }

            return {
                ...acc,
                [day]: { matutino, vespertino, nocturno, planned, rest, vacation: totalVacCount }
            };
        }, {});

        setDistribution(newDist);
        if (totalVacCount > 0) {
            alert(`IA: Plan generado descontando ${totalVacCount} agentes en vacaciones.`);
        } else {
            alert(`IA: Plan balanceado generado para ${pool.name} (${totalAgents} agentes)`);
        }
    };
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <LayoutDashboard className="text-indigo-600" />
                        Simulador de Suma Cero (Spec 1.0)
                    </h1>
                    <p className="text-gray-500 mt-1">Ajusta la distribución diaria o usa la IA para balancear.</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleAutoPlan}
                        className="flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 px-4 py-2 rounded-lg font-bold hover:bg-amber-100 transition active:scale-95"
                    >
                        <RotateCcw size={18} className="animate-spin-slow" />
                        Auto-Plan IA
                    </button>

                    <button
                        onClick={async () => {
                            try {
                                const res = await api.get('/live');
                                const pool = pools.find(p => p.id === selectedPoolId);
                                if (pool) {
                                    handlePoolChange(pool.id, 'totalAgents', res.data.total_agentes);
                                    alert(`Staff Real cargado: ${res.data.total_agentes} agentes activos en este momento.`);
                                }
                            } catch (error) {
                                alert('No se pudo conectar con la Central de Datos');
                            }
                        }}
                        className="flex items-center gap-2 bg-rose-50 text-rose-700 border border-rose-200 px-4 py-2 rounded-lg font-bold hover:bg-rose-100 transition active:scale-95"
                    >
                        <Activity size={18} />
                        Usar Staff Real (Live)
                    </button>

                    <select
                        className="bg-gray-50 border border-gray-200 text-gray-900 rounded-lg p-2.5 focus:ring-indigo-500 focus:border-indigo-500 transition"
                        value={selectedPoolId}
                        onChange={(e) => setSelectedPoolId(e.target.value)}
                    >
                        {pools.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.totalAgents} agentes)</option>
                        ))}
                    </select>
                </div>
            </div>

            {vacations.filter(v => v.poolId === parseInt(selectedPoolId)).length > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-3 text-emerald-800 text-sm font-medium">
                    <Palmtree className="text-emerald-600" />
                    Hay {vacations.filter(v => v.poolId === parseInt(selectedPoolId)).length} agentes con vacaciones aprobadas para este pool.
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Grid de Entrada */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b border-gray-100 text-[10px] text-gray-400 font-bold uppercase tracking-wider text-center">
                                <th className="pb-4 text-left">Día</th>
                                <th className="pb-4 text-sky-600">Matutino</th>
                                <th className="pb-4 text-orange-600">Vespertino</th>
                                <th className="pb-4 text-indigo-600">Nocturno</th>
                                <th className="pb-4">Descansos</th>
                                <th className="pb-4">Vacac.</th>
                                <th className="pb-4 text-right">Capacidad</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {DAYS.map(day => (
                                <tr key={day} className="group hover:bg-gray-50/50 transition border-b border-gray-50/50 last:border-0 relative">
                                    <td className="py-4 font-semibold text-gray-700 text-xs">
                                        {day}
                                        <div className="text-[9px] text-gray-400 font-normal">
                                            Σ {distribution[day].planned} asignados
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        <input type="number"
                                            className="w-14 bg-sky-50 text-sky-700 border-none rounded-md p-1.5 focus:ring-2 focus:ring-sky-500 transition text-center text-xs font-bold"
                                            value={distribution[day].matutino}
                                            onChange={(e) => handleInputChange(day, 'matutino', parseInt(e.target.value) || 0)}
                                        />
                                    </td>
                                    <td className="text-center">
                                        <input type="number"
                                            className="w-14 bg-orange-50 text-orange-700 border-none rounded-md p-1.5 focus:ring-2 focus:ring-orange-500 transition text-center text-xs font-bold"
                                            value={distribution[day].vespertino}
                                            onChange={(e) => handleInputChange(day, 'vespertino', parseInt(e.target.value) || 0)}
                                        />
                                    </td>
                                    <td className="text-center">
                                        <input type="number"
                                            className="w-14 bg-indigo-50 text-indigo-700 border-none rounded-md p-1.5 focus:ring-2 focus:ring-indigo-500 transition text-center text-xs font-bold"
                                            value={distribution[day].nocturno}
                                            onChange={(e) => handleInputChange(day, 'nocturno', parseInt(e.target.value) || 0)}
                                        />
                                    </td>
                                    <td className="text-center">
                                        <input type="number"
                                            className="w-14 bg-gray-50 text-gray-600 border-none rounded-md p-1.5 focus:ring-2 focus:ring-gray-400 transition text-center text-xs"
                                            value={distribution[day].rest}
                                            onChange={(e) => handleInputChange(day, 'rest', parseInt(e.target.value) || 0)}
                                        />
                                    </td>
                                    <td className="text-center">
                                        <input type="number" readOnly
                                            className="w-14 bg-gray-100 text-gray-400 border-none rounded-md p-1.5 text-center text-xs cursor-not-allowed hidden md:inline-block outline-none"
                                            value={distribution[day].vacation}
                                        />
                                    </td>
                                    <td className="py-4 text-right font-mono font-black text-indigo-600">
                                        {calculateCapacity(distribution[day].planned)} <span className="text-[9px] text-gray-400 font-sans font-medium">LLAM</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Panel de Control y Balance */}
                <div className="space-y-6">
                    <div className={`p-6 rounded-xl border transition-all duration-300 ${balance?.isBalanced ? 'bg-green-50 border-green-100 shadow-green-100' : 'bg-red-50 border-red-100 shadow-red-100'
                        } shadow-lg`}>
                        <div className="flex items-center gap-2 mb-4">
                            {balance?.isBalanced ? (
                                <CheckCircle2 className="text-green-600" />
                            ) : (
                                <AlertCircle className="text-red-500 animate-pulse" />
                            )}
                            <h2 className={`font-bold text-lg ${balance?.isBalanced ? 'text-green-800' : 'text-red-800'}`}>
                                {balance?.isBalanced ? 'Suma Cero Correcta' : 'Estado de Balance'}
                            </h2>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-end border-b pb-2 border-gray-100">
                                <span className="text-sm text-gray-500">Capacidad Total Semana</span>
                                <span className="text-2xl font-black text-gray-800">{balance?.weeklyTotalCapacity}</span>
                            </div>
                            <div className="flex justify-between items-end border-b pb-2 border-gray-100">
                                <span className="text-sm text-gray-500">Total Asignado (Σ)</span>
                                <span className="text-2xl font-black text-gray-800">{balance?.totalAllocated}</span>
                            </div>
                            <div className="text-center pt-2">
                                <span className={`text-xl font-black ${balance?.isBalanced ? 'text-green-600' : (balance?.delta > 0 ? 'text-amber-500' : 'text-rose-500')}`}>
                                    {balance?.isBalanced ? 'Suma Cero Correcta' : (balance?.delta > 0 ? `Falta asignar ${Math.abs(balance?.delta)} jornada(s)` : `Sobrecarga de ${Math.abs(balance?.delta)} jornada(s)`)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={!balance?.isBalanced || isLoading}
                        className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md ${balance?.isBalanced
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-[1.02] active:scale-95'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        <Save size={20} />
                        {isLoading ? 'Guardando...' : 'Guardar Plan y Auditar'}
                    </button>

                    <div className="bg-white p-4 rounded-lg border border-gray-100 text-[11px] text-gray-400 space-y-1">
                        <p className="font-bold text-gray-500 uppercase">Referencia Spec 1.0</p>
                        <p>• AHT: {config?.ahtMinutes} min</p>
                        <p>• Ocupación: {Math.round(config?.occupancy * 100)}%</p>
                        <p>• Shrinkage: {Math.round(config?.shrinkage * 100)}%</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Simulator;
