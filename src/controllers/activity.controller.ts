import { Response } from 'express'
import { prisma } from '../utils/prisma'
import logger from '../utils/logger'
import { AuthRequest } from '../middleware/auth.middleware'

export const getActivities = async (req: AuthRequest, res: Response) => {
  try {
    const query = req.query
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 50
    const offset = (page - 1) * limit

    const where: any = {}
    if (query.userId) where.userId = query.userId

    // Get recent activities
    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        include: {
          userAccount: {
            select: { id: true, name: true, color: true, initials: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.activity.count({ where })
    ])

    const response = {
      activities: activities.map(activity => ({
        id: activity.id,
        time: activity.time,
        user: activity.userAccount.name,
        action: activity.action,
        userColor: activity.userAccount.color,
        userInitials: activity.userAccount.initials,
        createdAt: activity.createdAt.toISOString()
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }

    console.log('Get activities response:', { count: activities.length })
    res.json(response)
  } catch (error) {
    console.error('Get activities error:', error)
    logger.error('Get activities error:', error)
    res.status(500).json({ error: 'Failed to get activities' })
  }
}

export const createActivity = async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as {
      action: string
      time?: string
    }

    const activity = await prisma.activity.create({
      data: {
        userId: req.user!.id,
        time: body.time || new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }),
        user: req.user!.name,
        action: body.action,
        userColor: req.user!.color || '#3B82F6'
      },
      include: {
        userAccount: {
          select: { id: true, name: true, color: true, initials: true }
        }
      }
    })

    const response = {
      id: activity.id,
      time: activity.time,
      user: activity.userAccount.name,
      action: activity.action,
      userColor: activity.userAccount.color,
      userInitials: activity.userAccount.initials,
      createdAt: activity.createdAt.toISOString()
    }

    logger.info(`Activity created: ${activity.id} by ${req.user!.name}`)
    res.status(201).json({ activity: response })
  } catch (error) {
    console.error('Create activity error:', error)
    logger.error('Create activity error:', error)
    res.status(500).json({ error: 'Failed to create activity' })
  }
}

export const getRecentActivities = async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10

    const activities = await prisma.activity.findMany({
      include: {
        userAccount: {
          select: { id: true, name: true, color: true, initials: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    const response = activities.map(activity => ({
      id: activity.id,
      time: activity.time,
      user: activity.userAccount.name,
      action: activity.action,
      userColor: activity.userAccount.color,
      userInitials: activity.userAccount.initials,
      createdAt: activity.createdAt.toISOString()
    }))

    res.json({ activities: response })
  } catch (error) {
    console.error('Get recent activities error:', error)
    logger.error('Get recent activities error:', error)
    res.status(500).json({ error: 'Failed to get recent activities' })
  }
}

export const getActivityStats = async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [
      totalActivities,
      todayActivities,
      activeUsers
    ] = await Promise.all([
      prisma.activity.count(),
      prisma.activity.count({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow
          }
        }
      }),
      prisma.activity.findMany({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow
          }
        },
        select: {
          userId: true,
          userAccount: {
            select: { name: true }
          }
        },
        distinct: ['userId']
      })
    ])

    const stats = {
      totalActivities,
      todayActivities,
      activeUsersCount: activeUsers.length,
      activeUsers: activeUsers.map(a => a.userAccount.name)
    }

    res.json({ stats })
  } catch (error) {
    console.error('Get activity stats error:', error)
    logger.error('Get activity stats error:', error)
    res.status(500).json({ error: 'Failed to get activity stats' })
  }
}