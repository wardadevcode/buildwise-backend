import { Router } from 'express'
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject
} from '../controllers/project.controller'
import { authenticateToken } from '../middleware/auth.middleware'
import { uploadProjectFiles, handleMulterError } from '../middleware/upload.middleware'

const router = Router()

// All routes require authentication
router.use(authenticateToken)

// Project CRUD routes
router.get('/', getProjects)
router.post('/',
  uploadProjectFiles,
  handleMulterError,
  createProject
)
router.get('/:id', getProject)
router.put('/:id', updateProject)
router.delete('/:id', deleteProject)

export default router