const sequelize = require('./database');
const Agente = require('./models/Agente');
const Asistencia = require('./models/Asistencia');
const Configuracion = require('./models/Configuracion');
const mysql = require('mysql2/promise');
const axios = require('axios');

async function verify() {
    try {
        console.log('--- INICIANDO VERIFICACIÓN SISTEMA ---');
        const config = await Configuracion.findOne();
        const tmo = config?.tmoMinutos || 11.5;
        const tolerance = config?.toleranciaRetardoMinutos || 5;
        const today = new Date().toISOString().split('T')[0];
        
        const allAgents = await Agente.findAll();
        console.log('Agentes locales encontrados:', allAgents.length);
        console.log('Ejemplo Agente Local:', JSON.stringify(allAgents[0], null, 2));

        let prodConn;
        try {
            prodConn = await mysql.createConnection({
                host: '192.168.50.33',
                user: 'cyberhub',
                password: 'masterC1berHUb#',
                database: 'cyber_ideas_hub'
            });

            const [rows] = await prodConn.execute('SELECT nombre_agente, tiempo_logueado FROM reporteProductividad ORDER BY id DESC LIMIT 50');
            console.log('Datos de productividad obtenidos:', rows.length);
            console.log('Ejemplo Registro Central:', JSON.stringify(rows[0], null, 2));

            const normalize = (str) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

            for (const row of rows) {
                const agent = allAgents.find(a => {
                    const localId = (a.numero_agente || "").toString().trim();
                    const centralId = (row.numero_agente || "").toString().trim();
                    
                    // Match por Número de Agente (Exacto)
                    return localId && centralId && localId === centralId;
                });

                if (agent) {
                    console.log('✅ Matched:', agent.nombre, 'con', row.nombre_agente);
                    if (row.tiempo_logueado && row.tiempo_logueado !== '00:00:00') {
                        const [dH, dM, dS] = row.tiempo_logueado.split(':').map(Number);
                        const loginDate = new Date();
                        loginDate.setHours(loginDate.getHours() - dH);
                        loginDate.setMinutes(loginDate.getMinutes() - dM);
                        
                        const loginTimeStr = loginDate.toLocaleTimeString('es-MX', { hour12: false, hour: '2-digit', minute: '2-digit' });
                        const [sH, sM] = agent.horaEntradaProgramada.split(':').map(Number);
                        const [nH, nM] = loginTimeStr.split(':').map(Number);
                        
                        const delayMinsTotal = (nH * 60 + nM) - (sH * 60 + sM);
                        const delayMin = Math.max(0, delayMinsTotal);
                        const impact = Math.round(delayMin / tmo);

                        console.log('   Entrada Prog: ' + agent.horaEntradaProgramada + ' | Real: ' + loginTimeStr + ' | Minutos: ' + delayMin + ' | Impacto: ' + impact);

                        await Asistencia.create({
                            nombreAgente: agent.nombre,
                            fecha: today,
                            horaEntradaProgramada: agent.horaEntradaProgramada,
                            horaEntradaReal: loginTimeStr,
                            minutosRetardo: delayMin,
                            impactoLlamadas: impact,
                            estatusAsistencia: delayMinsTotal > tolerance ? 'Retardo' : 'A Tiempo',
                            campanaId: agent.campanaId
                        });
                    }
                }
            }
        } catch(err) {
            console.error('Error en Cruce:', err.message);
        } finally {
            if (prodConn) await prodConn.end();
        }

        console.log('--- VERIFICACIÓN COMPLETADA ---');
        process.exit(0);
    } catch(error) {
        console.error(error);
        process.exit(1);
    }
}

verify();
