import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { BarChart3, Download, CalendarCheck, Users, Activity, PhoneCall, Trash2 } from 'lucide-react';

const Reports: React.FC = () => {
    const [reports, setReports] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const res = await api.get('/reports/compliance');
            setReports(res.data);
        } catch (error) {
            console.error('Error fetching reports', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string, date: string) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar el reporte del día ${date}? Esta acción no se puede deshacer.`)) return;
        try {
            await api.delete(`/reports/${id}`);
            fetchReports();
        } catch (error) {
            alert('No se pudo eliminar el reporte');
        }
    };

    const exportToCSV = () => {
        if (reports.length === 0) return;

        const headers = ["Fecha", "Campaña", "Staff Planeado", "Staff Real", "Cumplimiento (%)", "Llamadas Recibidas", "Abandonos", "Nivel de Servicio (%)"];
        const rows = reports.map(r => [
            r.date,
            r.poolName,
            r.plannedAgents,
            r.activeAgents,
            r.compliancePct,
            r.totalCalls,
            r.abandonedCalls,
            r.serviceLevel
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.join(','))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `reporte_operativo_wfm_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                        <BarChart3 className="text-indigo-600" />
                        Reportes de Cumplimiento
                    </h1>
                    <p className="text-gray-500 mt-2">Análisis de Plan vs. Realidad y métricas de cierre de día.</p>
                </div>
                <button
                    onClick={exportToCSV}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-bold transition shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 active:scale-95"
                >
                    <Download size={18} />
                    Descargar Reporte (Excel)
                </button>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    <div className="flex items-center gap-2"><CalendarCheck size={12} /> Fecha</div>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    Campaña
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                                    <div className="flex items-center justify-center gap-2"><Users size={12} /> Plan vs Real</div>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                                    <div className="flex items-center justify-center gap-2"><Activity size={12} /> Cumplimiento</div>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                                    <div className="flex items-center justify-center gap-2"><PhoneCall size={12} /> Tráfico</div>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {reports.map((report, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <p className="text-sm font-bold text-gray-700">
                                            {report.date}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-tighter">
                                            {report.poolName}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <div className="flex items-center justify-center gap-3">
                                            <div className="text-center">
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">Plan</p>
                                                <p className="text-lg font-black text-indigo-600">{report.plannedAgents}</p>
                                            </div>
                                            <div className="w-px h-6 bg-gray-200"></div>
                                            <div className="text-center">
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">Real</p>
                                                <p className="text-lg font-black text-gray-700">{report.activeAgents}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        {report.plannedAgents > 0 ? (
                                            <span className={`px-4 py-2 rounded-xl text-sm font-black transition-colors ${report.compliancePct >= 95 ? 'bg-emerald-50 text-emerald-600' :
                                                    report.compliancePct >= 85 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                                                }`}>
                                                {report.compliancePct}%
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">Sin plan</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center gap-1 text-xs">
                                            <p><span className="text-gray-400 font-medium">Recibidas:</span> <span className="font-bold text-gray-700">{report.totalCalls}</span></p>
                                            <p><span className="text-gray-400 font-medium">Abandonos:</span> <span className="font-bold text-rose-600">{report.abandonedCalls}</span></p>
                                            <p><span className="text-gray-400 font-medium">NS:</span> <span className="font-bold text-indigo-600">{report.serviceLevel}%</span></p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(report.id, report.date)}
                                            className="p-2 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all group-hover:scale-110"
                                            title="Eliminar reporte de este día"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {reports.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <p className="text-gray-400 italic">Aún no hay días cerrados. Ve a la pestaña Live y usa "Cerrar Día y Guardar Métricas".</p>
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

export default Reports;
