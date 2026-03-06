const WfmService = require('../src/services/WfmService');

describe('WfmService - Zero Sum Logic', () => {
    test('should return balanced when exactly 6 days per agent are allocated', () => {
        const totalAgents = 10; // 60 jornadas totales
        const distribution = {
            Monday: 10,
            Tuesday: 10,
            Wednesday: 10,
            Thursday: 10,
            Friday: 10,
            Saturday: 10,
            Sunday: 0
        };

        const result = WfmService.calculateZeroSumBalance(totalAgents, distribution);
        expect(result.isBalanced).toBe(true);
        expect(result.delta).toBe(0);
    });

    test('should return imbalance when more agents are allocated than capacity', () => {
        const totalAgents = 10; // 60 jornadas
        const distribution = {
            Monday: 11, // Sobrecarga
            Tuesday: 10,
            Wednesday: 10,
            Thursday: 10,
            Friday: 10,
            Saturday: 10,
            Sunday: 0
        };

        const result = WfmService.calculateZeroSumBalance(totalAgents, distribution);
        expect(result.isBalanced).toBe(false);
        expect(result.delta).toBe(-1);
    });

    test('should return imbalance when fewer agents are allocated than capacity', () => {
        const totalAgents = 10; // 60 jornadas
        const distribution = {
            Monday: 5, // Falta asignar
            Tuesday: 10,
            Wednesday: 10,
            Thursday: 10,
            Friday: 10,
            Saturday: 10,
            Sunday: 0
        };

        const result = WfmService.calculateZeroSumBalance(totalAgents, distribution);
        expect(result.isBalanced).toBe(false);
        expect(result.delta).toBe(5);
    });
});
