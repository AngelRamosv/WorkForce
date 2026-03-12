import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { Activity, Users, PhoneIncoming, PhoneOff, Clock, AlertTriangle, UserCheck, Search, Filter, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LiveDashboard: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [config, setConfig] = useState<any>(null);

    const navigate = useNavigate();
    const [isSaving, setIsSaving] = useState(false);
    const [pools, setPools] = useState<any[]>([]);

    const handleCloseDay = async () => {
        if (!data) return;
        setIsSaving(true);
        try {
            const totalCalls = data.llamadas_ingresadas || 0;

            // Recálculo real por defecto de la API (porcentaje_abandono llega en 0)
            const realPct = (data.abandonadas_total && totalCalls)
                ? Math.round((data.abandonadas_total / totalCalls) * 100)
                : (data.porcentaje_abandono || 0);

            const abandonedCalls = data.abandonadas_total || Math.round(totalCalls * (realPct / 100)) || 0;
            const answeredCalls = data.contestadas_total || (totalCalls - abandonedCalls);
            const serviceLevel = 100 - realPct;

            // Buscar prioritariamente el pool de Retención
            const retPool = pools.find(p => p.name.toLowerCase().includes('retencion') || p.name.toLowerCase().includes('retención'));
            // Respaldo: el primero que encuentre de la lista real
            const poolId = retPool ? retPool.id : (pools.length > 0 ? pools[0].id : null);
            
            if (!poolId) {
                alert('No se ha detectado ninguna campaña activa (Retención/Móvil). Por favor, refresca la página o revisa la configuración.');
                return;
            }

            console.log('Intentando guardar reporte para el Pool ID:', poolId);

            await api.post('/reports/save-day', {
                poolId,
                totalCalls,
                answeredCalls,
                abandonedCalls,
                serviceLevel,
                totalAgentsActive: data.total_agentes || 0
            });
            alert('Día cerrado exitosamente. Resultados enviados al Dashboard de Cumplimiento.');
            navigate('/reports');
        } catch (error: any) {
            console.error(error);
            const msg = error.response?.data?.error || 'Error desconocido al guardar';
            alert(`Error al guardar el reporte del día: ${msg}`);
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            try {
                const res = await api.get('/live');
                if (isMounted) {
                    setData(res.data);
                    setError(null);
                    setLastUpdate(new Date());
                }
                
                // Cargar pools para tener el ID correcto
                const poolsRes = await api.get('/pools');
                setPools(poolsRes.data);

                // Cargar configuración para tener metas reales
                const confRes = await api.get('/config');
                setConfig(confRes.data);
            } catch (err: any) {
                if (isMounted) {
                    console.error('Error fetching live data', err);
                    setError('Error de conexión con la central');
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <Activity className="text-indigo-600 animate-pulse" size={48} />
                <p className="text-gray-500 font-medium animate-pulse">Sincronizando con la central de datos...</p>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 text-center px-4">
                <AlertTriangle className="text-rose-600" size={64} />
                <h2 className="text-2xl font-black text-gray-900">Central de Datos Inalcanzable</h2>
                <p className="text-gray-500 max-w-md mx-auto">
                    No se pudo establecer conexión con el servidor de métricas.
                    Verifique su conexión a la red local.
                </p>
                <button onClick={() => window.location.reload()} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold">
                    Reintentar
                </button>
            </div>
        );
    }

    if (!data) return <div className="p-10 text-center text-gray-500 font-mono text-xs">Awaiting data stream...</div>;

    const metasLlamadas = config?.dailyGoal || 3195;
    const ahtReference = config?.ahtMinutes || 11.5;

    // ==========================================
    // LÓGICA DE CUMPLIMIENTO AL CORTE (PACING)
    // ==========================================
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();

    const startHour = 9; // 9:00 AM
    const endHour = 21;  // 9:00 PM (21:00)
    const totalOperatingMinutes = (endHour - startHour) * 60; // 720 minutos

    // Calcular cuántos minutos han pasado desde las 9:00 AM
    let elapsedMinutes = ((currentHour - startHour) * 60) + currentMinutes;

    // Lógica de visualización:
    let percentOfDayPassed = 0;
    let metaAlCorte = 0;
    let porcentajeCumplimientoCorte = 0;
    const llamadasReales = data.llamadas_ingresadas || 0;

    if (elapsedMinutes > 0) {
        if (elapsedMinutes > totalOperatingMinutes) elapsedMinutes = totalOperatingMinutes;
        
        percentOfDayPassed = elapsedMinutes / totalOperatingMinutes;
        metaAlCorte = Math.round(metasLlamadas * percentOfDayPassed);
        
        // Si la meta es 0 (muy temprano), evitamos división por cero
        porcentajeCumplimientoCorte = metaAlCorte > 0 
            ? Math.round((llamadasReales / metaAlCorte) * 100) 
            : 0;
    }
    // Si es antes de las 9 AM, se queda todo en 0.

    // ==========================================

    // Lógica para medir "Fuga" real
    const allAgents = (data.nombres || []).map((name: string, idx: number) => ({
        name,
        supervisor: (data.supervisores || [])[idx] || 'Sin Asignar',
        status: (data.auxiliares_actuales || [])[idx] || 'Disponible',
        time: (data.tiempos_en_estado || [])[idx] || '0m'
    }));

    const tardyAgents = allAgents
        .filter((a: any) => ['Break', 'Baño', 'Personal', 'Coaching', 'Comida', 'Capacitación', 'No Disponible', 'Consultorio', 'RetroSup', 'esperando info'].includes(a.status))
        .map((a: any) => {
            const minutes = parseInt(a.time.replace(/\D/g, '')) || 0;
            return { ...a, minutes };
        })
        .filter((a: any) => a.minutes > (config?.lateToleranceMinutes || 5)) // Umbral dinámico: 5 minutos
        .sort((a: any, b: any) => b.minutes - a.minutes);

    const totalFugaMinutes = tardyAgents.reduce((sum: number, a: any) => sum + a.minutes, 0);
    const impactoLlamadas = Math.round(totalFugaMinutes / ahtReference);

    // Preparar lista de agentes con filtros (la tabla visual)
    const agentsList = allAgents.filter((agent: any) => {
        const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            agent.supervisor.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || agent.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                        <Activity className="text-rose-600" />
                        Live Operations Center
                    </h1>
                    <p className="text-gray-500 mt-2">Monitoreo activo de la operación actual.</p>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                    {data.isMock && (
                        <span className="block text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold uppercase animate-pulse">
                            ⚠️ Modo Demo Activo
                        </span>
                    )}
                    <div className="flex gap-2">
                        <button
                            onClick={handleCloseDay}
                            disabled={isSaving}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition active:scale-95 disabled:opacity-50"
                        >
                            <Save size={16} />
                            {isSaving ? 'Guardando...' : 'Cerrar Día'}
                        </button>
                    </div>
                    <p className="text-xs font-mono font-medium text-gray-400 mt-1">Actualizado: {lastUpdate.toLocaleTimeString()}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Ingresadas"
                    value={data.llamadas_ingresadas ?? 0}
                    icon={<PhoneIncoming size={20} />}
                    color="blue"
                />
                <MetricCard
                    title="Staff Online"
                    value={data.total_agentes ?? 0}
                    icon={<Users size={20} />}
                    color="indigo"
                />
                <MetricCard
                    title="Abandono"
                    value={`${data.abandonadas_total && data.llamadas_ingresadas ? Math.round((data.abandonadas_total / data.llamadas_ingresadas) * 100) : (data.porcentaje_abandono ?? 0)}%`}
                    icon={<PhoneOff size={20} />}
                    color="rose"
                    alert={data.alerta_abandono}
                />
                <MetricCard
                    title="AHT Medio"
                    value={`${data.media_total ?? 0}m`}
                    icon={<Clock size={20} />}
                    color="amber"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    {/* Buscador y Filtros */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar por agente o supervisor..."
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter size={16} className="text-gray-400" />
                            <select
                                className="bg-gray-50 border-none rounded-xl text-sm py-2 px-4 focus:ring-2 focus:ring-indigo-500"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="All">Todos los estados</option>
                                <option value="Disponible">Disponible</option>
                                <option value="Break">Break</option>
                                <option value="Coaching">Coaching</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                <UserCheck size={18} className="text-indigo-600" />
                                Lista de Agentes Online
                            </h3>
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                                {agentsList.length} FILTRADOS
                            </span>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                    <tr className="text-gray-400 bg-gray-50/50">
                                        <th className="px-6 py-2">Agente</th>
                                        <th className="px-6 py-2">Supervisor</th>
                                        <th className="px-6 py-2 font-bold text-indigo-600">Tiempo en Estado</th>
                                        <th className="px-6 py-2 text-right">Estatus</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 text-gray-600">
                                    {agentsList.map((agent: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-3 font-semibold text-gray-800">{agent.name}</td>
                                            <td className="px-6 py-3 text-gray-500">{agent.supervisor}</td>
                                            <td className="px-6 py-3 font-mono font-bold text-indigo-600 italic">
                                                {agent.time}
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${agent.status === 'Disponible' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                                                    {agent.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {agentsList.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-10 text-center text-gray-400 italic">No se encontraron agentes con esos filtros.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-indigo-600 p-8 rounded-3xl text-white shadow-xl shadow-indigo-100">
                        <div className="flex justify-between items-start">
                            <p className="text-xs font-bold uppercase opacity-80">Avance Actual (Corte)</p>
                            <span className="text-[10px] bg-white/20 px-2 py-1 rounded font-mono">
                                {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>

                        <div className="flex items-end gap-2 mt-2">
                            <h4 className="text-5xl font-black">{porcentajeCumplimientoCorte}%</h4>
                            <span className="text-sm opacity-80 mb-1 pb-1">del esperado</span>
                        </div>

                        <div className="bg-white/20 h-2 rounded-full mt-5 overflow-hidden">
                            <div
                                className={`h-full transition-all duration-1000 ${porcentajeCumplimientoCorte >= 100 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                                style={{ width: `${Math.min(100, porcentajeCumplimientoCorte)}%` }}
                            />
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/10 space-y-1">
                            <div className="flex justify-between text-xs font-medium">
                                <span className="opacity-80">Llevamos:</span>
                                <span>{llamadasReales} llamadas</span>
                            </div>
                            <div className="flex justify-between text-[10px] items-center">
                                <span className="opacity-60 uppercase tracking-wider">Avance actual (Corte):</span>
                                <span className="font-mono bg-white/10 px-1 rounded">{metaAlCorte}</span>
                            </div>
                            <div className="flex justify-between text-[10px] items-center text-teal-100 mt-2">
                                <span className="uppercase tracking-wider">Total Día:</span>
                                <span className="font-mono">{metasLlamadas}</span>
                            </div>
                        </div>
                    </div>

                    {/* Módulo oculto a petición directiva
                    data.alerta_abandono && (
                        <div className="bg-rose-600 text-white p-6 rounded-2xl flex items-start gap-4 animate-pulse">
                            <AlertTriangle size={24} />
                            <div>
                                <p className="font-bold">⚠️ Alerta de Abandono</p>
                                <p className="text-xs mt-1 opacity-90">Tasa de abandono crítica. Es necesario mover agentes a línea.</p>
                            </div>
                        </div>
                    )*/}

                    {/* MÓDULO DE RETARDOS Y DESVIACIONES */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-amber-100 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-100 to-transparent -mr-8 -mt-8 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-4">
                                <Clock className="text-amber-500" size={18} />
                                <h4 className="font-bold text-gray-800 text-sm">Monitor de Puntualidad</h4>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                    <p className="text-[9px] text-gray-400 font-black uppercase mb-1">Retardo Entrada (Login)</p>
                                    <p className="text-2xl font-black text-rose-500">{data.puntualidad?.totalLoginDelay || 0}m</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                    <p className="text-[9px] text-gray-400 font-black uppercase mb-1">Tiempo en Aux (Fuga)</p>
                                    <p className="text-2xl font-black text-amber-500">{totalFugaMinutes}m</p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-3 flex justify-between">
                                    <span>Infractores de Hoy (Puntualidad)</span>
                                    <span className="text-rose-500">{(data.puntualidad?.tardyEntrants || []).length} detectados</span>
                                </p>
                                <div className="space-y-2 max-h-[100px] overflow-y-auto pr-2 custom-scrollbar mb-4">
                                    {(data.puntualidad?.tardyEntrants || []).length === 0 ? (
                                        <p className="text-[10px] text-gray-400 italic">Sin retardos de entrada hoy.</p>
                                    ) : (
                                        (data.puntualidad?.tardyEntrants || []).map((agent: any, i: number) => (
                                            <div key={i} className="flex justify-between items-center text-[11px] bg-rose-50/50 p-1.5 rounded-lg border border-rose-100/50">
                                                <span className="font-bold text-gray-700 truncate max-w-[150px]">{agent.name}</span>
                                                <span className="text-rose-600 font-black">+{agent.delay}m</span>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-3 flex justify-between pt-2 border-t border-gray-50">
                                    <span>Exceso en Aux (Vivo)</span>
                                    <span className="text-amber-500">{tardyAgents.length} detectados</span>
                                </p>
                                <div className="space-y-2 max-h-[100px] overflow-y-auto pr-2 custom-scrollbar">
                                    {tardyAgents.length === 0 ? (
                                        <p className="text-[10px] text-gray-400 italic">Todos en regla actualmente.</p>
                                    ) : (
                                        tardyAgents.map((agent: any, i: number) => (
                                            <div key={i} className="flex justify-between items-center text-[11px] bg-amber-50/50 p-1.5 rounded-lg border border-amber-100/50">
                                                <span className="font-bold text-gray-700 truncate max-w-[150px]">{agent.name}</span>
                                                <span className="text-amber-600 font-black">+{agent.minutes}m</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const MetricCard = ({ title, value, icon, alert, color }: any) => {
    const colors: any = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        rose: 'bg-rose-50 text-rose-600 border-rose-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100'
    };
    return (
        <div className={`p-6 rounded-2xl border ${colors[color]} ${alert ? 'ring-2 ring-rose-300' : ''}`}>
            <div className="flex justify-between items-center mb-4">
                <div className="p-2 bg-white rounded-lg shadow-sm">{icon}</div>
                {alert && <span className="text-[9px] font-black bg-rose-600 text-white px-2 py-1 rounded">ALERTA</span>}
            </div>
            <p className="text-[10px] font-bold uppercase opacity-60">{title}</p>
            <p className="text-2xl font-black">{value}</p>
        </div>
    );
};

export default LiveDashboard;
