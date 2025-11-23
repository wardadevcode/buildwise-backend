import { Response } from 'express'
import { prisma } from '../utils/prisma'
import logger from '../utils/logger'
import { safeValidateData } from '../utils/validation'
import { AuthRequest } from '../middleware/auth.middleware'
import supabaseService from '../services/supabase.service'
import path from 'path'

export const getProjects = async (req: AuthRequest, res: Response) => {
  try {
    const query = req.query
    console.log('Admin get projects request:', query)

    // Parse query parameters
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 10
    const offset = (page - 1) * limit

    // Build where clause
    const where: any = {}

    if (query.status) where.status = query.status
    if (query.projectType) where.projectType = query.projectType
    if (query.priority) where.priority = query.priority
    if (query.userId) where.userId = query.userId
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {}
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom as string)
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo as string)
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { user: { name: { contains: query.search, mode: 'insensitive' } } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } }
      ]
    }

    console.log('Admin projects query where clause:', where)

    // Get projects with pagination
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
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
    console.log('Admin get projects response:', response)
    res.json(response)
  } catch (error) {
    console.error('Admin get projects error:', error)
    logger.error('Admin get projects error:', error)
    res.status(500).json({ error: 'Failed to get projects' })
  }
}

export const getProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    console.log('Admin get project request:', { id })

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
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

    console.log('Admin get project response:', project)
    res.json({ project })
  } catch (error) {
    console.error('Admin get project error:', error)
    logger.error('Admin get project error:', error)
    res.status(500).json({ error: 'Failed to get project' })
  }
}

export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    console.log('Admin update project request:', { id, body: req.body })

    // Check if project exists
    const existingProject = await prisma.project.findUnique({
      where: { id }
    })

    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const body = req.body as {
      title?: string
      description?: string
      projectType?: string
      status?: string
      priority?: string
      minBudget?: string
      maxBudget?: string
      currency?: string
      deadline?: string
      address?: string
      city?: string
      state?: string
      zipCode?: string
      adminNotes?: string
      customerNotes?: string
    }

    const validatedData = safeValidateData(require('../utils/validation').updateProjectSchema, body)

    if (!validatedData.success) {
      return res.status(400).json({ error: 'Invalid data', details: validatedData.error })
    }

    const data = validatedData.data as {
      title?: string
      description?: string
      projectType?: string
      status?: string
      priority?: string
      minBudget?: string
      maxBudget?: string
      currency?: string
      deadline?: string
      address?: string
      city?: string
      state?: string
      zipCode?: string
      adminNotes?: string
      customerNotes?: string
    }

    // Convert string budgets to numbers for update
    const updateData: any = {
      lastUpdated: new Date()
    }

    if (data.title) updateData.title = data.title
    if (data.description) updateData.description = data.description
    if (data.projectType) updateData.projectType = data.projectType
    if (data.status) updateData.status = data.status
    if (data.priority) updateData.priority = data.priority
    if (data.customerNotes !== undefined) updateData.customerNotes = data.customerNotes
    if (data.adminNotes !== undefined) updateData.adminNotes = data.adminNotes

    // Handle budget fields
    if (data.minBudget !== undefined) {
      updateData.budgetMin = data.minBudget ? parseFloat(data.minBudget) : null
    }
    if (data.maxBudget !== undefined) {
      updateData.budgetMax = data.maxBudget ? parseFloat(data.maxBudget) : null
    }
    if (data.currency) {
      updateData.budgetCurrency = data.currency
    }

    // Handle optional fields
    if (data.deadline !== undefined) {
      updateData.deadline = data.deadline ? new Date(data.deadline) : null
    }
    if (data.address !== undefined) updateData.address = data.address
    if (data.city !== undefined) updateData.city = data.city
    if (data.state !== undefined) updateData.state = data.state
    if (data.zipCode !== undefined) updateData.zipCode = data.zipCode

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        attachments: true,
        estimate: true
      }
    })

    console.log('Admin update project response:', project)
    logger.info(`Admin updated project: ${project.id}`)
    res.json({ project })
  } catch (error) {
    console.error('Admin update project error:', error)
    logger.error('Admin update project error:', error)
    res.status(500).json({ error: 'Failed to update project' })
  }
}

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const query = req.query
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 10
    const offset = (page - 1) * limit

    const where: any = {}
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } }
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { projects: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.user.count({ where })
    ])

    const response = {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
    console.log('Admin get users response:', response)
    res.json(response)
  } catch (error) {
    console.error('Admin get users error:', error)
    logger.error('Admin get users error:', error)
    res.status(500).json({ error: 'Failed to get users' })
  }
}

export const uploadEstimate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    console.log('Admin upload estimate request:', { id })

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id }
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const file = req.file as Express.Multer.File
    console.log('Estimate file received:', { filename: file.originalname, size: file.size })

    // Generate unique filename
    const fileExt = path.extname(file.originalname)
    const fileName = `estimate_${Date.now()}-${Math.random().toString(36).substring(2)}${fileExt}`
    const filePath = `projects/${project.id}/estimates/${fileName}`

    // Upload to Supabase Storage
    await supabaseService.uploadFile('buildwise-attachments', filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    })

    // Get public URL
    const fileUrl = await supabaseService.getFileUrl('buildwise-attachments', filePath)

    // Create estimate record
    const estimate = await prisma.estimate.create({
      data: {
        projectId: id,
        amount: parseFloat(req.body.amount) || 0,
        currency: req.body.currency || 'USD',
        fileUrl: fileUrl,
        uploadedById: req.user!.id
      }
    })

    // Update project status
    await prisma.project.update({
      where: { id },
      data: {
        status: 'ESTIMATE_READY',
        lastUpdated: new Date()
      }
    })

    console.log('Estimate uploaded:', estimate)
    logger.info(`Estimate uploaded: ${estimate.id} for project ${id}`)
    const response = { estimate }
    console.log('Upload estimate response:', response)
    res.status(201).json(response)
  } catch (error) {
    console.error('Upload estimate error:', error)
    logger.error('Upload estimate error:', error)
    res.status(500).json({ error: 'Failed to upload estimate' })
  }
}

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalProjects,
      projectsByStatus,
      totalUsers,
      recentProjects,
      monthlyStats
    ] = await Promise.all([
      prisma.project.count(),
      prisma.project.groupBy({
        by: ['status'],
        _count: { status: true }
      }),
      prisma.user.count(),
      prisma.project.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { name: true, email: true }
          }
        }
      }),
      // Monthly stats for last 6 months
      prisma.$queryRaw`
        SELECT
          DATE_TRUNC('month', "createdAt") as month,
          COUNT(*) as count
        FROM projects
        WHERE "createdAt" >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY month DESC
      `
    ])

    const response = {
      stats: {
        totalProjects,
        totalUsers,
        projectsByStatus: projectsByStatus.reduce((acc, stat) => {
          acc[stat.status] = stat._count.status
          return acc
        }, {} as Record<string, number>),
        recentProjects,
        monthlyStats
      }
    }
    console.log('Dashboard stats response:', response)
    res.json(response)
  } catch (error) {
    console.error('Dashboard stats error:', error)
    logger.error('Dashboard stats error:', error)
    res.status(500).json({ error: 'Failed to get dashboard stats' })
  }
}