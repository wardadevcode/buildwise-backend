import { prisma } from '../utils/prisma'
import { ProjectStatus, TimelineEventType } from '@prisma/client'

export class ProjectService {
  // Create timeline event helper
  static async createTimelineEvent(projectId: string, event: string, type: TimelineEventType, user: string) {
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

  // Update project status with timeline event
  static async updateProjectStatus(projectId: string, status: ProjectStatus, user: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true }
    })

    if (!project) {
      throw new Error('Project not found')
    }

    if (project.status === status) {
      return project // No change needed
    }

    // Update project status
    await prisma.project.update({
      where: { id: projectId },
      data: { status, updatedAt: new Date() }
    })

    // Create timeline event
    await this.createTimelineEvent(
      projectId,
      `Status changed to ${status.toLowerCase().replace('_', '-')}`,
      TimelineEventType.APPROVED, // Generic event type
      user
    )

    return { previousStatus: project.status, newStatus: status }
  }

  // Assign team members to project
  static async assignTeamMembers(projectId: string, assigneeIds: string[], user: string) {
    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, title: true }
    })

    if (!project) {
      throw new Error('Project not found')
    }

    // Verify all assignees exist
    const assignees = await prisma.user.findMany({
      where: { id: { in: assigneeIds } },
      select: { id: true, name: true }
    })

    if (assignees.length !== assigneeIds.length) {
      throw new Error('One or more assignees not found')
    }

    // Update project assignees
    await prisma.project.update({
      where: { id: projectId },
      data: {
        assignees: {
          set: assigneeIds.map(id => ({ id }))
        },
        updatedAt: new Date()
      }
    })

    // Create timeline event
    const assigneeNames = assignees.map(a => a.name).join(', ')
    await this.createTimelineEvent(
      projectId,
      `Assigned team members: ${assigneeNames}`,
      TimelineEventType.ASSIGNED,
      user
    )

    return { projectId, assignees }
  }

  // Calculate project progress based on timeline events
  static async calculateProgress(projectId: string) {
    const events = await prisma.timelineEvent.findMany({
      where: { projectId },
      orderBy: { date: 'asc' }
    })

    // Simple progress calculation based on status
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true, startDate: true, deadline: true }
    })

    if (!project) return 0

    const statusProgress: Record<ProjectStatus, number> = {
      PENDING: 10,
      ESTIMATE_READY: 25,
      APPROVED: 40,
      IN_CONSTRUCTION: 70,
      CHANGE_ORDER_PENDING: 60,
      COMPLETED: 100
    }

    return statusProgress[project.status] || 0
  }

  // Get project statistics
  static async getProjectStats() {
    const [
      totalProjects,
      projectsByStatus,
      recentProjects
    ] = await Promise.all([
      prisma.project.count(),
      prisma.project.groupBy({
        by: ['status'],
        _count: { status: true }
      }),
      prisma.project.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          customer: {
            select: { name: true }
          }
        }
      })
    ])

    return {
      totalProjects,
      projectsByStatus: projectsByStatus.reduce((acc, stat) => {
        acc[stat.status] = stat._count.status
        return acc
      }, {} as Record<string, number>),
      recentProjects
    }
  }

  // Validate project data
  static validateProjectData(data: any) {
    const errors: string[] = []

    if (!data.title?.trim()) errors.push('Title is required')
    if (!data.description?.trim()) errors.push('Description is required')
    if (!data.customerName?.trim()) errors.push('Customer name is required')
    if (!data.customerEmail?.trim()) errors.push('Customer email is required')
    if (!data.customerPhone?.trim()) errors.push('Customer phone is required')

    if (data.budgetMin && data.budgetMax && data.budgetMin > data.budgetMax) {
      errors.push('Minimum budget cannot be greater than maximum budget')
    }

    return errors
  }
}