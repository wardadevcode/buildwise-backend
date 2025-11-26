import { Router } from 'express'
import {
  getActivities,
  createActivity,
  getRecentActivities,
  getActivityStats
} from '../controllers/activity.controller'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

// All routes require authentication
router.use(authenticateToken)

// Activity routes
router.get('/', getActivities)
router.post('/', createActivity)
router.get('/recent', getRecentActivities)
router.get('/stats', getActivityStats)

export default router