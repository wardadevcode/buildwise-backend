import { createClient, SupabaseClient } from '@supabase/supabase-js'
import logger from '../utils/logger'

class SupabaseService {
  private client: SupabaseClient

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_ANON_KEY!

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and key are required')
    }

    this.client = createClient(supabaseUrl, supabaseKey)
  }

  getClient(): SupabaseClient {
    return this.client
  }

  async getUserById(supabaseId: string) {
    try {
      const { data, error } = await this.client.auth.admin.getUserById(supabaseId)
      if (error) throw error
      return data.user
    } catch (error) {
      logger.error('Error getting user by ID:', error)
      throw error
    }
  }

  async createUser(email: string, password: string, userMetadata?: any) {
    try {
      const { data, error } = await this.client.auth.admin.createUser({
        email,
        password,
        user_metadata: userMetadata,
        email_confirm: true
      })
      if (error) throw error
      return data.user
    } catch (error) {
      logger.error('Error creating user:', error)
      throw error
    }
  }

  async deleteUser(supabaseId: string) {
    try {
      const { error } = await this.client.auth.admin.deleteUser(supabaseId)
      if (error) throw error
      return true
    } catch (error) {
      logger.error('Error deleting user:', error)
      throw error
    }
  }

  async verifyToken(token: string) {
    try {
      const { data, error } = await this.client.auth.getUser(token)
      if (error) throw error
      return data.user
    } catch (error) {
      logger.error('Error verifying token:', error)
      throw error
    }
  }

  async uploadFile(bucket: string, path: string, file: Buffer, options?: any) {
    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .upload(path, file, options)

      if (error) throw error
      return data
    } catch (error) {
      logger.error('Error uploading file:', error)
      throw error
    }
  }

  async getFileUrl(bucket: string, path: string) {
    try {
      const { data } = this.client.storage
        .from(bucket)
        .getPublicUrl(path)

      return data.publicUrl
    } catch (error) {
      logger.error('Error getting file URL:', error)
      throw error
    }
  }

  async deleteFile(bucket: string, path: string) {
    try {
      const { error } = await this.client.storage
        .from(bucket)
        .remove([path])

      if (error) throw error
      return true
    } catch (error) {
      logger.error('Error deleting file:', error)
      throw error
    }
  }
}

export default new SupabaseService()