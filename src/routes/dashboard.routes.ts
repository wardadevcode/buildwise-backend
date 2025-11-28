import { Router } from 'express'
import {
  getDashboardStats,
  getProjectStatusBreakdown,
  getRevenueStats
} from '../controllers/dashboard.controller'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

// All dashboard routes require authentication
router.use(authenticateToken)

// Main dashboard statistics
router.get('/stats', getDashboardStats)

// Additional dashboard endpoints
router.get('/projects/status-breakdown', getProjectStatusBreakdown)
router.get('/revenue', getRevenueStats)

export default router