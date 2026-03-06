import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Settings, Calculator, History, BarChart3, Palmtree } from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    const baseClass = "flex items-center px-3 py-2 rounded-xl transition-all font-medium text-sm ";
    const normalClass = baseClass + "text-gray-500 hover:bg-gray-100 hover:text-indigo-600";
    const activeClass = baseClass + "bg-indigo-50 text-indigo-700 font-bold shadow-sm ring-1 ring-indigo-100";

    // Live es especial con su diseño
    const liveNormalClass = baseClass + "text-rose-600 hover:bg-rose-50";
    const liveActiveClass = baseClass + "bg-rose-100 text-rose-700 font-bold shadow-sm ring-1 ring-rose-200";

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white shadow-sm border-b border-gray-200 z-10 sticky top-0">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight">Capacity WFM</span>
                        </div>
                        <nav className="flex space-x-2">
                            <Link to="/plan" className={isActive('/plan') ? activeClass : normalClass}>
                                <LayoutDashboard className="w-4 h-4 mr-2" />
                                Plan
                            </Link>
                            <Link to="/live" className={isActive('/live') ? liveActiveClass : liveNormalClass}>
                                <div className={`w-2 h-2 rounded-full mr-2 ${isActive('/live') ? 'bg-rose-600 animate-pulse' : 'bg-rose-400'}`} />
                                Live
                            </Link>
                            <Link to="/setup" className={isActive('/setup') ? activeClass : normalClass}>
                                <Settings className="w-4 h-4 mr-2" />
                                Setup
                            </Link>
                            <Link to="/vacations" className={isActive('/vacations') ? activeClass : normalClass}>
                                <Palmtree className="w-4 h-4 mr-2" />
                                Vacaciones
                            </Link>
                            <Link to="/simulator" className={isActive('/simulator') ? activeClass : normalClass}>
                                <Calculator className="w-4 h-4 mr-2" />
                                Simulador
                            </Link>
                            <Link to="/reports" className={isActive('/reports') ? activeClass : normalClass}>
                                <BarChart3 className="w-4 h-4 mr-2" />
                                Reportes
                            </Link>
                            <Link to="/audit" className={isActive('/audit') ? activeClass : normalClass}>
                                <History className="w-4 h-4 mr-2" />
                                Auditoría
                            </Link>
                        </nav>
                    </div>
                </div>
            </header>
            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
                {children}
            </main>
            <footer className="bg-white border-t border-gray-200 py-4">
                <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
                    &copy; 2026 Capacity WFM - Internal Tool
                </div>
            </footer>
        </div>
    );
};

export default Layout;
