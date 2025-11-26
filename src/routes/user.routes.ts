import { Router } from 'express'
import {
  getUsers,
  getUser,
  updateUser,
  getTeamStats
} from '../controllers/user.controller'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

// All routes require authentication
router.use(authenticateToken)

// User routes
router.get('/', getUsers)
router.get('/stats', getTeamStats)
router.get('/:id', getUser)
router.put('/:id', updateUser)

export default router