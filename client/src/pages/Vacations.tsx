import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { Palmtree, Plus, Trash2, Calendar, User, Search } from 'lucide-react';

const Vacations: React.FC = () => {
    const [vacations, setVacations] = useState<any[]>([]);
    const [pools, setPools] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Form state
    const [formData, setFormData] = useState({
        agentName: '',
        startDate: '',
        endDate: '',
        poolId: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [vacRes, poolRes] = await Promise.all([
                api.get('/vacations'),
                api.get('/pools')
            ]);
            setVacations(vacRes.data);
            setPools(poolRes.data);
            if (poolRes.data.length > 0) {
                setFormData(prev => ({ ...prev, poolId: poolRes.data[0].id }));
            }
        } catch (error) {
            console.error('Error fetching data', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/vacations', formData);
            setFormData({ ...formData, agentName: '', startDate: '', endDate: '' });
            fetchData();
            alert('Vacaciones registradas correctamente');
        } catch (error) {
            alert('Error al guardar');
        }
    };

    const deleteVacation = async (id: string) => {
        if (!confirm('¿Eliminar estas vacaciones?')) return;
        try {
            await api.delete(`/vacations/${id}`);
            fetchData();
        } catch (error) {
            alert('Error al eliminar');
        }
    };

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
            <div>
                <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                    <Palmtree className="text-emerald-600" />
                    Gestión de Vacaciones
                </h1>
                <p className="text-gray-500 mt-2">Registra ausencias aprobadas para que el simulador las descuente automáticamente.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Formulario */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-6">
                        <Plus className="text-indigo-500" size={20} />
                        Nueva Aprobación
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Nombre del Agente</label>
                            <input
                                required
                                className="w-full p-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                                value={formData.agentName}
                                onChange={e => setFormData({ ...formData, agentName: e.target.value })}
                                placeholder="Ej. Juan Perez"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Inicio</label>
                                <input
                                    required
                                    type="date"
                                    className="w-full p-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                                    value={formData.startDate}
                                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Fin</label>
                                <input
                                    required
                                    type="date"
                                    className="w-full p-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                                    value={formData.endDate}
                                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Pool / Negocio</label>
                            <select
                                className="w-full p-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                                value={formData.poolId}
                                onChange={e => setFormData({ ...formData, poolId: e.target.value })}
                            >
                                {pools.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <button className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-50 active:scale-95 mt-4">
                            Registrar Vacaciones
                        </button>
                    </form>
                </div>

                {/* Lista */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-6">
                        <Calendar className="text-indigo-500" size={20} />
                        Historial de Ausencias
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="text-gray-400 border-b border-gray-50">
                                    <th className="py-3 px-4">Agente</th>
                                    <th className="py-3 px-4">Periodo</th>
                                    <th className="py-3 px-4">Pool</th>
                                    <th className="py-3 px-4 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {vacations.map(vac => (
                                    <tr key={vac.id} className="hover:bg-gray-50">
                                        <td className="py-4 px-4 font-bold text-gray-800 flex items-center gap-2">
                                            <User size={14} className="text-gray-400" />
                                            {vac.agentName}
                                        </td>
                                        <td className="py-4 px-4 text-gray-500">
                                            {vac.startDate} al {vac.endDate}
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-[10px] font-bold uppercase">
                                                {pools.find(p => p.id === vac.poolId)?.name}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <button
                                                onClick={() => deleteVacation(vac.id)}
                                                className="text-rose-400 hover:text-rose-600 p-2"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {vacations.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-10 text-center text-gray-400 italic">No hay vacaciones registradas.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Vacations;
