import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../utils/prisma'
import supabaseService from '../services/supabase.service'
import logger from '../utils/logger'
import { validateData } from '../utils/validation'

export const register = async (req: Request, res: Response) => {
  try {
    const body = req.body as { email: string; password: string; name: string }
    const validatedData = validateData(require('../utils/validation').registerSchema, body)
    const { email, password, name } = validatedData as { email: string; password: string; name: string }
    console.log('Registration request:', { email, name })

    // Create user in Supabase
    const supabaseUser = await supabaseService.createUser(email, password, { name })
    console.log('Supabase user created:', supabaseUser)

    // Create user in database
    const user = await prisma.user.create({
      data: {
        supabaseId: supabaseUser!.id,
        email,
        name,
      }
    })
    console.log('Database user created:', user)

    logger.info(`User registered: ${user.id}`)
    const response = {
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    }
    console.log('Registration response:', response)
    res.status(201).json(response)
  } catch (error: any) {
    console.error('Registration error:', error)
    logger.error('Registration error:', error)
    if (error.message?.includes('already registered')) {
      return res.status(400).json({ error: 'User already exists' })
    }
    res.status(500).json({ error: 'Registration failed' })
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const body = req.body as { email: string; password: string }
    const validatedData = validateData(require('../utils/validation').loginSchema, body)
    const { email, password } = validatedData as { email: string; password: string }
    console.log('Login request:', { email })

    // Sign in with Supabase
    const { data, error } = await supabaseService.getClient().auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      console.log('Supabase login error:', error)
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    console.log('Supabase login successful:', data.user?.id)

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { supabaseId: data.user!.id }
    })

    if (!user) {
      console.log('User not found in database')
      return res.status(401).json({ error: 'User not found' })
    }

    console.log('Database user found:', user.id)

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, supabaseId: user.supabaseId },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    logger.info(`User logged in: ${user.id}`)
    const response = {
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    }
    console.log('Login response:', response)
    res.json(response)
  } catch (error) {
    console.error('Login error:', error)
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