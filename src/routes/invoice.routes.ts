import { Router } from 'express'
import {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice
} from '../controllers/invoice.controller'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

// All routes require authentication
router.use(authenticateToken)

// Invoice CRUD routes
router.get('/', getInvoices)
router.post('/', createInvoice)
router.get('/:id', getInvoice)
router.put('/:id', updateInvoice)
router.delete('/:id', deleteInvoice)

export default router