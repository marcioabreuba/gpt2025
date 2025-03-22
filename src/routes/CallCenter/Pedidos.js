import express from 'express';
import VapiService from '../../services/CallCenter/Vapi.js';

const router = express.Router();

// Rota para processar pedidos
router.post('/processar', async (req, res) => {
    try {
        // Imprime o body da requisição
        console.log('Body da requisição:', req.body);
        
        // Chama o serviço Vapi
        await VapiService.processarPedido(req.body);
        
        // Retorna resposta vazia com status 200
        res.status(200).send();
    } catch (error) {
        console.error('Erro ao processar pedido:', error);
        res.status(500).send();
    }
});

export default router;
