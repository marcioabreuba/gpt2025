import express from 'express';
import httpStatus from 'http-status';
import { updateQueueTraining } from '../../services/true.js';

const router = express.Router();

// Rota para buscar todos os produtos com paginação
router.post('/true', async (req, res, next) => {
  try {
    await updateQueueTraining();
    res.status(httpStatus.OK).send({ message: 'Status atualizado com sucesso' });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ error: 'Erro ao buscar todos os produtos' });
  }
});

export default router;