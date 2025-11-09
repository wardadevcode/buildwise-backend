import { Router } from 'express'
import {
  register,
  login,
  logout,
  getMe,
  callback
} from '../controllers/auth.controller'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

// Public routes
router.post('/register', register)
router.post('/login', login)
router.post('/logout', logout)
router.get('/callback', callback)

// Protected routes
router.get('/me', authenticateToken, getMe)

export default router