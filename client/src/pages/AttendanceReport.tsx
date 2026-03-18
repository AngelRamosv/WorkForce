import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { Clock, Filter, UserCheck, AlertCircle, Download, Trash2, ShieldAlert } from 'lucide-react';

const AttendanceReport: React.FC = () => {
    const [attendance, setAttendance] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [pools, setPools] = useState<any[]>([]);
    const [filters, setFilters] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        poolId: ''
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const poolsRes = await api.get('/pools');
            setPools(poolsRes.data);
            fetchReport();
        } catch (error) {
            console.error('Error fetching pools', error);
        }
    };

    const fetchReport = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.poolId) params.append('poolId', filters.poolId);

            const res = await api.get(`/reports/attendance?${params.toString()}`);
            setAttendance(res.data);
        } catch (error) {
            console.error('Error fetching attendance report', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const params = new URLSearchParams();
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.poolId) params.append('poolId', filters.poolId);
            
            // Usar window.open para descargar el archivo directamente desde el endpoint
            const url = `${api.defaults.baseURL}/reports/attendance/export?${params.toString()}`;
            window.open(url, '_blank');
        } catch (error) {
            console.error('Error exporting report', error);
            alert('Error al exportar el reporte');
        }
    };

    const handleDeleteRecord = async (id: string, name: string) => {
        if (!window.confirm(`¿Estás seguro de eliminar el registro de ${name}?`)) return;
        
        try {
            await api.delete(`/reports/attendance/${id}`);
            setAttendance(prev => prev.filter(a => a.id !== id));
        } catch (error) {
            console.error('Error deleting record', error);
            alert('No se pudo eliminar el registro');
        }
    };

    const handleClearPeriod = async () => {
        const msg = `¡ATENCIÓN! Se eliminarán TODOS los registros del periodo ${filters.startDate} al ${filters.endDate}. ¿Deseas continuar?`;
        if (!window.confirm(msg)) return;

        try {
            const params = new URLSearchParams();
            params.append('startDate', filters.startDate);
            params.append('endDate', filters.endDate);
            if (filters.poolId) params.append('poolId', filters.poolId);

            await api.delete(`/reports/attendance?${params.toString()}`);
            fetchReport();
            alert('Periodo limpiado correctamente');
        } catch (error) {
            console.error('Error clearing period', error);
            alert('Error al limpiar el periodo');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <Clock className="text-amber-500" />
                        Reporte de Asistencia y Retardos
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Histórico detallado de puntualidad de agentes.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
                        <Filter size={16} className="text-gray-400" />
                        <input 
                            type="date" 
                            className="bg-transparent border-none text-xs font-bold focus:ring-0"
                            value={filters.startDate}
                            onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                        />
                        <span className="text-gray-300">|</span>
                        <input 
                            type="date" 
                            className="bg-transparent border-none text-xs font-bold focus:ring-0"
                            value={filters.endDate}
                            onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                        />
                    </div>
                    
                    <select 
                        className="bg-gray-50 border border-gray-200 rounded-xl p-2 text-xs font-bold focus:ring-indigo-500 transition"
                        value={filters.poolId}
                        onChange={(e) => setFilters({...filters, poolId: e.target.value})}
                    >
                        <option value="">Todas las Campañas</option>
                        {pools.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>

                    <div className="flex gap-2">
                        <button 
                            onClick={fetchReport}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition active:scale-95 flex items-center gap-2"
                        >
                            Consultar
                        </button>
                        <button 
                            onClick={handleExport}
                            disabled={attendance.length === 0}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Download size={14} />
                            Excel
                        </button>
                        <button 
                            onClick={handleClearPeriod}
                            disabled={attendance.length === 0}
                            className="bg-gray-100 text-gray-400 px-4 py-2 rounded-xl text-xs font-bold hover:bg-rose-50 hover:text-rose-600 transition active:scale-95 disabled:opacity-50 flex items-center gap-2"
                            title="Limpiar Periodo Seleccionado"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                            <th className="px-6 py-4 text-center">Fecha</th>
                            <th className="px-6 py-4">Agente</th>
                            <th className="px-6 py-4 text-center">H. Programada</th>
                            <th className="px-6 py-4 text-center">H. Entrada</th>
                            <th className="px-6 py-4 text-center">Retardo</th>
                            <th className="px-6 py-4 text-center">Impacto (Llamadas)</th>
                            <th className="px-6 py-4 text-center">Estatus</th>
                            <th className="px-6 py-4 text-right">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-20 text-center animate-pulse text-gray-400 font-medium">Cargando reporte...</td>
                            </tr>
                        ) : attendance.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-20 text-center text-gray-400 italic">No se encontraron registros para este periodo.</td>
                            </tr>
                        ) : (
                            attendance.map((row) => (
                                <tr key={row.id} className="hover:bg-gray-50/30 transition-colors group">
                                    <td className="px-6 py-4 text-center text-xs font-mono font-bold text-gray-500">
                                        {row.fecha}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold text-[10px]">
                                                {row.nombreAgente.substring(0,2).toUpperCase()}
                                            </div>
                                            <span className="text-xs font-bold text-gray-700">{row.nombreAgente}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center text-xs font-medium text-gray-400 italic">
                                        {row.horaEntradaProgramada}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="text-xs font-black text-gray-800 bg-gray-100 px-2 py-1 rounded-lg">
                                            {row.horaEntradaReal}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="text-xs font-bold text-gray-500">
                                            {row.minutosRetardo} m
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {row.minutosRetardo > 0 ? (
                                            <span className="text-xs font-black text-rose-500 bg-rose-50 px-2 py-1 rounded-lg">
                                                -{row.impactoLlamadas} LLAM
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {row.estatusAsistencia === 'Retardo' ? (
                                            <div className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ring-1 ring-inset ring-rose-200">
                                                <AlertCircle size={10} />
                                                Retardo
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ring-1 ring-inset ring-emerald-200">
                                                <UserCheck size={10} />
                                                A Tiempo
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => handleDeleteRecord(row.id, row.nombreAgente)}
                                            className="text-gray-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                            title="Eliminar Registro"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-widest px-2">
                <p>Total registros: {attendance.length}</p>
                <div className="flex gap-4">
                    <span className="flex items-center gap-1 text-emerald-500"><UserCheck size={12}/> Puntuales: {attendance.filter(a => a.estatusAsistencia === 'A Tiempo').length}</span>
                    <span className="flex items-center gap-1 text-rose-500"><AlertCircle size={12}/> Retardos: {attendance.filter(a => a.estatusAsistencia === 'Retardo').length}</span>
                    <span className="flex items-center gap-1 text-amber-500 font-black">
                        <Clock size={12}/> Impacto Total: -{attendance.reduce((sum, a) => sum + (a.impactoLlamadas || 0), 0)} LLAM
                    </span>
                </div>
            </div>
        </div>
    );
};

export default AttendanceReport;
