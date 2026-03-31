import React, { useEffect, useState, useMemo } from 'react';
import api from '../api/client';
import { Clock, Filter, UserCheck, AlertCircle, Download, Trash2, Users, Moon } from 'lucide-react';

const TURNO_OPTIONS = [
    { value: 'matutino',  label: 'Matutino (9-6)',     minHour: 9,  minLabel: '09:00 AM' },
    { value: 'vespertino',label: 'Vespertino (12-9)',  minHour: 12, minLabel: '12:00 PM' },
    { value: 'ausentes',  label: 'Ausentes',            minHour: 9,  minLabel: '09:00 AM' },
    { value: 'todos',     label: 'Todos los Turnos',   minHour: 18, minLabel: '06:00 PM' },
];

const AttendanceReport: React.FC = () => {
    const [attendance, setAttendance] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [pools, setPools] = useState<any[]>([]);
    const [date, setDate] = useState<string>(
        new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' })
    );
    const [poolId, setPoolId] = useState('');
    const [turno, setTurno] = useState('matutino');

    // Hora actual en México
    const nowMex = useMemo(() => {
        const now = new Date();
        return new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    }, []);

    const todayMex = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
    const isToday = date === todayMex;
    const nowMinutes = nowMex.getHours() * 60 + nowMex.getMinutes();

    const turnoInfo = TURNO_OPTIONS.find(t => t.value === turno)!;
    const canConsult = !isToday || nowMinutes >= turnoInfo.minHour * 60;

    useEffect(() => {
        api.get('/pools').then(r => setPools(r.data)).catch(() => {});
    }, []);

    const fetchReport = async () => {
        if (!canConsult) return;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('startDate', date);
            params.append('endDate', date);
            params.append('turno', turno);
            if (poolId) params.append('poolId', poolId);
            const res = await api.get(`/reports/attendance?${params.toString()}`);
            setAttendance(res.data);
        } catch (e) {
            console.error('Error fetching attendance', e);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        const params = new URLSearchParams();
        params.append('startDate', date);
        params.append('endDate', date);
        if (poolId) params.append('poolId', poolId);
        window.open(`${api.defaults.baseURL}/reports/attendance/export?${params.toString()}`, '_blank');
    };

    const handleDeleteRecord = async (id: string, name: string) => {
        if (!window.confirm(`¿Eliminar el registro de ${name}?`)) return;
        await api.delete(`/reports/attendance/${id}`);
        setAttendance(prev => prev.filter(a => a.id !== id));
    };

    const handleClearPeriod = async () => {
        const fmt = (d: string) => d.split('-').reverse().join('/');
        if (!window.confirm(`¡ATENCIÓN! Se eliminarán todos los registros del ${fmt(date)}. ¿Continuar?`)) return;
        await api.delete(`/reports/attendance?startDate=${date}&endDate=${date}${poolId ? `&poolId=${poolId}` : ''}`);
        setAttendance([]);
    };

    const formatDate = (d: string) => d.split('-').reverse().join('/');

    const statusBadge = (row: any) => {
        if (row.estatusAsistencia === 'Ausente') return (
            <div className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ring-1 ring-inset ring-gray-300">
                Ausente
            </div>
        );
        if (row.estatusAsistencia === 'Por Ingresar') return (
            <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ring-1 ring-inset ring-amber-200">
                <Moon size={10} /> Por Ingresar
            </div>
        );
        if (row.estatusAsistencia === 'Retardo') return (
            <div className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ring-1 ring-inset ring-rose-200">
                <AlertCircle size={10} /> Retardo
            </div>
        );
        return (
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ring-1 ring-inset ring-emerald-200">
                <UserCheck size={10} /> A Tiempo
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Header */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <Clock className="text-amber-500" />
                        Reporte de Asistencia y Retardos
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Histórico detallado de puntualidad de agentes.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Un solo calendario */}
                    <div className="flex items-center gap-1 bg-gray-50 p-2 rounded-xl border border-gray-200">
                        <Filter size={16} className="text-gray-400 mr-1" />
                        <div className="relative cursor-pointer flex items-center h-8 px-2 hover:bg-white rounded-lg transition-colors">
                            <span className="text-sm font-black text-gray-800 pointer-events-none">
                                {formatDate(date)}
                            </span>
                            <input
                                type="date"
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                value={date}
                                onChange={e => { setDate(e.target.value); setAttendance([]); }}
                            />
                        </div>
                    </div>

                    {/* Dropdown Campaña */}
                    <select
                        className="bg-gray-50 border border-gray-200 rounded-xl p-2 text-xs font-bold focus:ring-indigo-500 transition"
                        value={poolId}
                        onChange={e => setPoolId(e.target.value)}
                    >
                        <option value="">Todas las Campañas</option>
                        {pools.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>

                    {/* Dropdown Turno con indicador de disponibilidad */}
                    <div className="relative">
                        <select
                            className="bg-gray-50 border border-gray-200 rounded-xl p-2 text-xs font-bold focus:ring-indigo-500 transition pr-8"
                            value={turno}
                            onChange={e => { setTurno(e.target.value); setAttendance([]); }}
                        >
                            {TURNO_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                        </select>
                    </div>

                    {/* Botones */}
                    <div className="flex gap-2">
                        <div className="relative group">
                            <button
                                onClick={fetchReport}
                                disabled={!canConsult}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Users size={14} />
                                Consultar
                            </button>
                            {!canConsult && (
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    Disponible después de las {turnoInfo.minLabel}
                                </div>
                            )}
                        </div>

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
                            title="Limpiar periodo seleccionado"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabla */}
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
                            <tr><td colSpan={8} className="px-6 py-20 text-center animate-pulse text-gray-400 font-medium">Cargando reporte...</td></tr>
                        ) : attendance.length === 0 ? (
                            <tr><td colSpan={8} className="px-6 py-20 text-center text-gray-400 italic">No se encontraron registros para este periodo.</td></tr>
                        ) : (
                            attendance.map((row) => (
                                <tr key={row.id} className="hover:bg-gray-50/30 transition-colors group">
                                    <td className="px-6 py-4 text-center text-xs font-mono font-bold text-gray-500">
                                        {formatDate(row.fecha)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold text-[10px]">
                                                {row.nombreAgente.substring(0, 2).toUpperCase()}
                                            </div>
                                            <span className="text-xs font-bold text-gray-700">{row.nombreAgente}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center text-xs font-medium text-gray-400 italic">{row.horaEntradaProgramada}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="text-xs font-black text-gray-800 bg-gray-100 px-2 py-1 rounded-lg">{row.horaEntradaReal}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="text-xs font-bold text-gray-500">{row.minutosRetardo} m</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {row.estatusAsistencia === 'Ausente' || row.estatusAsistencia === 'Por Ingresar' ? (
                                            <span className="text-xs font-bold text-gray-400 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg shadow-sm">0 LLAM</span>
                                        ) : row.impactoLlamadas > 0 ? (
                                            <span className="text-xs font-black text-rose-500 bg-rose-50 px-2 py-1 rounded-lg">-{row.impactoLlamadas} LLAM</span>
                                        ) : (
                                            <span className="text-xs font-black text-purple-600 bg-purple-50 border border-purple-200 px-2 py-1 rounded-lg shadow-sm">0 LLAM</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">{statusBadge(row)}</td>
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

            {/* Footer resumen */}
            <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-widest px-2">
                <p>Total registros: {attendance.length}</p>
                <div className="flex gap-4">
                    <span className="flex items-center gap-1 text-emerald-500">
                        <UserCheck size={12} /> Puntuales: {attendance.filter(a => a.estatusAsistencia === 'A Tiempo').length}
                    </span>
                    <span className="flex items-center gap-1 text-rose-500">
                        <AlertCircle size={12} /> Retardos: {attendance.filter(a => a.estatusAsistencia === 'Retardo').length}
                    </span>
                    <span className="flex items-center gap-1 text-gray-500">
                        ✗ Ausentes: {attendance.filter(a => a.estatusAsistencia === 'Ausente').length}
                    </span>
                    <span className="flex items-center gap-1 text-amber-500 font-black">
                        <Clock size={12} /> Impacto Total: -{attendance
                            .filter(a => a.horaEntradaProgramada !== '23:00')
                            .reduce((sum, a) => sum + (a.impactoLlamadas || 0), 0)} LLAM
                    </span>
                </div>
            </div>
        </div>
    );
};

export default AttendanceReport;
