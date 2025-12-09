import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const BUCKET_NAME = 'missions-assets'

const sanitizeMissionUid = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()

const missionFolderFromUid = (missionUid?: string | null) => {
  if (!missionUid) {
    return ''
  }
  const sanitized = sanitizeMissionUid(missionUid || '')
  if (!sanitized) {
    return ''
  }
  return sanitized.startsWith('M') ? sanitized : `M${sanitized}`
}

const sanitizeCustomFolder = (folder: string) =>
  folder
    .trim()
    .replace(/^[./]+/, '')
    .replace(/[^a-zA-Z0-9/_-]+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^-+|-+$/g, '')

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { mission_uid, image_path, image_folder } = body

    if (!mission_uid || !image_path) {
      return NextResponse.json(
        { error: 'mission_uid and image_path are required.' },
        { status: 400 }
      )
    }

    const missionFolder = missionFolderFromUid(mission_uid)
    const customFolder = image_folder ? sanitizeCustomFolder(image_folder) : ''
    
    const baseFolder = customFolder || missionFolder || 'unknown'
    const storagePath = `${baseFolder}/images/${image_path}`

    console.log(`Attempting to delete image at path: ${storagePath}`)

    const { error: deleteError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([storagePath])

    if (deleteError) {
      console.warn(`Failed to delete ${storagePath}:`, deleteError.message)
      return NextResponse.json(
        { error: `Failed to delete image: ${deleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Image ${image_path} deleted successfully.`,
      deleted_path: storagePath
    })
  } catch (error: any) {
    console.error('Delete image error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to delete image.' },
      { status: 500 }
    )
  }
}