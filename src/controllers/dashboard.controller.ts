import { Response } from 'express'
import { prisma } from '../utils/prisma'
import { AuthRequest } from '../middleware/auth.middleware'
import logger from '../utils/logger'

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    console.log('Get dashboard stats request')

    // Get project statistics
    const [
      activeProjects,
      completedProjects,
      pendingReviewProjects,
      recentProjects,
      recentActivities
    ] = await Promise.all([
      // Active projects (APPROVED, IN_CONSTRUCTION, CHANGE_ORDER_PENDING)
      prisma.project.count({
        where: {
          status: {
            in: ['APPROVED', 'IN_CONSTRUCTION', 'CHANGE_ORDER_PENDING']
          }
        }
      }),

      // Completed projects
      prisma.project.count({
        where: {
          status: 'COMPLETED'
        }
      }),

      // Pending review projects (ESTIMATE_READY)
      prisma.project.count({
        where: {
          status: 'ESTIMATE_READY'
        }
      }),

      // Recent projects (last 5)
      prisma.project.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          projectName: true,
          title: true,
          status: true,
          createdAt: true,
          customer: {
            select: {
              name: true
            }
          }
        }
      }),

      // Recent activities (last 10 timeline events)
      prisma.timelineEvent.findMany({
        take: 10,
        orderBy: { date: 'desc' },
        select: {
          id: true,
          event: true,
          type: true,
          user: true,
          date: true,
          project: {
            select: {
              id: true,
              title: true,
              projectName: true
            }
          }
        }
      })
    ])

    // Format recent activities for dashboard display
    const formattedActivities = recentActivities.map(activity => ({
      id: activity.id,
      message: `Project "${activity.project.title}" ${activity.event.toLowerCase()}`,
      timestamp: activity.date.toISOString(),
      type: activity.type,
      user: activity.user,
      projectId: activity.project.id
    }))

    // Additional stats
    const totalProjects = await prisma.project.count()
    const totalRevenue = await prisma.invoice.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true }
    })

    const dashboardData = {
      stats: {
        activeProjects,
        completedProjects,
        pendingReviewProjects,
        totalProjects,
        totalRevenue: totalRevenue._sum.amount ? `$${(totalRevenue._sum.amount / 100).toLocaleString()}` : '$0'
      },
      recentProjects: recentProjects.map(project => ({
        id: project.id,
        name: project.projectName,
        title: project.title,
        status: project.status.toLowerCase().replace('_', '-'),
        customerName: project.customer.name,
        createdAt: project.createdAt.toISOString().split('T')[0]
      })),
      recentActivities: formattedActivities
    }

    console.log('Dashboard stats response:', {
      activeProjects,
      completedProjects,
      pendingReviewProjects,
      recentProjectsCount: recentProjects.length,
      recentActivitiesCount: formattedActivities.length
    })

    res.json(dashboardData)
  } catch (error) {
    console.error('Get dashboard stats error:', error)
    logger.error('Get dashboard stats error:', error)
    res.status(500).json({ error: 'Failed to get dashboard statistics' })
  }
}

export const getProjectStatusBreakdown = async (req: AuthRequest, res: Response) => {
  try {
    const statusCounts = await prisma.project.groupBy({
      by: ['status'],
      _count: { status: true },
      orderBy: { _count: { status: 'desc' } }
    })

    const breakdown = statusCounts.map(item => ({
      status: item.status.toLowerCase().replace('_', '-'),
      count: item._count.status,
      label: item.status.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
    }))

    res.json({ statusBreakdown: breakdown })
  } catch (error) {
    console.error('Get project status breakdown error:', error)
    logger.error('Get project status breakdown error:', error)
    res.status(500).json({ error: 'Failed to get project status breakdown' })
  }
}

export const getRevenueStats = async (req: AuthRequest, res: Response) => {
  try {
    const revenueStats = await prisma.invoice.groupBy({
      by: ['status'],
      _sum: { amount: true },
      _count: true
    })

    const stats = {
      totalInvoiced: revenueStats.reduce((sum, stat) => sum + (stat._sum.amount || 0), 0),
      totalPaid: revenueStats.find(stat => stat.status === 'PAID')?._sum.amount || 0,
      totalPending: revenueStats.find(stat => stat.status === 'PENDING')?._sum.amount || 0,
      totalOverdue: revenueStats.find(stat => stat.status === 'OVERDUE')?._sum.amount || 0,
      invoiceCount: revenueStats.reduce((sum, stat) => sum + stat._count, 0)
    }

    res.json({
      revenue: {
        totalInvoiced: `$${(stats.totalInvoiced / 100).toLocaleString()}`,
        totalPaid: `$${(stats.totalPaid / 100).toLocaleString()}`,
        totalPending: `$${(stats.totalPending / 100).toLocaleString()}`,
        totalOverdue: `$${(stats.totalOverdue / 100).toLocaleString()}`,
        invoiceCount: stats.invoiceCount
      }
    })
  } catch (error) {
    console.error('Get revenue stats error:', error)
    logger.error('Get revenue stats error:', error)
    res.status(500).json({ error: 'Failed to get revenue statistics' })
  }
}