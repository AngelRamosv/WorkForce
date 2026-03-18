import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { ShieldCheck, Download, Clock, Database, Tag, Info, ListChecks, Trash2, RefreshCw } from 'lucide-react';

const Audit: React.FC = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            const res = await api.get('/audit');
            setLogs(res.data);
        } catch (error) {
            console.error('Error fetching logs', error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatChanges = (changes: any) => {
        if (!changes) return 'Sin detalles';

        // Si es un plan semanal (PlanSemanal)
        if (changes.distribucion) {
            const days = Object.keys(changes.distribucion);
            const total = changes.balance?.totalAllocated || 'N/A';
            return (
                <div className="space-y-2">
                    <p className="text-indigo-600 font-bold flex items-center gap-1">
                        <ListChecks size={12} /> Plan de Capacidad Generado
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                        {days.map(day => (
                            <div key={day} className="bg-white p-1 rounded-lg border border-gray-100 text-center">
                                <p className="text-[8px] text-gray-400 font-black uppercase">{day.substring(0, 3)}</p>
                                <p className="text-xs font-black text-gray-700">{changes.distribucion[day].planned}</p>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium italic">
                        Métrica final: {total} jornadas totales. Balance: {changes.balance?.message || 'Correcto'}.
                    </p>
                </div>
            );
        }

        // Si es cualquier otro cambio (general)
        return (
            <div className="bg-white p-3 rounded-xl border border-gray-100 italic text-gray-600 text-[11px] leading-relaxed">
                {JSON.stringify(changes).replace(/[{}"]/g, ' ').trim()}
            </div>
        );
    };

    const exportToCSV = () => {
        if (logs.length === 0) return;
        const headers = ["Fecha", "Entidad", "Accion", "Cambios"];
        const rows = logs.map(log => [
            new Date(log.createdAt).toLocaleString(),
            log.nombreEntidad,
            log.accion,
            JSON.stringify(log.cambios).replace(/"/g, '""')
        ]);
        const csvContent = [headers.join(","), ...rows.map(row => `"${row.join('","')}"`)].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `auditoria_wfm_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                        <ShieldCheck className="text-indigo-600" />
                        Registro de Auditoría
                    </h1>
                    <p className="text-gray-500 mt-2">Trazabilidad oficial de cambios procesada para lectura humana.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchLogs}
                        className="bg-white text-gray-600 px-4 py-3 rounded-2xl font-bold border border-gray-100 hover:bg-gray-50 transition active:scale-95 flex items-center gap-2"
                        title="Refrescar"
                    >
                        <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={async () => {
                            if (confirm('¿ELIMINAR TODO EL HISTORIAL? Esta acción es irreversible y reseteará el log de auditoría.')) {
                                await api.delete('/audit');
                                fetchLogs();
                            }
                        }}
                        className="bg-rose-50 text-rose-600 px-6 py-3 rounded-2xl font-bold border border-rose-100 hover:bg-rose-100 transition active:scale-95 flex items-center gap-2"
                    >
                        <Trash2 size={18} />
                        Limpiar Historial
                    </button>
                    <button
                        onClick={exportToCSV}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold transition shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 active:scale-95"
                    >
                        <Download size={18} />
                        Exportar reporte CSV
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    <div className="flex items-center gap-2"><Clock size={12} /> Fecha y Hora</div>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    <div className="flex items-center gap-2"><Database size={12} /> Entidad</div>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    <div className="flex items-center gap-2"><Tag size={12} /> Acción</div>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    <div className="flex items-center gap-2"><Info size={12} /> Detalles del Cambio</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {logs.map(log => (
                                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap align-top">
                                        <p className="text-sm font-bold text-gray-700">
                                            {new Date(log.createdAt).toLocaleDateString()}
                                        </p>
                                        <p className="text-[10px] text-gray-400 font-medium">
                                            {new Date(log.createdAt).toLocaleTimeString()}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap align-top">
                                        <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-tighter">
                                            {log.nombreEntidad}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap align-top">
                                        <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-tighter ${log.accion === 'Creado' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                            }`}>
                                            {log.accion}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 group-hover:bg-white transition-colors">
                                            {formatChanges(log.cambios)}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan={4} className="py-20 text-center">
                                        <p className="text-gray-400 italic">No hay registros aún.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Audit;
