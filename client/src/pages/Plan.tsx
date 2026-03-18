import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { BookOpen, Calendar, Filter, Archive, CheckCircle, ChevronRight, Trash2 } from 'lucide-react';

const Plan: React.FC = () => {
    const [pools, setPools] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [selectedPoolId, setSelectedPoolId] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const res = await api.get('/pools');
            setPools(res.data);
            if (res.data.length > 0) {
                setSelectedPoolId(res.data[0].id);
                fetchPlans(res.data[0].id);
            }
        } catch (error) {
            console.error('Error fetching pools', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPlans = (poolId: string) => {
        api.get(`/plans/${poolId}`).then(res => setPlans(res.data));
    };

    const handlePoolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedPoolId(id);
        fetchPlans(id);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Cabecera Técnica */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                        <Archive className="text-indigo-600" />
                        Histórico de Planes
                    </h1>
                    <p className="text-gray-500 mt-2">Repositorio oficial de planes de capacidad guardados y auditados.</p>
                </div>

                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                    <Filter className="text-gray-400 ml-2" size={18} />
                    <select
                        value={selectedPoolId}
                        onChange={handlePoolChange}
                        className="bg-transparent border-none focus:ring-0 text-sm font-bold text-gray-700 pr-8"
                    >
                        {pools.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                </div>
            </div>

            {/* Listado de Planes */}
            <div className="grid grid-cols-1 gap-6">
                {plans.length === 0 ? (
                    <div className="bg-white p-20 text-center rounded-3xl border-2 border-dashed border-gray-100 flex flex-col items-center justify-center space-y-4">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                            <BookOpen className="text-gray-300" size={32} />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-gray-900">Archivo Vacío</p>
                            <p className="text-gray-400">No hay planes registrados para {pools.find(p => p.id == selectedPoolId)?.nombre}.</p>
                        </div>
                    </div>
                ) : (
                    plans.map(plan => (
                        <div key={plan.id} className="group bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:shadow-indigo-50/50 transition-all duration-500">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                                            <Calendar size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-gray-900 italic">SEMANA {plan.numeroSemana}</h3>
                                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{plan.anio}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter">
                                        <CheckCircle size={12} />
                                        Finalizado / Auditado
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                                    {Object.entries(plan.distribucion).map(([day, data]: [string, any]) => (
                                        <div key={day} className="relative p-4 bg-gray-50 rounded-2xl border border-transparent group-hover:border-indigo-100 transition-colors">
                                            <p className="text-[10px] text-gray-400 uppercase font-bold mb-1 opacity-70">{day.substring(0, 3)}</p>
                                            <div className="flex flex-col items-baseline gap-1">
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-xl font-black text-gray-800">{data.planned}</span>
                                                    <span className="text-[8px] font-black text-indigo-400 uppercase">Pax</span>
                                                </div>
                                                {data.matutino !== undefined && (
                                                    <div className="text-[9px] text-gray-500 font-medium">
                                                        <span className="text-blue-500">{data.matutino}</span> / <span className="text-orange-500">{data.vespertino}</span> / <span className="text-purple-500">{data.nocturno}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="mt-2 text-[8px] font-bold text-gray-500 bg-white inline-block px-1.5 py-0.5 rounded-lg border border-gray-100 shadow-sm leading-tight">
                                                {data.shift ? `TURNO ${data.shift}` : `${data.rest} Libres`}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-gray-50/50 px-6 py-3 border-t border-gray-50 flex justify-between items-center">
                                <p className="text-[10px] font-bold text-gray-400 italic">ID de Auditoría: {plan.id.substring(0, 8)}...</p>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={async () => {
                                            if (confirm('¿Está seguro de eliminar este plan histórico? Esta acción no se puede deshacer.')) {
                                                await api.delete(`/plans/${plan.id}`);
                                                fetchPlans(selectedPoolId);
                                            }
                                        }}
                                        className="text-rose-400 hover:text-rose-600 p-2 transition-colors"
                                        title="Eliminar Plan"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                    <button className="text-indigo-600 text-xs font-black flex items-center gap-1 hover:gap-2 transition-all">
                                        DETALLES COMPLETOS
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Plan;
