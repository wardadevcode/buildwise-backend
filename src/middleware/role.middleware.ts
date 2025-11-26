import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth.middleware'
import { UserRole } from '@prisma/client'

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.role
      })
    }

    next()
  }
}

export const requireAdmin = requireRole([UserRole.ADMIN])
export const requireTeamLead = requireRole([UserRole.ADMIN, UserRole.TEAM_LEAD])
export const requireEstimator = requireRole([UserRole.ADMIN, UserRole.TEAM_LEAD, UserRole.SENIOR_ESTIMATOR])