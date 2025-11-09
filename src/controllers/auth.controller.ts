import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../utils/prisma'
import supabaseService from '../services/supabase.service'
import logger from '../utils/logger'
import { validateData } from '../utils/validation'

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = validateData(require('../utils/validation').registerSchema, req.body)

    // Create user in Supabase
    const supabaseUser = await supabaseService.createUser(email, password, { name })

    // Create user in database
    const user = await prisma.user.create({
      data: {
        supabaseId: supabaseUser.id,
        email,
        name,
      }
    })

    logger.info(`User registered: ${user.id}`)
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    })
  } catch (error: any) {
    logger.error('Registration error:', error)
    if (error.message?.includes('already registered')) {
      return res.status(400).json({ error: 'User already exists' })
    }
    res.status(500).json({ error: 'Registration failed' })
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = validateData(require('../utils/validation').loginSchema, req.body)

    // Get user from Supabase
    const { data: supabaseUsers } = await supabaseService.getClient().auth.admin.listUsers()
    const supabaseUser = supabaseUsers.users.find(u => u.email === email)

    if (!supabaseUser) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id }
    })

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, supabaseId: user.supabaseId },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    logger.info(`User logged in: ${user.id}`)
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    })
  } catch (error) {
    logger.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
}

export const logout = async (req: Request, res: Response) => {
  try {
    // In Supabase, logout is handled client-side
    // We can add token blacklisting here if needed
    res.json({ message: 'Logged out successfully' })
  } catch (error) {
    logger.error('Logout error:', error)
    res.status(500).json({ error: 'Logout failed' })
  }
}

export const getMe = async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ user })
  } catch (error) {
    logger.error('Get me error:', error)
    res.status(500).json({ error: 'Failed to get user info' })
  }
}

export const callback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' })
    }

    // Exchange code for session
    const { data, error } = await supabaseService.getClient().auth.exchangeCodeForSession(code as string)

    if (error) {
      throw error
    }

    // Check if user exists in database, create if not
    let user = await prisma.user.findUnique({
      where: { supabaseId: data.user.id }
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          supabaseId: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.name || data.user.email!.split('@')[0],
        }
      })
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, supabaseId: user.supabaseId },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    res.json({
      message: 'Authentication successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    })
  } catch (error) {
    logger.error('Callback error:', error)
    res.status(500).json({ error: 'Authentication failed' })
  }
}