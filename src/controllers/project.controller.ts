import { Response } from 'express'
import { prisma } from '../utils/prisma'
import logger from '../utils/logger'
import { validateData } from '../utils/validation'
import { AuthRequest } from '../middleware/auth.middleware'

export const getProjects = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const query = req.query
    console.log('Get projects request:', { userId, query })

    // Parse query parameters with defaults
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 10
    const offset = (page - 1) * limit

    // Build where clause
    const where: any = { userId }

    if (query.status) where.status = query.status
    if (query.projectType) where.projectType = query.projectType
    if (query.priority) where.priority = query.priority
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } }
      ]
    }

    console.log('Projects query where clause:', where)

    // Get projects with pagination
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          attachments: true,
          estimate: true,
          _count: {
            select: { attachments: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.project.count({ where })
    ])

    const response = {
      projects,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
    console.log('Get projects response:', response)
    res.json(response)
  } catch (error) {
    console.error('Get projects error:', error)
    logger.error('Get projects error:', error)
    res.status(500).json({ error: 'Failed to get projects' })
  }
}

export const getProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const userId = req.user!.id

    const project = await prisma.project.findFirst({
      where: {
        id,
        userId
      },
      include: {
        attachments: true,
        estimate: true,
        _count: {
          select: { attachments: true }
        }
      }
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    res.json({ project })
  } catch (error) {
    logger.error('Get project error:', error)
    res.status(500).json({ error: 'Failed to get project' })
  }
}

export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const body = req.body as {
      title: string
      description: string
      projectType: string
      priority?: string
      minBudget?: string
      maxBudget?: string
      currency?: string
      deadline?: string
      address?: string
      city?: string
      state?: string
      zipCode?: string
      customerNotes?: string
    }

    // Extract file data from request
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined

    const validatedData = validateData(require('../utils/validation').createProjectSchema, body) as {
      title: string
      description: string
      projectType: string
      priority?: string
      minBudget?: string
      maxBudget?: string
      currency?: string
      deadline?: string
      address?: string
      city?: string
      state?: string
      zipCode?: string
      customerNotes?: string
    }
    console.log('Create project request:', { userId, validatedData, files: files ? Object.keys(files) : 'none' })

    // Convert string budgets to numbers
    const projectData: any = {
      title: validatedData.title,
      description: validatedData.description,
      projectType: validatedData.projectType,
      priority: validatedData.priority || 'MEDIUM',
      userId,
      supabaseUserId: req.user!.supabaseId,
      customerNotes: validatedData.customerNotes,
    }

    // Handle budget fields
    if (validatedData.minBudget) {
      projectData.budgetMin = parseFloat(validatedData.minBudget)
    }
    if (validatedData.maxBudget) {
      projectData.budgetMax = parseFloat(validatedData.maxBudget)
    }
    if (validatedData.currency) {
      projectData.budgetCurrency = validatedData.currency
    }

    // Handle optional fields
    if (validatedData.deadline) {
      projectData.deadline = new Date(validatedData.deadline)
    }
    if (validatedData.address) projectData.address = validatedData.address
    if (validatedData.city) projectData.city = validatedData.city
    if (validatedData.state) projectData.state = validatedData.state
    if (validatedData.zipCode) projectData.zipCode = validatedData.zipCode

    const project = await prisma.project.create({
      data: projectData,
      include: {
        attachments: true,
        estimate: true
      }
    })

    console.log('Project created:', project)
    logger.info(`Project created: ${project.id} by user ${userId}`)
    const response = { project }
    console.log('Create project response:', response)
    res.status(201).json(response)
  } catch (error) {
    console.error('Create project error:', error)
    logger.error('Create project error:', error)
    res.status(500).json({ error: 'Failed to create project' })
  }
}

export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const userId = req.user!.id

    // Check if project exists and belongs to user
    const existingProject = await prisma.project.findFirst({
      where: { id, userId }
    })

    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Prevent updates if project has estimate ready
    if (existingProject.status === 'ESTIMATE_READY') {
      return res.status(400).json({ error: 'Cannot update project with estimate ready' })
    }

    const body = req.body as {
      title?: string
      description?: string
      projectType?: string
      priority?: string
      minBudget?: string
      maxBudget?: string
      currency?: string
      deadline?: string
      address?: string
      city?: string
      state?: string
      zipCode?: string
      customerNotes?: string
    }

    const validatedData = validateData(require('../utils/validation').updateProjectSchema, body) as {
      title?: string
      description?: string
      projectType?: string
      priority?: string
      minBudget?: string
      maxBudget?: string
      currency?: string
      deadline?: string
      address?: string
      city?: string
      state?: string
      zipCode?: string
      customerNotes?: string
    }

    // Convert string budgets to numbers for update
    const updateData: any = {
      lastUpdated: new Date()
    }

    if (validatedData.title) updateData.title = validatedData.title
    if (validatedData.description) updateData.description = validatedData.description
    if (validatedData.projectType) updateData.projectType = validatedData.projectType
    if (validatedData.priority) updateData.priority = validatedData.priority
    if (validatedData.customerNotes !== undefined) updateData.customerNotes = validatedData.customerNotes

    // Handle budget fields
    if (validatedData.minBudget !== undefined) {
      updateData.budgetMin = validatedData.minBudget ? parseFloat(validatedData.minBudget) : null
    }
    if (validatedData.maxBudget !== undefined) {
      updateData.budgetMax = validatedData.maxBudget ? parseFloat(validatedData.maxBudget) : null
    }
    if (validatedData.currency) {
      updateData.budgetCurrency = validatedData.currency
    }

    // Handle optional fields
    if (validatedData.deadline !== undefined) {
      updateData.deadline = validatedData.deadline ? new Date(validatedData.deadline) : null
    }
    if (validatedData.address !== undefined) updateData.address = validatedData.address
    if (validatedData.city !== undefined) updateData.city = validatedData.city
    if (validatedData.state !== undefined) updateData.state = validatedData.state
    if (validatedData.zipCode !== undefined) updateData.zipCode = validatedData.zipCode

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        attachments: true,
        estimate: true
      }
    })

    logger.info(`Project updated: ${project.id}`)
    res.json({ project })
  } catch (error) {
    logger.error('Update project error:', error)
    res.status(500).json({ error: 'Failed to update project' })
  }
}

export const deleteProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const userId = req.user!.id

    // Check if project exists and belongs to user
    const project = await prisma.project.findFirst({
      where: { id, userId }
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Prevent deletion if project has estimate ready
    if (project.status === 'ESTIMATE_READY') {
      return res.status(400).json({ error: 'Cannot delete project with estimate ready' })
    }

    await prisma.project.delete({
      where: { id }
    })

    logger.info(`Project deleted: ${id}`)
    res.json({ message: 'Project deleted successfully' })
  } catch (error) {
    logger.error('Delete project error:', error)
    res.status(500).json({ error: 'Failed to delete project' })
  }
}