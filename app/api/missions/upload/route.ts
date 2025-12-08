import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Add this helper at module-level (top of function is fine, not inside blocks)
function pad2(n: number): string { return n < 10 ? '0' + n : '' + n; }

export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData()
    const jsonFile = formData.get('json') as File
    const imageFiles = formData.getAll('images') as File[]
    const providedTitle = (formData.get('title') || '').toString().trim()
    const providedMissionUid = (formData.get('mission_uid') || '').toString().trim()
    const providedOrderNoRaw = (formData.get('order_no') || '').toString().trim()

    if (!jsonFile) {
      return NextResponse.json(
        { error: 'JSON file is required' },
        { status: 400 }
      )
    }

    // Read and parse JSON
    const jsonContent = await jsonFile.text()
    let parsedData: any
    try {
      parsedData = JSON.parse(jsonContent)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON format. Please check your JSON syntax.' },
        { status: 400 }
      )
    }

    // Handle both array and single object formats
    let missionsToProcess: any[] = []
    if (Array.isArray(parsedData)) {
      missionsToProcess = parsedData
    } else if (parsedData && typeof parsedData === 'object') {
      // Single mission object
      missionsToProcess = [parsedData]
    } else {
      return NextResponse.json(
        { error: 'JSON must contain either a single mission object or an array of missions' },
        { status: 400 }
      )
    }

    if (missionsToProcess.length === 0) {
      return NextResponse.json(
        { error: 'No mission data found in JSON' },
        { status: 400 }
      )
    }

    // Process first mission (for now we'll handle one at a time, can extend later)
    let missionData = missionsToProcess[0]

    // Extract metadata if present and allow form overrides
    const title = providedTitle || missionData.title || 'Untitled Mission'
    const description = missionData.description || ''
    const order = missionData.order || null
    const xp_reward = missionData.xp_reward || missionData.total_points || 0
    const difficulty = missionData.difficulty || missionData.Difficulty || 'medium'
    const estimated_time = missionData.estimated_time || missionData.mission_time || 0
    const unlocked = missionData.unlocked !== undefined ? missionData.unlocked : true

    // Generate mission_uid if column exists (UUID or identifier)
    // Priority: provided form value > JSON value > slug(title)+timestamp
    const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')
    const desiredMissionUid = providedMissionUid
      ? slugify(providedMissionUid)
      : (missionData.mission_uid ? slugify(missionData.mission_uid) : `${slugify(title)}-${Date.now()}`)

    // Ensure mission_uid uniqueness to avoid PK conflicts
    let missionUid = desiredMissionUid
    try {
      const { count: uidCount } = await supabaseAdmin
        .from('missions')
        .select('mission_uid', { count: 'exact', head: true })
        .eq('mission_uid', missionUid)

      if ((uidCount || 0) > 0) {
        if (providedMissionUid) {
          return NextResponse.json(
            { error: `Mission UID '${missionUid}' already exists. Choose a different mission_uid.` },
            { status: 409 }
          )
        }
        missionUid = `${missionUid}-${Date.now()}`
      }
    } catch (_e) {
      // On failure to check, proceed; DB will still guard with PK
    }

    // All orderNo calculations
    let orderNo = order
    if (orderNo === null || orderNo === undefined) {
      // allow form override if provided
      const parsedOrder = providedOrderNoRaw ? Number(providedOrderNoRaw) : NaN
      if (!Number.isNaN(parsedOrder)) {
        orderNo = parsedOrder
      }
    }
    // Fetch existing order numbers to avoid unique constraint violations
    const { data: existingOrders } = await supabaseAdmin
      .from('missions')
      .select('order_no')

    const usedOrders = new Set<number>((existingOrders || []).map((r: any) => Number(r.order_no)))

    if (orderNo === null || orderNo === undefined) {
      // Default to next available from max(existing) + 1
      const maxExisting = (existingOrders || []).reduce((max: number, r: any) => Math.max(max, Number(r.order_no) || 0), 0)
      orderNo = maxExisting + 1
    }

    // If provided or determined order is already used, pick next free slot
    let candidateOrder = Number(orderNo) || 1
    while (usedOrders.has(candidateOrder)) {
      candidateOrder += 1
    }
    orderNo = candidateOrder
    // insertData.order_no = orderNo // This line is removed as per the edit hint

    // Decide JSON filename for storage/DB
    // Requirement: numeric mission id naming like 1.json, 2.json, ...
    const jsonFileName = `${orderNo}.json`;
    const objectPath = jsonFileName;

    const assetsBucket = 'missions-assets'
    const buildAssetsPrefix = (uid: string) => {
      const cleaned = uid?.trim()
      if (!cleaned) return null
      const upper = cleaned.toUpperCase()
      const prefixBody = upper.startsWith('M') ? upper : `M${upper}`
      return `${prefixBody}/`
    }
    const assetsPrefix = buildAssetsPrefix(missionUid)

    // Add optional fields if they exist in schema
    // Note: estimated_time and difficulty may not exist in all schemas
    if (xp_reward !== undefined) {
      // insertData.xp_reward = xp_reward // This line is removed as per the edit hint
    }
    if (unlocked !== undefined) {
      // insertData.unlocked = unlocked // This line is removed as per the edit hint
    }
    // Don't add estimated_time or difficulty - they may not exist in schema

    // ----- IMAGE UPLOAD BLOCK: use variables defined above -----
    const missionFolder = `M${pad2(orderNo)}`;
    const sanitizeCustomFolder = (folder: string) =>
      folder
        .trim()
        .replace(/^[./]+/, '')
        .replace(/[^a-zA-Z0-9/_-]+/g, '-')
        .replace(/\/+/g, '/')
        .replace(/^-+|-+$/g, '')
    const providedImageFolderRaw = (formData.get('image_folder') || '').toString()
    const providedImageFolder = sanitizeCustomFolder(providedImageFolderRaw)
    const imagePaths: Record<string, string> = {}
    const uploadedImages: string[] = []
    const bucketName = 'missions-assets' // For images
    const jsonBucketName = 'missions-json' // For JSON files

    if (imageFiles.length > 0) {
      // Check if bucket exists, create if not
      const { data: buckets } = await supabaseAdmin.storage.listBuckets()
      const bucketExists = buckets?.some(b => b.name === bucketName)
      
      if (!bucketExists) {
        const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
          fileSizeLimit: 5242880 // 5MB
        })
        
        if (createError && !createError.message.includes('already exists')) {
          console.error('Error creating bucket:', createError)
        }
      }
      // Upload each image to 'MXX/images/originalname.png'
      for (const imageFile of imageFiles) {
        if (imageFile && imageFile.size > 0) {
          const originalName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
          const folderBase =
            providedImageFolder ||
            missionFolder ||
            `generator/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
          const filePath = `${folderBase}/images/${originalName}`
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from(bucketName)
            .upload(filePath, imageFile, {
              cacheControl: '3600',
              upsert: false
            })

          if (uploadError) {
            console.error(`Error uploading image ${imageFile.name}:`, uploadError)
            continue
          }

          // Get public URL
          const { data: urlData } = supabaseAdmin.storage
            .from(bucketName)
            .getPublicUrl(filePath)

          if (urlData?.publicUrl) {
            imagePaths[imageFile.name] = urlData.publicUrl
            uploadedImages.push(urlData.publicUrl)
            // Replace image references in mission data (NO use of insertData at all)
            const imageName = imageFile.name
            const imageUrl = urlData.publicUrl
            const jsonString = JSON.stringify(missionData)
            const updatedJsonString = jsonString.replace(
              new RegExp(imageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
              imageUrl
            )
            missionData = JSON.parse(updatedJsonString)
          }
        }
      }
    }

    // Ensure missionData reflects any overrides
    try {
      missionData = { ...missionData, title }
    } catch (_e) {}

    // Build insert object with only available fields
    // Start with required fields
    const insertData: any = {
      title
    }
    
    // Add description if it exists (might be optional)
    if (description) {
      insertData.description = description
    }
    // Add core fields now that values are known
    insertData.mission_uid = missionUid
    insertData.order_no = orderNo
    insertData.object_path = objectPath
    if (xp_reward !== undefined) {
      insertData.xp_reward = xp_reward
    }
    if (unlocked !== undefined) {
      insertData.unlocked = unlocked
    }
    insertData.assets_bucket = assetsBucket
    if (assetsPrefix) {
      insertData.assets_prefix = assetsPrefix
    }
    insertData.unlock_playground = true
    insertData.unlocks_projects = true
    
    // Add required order_no field (NOT NULL constraint)
    // Use order from JSON, or get max order_no + 1 if not provided
    // This block is now redundant as orderNo is calculated and set above
    // let orderNo = order
    // if (orderNo === null || orderNo === undefined) {
    //   // allow form override if provided
    //   const parsedOrder = providedOrderNoRaw ? Number(providedOrderNoRaw) : NaN
    //   if (!Number.isNaN(parsedOrder)) {
    //     orderNo = parsedOrder
    //   }
    // }
    // // Fetch existing order numbers to avoid unique constraint violations
    // const { data: existingOrders } = await supabaseAdmin
    //   .from('missions')
    //   .select('order_no')

    // const usedOrders = new Set<number>((existingOrders || []).map((r: any) => Number(r.order_no)))

    // if (orderNo === null || orderNo === undefined) {
    //   // Default to next available from max(existing) + 1
    //   const maxExisting = (existingOrders || []).reduce((max: number, r: any) => Math.max(max, Number(r.order_no) || 0), 0)
    //   orderNo = maxExisting + 1
    // }

    // // If provided or determined order is already used, pick next free slot
    // let candidateOrder = Number(orderNo) || 1
    // while (usedOrders.has(candidateOrder)) {
    //   candidateOrder += 1
    // }
    // orderNo = candidateOrder
    // insertData.order_no = orderNo

    // Add required object_path field (NOT NULL constraint)
    // This likely stores the path to the mission JSON in storage
    // const jsonFileName = `${missionUid}.json`
    // const objectPath = jsonFileName // Store just filename or full path as needed
    // insertData.object_path = objectPath

    // Add optional fields if they exist in schema
    // Note: estimated_time and difficulty may not exist in all schemas
    // if (xp_reward !== undefined) {
    //   insertData.xp_reward = xp_reward
    // }
    // if (unlocked !== undefined) {
    //   insertData.unlocked = unlocked
    // }
    // // Don't add estimated_time or difficulty - they may not exist in schema

    // Try to insert with mission_data first
    let missionRecord: any = null
    let dbError: any = null
    
    try {
      const result = await supabaseAdmin
        .from('missions')
        .insert({
          ...insertData,
          mission_data: missionData
        })
        .select()
        .single()
      
      missionRecord = result.data
      dbError = result.error
    } catch (error: any) {
      dbError = error
    }

    // If any column doesn't exist, try with fewer fields
    if (dbError && dbError.message && (
      dbError.message.includes('column') || 
      dbError.message.includes('does not exist') ||
      dbError.message.includes('schema cache')
    )) {
      // Try inserting without mission_data and difficulty
      // Remove any potentially missing columns from insertData
      const safeInsertData: any = {
        title,
        mission_uid: missionUid, // Keep mission_uid as it's required
        order_no: orderNo, // Keep order_no as it's required (NOT NULL)
        object_path: objectPath // Keep object_path as it's required (NOT NULL)
      }
      
      // Add description if provided
      if (description) {
        safeInsertData.description = description
      }
      if (xp_reward !== undefined) {
        safeInsertData.xp_reward = xp_reward
      }
      if (unlocked !== undefined) {
        safeInsertData.unlocked = unlocked
      }
      safeInsertData.assets_bucket = assetsBucket
      if (assetsPrefix) {
        safeInsertData.assets_prefix = assetsPrefix
      }
      safeInsertData.unlock_playground = true
      safeInsertData.unlocks_projects = true
      
      // Try with safe fields
      const result2 = await supabaseAdmin
        .from('missions')
        .insert(safeInsertData)
        .select()
        .single()

      missionRecord = result2.data
      dbError = result2.error

      // If successful with safe fields, still store full JSON in storage
      if (!dbError && missionRecord) {
        // Store full mission JSON in missions-json bucket
        try {
          // Check if missions-json bucket exists
          const { data: buckets } = await supabaseAdmin.storage.listBuckets()
          const jsonBucketExists = buckets?.some(b => b.name === jsonBucketName)
          
          if (!jsonBucketExists) {
            const { error: createError } = await supabaseAdmin.storage.createBucket(jsonBucketName, {
              public: true,
              allowedMimeTypes: ['application/json'],
              fileSizeLimit: 10485760 // 10MB
            })
            
            if (createError && !createError.message.includes('already exists')) {
              console.error('Error creating JSON bucket:', createError)
            }
          }

          // Upload to missions-json bucket using the mission_uid filename
          const { error: jsonUploadError } = await supabaseAdmin.storage
            .from(jsonBucketName)
            .upload(jsonFileName, jsonFile, {
              cacheControl: '3600',
              upsert: false
            })

          if (!jsonUploadError) {
            const { data: jsonUrlData } = supabaseAdmin.storage
              .from(jsonBucketName)
              .getPublicUrl(jsonFileName)

            return NextResponse.json({
              success: true,
              mission: missionRecord,
              message: 'Mission uploaded successfully (Full JSON stored in storage bucket)',
              jsonUrl: jsonUrlData?.publicUrl,
              images: uploadedImages
            })
          }
        } catch (storageError) {
          // Ignore storage errors, mission was inserted successfully
          console.error('Storage error:', storageError)
        }

        return NextResponse.json({
          success: true,
          mission: missionRecord,
          message: 'Mission uploaded successfully. Some optional fields may not be stored in database.',
          images: uploadedImages
        })
      }

      if (dbError) {
        // If still error, try with absolute minimum required fields
        const minimalData: any = {
          title,
          mission_uid: missionUid, // mission_uid is required (NOT NULL constraint)
          order_no: orderNo, // order_no is required (NOT NULL constraint)
          object_path: objectPath // object_path is required (NOT NULL constraint)
        }
        minimalData.assets_bucket = assetsBucket
        if (assetsPrefix) {
          minimalData.assets_prefix = assetsPrefix
        }
        minimalData.unlock_playground = true
        minimalData.unlocks_projects = true
        
        const result3 = await supabaseAdmin
          .from('missions')
          .insert(minimalData)
          .select()
          .single()

        missionRecord = result3.data
        dbError = result3.error

        if (dbError) {
          return NextResponse.json(
            { error: `Database error: ${dbError.message}. Please check your missions table schema. Required columns: title` },
            { status: 500 }
          )
        }

        // Try to store mission JSON in missions-json storage bucket
        try {
          // Check if missions-json bucket exists
          const { data: buckets } = await supabaseAdmin.storage.listBuckets()
          const jsonBucketExists = buckets?.some(b => b.name === jsonBucketName)
          
          if (!jsonBucketExists) {
            const { error: createError } = await supabaseAdmin.storage.createBucket(jsonBucketName, {
              public: true,
              allowedMimeTypes: ['application/json'],
              fileSizeLimit: 10485760 // 10MB
            })
            
            if (createError && !createError.message.includes('already exists')) {
              console.error('Error creating JSON bucket:', createError)
            }
          }

          const { error: jsonUploadError } = await supabaseAdmin.storage
            .from(jsonBucketName)
            .upload(jsonFileName, jsonFile, {
              cacheControl: '3600',
              upsert: false
            })

          if (!jsonUploadError) {
            const { data: jsonUrlData } = supabaseAdmin.storage
              .from(jsonBucketName)
              .getPublicUrl(jsonFileName)

            return NextResponse.json({
              success: true,
              mission: missionRecord,
              message: 'Mission uploaded successfully (JSON stored in storage bucket)',
              jsonUrl: jsonUrlData?.publicUrl,
              images: uploadedImages
            })
          }
        } catch (storageError) {
          console.error('Storage upload error in fallback:', storageError)
        }

        return NextResponse.json({
          success: true,
          mission: missionRecord,
          message: 'Mission basic metadata uploaded. Some fields may be missing. Full JSON stored separately.',
          images: uploadedImages
        })
      }
    } else if (dbError) {
      // Some other database error
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      )
    }

    // Success - mission was inserted
    if (!missionRecord) {
      return NextResponse.json(
        { error: 'Failed to insert mission record' },
        { status: 500 }
      )
    }

    // Always upload JSON file to storage bucket after successful insert
    let jsonUrl: string | null = null
    try {
      // Check if missions-json bucket exists, create if not
      const { data: buckets } = await supabaseAdmin.storage.listBuckets()
      const jsonBucketExists = buckets?.some(b => b.name === jsonBucketName)
      
      if (!jsonBucketExists) {
        const { error: createError } = await supabaseAdmin.storage.createBucket(jsonBucketName, {
          public: true,
          allowedMimeTypes: ['application/json'],
          fileSizeLimit: 10485760 // 10MB
        })
        
        if (createError && !createError.message.includes('already exists')) {
          console.error('Error creating JSON bucket:', createError)
        }
      }

      // Upload JSON file to missions-json bucket
      const { error: jsonUploadError } = await supabaseAdmin.storage
        .from(jsonBucketName)
        .upload(jsonFileName, jsonFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (jsonUploadError) {
        console.error('Error uploading JSON to storage:', jsonUploadError)
      } else {
        // Get public URL
        const { data: jsonUrlData } = supabaseAdmin.storage
          .from(jsonBucketName)
          .getPublicUrl(jsonFileName)
        
        jsonUrl = jsonUrlData?.publicUrl || null
      }
    } catch (storageError) {
      console.error('Storage upload error:', storageError)
      // Continue even if storage upload fails - database insert was successful
    }

    return NextResponse.json({
      success: true,
      mission: missionRecord,
      message: jsonUrl 
        ? 'Mission uploaded successfully. JSON file stored in storage.' 
        : 'Mission uploaded to database. JSON storage upload may have failed.',
      jsonUrl: jsonUrl,
      images: uploadedImages,
      imagePaths
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload mission' },
      { status: 500 }
    )
  }
}

