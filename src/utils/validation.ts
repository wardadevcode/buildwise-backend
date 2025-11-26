import { z } from 'zod'

// User validation schemas
export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  supabaseId: z.string().min(1),
  role: z.enum(['USER', 'ADMIN', 'TEAM']).optional().default('USER'),
})

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['USER', 'ADMIN', 'TEAM']).optional(),
})

// Project validation schemas
export const createProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  projectType: z.string().min(1), // Changed from enum to string to match frontend
  priority: z.string().optional().default('MEDIUM'), // Added priority field
  minBudget: z.string().optional(), // Changed from budgetMin to minBudget
  maxBudget: z.string().optional(), // Changed from budgetMax to maxBudget
  currency: z.string().optional().default('USD'), // Changed from budgetCurrency to currency
  deadline: z.string().optional(), // Changed from datetime to string
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  customerNotes: z.string().optional(),
  // File fields will be handled separately in the controller
})

export const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  projectType: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'ESTIMATE_READY', 'APPROVED', 'IN_CONSTRUCTION', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.string().optional(),
  minBudget: z.string().optional(),
  maxBudget: z.string().optional(),
  currency: z.string().optional(),
  deadline: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  adminNotes: z.string().optional(),
  customerNotes: z.string().optional(),
})

// Estimate validation schemas
export const createEstimateSchema = z.object({
  projectId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().optional().default('USD'),
  fileUrl: z.string().url(),
})

// Attachment validation schemas
export const createAttachmentSchema = z.object({
  projectId: z.string().min(1),
  type: z.enum(['SKETCH', 'PHOTO', 'DOCUMENT', 'NOTE', 'ADDITIONAL_DOCUMENT']),
  filename: z.string().min(1),
  url: z.string().url(),
})

// Query validation schemas
export const projectQuerySchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'ESTIMATE_READY', 'APPROVED', 'IN_CONSTRUCTION', 'COMPLETED', 'CANCELLED']).optional(),
  projectType: z.enum(['CONSTRUCTION', 'RENOVATION', 'INTERIOR', 'ARCHITECTURE', 'OTHER']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  page: z.string().transform((val: string) => parseInt(val)).optional().default('1'),
  limit: z.string().transform((val: string) => parseInt(val)).optional().default('10'),
  search: z.string().optional(),
})

export const adminProjectQuerySchema = projectQuerySchema.extend({
  userId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
})

// Auth validation schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
})

// File upload validation
export const fileUploadSchema = z.object({
  fieldname: z.string(),
  originalname: z.string(),
  encoding: z.string(),
  mimetype: z.string(),
  size: z.number(),
  buffer: z.any(),
})

// Helper function to validate data
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data)
}

// Helper function to safely validate data
export function safeValidateData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  } else {
    return { success: false, error: result.error }
  }
}