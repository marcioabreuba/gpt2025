import express from 'express';
import VapiService from '../../../services/CallCenter/Vapi.js';

const router = express.Router();

// Rota para processar pedidos
router.post('/buscarpedidos', async (req, res) => {
    try {
        // Verifica se o body está presente
        if (!req.body) {
            console.error('Body da requisição está vazio');
            return res.status(400).json({ error: 'Body da requisição é obrigatório' });
        }

        // Imprime o body da requisição
        console.log('Body da requisição:', req.body);
        
        // Chama o serviço Vapi
        await VapiService.processarPedido(req.body);
        
        // Retorna resposta de sucesso
        return res.status(200).json({ 
            success: true, 
            message: 'Pedido processado com sucesso' 
        });
    } catch (error) {
        console.error('Erro ao processar pedido:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Erro ao processar pedido',
            details: error.message 
        });
    }
});

export default router;
