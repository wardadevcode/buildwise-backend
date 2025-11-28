import { Response } from 'express'
import path from 'path'
import { prisma } from '../utils/prisma'
import logger from '../utils/logger'
import { validateData } from '../utils/validation'
import { AuthRequest } from '../middleware/auth.middleware'
import supabaseService from '../services/supabase.service'
import { ProjectService } from '../services/project.service'
import { ProjectStatus, TimelineEventType, UserRole } from '@prisma/client'

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

// Helper function to format project response
const formatProjectResponse = (project: any) => {
  return {
    id: project.id,
    projectName: project.projectName,
    title: project.title,
    description: project.description,
    contractor: project.contractorName,
    contractorInitials: project.contractorName ? project.contractorName.split(' ').map((n: string) => n[0]).join('').toUpperCase() : '',
    status: project.status.toLowerCase().replace('_', '-'),
    priority: project.priority.toLowerCase(),
    deadline: project.deadline?.toISOString().split('T')[0],
    startDate: project.startDate?.toISOString().split('T')[0],
    type: project.type,
    scopeType: project.scopeType,
    budget: `$${(project.budgetMax / 100).toLocaleString()}`,
    actualCost: project.actualCost ? `$${(project.actualCost / 100).toLocaleString()}` : '$0',
    insuredBy: project.insuredBy,
    createdAt: project.createdAt.toISOString(),
    lastUpdated: project.updatedAt.toISOString(),
    customer: {
      name: project.customer.name,
      email: project.customer.email,
      phone: project.customer.phone,
      address: project.customer.address
    },
    adjuster: project.adjuster ? {
      name: project.adjuster.name,
      email: project.adjuster.email,
      phone: project.adjuster.phone,
      company: project.adjuster.company
    } : null,
    timeline: project.timelineEvents.map((event: any) => ({
      id: event.id,
      date: event.date.toISOString().split('T')[0],
      event: event.event,
      type: event.type,
      user: event.user
    })),
    assignedTo: project.assignees.map((user: any) => user.id),
    primaryAssignee: project.primaryAssignee?.id
  }
}

export const getProjects = async (req: AuthRequest, res: Response) => {
  try {
    const query = req.query
    console.log('Get projects request:', query)

    // Parse query parameters with defaults
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 10
    const offset = (page - 1) * limit

    // Build where clause
    const where: any = {}

    if (query.status) where.status = query.status
    if (query.type) where.type = query.type
    if (query.priority) where.priority = query.priority
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { projectName: { contains: query.search, mode: 'insensitive' } }
      ]
    }

    console.log('Projects query where clause:', where)

    // Get projects with pagination
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          customer: true,
          attachments: true,
          estimates: true,
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

    const pagination = {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
    const response = {
      projects,
      pagination
    }
    console.log('Get projects response:', { projectCount: projects.length, pagination })
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

    // Validate project ID
    if (!id || id === 'undefined' || id.length !== 25 || !id.startsWith('c')) {
      console.log('Invalid project ID:', id)
      return res.status(400).json({ error: 'Invalid project ID' })
    }

    const userId = req.user!.id
    console.log('Get project request:', { userId, projectId: id })
    const project = await prisma.project.findFirst({
      where: {
        id,
        customer: {
          // Assuming projects belong to customers, but we need to check ownership
          // For now, we'll allow access if the user is authenticated
        }
      },
      include: {
        customer: true,
        adjuster: true,
        assignees: true,
        primaryAssignee: true,
        timelineEvents: {
          orderBy: { date: 'desc' }
        },
        attachments: true,
        estimates: true,
        _count: {
          select: { attachments: true }
        }
      }
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Format the response to match frontend requirements
    const formattedProject = {
      id: project.id,
      projectName: project.projectName,
      title: project.title,
      description: project.description,
      contractor: project.contractorName,
      contractorInitials: project.contractorName ? project.contractorName.split(' ').map(n => n[0]).join('').toUpperCase() : '',
      status: project.status.toLowerCase().replace('_', '-'),
      priority: project.priority.toLowerCase(),
      deadline: project.deadline?.toISOString().split('T')[0],
      startDate: project.startDate?.toISOString().split('T')[0],
      type: project.type,
      scopeType: project.scopeType,
      budget: `$${(project.budgetMax / 100).toLocaleString()}`, // Convert cents to dollars
      actualCost: project.actualCost ? `$${(project.actualCost / 100).toLocaleString()}` : '$0',
      insuredBy: project.insuredBy,
      createdAt: project.createdAt.toISOString(),
      lastUpdated: project.updatedAt.toISOString(),
      customer: {
        name: project.customer.name,
        email: project.customer.email,
        phone: project.customer.phone,
        address: project.customer.address
      },
      adjuster: project.adjuster ? {
        name: project.adjuster.name,
        email: project.adjuster.email,
        phone: project.adjuster.phone,
        company: project.adjuster.company
      } : null,
      timeline: project.timelineEvents.map(event => ({
        id: event.id,
        date: event.date.toISOString().split('T')[0],
        event: event.event,
        type: event.type,
        user: event.user
      })),
      assignedTo: project.assignees.map(user => user.id),
      primaryAssignee: project.primaryAssignee?.id
    }

    console.log('Get project response:', { id: project.id, title: project.title, status: project.status })
    res.json({ project: formattedProject })
  } catch (error) {
    logger.error('Get project error:', error)
    res.status(500).json({ error: 'Failed to get project' })
  }
}

export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as {
      projectName: string
      title: string
      description: string
      type: string
      priority?: string
      budgetMin: number
      budgetMax: number
      deadline?: string
      address?: string
      city?: string
      state?: string
      zipCode?: string
      contractorName?: string
      insuredBy?: string
      scopeType?: string
      // Customer info
      customerName: string
      customerEmail: string
      customerPhone: string
      // Adjuster info (optional)
      adjusterName?: string
      adjusterEmail?: string
      adjusterPhone?: string
      adjusterCompany?: string
    }

    // Extract file data from request
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined

    console.log('Create project request:', { body: { ...body, customerEmail: '[REDACTED]' }, files: files ? Object.keys(files) : 'none' })

    // Create or find customer
    let customer = await prisma.customer.findFirst({
      where: { email: body.customerEmail }
    })

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: body.customerName,
          email: body.customerEmail,
          phone: body.customerPhone,
          address: `${body.address || ''} ${body.city || ''} ${body.state || ''} ${body.zipCode || ''}`.trim()
        }
      })
    }

    // Create adjuster if provided
    let adjusterId: string | undefined
    if (body.adjusterEmail) {
      let adjuster = await prisma.adjuster.findFirst({
        where: { email: body.adjusterEmail }
      })

      if (!adjuster) {
        adjuster = await prisma.adjuster.create({
          data: {
            name: body.adjusterName!,
            email: body.adjusterEmail,
            phone: body.adjusterPhone!,
            company: body.adjusterCompany!
          }
        })
      }
      adjusterId = adjuster.id
    }

    // Create project
    const projectData: any = {
      projectName: body.projectName,
      title: body.title,
      description: body.description,
      type: body.type as any,
      priority: (body.priority as any) || 'MEDIUM',
      budgetMin: Math.round(body.budgetMin * 100), // Convert to cents
      budgetMax: Math.round(body.budgetMax * 100), // Convert to cents
      contractorName: body.contractorName,
      insuredBy: body.insuredBy,
      scopeType: body.scopeType,
      address: body.address,
      city: body.city,
      state: body.state,
      zipCode: body.zipCode,
      customerId: customer.id,
      adjusterId,
      status: ProjectStatus.PENDING
    }

    if (body.deadline) {
      projectData.deadline = new Date(body.deadline)
    }

    const project = await prisma.project.create({
      data: projectData,
      include: {
        customer: true,
        adjuster: true,
        attachments: true,
        estimates: true
      }
    })

    // Create timeline event
    await createTimelineEvent(project.id, 'Project created', TimelineEventType.CREATED, 'System')

    console.log('Project created:', project.id)

    // Handle file uploads if any files were provided
    const attachments: any[] = []
    if (files) {
      console.log('Processing uploaded files...')

      // Process each file type
      const fileTypes = [
        { field: 'sketches', type: 'SKETCH' },
        { field: 'photos', type: 'PHOTO' },
        { field: 'notes', type: 'NOTE' },
        { field: 'documents', type: 'DOCUMENT' },
        { field: 'additionalDocuments', type: 'ADDITIONAL_DOCUMENT' }
      ]

      for (const { field, type } of fileTypes) {
        const fieldFiles = files[field]
        if (fieldFiles && fieldFiles.length > 0) {
          console.log(`Processing ${fieldFiles.length} ${field} files...`)

          for (const file of fieldFiles) {
            try {
              // Generate unique filename
              const fileExt = path.extname(file.originalname)
              const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}${fileExt}`
              const filePath = `projects/${project.id}/${field}/${fileName}`

              // Upload to Supabase Storage
              await supabaseService.uploadFile('buildwise-attachments', filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false
              })

              // Get public URL
              const fileUrl = await supabaseService.getFileUrl('buildwise-attachments', filePath)

              // Create attachment record
              const attachment = await prisma.attachment.create({
                data: {
                  projectId: project.id,
                  type,
                  url: fileUrl,
                  name: file.originalname
                }
              })

              attachments.push(attachment)
              console.log(`Uploaded ${field} file: ${file.originalname}`)
            } catch (fileError) {
              console.error(`Error uploading ${field} file ${file.originalname}:`, fileError)
              // Continue with other files even if one fails
            }
          }
        }
      }
    }

    logger.info(`Project created: ${project.id}`)
    const response = {
      project: formatProjectResponse({ ...project, timelineEvents: [], assignees: [], primaryAssignee: null }),
      uploadedAttachments: attachments.length
    }
    console.log('Create project response:', { id: project.id, title: project.title, uploadedAttachments: attachments.length })
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

    // Validate project ID
    if (!id || id === 'undefined' || id.length !== 25 || !id.startsWith('c')) {
      console.log('Invalid project ID:', id)
      return res.status(400).json({ error: 'Invalid project ID' })
    }

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
      status?: string
      priority?: string
      type?: string
      budgetMin?: number
      budgetMax?: number
      actualCost?: number
      deadline?: string
      startDate?: string
      address?: string
      city?: string
      state?: string
      zipCode?: string
      contractorName?: string
      insuredBy?: string
      scopeType?: string
      assignedTo?: string[]
      primaryAssignee?: string
    }

    console.log('Update project request:', { id, updates: Object.keys(body) })

    const updateData: any = {
      updatedAt: new Date()
    }

    // Basic fields
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.status) updateData.status = body.status
    if (body.priority) updateData.priority = body.priority
    if (body.type) updateData.type = body.type
    if (body.scopeType !== undefined) updateData.scopeType = body.scopeType
    if (body.contractorName !== undefined) updateData.contractorName = body.contractorName
    if (body.insuredBy !== undefined) updateData.insuredBy = body.insuredBy

    // Financial fields (convert to cents)
    if (body.budgetMin !== undefined) updateData.budgetMin = Math.round(body.budgetMin * 100)
    if (body.budgetMax !== undefined) updateData.budgetMax = Math.round(body.budgetMax * 100)
    if (body.actualCost !== undefined) updateData.actualCost = Math.round(body.actualCost * 100)

    // Date fields
    if (body.deadline !== undefined) updateData.deadline = body.deadline ? new Date(body.deadline) : null
    if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null

    // Location fields
    if (body.address !== undefined) updateData.address = body.address
    if (body.city !== undefined) updateData.city = body.city
    if (body.state !== undefined) updateData.state = body.state
    if (body.zipCode !== undefined) updateData.zipCode = body.zipCode

    // Team assignments
    if (body.assignedTo) {
      updateData.assignees = {
        set: body.assignedTo.map(id => ({ id }))
      }
    }
    if (body.primaryAssignee !== undefined) {
      updateData.primaryAssigneeId = body.primaryAssignee
    }

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        adjuster: true,
        assignees: true,
        primaryAssignee: true,
        timelineEvents: {
          orderBy: { date: 'desc' }
        },
        attachments: true,
        estimates: true
      }
    })

    // Create timeline event for status changes
    if (body.status && body.status !== existingProject.status) {
      await createTimelineEvent(
        project.id,
        `Status changed to ${body.status}`,
        TimelineEventType.APPROVED, // Generic event type
        req.user!.name || 'System'
      )
    }

    console.log('Update project response:', { id: project.id, title: project.title, status: project.status })
    logger.info(`Project updated: ${project.id}`)
    res.json({ project: formatProjectResponse(project) })
  } catch (error) {
    logger.error('Update project error:', error)
    res.status(500).json({ error: 'Failed to update project' })
  }
}

export const deleteProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    // Validate project ID
    if (!id || id === 'undefined' || id.length !== 25 || !id.startsWith('c')) {
      console.log('Invalid project ID:', id)
      return res.status(400).json({ error: 'Invalid project ID' })
    }

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id }
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Prevent deletion if project is in progress or completed
    if (project.status === ProjectStatus.IN_CONSTRUCTION || project.status === ProjectStatus.COMPLETED) {
      return res.status(400).json({ error: 'Cannot delete project that is in progress or completed' })
    }

    await prisma.project.delete({
      where: { id }
    })

    console.log('Delete project response:', { id, message: 'Project deleted successfully' })
    logger.info(`Project deleted: ${id}`)
    res.json({ message: 'Project deleted successfully' })
  } catch (error) {
    logger.error('Delete project error:', error)
    res.status(500).json({ error: 'Failed to delete project' })
  }
}

export const getTeamMembers = async (req: AuthRequest, res: Response) => {
  try {
    console.log('Get team members request')

    const teamMembers = await prisma.user.findMany({
      where: {
        role: {
          in: ['ADMIN', 'TEAM_MEMBER']
        }
      },
      orderBy: { name: 'asc' }
    })

    const response = teamMembers.map(member => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      initials: member.initials,
      color: member.color,
      currentProjects: member.currentProjects,
      maxProjects: member.maxProjects
    }))

    console.log('Get team members response:', { count: response.length })
    res.json({ teamMembers: response })
  } catch (error) {
    console.error('Get team members error:', error)
    logger.error('Get team members error:', error)
    res.status(500).json({ error: 'Failed to get team members' })
  }
}

export const updateProjectStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { status } = req.body

    if (!status) {
      return res.status(400).json({ error: 'Status is required' })
    }

    const result = await ProjectService.updateProjectStatus(id, status, req.user!.name || 'System')

    res.json({
      message: 'Project status updated successfully',
      previousStatus: 'previousStatus' in result ? result.previousStatus : null,
      newStatus: 'newStatus' in result ? result.newStatus : result.status
    })
  } catch (error) {
    console.error('Update project status error:', error)
    logger.error('Update project status error:', error)
    res.status(500).json({ error: 'Failed to update project status' })
  }
}

export const approveEstimate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    // Update project status to APPROVED
    const result = await ProjectService.updateProjectStatus(id, ProjectStatus.APPROVED, req.user!.name || 'Customer')

    // Create timeline event for estimate approval
    await createTimelineEvent(id, 'Estimate approved by customer', TimelineEventType.APPROVED, req.user!.name || 'Customer')

    res.json({
      message: 'Estimate approved successfully',
      projectId: id,
      status: 'newStatus' in result ? result.newStatus : result.status
    })
  } catch (error) {
    console.error('Approve estimate error:', error)
    logger.error('Approve estimate error:', error)
    res.status(500).json({ error: 'Failed to approve estimate' })
  }
}

export const createChangeOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { total, lineItems, pdfUrl } = req.body

    // Get the latest change order number for this project
    const latestEstimate = await prisma.estimate.findFirst({
      where: { projectId: id },
      orderBy: { changeOrderNumber: 'desc' }
    })

    const changeOrderNumber = (latestEstimate?.changeOrderNumber || 0) + 1

    // Create change order estimate
    const estimate = await prisma.estimate.create({
      data: {
        projectId: id,
        total: Math.round(total * 100),
        lineItems,
        pdfUrl,
        changeOrderNumber,
        createdById: req.user!.id
      },
      include: {
        project: { select: { title: true, projectName: true } },
        createdBy: { select: { name: true } }
      }
    })

    // Update project status to CHANGE_ORDER_PENDING
    await ProjectService.updateProjectStatus(id, ProjectStatus.CHANGE_ORDER_PENDING, req.user!.name || 'System')

    // Create timeline event
    await createTimelineEvent(
      id,
      `Change order #${changeOrderNumber} created: $${total.toFixed(2)}`,
      TimelineEventType.CHANGE_ORDER,
      req.user!.name || 'System'
    )

    res.status(201).json({
      message: 'Change order created successfully',
      estimate: {
        id: estimate.id,
        total: `$${(estimate.total / 100).toFixed(2)}`,
        changeOrderNumber: estimate.changeOrderNumber,
        project: estimate.project
      }
    })
  } catch (error) {
    console.error('Create change order error:', error)
    logger.error('Create change order error:', error)
    res.status(500).json({ error: 'Failed to create change order' })
  }
}

export const getUserDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const query = req.query

    // Parse query parameters
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 20
    const offset = (page - 1) * limit

    // Get all documents for projects (no user filtering since projects aren't directly linked to users)
    const documents = await prisma.attachment.findMany({
      where: {
        type: {
          in: ['DOCUMENT', 'ADDITIONAL_DOCUMENT']
        }
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            type: true
          }
        }
      },
      orderBy: { uploadedAt: 'desc' },
      skip: offset,
      take: limit
    })

    // Get total count
    const total = await prisma.attachment.count({
      where: {
        type: {
          in: ['DOCUMENT', 'ADDITIONAL_DOCUMENT']
        }
      }
    })

    const response = {
      documents: documents.map(doc => ({
        id: doc.id,
        name: doc.name,
        url: doc.url,
        type: doc.type,
        uploadedAt: doc.uploadedAt,
        project: doc.project
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }

    console.log('Get user documents response:', { count: documents.length, pagination: response.pagination })
    res.json(response)
  } catch (error) {
    console.error('Get user documents error:', error)
    logger.error('Get user documents error:', error)
    res.status(500).json({ error: 'Failed to get documents' })
  }
}