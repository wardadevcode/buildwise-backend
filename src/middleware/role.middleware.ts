import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth.middleware'
import logger from '../utils/logger'

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Access denied for user ${req.user.id} with role ${req.user.role}. Required roles: ${allowedRoles.join(', ')}`)
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    next()
  }
}

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  if (req.user.role !== 'ADMIN') {
    logger.warn(`Admin access denied for user ${req.user.id} with role ${req.user.role}`)
    return res.status(403).json({ error: 'Admin access required' })
  }

  next()
}

export const requireTeamOrAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  if (!['ADMIN', 'TEAM'].includes(req.user.role)) {
    logger.warn(`Team/Admin access denied for user ${req.user.id} with role ${req.user.role}`)
    return res.status(403).json({ error: 'Team or Admin access required' })
  }

  next()
}

export const requireUserOrAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  if (!['ADMIN', 'USER'].includes(req.user.role)) {
    logger.warn(`User/Admin access denied for user ${req.user.id} with role ${req.user.role}`)
    return res.status(403).json({ error: 'User or Admin access required' })
  }

  next()
}

export const isOwnerOrAdmin = (resourceUserId: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const isOwner = req.user.id === resourceUserId
    const isAdmin = req.user.role === 'ADMIN'

    if (!isOwner && !isAdmin) {
      logger.warn(`Resource access denied for user ${req.user.id}. Not owner or admin.`)
      return res.status(403).json({ error: 'Access denied. You can only access your own resources.' })
    }

    next()
  }
}