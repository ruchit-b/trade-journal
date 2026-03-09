import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createTrade,
  createTradeValidations,
  getTrades,
  getTradesValidations,
  getTradeById,
  getTradeByIdValidations,
  updateTrade,
  updateTradeValidations,
  deleteTrade,
  deleteTradeValidations,
  getDashboardStats,
} from '../controllers/trades.controller';

const router = Router();

router.use(authMiddleware);

router.post('/', validate(createTradeValidations), createTrade);
router.get('/stats', getDashboardStats);
router.get('/', validate(getTradesValidations), getTrades);
router.get('/:id', validate(getTradeByIdValidations), getTradeById);
router.put('/:id', validate(updateTradeValidations), updateTrade);
router.delete('/:id', validate(deleteTradeValidations), deleteTrade);

export default router;
