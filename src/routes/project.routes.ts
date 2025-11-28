import { Router } from 'express'
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getUserDocuments,
  getTeamMembers,
  updateProjectStatus,
  approveEstimate,
  createChangeOrder
} from '../controllers/project.controller'
import { authenticateToken } from '../middleware/auth.middleware'
import { requireAdmin, requireTeamMember } from '../middleware/role.middleware'
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

// Documents route
router.get('/documents', getUserDocuments)

// Team members route
router.get('/team', getTeamMembers)

// Project status and workflow routes (require team member or admin)
router.patch('/:id/status', requireTeamMember, updateProjectStatus)
router.post('/:id/approve-estimate', approveEstimate) // Customer can approve
router.post('/:id/change-order', requireTeamMember, createChangeOrder)

export default router