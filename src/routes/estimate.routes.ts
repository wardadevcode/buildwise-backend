import { Router } from 'express'
import {
  getEstimates,
  getEstimate,
  createEstimate,
  updateEstimate,
  deleteEstimate
} from '../controllers/estimate.controller'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

// All routes require authentication
router.use(authenticateToken)

// Estimate CRUD routes
router.get('/', getEstimates)
router.post('/', createEstimate)
router.get('/:id', getEstimate)
router.put('/:id', updateEstimate)
router.delete('/:id', deleteEstimate)

export default router