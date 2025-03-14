import express from 'express';
import httpStatus from 'http-status';

const router = express.Router();

router.post("/rota", async (req, res) => {
  try {
   
    res.status(httpStatus.OK).send();
    } catch (error) {
  }
});

export default router;