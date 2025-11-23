import { Router } from 'express'
import {
  getProjects,
  getProject,
  updateProject,
  getUsers,
  uploadEstimate,
  getDashboardStats
} from '../controllers/admin.controller'
import { authenticateToken } from '../middleware/auth.middleware'
import { requireAdmin } from '../middleware/role.middleware'
import { uploadSingleMemory, handleMulterError } from '../middleware/upload.middleware'

const router = Router()

// All routes require admin authentication
router.use(authenticateToken)
router.use(requireAdmin)

// Project management routes
router.get('/projects', getProjects)
router.get('/projects/:id', getProject)
router.put('/projects/:id', updateProject)

// User management routes
router.get('/users', getUsers)

// Estimate upload routes
router.post('/projects/:id/estimate',
  uploadSingleMemory,
  handleMulterError,
  uploadEstimate
)

// Dashboard routes
router.get('/dashboard', getDashboardStats)

export default router