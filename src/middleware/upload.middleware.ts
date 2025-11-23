import multer from 'multer'
import { Request } from 'express'
import path from 'path'
import logger from '../utils/logger'

// Memory storage for processing files
const memoryStorage = multer.memoryStorage()

// File filter for images
const imageFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true)
  } else {
    cb(new Error('Only image files are allowed'))
  }
}

// File filter for documents
const documentFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/rtf'
  ]

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Only document files (PDF, DOC, DOCX, TXT, RTF) are allowed'))
  }
}

// File filter for all attachments
const attachmentFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/rtf',
    // Other
    'application/zip',
    'application/x-zip-compressed'
  ]

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('File type not allowed'))
  }
}

// File size limits
const limits = {
  fileSize: 10 * 1024 * 1024, // 10MB
  files: 20 // Maximum 20 files total
}

// Multer configurations
export const uploadMemory = multer({
  storage: memoryStorage,
  limits,
  fileFilter: attachmentFilter
})

export const uploadImage = multer({
  storage: memoryStorage,
  limits: { ...limits, fileSize: 5 * 1024 * 1024 }, // 5MB for images
  fileFilter: imageFilter
})

export const uploadDocument = multer({
  storage: memoryStorage,
  limits,
  fileFilter: documentFilter
})

// Single file uploads
export const uploadSingleMemory = uploadMemory.single('file')
export const uploadSingleImage = uploadImage.single('image')
export const uploadSingleDocument = uploadDocument.single('document')

// Multiple file uploads with field names matching frontend
export const uploadProjectFiles = uploadMemory.fields([
  { name: 'sketches', maxCount: 10 },
  { name: 'photos', maxCount: 10 },
  { name: 'notes', maxCount: 5 },
  { name: 'documents', maxCount: 10 }
])

// Error handling middleware for multer
export const handleMulterError = (error: any, req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' })
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum 20 files total.' })
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected file field.' })
    }
  }

  if (error.message.includes('Only image files are allowed')) {
    return res.status(400).json({ error: 'Only image files are allowed.' })
  }

  if (error.message.includes('Only document files')) {
    return res.status(400).json({ error: 'Only document files (PDF, DOC, DOCX, TXT, RTF) are allowed.' })
  }

  if (error.message.includes('File type not allowed')) {
    return res.status(400).json({ error: 'File type not allowed.' })
  }

  logger.error('Multer error:', error)
  return res.status(500).json({ error: 'File upload failed.' })
}

// Custom file validation
export const validateFile = (file: Express.Multer.File) => {
  const errors: string[] = []

  // Check file size
  if (file.size > 10 * 1024 * 1024) {
    errors.push('File size exceeds 10MB limit')
  }

  // Check file type
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'application/rtf', 'application/zip'
  ]

  if (!allowedTypes.includes(file.mimetype)) {
    errors.push('File type not allowed')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}