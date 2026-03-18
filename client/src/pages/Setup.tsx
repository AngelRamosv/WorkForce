import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { Settings, Users, Save, Sliders, Info, HardDrive, Upload } from 'lucide-react';

const Setup: React.FC = () => {
    const [pools, setPools] = useState<any[]>([]);
    const [config, setConfig] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [poolsRes, configRes] = await Promise.all([
                api.get('/pools'),
                api.get('/config')
            ]);
            setPools(poolsRes.data);
            setConfig(configRes.data);
        } catch (error) {
            console.error('Error fetching data', error);
        }
    };

    const handleConfigChange = (field: string, value: any) => {
        setConfig((prev: any) => ({ ...prev, [field]: value }));
    };

    const handlePoolChange = (id: string, field: string, value: any) => {
        setPools(prev => prev.map(p => p.id === id ? { ...prev.find(x => x.id === id), [field]: value } : p));
    };

    const saveConfig = async () => {
        setIsSaving(true);
        try {
            // Guardar cambios en los pools
            await Promise.all(pools.map(pool =>
                api.put(`/pools/${pool.id}`, { totalAgentes: pool.totalAgentes })
            ));

            // Guardar configuración global
            await api.put('/config', config);

            alert('Configuración y staff real actualizados correctamente.');
        } catch (error) {
            alert('Error al guardar configuración');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            try {
                const res = await api.post('/staff/sync', {
                    fileBase64: base64,
                    fileName: file.name
                });
                alert(`Staff sincronizado con éxito desde ${res.data.fileName}.\nRetención: ${res.data.retencionCount}\nMóvil: ${res.data.movilCount}`);
                fetchData();
            } catch (error: any) {
                alert(error.response?.data?.error || 'Error al procesar el archivo');
            } finally {
                setIsUploading(false);
            }
        };
        reader.readAsDataURL(file);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                        <Settings className="text-indigo-600 animate-spin-slow" />
                        Configuración Spec 1.0
                    </h1>
                    <p className="text-gray-500 mt-2">Gestiona pools de agentes y parámetros matemáticos de capacidad.</p>
                </div>
                <div className="flex gap-4">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".xlsx, .xls"
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="bg-emerald-50 text-emerald-700 px-4 py-2.5 rounded-xl font-bold hover:bg-emerald-100 transition border border-emerald-100 flex items-center gap-2 active:scale-95 disabled:opacity-50"
                    >
                        <Upload size={18} />
                        {isUploading ? 'Procesando archivo...' : 'Sincronizar archivo de Staff'}
                    </button>
                    <button
                        onClick={saveConfig}
                        disabled={isSaving}
                        className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition flex items-center gap-2 active:scale-95"
                    >
                        <Save size={18} />
                        {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Pools de Agentes */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6">
                        <Users className="text-indigo-500" />
                        Staff Real (Contratado)
                    </h2>
                    <div className="space-y-4">
                        {pools.map(pool => (
                            <div key={pool.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center gap-4">
                                <div className="flex-1">
                                    <p className="font-bold text-gray-900">{pool.nombre}</p>
                                    <p className="text-xs text-gray-500 uppercase font-black">Headcount:</p>
                                </div>
                                <input
                                    type="number"
                                    className="w-24 bg-white border border-gray-200 rounded-lg p-2 text-center font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                                    value={pool.totalAgentes}
                                    onChange={(e) => handlePoolChange(pool.id, 'totalAgentes', parseInt(e.target.value) || 0)}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Parámetros de Capacidad */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6">
                        <Sliders className="text-indigo-500" />
                        Ecuación de Capacidad
                    </h2>
                    {config && (
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-600 uppercase">Shrinkage (%)</label>
                                <input
                                    type="number"
                                    className="w-full bg-gray-50 border-gray-100 rounded-lg p-3 font-mono focus:ring-2 focus:ring-indigo-500"
                                    value={config.shrinkage * 100}
                                    onChange={(e) => handleConfigChange('shrinkage', parseFloat(e.target.value) / 100)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-600 uppercase">Ocupación (%)</label>
                                <input
                                    type="number"
                                    className="w-full bg-gray-50 border-gray-100 rounded-lg p-3 font-mono focus:ring-2 focus:ring-indigo-500"
                                    value={config.ocupacion * 100}
                                    onChange={(e) => handleConfigChange('ocupacion', parseFloat(e.target.value) / 100)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-600 uppercase">AHT (Minutos)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    className="w-full bg-gray-50 border-gray-100 rounded-lg p-3 font-mono focus:ring-2 focus:ring-indigo-500"
                                    value={config.tmoMinutos}
                                    onChange={(e) => handleConfigChange('tmoMinutos', parseFloat(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-600 uppercase">Jornada (Horas)</label>
                                <input
                                    type="number"
                                    className="w-full bg-gray-50 border-gray-100 rounded-lg p-3 font-mono focus:ring-2 focus:ring-indigo-500"
                                    value={config.horasTurno}
                                    onChange={(e) => handleConfigChange('horasTurno', parseFloat(e.target.value))}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 flex items-start gap-4">
                <Info className="text-indigo-600 mt-1" />
                <div className="text-sm text-indigo-900">
                    <p className="font-bold">Principio de Suma Cero:</p>
                    <p className="mt-1 opacity-80">
                        La ecuación oficial para esta versión es: <code className="bg-white/50 px-1 rounded">((Gente × {config?.horasTurno}h) - Shrinkage) × Ocupación / AHT</code>.
                        Cualquier ajuste aquí impactará el semáforo de cumplimiento en el simulador.
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2 text-gray-400 text-xs justify-center">
                <HardDrive size={12} />
                <span>Base de Datos: SQLite (Local)</span>
                <span>•</span>
                <span>Último sync: {new Date().toLocaleTimeString()}</span>
            </div>
        </div>
    );
};

export default Setup;
