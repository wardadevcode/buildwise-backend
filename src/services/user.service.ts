import { prisma } from '../utils/prisma'
import { UserRole, UserStatus } from '@prisma/client'

export class UserService {
  // Update user workload based on assigned projects
  static async updateUserWorkload(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        assignedProjects: {
          where: {
            status: {
              in: ['APPROVED', 'IN_CONSTRUCTION', 'CHANGE_ORDER_PENDING']
            }
          }
        }
      }
    })

    if (!user) return

    const activeProjects = user.assignedProjects.length
    const workload = user.maxProjects > 0 ? Math.round((activeProjects / user.maxProjects) * 100) : 0

    await prisma.user.update({
      where: { id: userId },
      data: {
        currentProjects: activeProjects,
        updatedAt: new Date()
      }
    })

    return { activeProjects, workload }
  }

  // Get team members available for assignment
  static async getAvailableTeamMembers(requiredSkills?: string[]) {
    const where: any = {
      role: {
        in: ['ADMIN', 'TEAM_MEMBER']
      }
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        _count: {
          select: {
            assignedProjects: {
              where: {
                status: {
                  in: ['APPROVED', 'IN_CONSTRUCTION', 'CHANGE_ORDER_PENDING']
                }
              }
            }
          }
        }
      }
    })

    return users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      initials: user.initials,
      color: user.color,
      currentProjects: user._count.assignedProjects,
      maxProjects: user.maxProjects,
      availableCapacity: Math.max(0, user.maxProjects - user._count.assignedProjects),
      workload: user.maxProjects > 0 ? Math.round((user._count.assignedProjects / user.maxProjects) * 100) : 0
    }))
  }

  // Calculate team performance metrics
  static async getTeamPerformance() {
    const users = await prisma.user.findMany({
      where: {
        role: {
          in: ['ADMIN', 'TEAM_MEMBER']
        }
      },
      select: {
        id: true,
        name: true,
        role: true,
        currentProjects: true,
        maxProjects: true,
        onTimeRate: true,
        revenue: true,
        activeTasks: true,
        _count: {
          select: {
            assignedProjects: true,
            primaryProjects: true,
            estimates: true,
            invoices: true
          }
        }
      }
    })

    const stats = {
      totalMembers: users.length,
      averageWorkload: Math.round(users.reduce((sum, u) => sum + (u.maxProjects > 0 ? (u.currentProjects / u.maxProjects) * 100 : 0), 0) / users.length),
      averageOnTimeRate: Math.round(users.reduce((sum, u) => sum + u.onTimeRate, 0) / users.length),
      totalRevenue: users.reduce((sum, u) => sum + u.revenue, 0),
      totalActiveTasks: users.reduce((sum, u) => sum + u.activeTasks, 0),
      membersByRole: users.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      topPerformers: users
        .sort((a, b) => b.onTimeRate - a.onTimeRate)
        .slice(0, 5)
        .map(u => ({ name: u.name, onTimeRate: u.onTimeRate, role: u.role }))
    }

    return stats
  }

  // Update user status and availability
  static async updateUserStatus(userId: string, status: UserStatus) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { status, updatedAt: new Date() },
      select: {
        id: true,
        name: true,
        status: true,
        currentProjects: true,
        maxProjects: true
      }
    })

    return user
  }

  // Bulk update user workloads (useful for cron jobs)
  static async refreshAllUserWorkloads() {
    const users = await prisma.user.findMany({
      select: { id: true }
    })

    const results = await Promise.all(
      users.map(user => this.updateUserWorkload(user.id))
    )

    return results.filter(Boolean)
  }

  // Validate user data
  static validateUserData(data: any) {
    const errors: string[] = []

    if (!data.name?.trim()) errors.push('Name is required')
    if (!data.email?.trim()) errors.push('Email is required')
    if (data.email && !data.email.includes('@')) errors.push('Valid email is required')

    if (data.maxProjects !== undefined && data.maxProjects < 0) {
      errors.push('Max projects cannot be negative')
    }

    return errors
  }
}