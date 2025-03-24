import express from 'express';
import VapiService from '../../../services/CallCenter/Vapi.js';
import logger from '../../../../utils/logger.js';

const router = express.Router();

// Rota para buscar produtos
router.post('/', async (req, res) => {
    try {
        // Verifica se o body está presente
        if (!req.body) {
            logger.error('Body da requisição está vazio');
            return res.status(400).json({ error: 'Body da requisição é obrigatório' });
        }

        // Imprime o body da requisição
        logger.info('Body da requisição:', req.body);
        
        // Chama o serviço Vapi
        const resultado = await VapiService.processarBuscaProdutos(req.body);
        
        // Retorna resposta de sucesso
        return res.status(200).json(resultado);
    } catch (error) {
        logger.error('Erro ao buscar produto:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Erro ao buscar produto',
            details: error.message 
        });
    }
});

export default router; 