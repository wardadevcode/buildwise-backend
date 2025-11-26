import { Response } from 'express'
import { prisma } from '../utils/prisma'
import logger from '../utils/logger'
import { AuthRequest } from '../middleware/auth.middleware'
import { InvoiceStatus } from '@prisma/client'

export const getInvoices = async (req: AuthRequest, res: Response) => {
  try {
    const query = req.query
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 10
    const offset = (page - 1) * limit

    const where: any = {}
    if (query.status) where.status = query.status
    if (query.projectId) where.projectId = query.projectId

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          project: {
            select: { id: true, title: true, projectName: true }
          },
          generatedBy: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.invoice.count({ where })
    ])

    const response = {
      invoices: invoices.map(invoice => ({
        id: invoice.id,
        customer: invoice.customer,
        address: invoice.address,
        date: invoice.date.toISOString().split('T')[0],
        amount: `$${(invoice.amount / 100).toFixed(2)}`,
        dueDate: invoice.dueDate.toISOString().split('T')[0],
        status: invoice.status,
        projectDetails: invoice.projectDetails,
        createdAt: invoice.createdAt.toISOString(),
        updatedAt: invoice.updatedAt.toISOString(),
        project: invoice.project,
        generatedBy: invoice.generatedBy
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }

    console.log('Get invoices response:', { count: invoices.length })
    res.json(response)
  } catch (error) {
    console.error('Get invoices error:', error)
    logger.error('Get invoices error:', error)
    res.status(500).json({ error: 'Failed to get invoices' })
  }
}

export const getInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, title: true, projectName: true, customer: true }
        },
        generatedBy: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' })
    }

    const response = {
      id: invoice.id,
      customer: invoice.customer,
      address: invoice.address,
      date: invoice.date.toISOString().split('T')[0],
      amount: `$${(invoice.amount / 100).toFixed(2)}`,
      dueDate: invoice.dueDate.toISOString().split('T')[0],
      status: invoice.status,
      projectDetails: invoice.projectDetails,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
      project: invoice.project,
      generatedBy: invoice.generatedBy
    }

    res.json({ invoice: response })
  } catch (error) {
    console.error('Get invoice error:', error)
    logger.error('Get invoice error:', error)
    res.status(500).json({ error: 'Failed to get invoice' })
  }
}

export const createInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as {
      projectId?: string
      customer: string
      address: string
      amount: number
      dueDate: string
      projectDetails?: string
    }

    console.log('Create invoice request:', { customer: body.customer, amount: body.amount })

    let projectDetails = body.projectDetails
    if (body.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: body.projectId },
        select: { title: true, projectName: true }
      })
      if (project) {
        projectDetails = project.title
      }
    }

    const invoice = await prisma.invoice.create({
      data: {
        customer: body.customer,
        address: body.address,
        date: new Date(),
        amount: Math.round(body.amount * 100), // Convert to cents
        dueDate: new Date(body.dueDate),
        status: InvoiceStatus.PENDING,
        projectDetails,
        projectId: body.projectId,
        generatedById: req.user!.id
      },
      include: {
        project: {
          select: { id: true, title: true, projectName: true }
        },
        generatedBy: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    const response = {
      id: invoice.id,
      customer: invoice.customer,
      address: invoice.address,
      date: invoice.date.toISOString().split('T')[0],
      amount: `$${(invoice.amount / 100).toFixed(2)}`,
      dueDate: invoice.dueDate.toISOString().split('T')[0],
      status: invoice.status,
      projectDetails: invoice.projectDetails,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
      project: invoice.project,
      generatedBy: invoice.generatedBy
    }

    logger.info(`Invoice created: ${invoice.id} for ${body.customer}`)
    res.status(201).json({ invoice: response })
  } catch (error) {
    console.error('Create invoice error:', error)
    logger.error('Create invoice error:', error)
    res.status(500).json({ error: 'Failed to create invoice' })
  }
}

export const updateInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const body = req.body as {
      status?: string
      amount?: number
      dueDate?: string
    }

    const updateData: any = {
      updatedAt: new Date()
    }

    if (body.status) updateData.status = body.status
    if (body.amount !== undefined) updateData.amount = Math.round(body.amount * 100)
    if (body.dueDate) updateData.dueDate = new Date(body.dueDate)

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        project: {
          select: { id: true, title: true, projectName: true }
        },
        generatedBy: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    const response = {
      id: invoice.id,
      customer: invoice.customer,
      address: invoice.address,
      date: invoice.date.toISOString().split('T')[0],
      amount: `$${(invoice.amount / 100).toFixed(2)}`,
      dueDate: invoice.dueDate.toISOString().split('T')[0],
      status: invoice.status,
      projectDetails: invoice.projectDetails,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
      project: invoice.project,
      generatedBy: invoice.generatedBy
    }

    logger.info(`Invoice updated: ${invoice.id}`)
    res.json({ invoice: response })
  } catch (error) {
    console.error('Update invoice error:', error)
    logger.error('Update invoice error:', error)
    res.status(500).json({ error: 'Failed to update invoice' })
  }
}

export const deleteInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const invoice = await prisma.invoice.findUnique({
      where: { id }
    })

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' })
    }

    // Prevent deletion of paid invoices
    if (invoice.status === InvoiceStatus.PAID) {
      return res.status(400).json({ error: 'Cannot delete paid invoice' })
    }

    await prisma.invoice.delete({
      where: { id }
    })

    logger.info(`Invoice deleted: ${id}`)
    res.json({ message: 'Invoice deleted successfully' })
  } catch (error) {
    console.error('Delete invoice error:', error)
    logger.error('Delete invoice error:', error)
    res.status(500).json({ error: 'Failed to delete invoice' })
  }
}