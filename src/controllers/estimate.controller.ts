import { Response } from 'express'
import { prisma } from '../utils/prisma'
import logger from '../utils/logger'
import { AuthRequest } from '../middleware/auth.middleware'
import { TimelineEventType } from '@prisma/client'

// Helper function to create timeline events
const createTimelineEvent = async (projectId: string, event: string, type: TimelineEventType, user: string) => {
  return await prisma.timelineEvent.create({
    data: {
      projectId,
      date: new Date(),
      event,
      type,
      user
    }
  })
}

export const getEstimates = async (req: AuthRequest, res: Response) => {
  try {
    const query = req.query
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 10
    const offset = (page - 1) * limit

    const where: any = {}
    if (query.projectId) where.projectId = query.projectId

    const [estimates, total] = await Promise.all([
      prisma.estimate.findMany({
        where,
        include: {
          project: {
            select: { id: true, title: true, projectName: true }
          },
          createdBy: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.estimate.count({ where })
    ])

    const response = {
      estimates: estimates.map(estimate => ({
        id: estimate.id,
        total: `$${(estimate.total / 100).toFixed(2)}`,
        lineItems: estimate.lineItems,
        pdfUrl: estimate.pdfUrl,
        changeOrderNumber: estimate.changeOrderNumber,
        createdAt: estimate.createdAt.toISOString(),
        updatedAt: estimate.updatedAt.toISOString(),
        project: estimate.project,
        createdBy: estimate.createdBy
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }

    console.log('Get estimates response:', { count: estimates.length })
    res.json(response)
  } catch (error) {
    console.error('Get estimates error:', error)
    logger.error('Get estimates error:', error)
    res.status(500).json({ error: 'Failed to get estimates' })
  }
}

export const getEstimate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const estimate = await prisma.estimate.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, title: true, projectName: true, budgetMin: true, budgetMax: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' })
    }

    const response = {
      id: estimate.id,
      total: `$${(estimate.total / 100).toFixed(2)}`,
      lineItems: estimate.lineItems,
      pdfUrl: estimate.pdfUrl,
      changeOrderNumber: estimate.changeOrderNumber,
      createdAt: estimate.createdAt.toISOString(),
      updatedAt: estimate.updatedAt.toISOString(),
      project: {
        ...estimate.project,
        budgetMin: `$${(estimate.project.budgetMin / 100).toFixed(2)}`,
        budgetMax: `$${(estimate.project.budgetMax / 100).toFixed(2)}`
      },
      createdBy: estimate.createdBy
    }

    res.json({ estimate: response })
  } catch (error) {
    console.error('Get estimate error:', error)
    logger.error('Get estimate error:', error)
    res.status(500).json({ error: 'Failed to get estimate' })
  }
}

export const createEstimate = async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as {
      projectId: string
      total: number
      lineItems: any[]
      pdfUrl?: string
      changeOrderNumber?: number
    }

    console.log('Create estimate request:', { projectId: body.projectId, total: body.total })

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: body.projectId }
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const estimate = await prisma.estimate.create({
      data: {
        projectId: body.projectId,
        total: Math.round(body.total * 100), // Convert to cents
        lineItems: body.lineItems,
        pdfUrl: body.pdfUrl,
        changeOrderNumber: body.changeOrderNumber,
        createdById: req.user!.id
      },
      include: {
        project: {
          select: { id: true, title: true, projectName: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    // Update project status to ESTIMATE_READY
    await prisma.project.update({
      where: { id: body.projectId },
      data: { status: 'ESTIMATE_READY' }
    })

    // Create timeline event
    await createTimelineEvent(
      body.projectId,
      `Estimate created: $${(body.total).toFixed(2)}`,
      TimelineEventType.ESTIMATE,
      req.user!.name || 'Estimator'
    )

    const response = {
      id: estimate.id,
      total: `$${(estimate.total / 100).toFixed(2)}`,
      lineItems: estimate.lineItems,
      pdfUrl: estimate.pdfUrl,
      changeOrderNumber: estimate.changeOrderNumber,
      createdAt: estimate.createdAt.toISOString(),
      updatedAt: estimate.updatedAt.toISOString(),
      project: estimate.project,
      createdBy: estimate.createdBy
    }

    logger.info(`Estimate created: ${estimate.id} for project ${body.projectId}`)
    res.status(201).json({ estimate: response })
  } catch (error) {
    console.error('Create estimate error:', error)
    logger.error('Create estimate error:', error)
    res.status(500).json({ error: 'Failed to create estimate' })
  }
}

export const updateEstimate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const body = req.body as {
      total?: number
      lineItems?: any[]
      pdfUrl?: string
      changeOrderNumber?: number
    }

    const updateData: any = {
      updatedAt: new Date()
    }

    if (body.total !== undefined) updateData.total = Math.round(body.total * 100)
    if (body.lineItems !== undefined) updateData.lineItems = body.lineItems
    if (body.pdfUrl !== undefined) updateData.pdfUrl = body.pdfUrl
    if (body.changeOrderNumber !== undefined) updateData.changeOrderNumber = body.changeOrderNumber

    const estimate = await prisma.estimate.update({
      where: { id },
      data: updateData,
      include: {
        project: {
          select: { id: true, title: true, projectName: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    const response = {
      id: estimate.id,
      total: `$${(estimate.total / 100).toFixed(2)}`,
      lineItems: estimate.lineItems,
      pdfUrl: estimate.pdfUrl,
      changeOrderNumber: estimate.changeOrderNumber,
      createdAt: estimate.createdAt.toISOString(),
      updatedAt: estimate.updatedAt.toISOString(),
      project: estimate.project,
      createdBy: estimate.createdBy
    }

    logger.info(`Estimate updated: ${estimate.id}`)
    res.json({ estimate: response })
  } catch (error) {
    console.error('Update estimate error:', error)
    logger.error('Update estimate error:', error)
    res.status(500).json({ error: 'Failed to update estimate' })
  }
}

export const deleteEstimate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const estimate = await prisma.estimate.findUnique({
      where: { id },
      select: { projectId: true }
    })

    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' })
    }

    await prisma.estimate.delete({
      where: { id }
    })

    logger.info(`Estimate deleted: ${id}`)
    res.json({ message: 'Estimate deleted successfully' })
  } catch (error) {
    console.error('Delete estimate error:', error)
    logger.error('Delete estimate error:', error)
    res.status(500).json({ error: 'Failed to delete estimate' })
  }
}