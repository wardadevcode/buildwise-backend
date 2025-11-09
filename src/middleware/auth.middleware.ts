import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../utils/prisma'
import logger from '../utils/logger'
import supabaseService from '../services/supabase.service'

export interface AuthRequest extends Request {
  user?: any
  supabaseUser?: any
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' })
    }

    // Verify token with Supabase
    const supabaseUser = await supabaseService.verifyToken(token)
    if (!supabaseUser) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id }
    })

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    req.user = user
    req.supabaseUser = supabaseUser
    next()
  } catch (error) {
    logger.error('Authentication error:', error)
    return res.status(401).json({ error: 'Authentication failed' })
  }
}

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]

    if (token) {
      try {
        const supabaseUser = await supabaseService.verifyToken(token)
        if (supabaseUser) {
          const user = await prisma.user.findUnique({
            where: { supabaseId: supabaseUser.id }
          })
          if (user) {
            req.user = user
            req.supabaseUser = supabaseUser
          }
        }
      } catch (error) {
        // Ignore auth errors for optional auth
        logger.debug('Optional auth failed:', error)
      }
    }

    next()
  } catch (error) {
    logger.error('Optional auth error:', error)
    next()
  }
}

export const requireSupabaseAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      return res.status(401).json({ error: 'Access token required' })
    }

    const supabaseUser = await supabaseService.verifyToken(token)
    if (!supabaseUser) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    req.supabaseUser = supabaseUser
    next()
  } catch (error) {
    logger.error('Supabase auth error:', error)
    return res.status(401).json({ error: 'Authentication failed' })
  }
}