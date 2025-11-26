import { Response } from 'express'
import { prisma } from '../utils/prisma'
import logger from '../utils/logger'
import { AuthRequest } from '../middleware/auth.middleware'
import { UserRole, UserStatus } from '@prisma/client'

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const query = req.query
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 20
    const offset = (page - 1) * limit

    const where: any = {}
    if (query.role) where.role = query.role
    if (query.status) where.status = query.status

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          _count: {
            select: {
              assignedProjects: true,
              primaryProjects: true
            }
          }
        },
        orderBy: { name: 'asc' },
        skip: offset,
        take: limit
      }),
      prisma.user.count({ where })
    ])

    const response = {
      users: users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        initials: user.initials,
        color: user.color,
        currentProjects: user.currentProjects,
        maxProjects: user.maxProjects,
        status: user.status,
        activeTasks: user.activeTasks,
        onTimeRate: user.onTimeRate,
        revenue: `$${(user.revenue / 100).toFixed(2)}`,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        assignedProjectsCount: user._count.assignedProjects,
        primaryProjectsCount: user._count.primaryProjects,
        workload: user.maxProjects > 0 ? Math.round((user.currentProjects / user.maxProjects) * 100) : 0
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }

    console.log('Get users response:', { count: users.length })
    res.json(response)
  } catch (error) {
    console.error('Get users error:', error)
    logger.error('Get users error:', error)
    res.status(500).json({ error: 'Failed to get users' })
  }
}

export const getUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        assignedProjects: {
          select: {
            id: true,
            title: true,
            projectName: true,
            status: true,
            priority: true
          }
        },
        primaryProjects: {
          select: {
            id: true,
            title: true,
            projectName: true,
            status: true,
            priority: true
          }
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        estimates: {
          select: {
            id: true,
            total: true,
            createdAt: true,
            project: {
              select: { title: true, projectName: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        invoices: {
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        _count: {
          select: {
            assignedProjects: true,
            primaryProjects: true,
            activities: true,
            estimates: true,
            invoices: true
          }
        }
      }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const response = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      initials: user.initials,
      color: user.color,
      currentProjects: user.currentProjects,
      maxProjects: user.maxProjects,
      status: user.status,
      activeTasks: user.activeTasks,
      onTimeRate: user.onTimeRate,
      revenue: `$${(user.revenue / 100).toFixed(2)}`,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      assignedProjects: user.assignedProjects,
      primaryProjects: user.primaryProjects,
      recentActivities: user.activities.map(activity => ({
        id: activity.id,
        time: activity.time,
        user: activity.user,
        action: activity.action,
        userColor: activity.userColor,
        createdAt: activity.createdAt.toISOString()
      })),
      recentEstimates: user.estimates.map(estimate => ({
        id: estimate.id,
        total: `$${(estimate.total / 100).toFixed(2)}`,
        createdAt: estimate.createdAt.toISOString(),
        project: estimate.project
      })),
      recentInvoices: user.invoices.map(invoice => ({
        id: invoice.id,
        amount: `$${(invoice.amount / 100).toFixed(2)}`,
        status: invoice.status,
        createdAt: invoice.createdAt.toISOString()
      })),
      stats: {
        totalProjects: user._count.assignedProjects,
        primaryProjects: user._count.primaryProjects,
        totalActivities: user._count.activities,
        totalEstimates: user._count.estimates,
        totalInvoices: user._count.invoices,
        workload: user.maxProjects > 0 ? Math.round((user.currentProjects / user.maxProjects) * 100) : 0
      }
    }

    res.json({ user: response })
  } catch (error) {
    console.error('Get user error:', error)
    logger.error('Get user error:', error)
    res.status(500).json({ error: 'Failed to get user' })
  }
}

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const body = req.body as {
      name?: string
      role?: string
      status?: string
      maxProjects?: number
      currentProjects?: number
      activeTasks?: number
      onTimeRate?: number
      revenue?: number
    }

    const updateData: any = {
      updatedAt: new Date()
    }

    if (body.name !== undefined) updateData.name = body.name
    if (body.role) updateData.role = body.role
    if (body.status) updateData.status = body.status
    if (body.maxProjects !== undefined) updateData.maxProjects = body.maxProjects
    if (body.currentProjects !== undefined) updateData.currentProjects = body.currentProjects
    if (body.activeTasks !== undefined) updateData.activeTasks = body.activeTasks
    if (body.onTimeRate !== undefined) updateData.onTimeRate = body.onTimeRate
    if (body.revenue !== undefined) updateData.revenue = Math.round(body.revenue * 100)

    // Update initials if name changed
    if (body.name) {
      updateData.initials = body.name.split(' ').map(n => n[0]).join('').toUpperCase()
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            assignedProjects: true,
            primaryProjects: true
          }
        }
      }
    })

    const response = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      initials: user.initials,
      color: user.color,
      currentProjects: user.currentProjects,
      maxProjects: user.maxProjects,
      status: user.status,
      activeTasks: user.activeTasks,
      onTimeRate: user.onTimeRate,
      revenue: `$${(user.revenue / 100).toFixed(2)}`,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      assignedProjectsCount: user._count.assignedProjects,
      primaryProjectsCount: user._count.primaryProjects,
      workload: user.maxProjects > 0 ? Math.round((user.currentProjects / user.maxProjects) * 100) : 0
    }

    logger.info(`User updated: ${user.id}`)
    res.json({ user: response })
  } catch (error) {
    console.error('Update user error:', error)
    logger.error('Update user error:', error)
    res.status(500).json({ error: 'Failed to update user' })
  }
}

export const getTeamStats = async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: {
          in: ['ADMIN', 'TEAM_LEAD', 'SENIOR_SPECIALIST', 'SPECIALIST', 'PROJECT_COORDINATOR', 'FIELD_MANAGER', 'DOCUMENT_SPECIALIST', 'QUALITY_INSPECTOR', 'SENIOR_ESTIMATOR']
        }
      },
      select: {
        id: true,
        name: true,
        role: true,
        status: true,
        currentProjects: true,
        maxProjects: true,
        activeTasks: true,
        onTimeRate: true,
        revenue: true,
        _count: {
          select: {
            assignedProjects: true,
            primaryProjects: true
          }
        }
      }
    })

    const stats = {
      totalMembers: users.length,
      availableMembers: users.filter(u => u.status === UserStatus.AVAILABLE).length,
      inCallMembers: users.filter(u => u.status === UserStatus.IN_CALL).length,
      offlineMembers: users.filter(u => u.status === UserStatus.OFFLINE).length,
      totalProjects: users.reduce((sum, u) => sum + u._count.assignedProjects, 0),
      totalActiveTasks: users.reduce((sum, u) => sum + u.activeTasks, 0),
      averageOnTimeRate: Math.round(users.reduce((sum, u) => sum + u.onTimeRate, 0) / users.length),
      totalRevenue: `$${(users.reduce((sum, u) => sum + u.revenue, 0) / 100).toFixed(2)}`,
      averageWorkload: Math.round(users.reduce((sum, u) => sum + (u.maxProjects > 0 ? (u.currentProjects / u.maxProjects) * 100 : 0), 0) / users.length),
      membersByRole: users.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }

    res.json({ stats })
  } catch (error) {
    console.error('Get team stats error:', error)
    logger.error('Get team stats error:', error)
    res.status(500).json({ error: 'Failed to get team stats' })
  }
}