'use client'

import { useEffect, useRef, useState } from 'react'
import { Wand2, Download, Plus, Trash2, Upload } from 'lucide-react'

const STORAGE_KEY = 'mission-generator-form'

const createEmptyBlock = () => ({
  image: '',
  alt: '',
  description: ''
})

const createEmptyMcq = () => ({
  compalsary: null as boolean | null,
  question: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  feedback: { success: '', retry: '' }
})

const createEmptyStep = () => ({
  title: '',
  points: 0,
  instruction: '',
  note: '',
  image: '',
  hint: '',
  important: '',
  blocks: [createEmptyBlock()],
  tryThis: '',
  whyItWorks: '',
  mcq: createEmptyMcq()
})

const createDefaultFormData = () => ({
    version: 1,
    layout: 'BlocklySplitLayout',
    title: '',
    description: '',
    mission_time: '',
    Difficulty: 1,
    missionPageImage: '',
    intro: {
      image: '',
      timeAllocated: '',
      description: ''
    },
    learn_before_you_code: [{ topic: '', explanation: '' }],
    requirements: [''],
    blocks_used: [''],
  steps: [createEmptyStep()],
    mission_reference_code: '',
    report_card: [{ task: '', points: 0 }],
    total_points: 0,
    learning_outcomes: [''],
    resources: [{ type: 'image', path: '' }]
  })

type FormDataState = ReturnType<typeof createDefaultFormData>

const getBareFileName = (path: string) => {
  if (!path) return ''
  const parts = path.trim().split('/')
  return parts[parts.length - 1] || path
}

const sanitizeFileName = (name: string) =>
  getBareFileName(name)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    || 'asset'

const sanitizeMissionUid = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase() || `MISSION-${Date.now()}`

const notifyAdmin = (message: string) => {
  if (typeof window !== 'undefined' && message) {
    window.alert(message)
  }
}

interface ImageDropZoneProps {
  title: string
  path: string
  previewUrl?: string
  file?: File
  onSelect: (file: File) => void
  onRemove?: () => void
}

function ImageDropZone({ title, path, previewUrl, file, onSelect, onRemove }: ImageDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [resolvedPreview, setResolvedPreview] = useState<string | null>(null)

  useEffect(() => {
    if (previewUrl) {
      setResolvedPreview(previewUrl)
      return
    }

    if (file) {
      const url = URL.createObjectURL(file)
      setResolvedPreview(url)
      return () => URL.revokeObjectURL(url)
    }

    if (
      typeof path === 'string' &&
      (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:'))
    ) {
      setResolvedPreview(path)
    } else {
      setResolvedPreview(null)
    }

    return undefined
  }, [previewUrl, file, path])

  const openFilePicker = () => {
    inputRef.current?.click()
  }

  const handleFileSelection = (file?: File | null) => {
    if (file) {
      onSelect(file)
    }
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(event) => {
        event.preventDefault()
        const file = event.dataTransfer.files?.[0]
        handleFileSelection(file)
      }}
      className="w-full rounded-md border-2 border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-center text-sm text-gray-600 transition hover:border-blue-400 hover:bg-blue-50"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          handleFileSelection(file)
          if (event.target) {
            event.target.value = ''
          }
        }}
      />

      {path ? (
        <div className="space-y-2">
          {resolvedPreview ? (
            <img
              src={resolvedPreview}
              alt={title}
              className="mx-auto max-h-32 rounded border object-contain"
            />
          ) : (
            <p className="text-xs text-gray-500">Preview unavailable</p>
          )}
          <p className="font-medium text-gray-800 break-all">
            {path.split('/').pop() || path}
          </p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={openFilePicker}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
            >
              Change image
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="font-medium text-gray-800">{title}</p>
          <p>Drag & drop an image here, or click to browse</p>
          <button
            type="button"
            onClick={openFilePicker}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            Browse files
          </button>
        </div>
      )}
    </div>
  )
}

const normalizeFormData = (raw: any): FormDataState => {
  const defaults = createDefaultFormData()

  const normalizeSteps = (steps: any): FormDataState['steps'] => {
    if (!Array.isArray(steps) || steps.length === 0) return defaults.steps
    return steps.map((step: any) => {
      const baseStep = createEmptyStep()
      return {
        ...baseStep,
        ...step,
        blocks:
          Array.isArray(step?.blocks) && step.blocks.length > 0
            ? step.blocks.map((block: any) => ({
                image: block?.image || '',
                alt: block?.alt || '',
                description: block?.description || ''
              }))
            : baseStep.blocks,
        mcq: {
          compalsary: (() => {
            const value = step?.mcq?.compalsary
            if (typeof value === 'boolean') return value
            if (typeof value === 'string') {
              const lowered = value.toLowerCase()
              if (lowered === 'true') return true
              if (lowered === 'false') return false
            }
            return null
          })(),
          question: step?.mcq?.question ?? '',
          options:
            Array.isArray(step?.mcq?.options) && step.mcq.options.length === 4
              ? step.mcq.options
              : baseStep.mcq.options,
          correctAnswer:
            typeof step?.mcq?.correctAnswer === 'number'
              ? step.mcq.correctAnswer
              : baseStep.mcq.correctAnswer,
          feedback: {
            success: step?.mcq?.feedback?.success ?? '',
            retry: step?.mcq?.feedback?.retry ?? ''
          }
        }
      }
    })
  }

  return {
    ...defaults,
    ...raw,
    intro: {
      ...defaults.intro,
      ...(raw?.intro || {})
    },
    learn_before_you_code: Array.isArray(raw?.learn_before_you_code) && raw.learn_before_you_code.length
      ? raw.learn_before_you_code.map((item: any) => ({
          topic: item?.topic ?? '',
          explanation: item?.explanation ?? ''
        }))
      : defaults.learn_before_you_code,
    requirements: Array.isArray(raw?.requirements) && raw.requirements.length
      ? raw.requirements
      : defaults.requirements,
    blocks_used: Array.isArray(raw?.blocks_used) && raw.blocks_used.length
      ? raw.blocks_used
      : defaults.blocks_used,
    steps: normalizeSteps(raw?.steps),
    report_card: Array.isArray(raw?.report_card) && raw.report_card.length
      ? raw.report_card.map((item: any) => ({
          task: item?.task ?? '',
          points: typeof item?.points === 'number' ? item.points : 0
        }))
      : defaults.report_card,
    learning_outcomes: Array.isArray(raw?.learning_outcomes) && raw.learning_outcomes.length
      ? raw.learning_outcomes
      : defaults.learning_outcomes,
    resources: Array.isArray(raw?.resources) && raw.resources.length
      ? raw.resources.map((resource: any) => ({
          type: resource?.type ?? 'image',
          path: resource?.path ?? ''
        }))
      : defaults.resources
  }
}

const UploadPrompt = ({
  title,
  description,
  fields,
  confirmLabel,
  onConfirm,
  onCancel,
  loading
}: {
  title: string
  description: string
  fields: Array<{
    label: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
    helper?: string
  }>
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
      <div className="mt-4 space-y-4">
        {fields.map((field, index) => (
          <div key={index}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
            </label>
            <input
              type="text"
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              placeholder={field.placeholder}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {field.helper && (
              <p className="mt-1 text-xs text-gray-500">{field.helper}</p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          )}
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
)

export default function MissionGeneratorPage() {
  const [jsonOutput, setJsonOutput] = useState('')
  const [formData, setFormData] = useState<FormDataState>(() => {
    if (typeof window === 'undefined') {
      return createDefaultFormData()
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return normalizeFormData(parsed)
      }
    } catch (_err) {
      // Ignore parse errors and fall back to defaults
    }
    return createDefaultFormData()
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(formData))
    } catch (_err) {
      // Ignore storage errors (e.g., quota exceeded)
    }
  }, [formData])

  const [assetFiles, setAssetFiles] = useState<Record<string, File>>({})
  const [assetPreviews, setAssetPreviews] = useState<Record<string, string>>({})
  const [uploadingToSupabase, setUploadingToSupabase] = useState(false)
  const [uploadErrorMessage, setUploadErrorMessage] = useState('')
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState('')
  const [uploadingImages, setUploadingImages] = useState(false)
  const [imageUploadError, setImageUploadError] = useState('')
  const [imageUploadSuccess, setImageUploadSuccess] = useState('')
  const [customMissionUid, setCustomMissionUid] = useState('')
  const [customImageFolder, setCustomImageFolder] = useState('')
  const [customOrderNo, setCustomOrderNo] = useState('')
  const [showMissionPrompt, setShowMissionPrompt] = useState<null | 'images' | 'json' | 'complete'>(null)
  const [loadMissionUid, setLoadMissionUid] = useState('')
  const [loadingMission, setLoadingMission] = useState(false)
  const [loadMissionError, setLoadMissionError] = useState('')
  const [editingMissionUid, setEditingMissionUid] = useState<string | null>(null)
  const [editingMode, setEditingMode] = useState<'table' | 'storage' | null>(null)
  const [editingStorageFile, setEditingStorageFile] = useState<string | null>(null)
  const [jsonFileOptions, setJsonFileOptions] = useState<string[]>([])
  const [loadingJsonFiles, setLoadingJsonFiles] = useState(false)
  const [jsonFilesError, setJsonFilesError] = useState('')
  const [missionOptions, setMissionOptions] = useState<Array<{ mission_uid: string; title: string }>>([])
  const [loadingMissions, setLoadingMissions] = useState(false)
  const [selectedMissionUid, setSelectedMissionUid] = useState('')

  // Add a new state for the combined upload process
  const [uploadingComplete, setUploadingComplete] = useState(false)

  // Add new state to track image replacements
  const [replacedImages, setReplacedImages] = useState<Record<string, string>>({})

  const assignAssetName = (file: File, previousName?: string) => {
    if (!file) return previousName || ''

    const base = sanitizeFileName(file.name)
    const lastDot = base.lastIndexOf('.')
    const namePart = lastDot !== -1 ? base.slice(0, lastDot) : base
    const extension = lastDot !== -1 ? base.slice(lastDot) : ''

    let assignedName = previousName || base

    setAssetFiles((prev) => {
      const next = { ...prev }

      if (previousName && next[previousName]) {
        // Track image replacement
        setReplacedImages((prevReplaced) => ({
          ...prevReplaced,
          [previousName]: 'replaced'
        }))
        
        delete next[previousName]
        setAssetPreviews((prevPreviews) => {
          if (prevPreviews[previousName]) {
            URL.revokeObjectURL(prevPreviews[previousName])
          }
          const updated = { ...prevPreviews }
          delete updated[previousName]
          return updated
        })
      }

      let candidate = base
      let counter = 1
      while (next[candidate]) {
        candidate = `${namePart}-${counter}${extension}`
        counter += 1
      }

      assignedName = candidate
      next[candidate] = file
      return next
    })

    setAssetPreviews((prev) => {
      const next = { ...prev }
      if (previousName && next[previousName]) {
        URL.revokeObjectURL(next[previousName])
        delete next[previousName]
      }
      next[assignedName] = URL.createObjectURL(file)
      return next
    })

    return assignedName
  }

  const removeAssetName = (name?: string) => {
    if (!name) return
    setAssetFiles((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, name)) {
        return prev
      }
      const next = { ...prev }
      delete next[name]
      return next
    })
    setAssetPreviews((prev) => {
      if (!prev[name]) {
        return prev
      }
      URL.revokeObjectURL(prev[name])
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  // Add function to delete replaced images
  const deleteReplacedImages = async (missionUid: string) => {
    const imagesToDelete = Object.keys(replacedImages)
    if (imagesToDelete.length === 0) return

    try {
      const deletePromises = imagesToDelete.map(async (imagePath) => {
        const response = await fetch('/api/missions/delete-image', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mission_uid: missionUid,
            image_path: imagePath,
            image_folder: customImageFolder.trim() || undefined
          })
        })
        
        if (!response.ok) {
          const result = await response.json()
          console.warn(`Failed to delete ${imagePath}:`, result.error)
        }
      })

      await Promise.all(deletePromises)
      console.log(`Deleted ${imagesToDelete.length} replaced images`)
    } catch (error: any) {
      console.warn('Some images may not have been deleted:', error.message)
    }
  }

  const generateJSON = () => {
    const json = JSON.stringify(formData, null, 2)
    setJsonOutput(json)
  }

  const stripAssetPrefixes = (data: FormDataState): FormDataState => {
    const clone = JSON.parse(JSON.stringify(data)) as FormDataState

    if (clone.missionPageImage) {
      clone.missionPageImage = getBareFileName(clone.missionPageImage)
    }
    if (clone.intro?.image) {
      clone.intro.image = getBareFileName(clone.intro.image)
    }

    clone.steps = clone.steps.map((step) => ({
      ...step,
      image: step.image ? getBareFileName(step.image) : step.image,
      blocks:
        step.blocks?.map((block: any) => ({
          ...block,
          image: block.image ? getBareFileName(block.image) : block.image
        })) || []
    }))

    clone.resources = clone.resources.map((resource) => ({
      ...resource,
      path: resource.path ? getBareFileName(resource.path) : resource.path
    }))

    return clone
  }

  const downloadJSON = () => {
    const blob = new Blob([jsonOutput], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${formData.title.replace(/\s+/g, '_')}_mission.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const updateField = (path: string, value: any) => {
    const keys = path.split('.')
    setFormData(prev => {
      const newData = JSON.parse(JSON.stringify(prev)) // Deep clone
      let current: any = newData
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]]
      }
      current[keys[keys.length - 1]] = value
      return newData
    })
  }

  const addArrayItem = (path: string, item: any) => {
    const keys = path.split('.')
    setFormData(prev => {
      const newData = JSON.parse(JSON.stringify(prev)) // Deep clone
      let current: any = newData
      
      // Navigate to the array (before the last key)
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]]
      }
      
      // Now push to the array at the last key
      const array = current[keys[keys.length - 1]]
      if (Array.isArray(array)) {
        array.push({ ...item })
      }
      
      return newData
    })
  }

  const updateArrayItem = (path: string, index: number, field: string, value: any) => {
    const keys = path.split('.')
    setFormData(prev => {
      const newData = JSON.parse(JSON.stringify(prev)) // Deep clone
      let current: any = newData
      
      // Navigate to the array
      for (let i = 0; i < keys.length; i++) {
        if (!current || !current[keys[i]]) {
          return newData
        }
        current = current[keys[i]]
      }
      
      // Now update the item in the array
      if (Array.isArray(current) && current[index]) {
        current[index][field] = value
      }
      
      return newData
    })
  }

  const removeArrayItem = (path: string, index: number) => {
    const keys = path.split('.')
    setFormData(prev => {
      const newData = JSON.parse(JSON.stringify(prev)) // Deep clone
      let current: any = newData
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]]
      }
      current.splice(index, 1)
      return newData
    })
  }

  const handleResetForm = () => {
    const defaults = createDefaultFormData()
    setFormData(defaults)
    setJsonOutput('')
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY)
    }
    setAssetFiles({})
    setAssetPreviews({})
    setReplacedImages({}) // Clear replaced images tracking
    setUploadErrorMessage('')
    setUploadSuccessMessage('')
    setImageUploadError('')
    setImageUploadSuccess('')
    setCustomMissionUid('')
    setCustomImageFolder('')
    setCustomOrderNo('')
    setLoadMissionUid('')
    setLoadMissionError('')
    setEditingMissionUid(null)
    setEditingMode(null)
    setEditingStorageFile(null)
  }

  const handleStepImageSelection = (stepIndex: number, file: File) => {
    const newName = assignAssetName(file, formData.steps[stepIndex]?.image)
    setFormData((prev) => {
      const newData = JSON.parse(JSON.stringify(prev)) as FormDataState
      if (newData.steps[stepIndex]) {
        newData.steps[stepIndex].image = newName
      }
      return newData
    })
  }

  const handleRemoveStepImage = (stepIndex: number) => {
    const currentPath = formData.steps[stepIndex]?.image
    if (currentPath) {
      removeAssetName(currentPath)
      setFormData((prev) => {
        const newData = JSON.parse(JSON.stringify(prev)) as FormDataState
        if (newData.steps[stepIndex]) {
          newData.steps[stepIndex].image = ''
        }
        return newData
      })
    }
  }

  const handleMissionImageSelection = (file: File) => {
    const newName = assignAssetName(
      file,
      formData.missionPageImage ? formData.missionPageImage : undefined
    )
    setFormData((prev) => ({
      ...prev,
      missionPageImage: newName
    }))
  }

  const handleMissionImageRemove = () => {
    if (!formData.missionPageImage) return
    removeAssetName(formData.missionPageImage)
    setFormData((prev) => ({
      ...prev,
      missionPageImage: ''
    }))
  }

  const handleIntroImageSelection = (file: File) => {
    const newName = assignAssetName(file, formData.intro.image)
    setFormData((prev) => ({
      ...prev,
      intro: {
        ...prev.intro,
        image: newName
      }
    }))
  }

  const handleIntroImageRemove = () => {
    if (!formData.intro.image) return
    removeAssetName(formData.intro.image)
    setFormData((prev) => ({
      ...prev,
      intro: {
        ...prev.intro,
        image: ''
      }
    }))
  }

  const handleBlockImageSelection = (stepIndex: number, blockIndex: number, file: File) => {
    const previousName = formData.steps[stepIndex]?.blocks?.[blockIndex]?.image
    const newName = assignAssetName(file, previousName)
    setFormData((prev) => {
      const newData = JSON.parse(JSON.stringify(prev)) as FormDataState
      if (!newData.steps[stepIndex].blocks) {
        newData.steps[stepIndex].blocks = []
      }
      if (!newData.steps[stepIndex].blocks[blockIndex]) {
        newData.steps[stepIndex].blocks[blockIndex] = createEmptyBlock()
      }
      newData.steps[stepIndex].blocks[blockIndex].image = newName
      return newData
    })
  }

  const handleBlockImageRemove = (stepIndex: number, blockIndex: number) => {
    const currentPath = formData.steps[stepIndex]?.blocks?.[blockIndex]?.image
    if (!currentPath) return
    removeAssetName(currentPath)
    setFormData((prev) => {
      const newData = JSON.parse(JSON.stringify(prev)) as FormDataState
      if (
        newData.steps[stepIndex] &&
        newData.steps[stepIndex].blocks &&
        newData.steps[stepIndex].blocks[blockIndex]
      ) {
        newData.steps[stepIndex].blocks[blockIndex].image = ''
      }
      return newData
    })
  }

  const handleRemoveBlock = (stepIndex: number, blockIndex: number) => {
    const block = formData.steps[stepIndex]?.blocks?.[blockIndex]
    if (block?.image) {
      removeAssetName(block.image)
    }
    setFormData((prev) => {
      const newData = JSON.parse(JSON.stringify(prev)) as FormDataState
      if (newData.steps[stepIndex]?.blocks) {
        newData.steps[stepIndex].blocks.splice(blockIndex, 1)
      }
      return newData
    })
  }

  const handleResourceImageSelection = (resourceIndex: number, file: File) => {
    const previousName = formData.resources[resourceIndex]?.path
    const newName = assignAssetName(file, previousName)
    setFormData((prev) => {
      const newData = JSON.parse(JSON.stringify(prev)) as FormDataState
      if (!newData.resources[resourceIndex]) {
        newData.resources[resourceIndex] = { type: 'image', path: newName }
      } else {
        newData.resources[resourceIndex].type = 'image'
        newData.resources[resourceIndex].path = newName
      }
      return newData
    })
  }

  const handleResourceImageRemove = (resourceIndex: number) => {
    const currentPath = formData.resources[resourceIndex]?.path
    if (!currentPath) return
    removeAssetName(currentPath)
    setFormData((prev) => {
      const newData = JSON.parse(JSON.stringify(prev)) as FormDataState
      if (newData.resources[resourceIndex]) {
        newData.resources[resourceIndex].path = ''
      }
      return newData
    })
  }

  const determineMissionUid = (data: FormDataState) => {
    const candidate =
      customMissionUid.trim() ||
      data.mission_reference_code?.toString().trim() ||
      (data as any).mission_uid?.toString().trim() ||
      data.title?.toString().trim() ||
      ''
    return sanitizeMissionUid(candidate)
  }

  const loadMissionFromSupabase = async () => {
    const uid = loadMissionUid.trim()
    if (!uid) {
      setLoadMissionError('Enter a mission UID or JSON file name (e.g., 14.json).')
      return
    }

    const isJsonFile = uid.toLowerCase().endsWith('.json')

    setLoadingMission(true)
    setLoadMissionError('')

    try {
      if (isJsonFile) {
        const response = await fetch(
          `/api/missions/storage-json/${encodeURIComponent(uid)}`
        )
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error || 'Failed to load mission JSON')
        }

        const missionJson = result.mission
        const normalized = normalizeFormData(missionJson || {})
        const stripped = stripAssetPrefixes(normalized)
        setFormData(stripped)
        setJsonOutput(JSON.stringify(stripped, null, 2))

        setCustomMissionUid(
          missionJson?.mission_uid?.toString?.().trim() || ''
        )
        setCustomImageFolder('')
        setCustomOrderNo('')
        setEditingMissionUid(null)
        setEditingMode('storage')
        setEditingStorageFile(result.file || uid)
      } else {
        const response = await fetch(`/api/missions/${encodeURIComponent(uid)}`)
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error || 'Failed to load mission')
        }

        const mission = result.mission
        const normalized = normalizeFormData(mission?.mission_data || {})
        const stripped = stripAssetPrefixes(normalized)
        setFormData(stripped)
        setJsonOutput(JSON.stringify(stripped, null, 2))

        const missionUid = mission?.mission_uid || uid
        setCustomMissionUid(missionUid)
        setCustomImageFolder(mission?.assets_prefix || '')
        setCustomOrderNo(
          mission?.order_no !== undefined && mission?.order_no !== null
            ? String(mission.order_no)
            : ''
        )
        setEditingMissionUid(missionUid)
        setEditingMode('table')
        setEditingStorageFile(null)
      }

      setUploadErrorMessage('')
      setUploadSuccessMessage('')
      setImageUploadError('')
      setImageUploadSuccess('')
      setAssetFiles({})
      setAssetPreviews({})
    } catch (error: any) {
      setLoadMissionError(error?.message || 'Unable to load mission.')
    } finally {
      setLoadingMission(false)
    }
  }

  const fetchJsonFileOptions = async () => {
    setLoadingJsonFiles(true)
    setJsonFilesError('')
    try {
      const response = await fetch('/api/missions/storage-json')
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load JSON file list.')
      }
      setJsonFileOptions(Array.isArray(result.files) ? result.files : [])
    } catch (error: any) {
      setJsonFilesError(error?.message || 'Unable to retrieve JSON file list.')
    } finally {
      setLoadingJsonFiles(false)
    }
  }

  const fetchMissionsFromDatabase = async () => {
    setLoadingMissions(true)
    try {
      const response = await fetch('/api/missions')
      const result = await response.json()
      
      console.log('Missions API response:', result)
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load missions.')
      }
      
      const missions = Array.isArray(result.missions) ? result.missions : []
      console.log('Fetched missions:', missions)
      
      const mappedMissions = missions
        .filter((m: any) => m.mission_uid) // Only include missions with mission_uid
        .map((m: any) => ({
          mission_uid: m.mission_uid || m.id,
          title: m.title || 'Untitled Mission'
        }))
        .sort((a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title))
      
      console.log('Mapped mission options:', mappedMissions)
      setMissionOptions(mappedMissions)
    } catch (error: any) {
      console.error('Error fetching missions:', error)
      setMissionOptions([])
    } finally {
      setLoadingMissions(false)
    }
  }

  useEffect(() => {
    fetchJsonFileOptions()
    fetchMissionsFromDatabase()
  }, [])

  const handleMissionSelect = async (missionUid: string) => {
    setSelectedMissionUid(missionUid)
    setLoadMissionUid(missionUid)
    if (missionUid) {
      // Load the mission using the selected mission_uid
      await loadMissionFromSupabase()
    }
  }

  const handleStandaloneImageUpload = async () => {
    setImageUploadError('')
    setImageUploadSuccess('')

    const missionUid = determineMissionUid(formData)
    if (!missionUid) {
      setImageUploadError('Provide a mission UID or reference code before uploading images.')
      return
    }

    const pendingEntries = Object.entries(assetFiles)
    if (pendingEntries.length === 0) {
      setImageUploadError('No pending images to upload.')
      return
    }

    setUploadingImages(true)

    try {
      const payload = new FormData()
      payload.append('mission_uid', missionUid)
      if (customImageFolder.trim()) {
        payload.append('image_folder', customImageFolder.trim())
      }

      pendingEntries.forEach(([path, file]) => {
        const filename = path.split('/').pop() || sanitizeFileName(file.name)
        const renamedFile = new File([file], filename, {
          type: file.type || 'application/octet-stream',
          lastModified: file.lastModified
        })
        payload.append('images', renamedFile)
        payload.append('paths[]', path)
      })

      const response = await fetch('/api/missions/upload-images', {
        method: 'POST',
        body: payload
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to upload images')
      }

      const uploadedMap: Record<string, string> = result.uploadedImages || {}

      setAssetFiles({})
      setAssetPreviews({})

      setImageUploadSuccess(
        result.message ||
          `Uploaded ${Object.keys(uploadedMap).length} image${
            Object.keys(uploadedMap).length === 1 ? '' : 's'
          } to Supabase storage.`
      )

      // handleResetForm()
      // setShowMissionPrompt(null)
    } catch (error: any) {
      setImageUploadError(error?.message || 'Failed to upload images to Supabase.')
    } finally {
      setUploadingImages(false)
    }
  }

  const handleRemoveResource = (resourceIndex: number) => {
    const resource = formData.resources[resourceIndex]
    if (resource?.type === 'image' && resource.path) {
      removeAssetName(resource.path)
    }
    setFormData((prev) => {
      const newData = JSON.parse(JSON.stringify(prev)) as FormDataState
      newData.resources.splice(resourceIndex, 1)
      return newData
    })
  }

  const handleRemoveStep = (stepIndex: number) => {
    const step = formData.steps[stepIndex]
    if (!step) return
    if (step.image) {
      removeAssetName(step.image)
    }
    step.blocks?.forEach((block: any) => {
      if (block?.image) {
        removeAssetName(block.image)
      }
    })
    setFormData((prev) => {
      const newData = JSON.parse(JSON.stringify(prev)) as FormDataState
      newData.steps.splice(stepIndex, 1)
      return newData
    })
  }

  const handleDownloadPackage = async () => {
    // Dynamically import jszip using require to avoid type errors at build time
    let JSZip
    try {
      // @ts-ignore
      JSZip = (await import('jszip')).default
    } catch (e) {
      // Fallback if import fails (for SSR, e.g.)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      JSZip = require('jszip')
    }
    const zip = new JSZip()

    const jsonFileName = `${sanitizeFileName(formData.title || 'mission') || 'mission'}.json`
    const jsonContent = jsonOutput || JSON.stringify(formData, null, 2)
    zip.file(jsonFileName, jsonContent)

    Object.entries(assetFiles).forEach(([path, file]) => {
      zip.file(path, file)
    })

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${sanitizeFileName(formData.title || 'mission') || 'mission'}-package.zip`
    link.click()
    URL.revokeObjectURL(url)
  }

  const uploadToSupabase = async () => {
    setUploadErrorMessage('')
    setUploadSuccessMessage('')
    setUploadingToSupabase(true)

    try {
      const missionJson = JSON.stringify(formData, null, 2)
      setJsonOutput(missionJson)

      const jsonBlob = new Blob([missionJson], { type: 'application/json' })
      const jsonFile = new File([jsonBlob], 'mission.json', { type: 'application/json' })

      const missionUid = determineMissionUid(formData)
      if (editingMode === 'storage' && editingStorageFile) {
        const response = await fetch(
          `/api/missions/storage-json/${encodeURIComponent(editingStorageFile)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mission_data: formData })
          }
        )

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || result.message || 'Failed to update mission JSON.')
        }

        const successMsg =
          result.message || `Mission JSON '${editingStorageFile}' updated successfully.`
        setUploadSuccessMessage(successMsg)
        notifyAdmin(successMsg)
      } else {
        const payload = new FormData()
        payload.append('json', jsonFile)

        const title = formData.title?.trim()
        if (title) {
          payload.append('title', title)
        }

        if (missionUid) {
          payload.append('mission_uid', missionUid)
        }
        if (customOrderNo.trim()) {
          payload.append('order_no', customOrderNo.trim())
        }
        if (customImageFolder.trim()) {
          payload.append('image_folder', customImageFolder.trim())
        }

        Object.entries(assetFiles).forEach(([path, file]) => {
          const filename = path.split('/').pop() || sanitizeFileName(file.name)
          const renamedFile = new File([file], filename, {
            type: file.type || 'application/octet-stream',
            lastModified: file.lastModified
          })
          payload.append('images', renamedFile)
        })

        if (editingMode === 'table' && editingMissionUid) {
          const response = await fetch(`/api/missions/${encodeURIComponent(missionUid)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mission_data: formData,
              title: formData.title,
              description: formData.description,
              order_no: customOrderNo ? Number(customOrderNo) : undefined,
              assets_prefix: customImageFolder || null
            })
          })

          const result = await response.json()

          if (!response.ok) {
            throw new Error(result.error || result.message || 'Failed to update mission.')
          }

          const successMsg = result.message || 'Mission updated successfully!'
          setUploadSuccessMessage(successMsg)
          notifyAdmin(successMsg)
        } else {
          const response = await fetch('/api/missions/upload', {
            method: 'PUT',
            body: payload
          })

          const result = await response.json()

          if (!response.ok) {
            throw new Error(result.error || result.message || 'Failed to upload mission.')
          }

          const successMsg =
            result.message ||
            `Mission uploaded successfully!${
              result.images?.length ? ` ${result.images.length} images uploaded.` : ''
            }`
          setUploadSuccessMessage(successMsg)
          notifyAdmin(successMsg)
        }
      }

      handleResetForm()
      setShowMissionPrompt(null)
    } catch (error: any) {
      setUploadErrorMessage(error?.message || 'Failed to upload mission to Supabase.')
    } finally {
      setUploadingToSupabase(false)
    }
  }

  // Create a new combined upload function
  const handleCompleteUpload = async () => {
    setUploadErrorMessage('')
    setUploadSuccessMessage('')
    setImageUploadError('')
    setImageUploadSuccess('')
    setUploadingComplete(true)

    try {
      const missionUid = determineMissionUid(formData)
      if (!missionUid) {
        throw new Error('Mission UID is required for uploading.')
      }

      // Step 1: Delete replaced images if we're editing an existing mission
      if ((editingMode === 'table' || editingMode === 'storage') && Object.keys(replacedImages).length > 0) {
        await deleteReplacedImages(missionUid)
        setReplacedImages({}) // Clear replaced images tracking
      }

      // Step 2: Upload new/updated images if there are any pending
      const pendingEntries = Object.entries(assetFiles)
      if (pendingEntries.length > 0) {
        const imagePayload = new FormData()
        imagePayload.append('mission_uid', missionUid)
        if (customImageFolder.trim()) {
          imagePayload.append('image_folder', customImageFolder.trim())
        }

        pendingEntries.forEach(([path, file]) => {
          const filename = path.split('/').pop() || sanitizeFileName(file.name)
          const renamedFile = new File([file], filename, {
            type: file.type || 'application/octet-stream',
            lastModified: file.lastModified
          })
          imagePayload.append('images', renamedFile)
          imagePayload.append('paths[]', path)
        })

        const imageResponse = await fetch('/api/missions/upload-images', {
          method: 'POST',
          body: imagePayload
        })

        const imageResult = await imageResponse.json()

        if (!imageResponse.ok) {
          throw new Error(imageResult.error || 'Failed to upload images')
        }

        // Clear uploaded assets
        setAssetFiles({})
        setAssetPreviews({})
        
        setImageUploadSuccess(
          imageResult.message ||
            `Uploaded ${Object.keys(imageResult.uploadedImages || {}).length} image${
              Object.keys(imageResult.uploadedImages || {}).length === 1 ? '' : 's'
            } to storage.`
        )
      }

      // Step 3: Upload mission JSON
      const missionJson = JSON.stringify(formData, null, 2)
      setJsonOutput(missionJson)

      const jsonBlob = new Blob([missionJson], { type: 'application/json' })
      const jsonFile = new File([jsonBlob], 'mission.json', { type: 'application/json' })
      
      if (editingMode === 'storage' && editingStorageFile) {
        const response = await fetch(
          `/api/missions/storage-json/${encodeURIComponent(editingStorageFile)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mission_data: formData })
          }
        )

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || result.message || 'Failed to update mission JSON.')
        }

        const successMsg =
          result.message || `Mission JSON '${editingStorageFile}' updated successfully.`
        setUploadSuccessMessage(successMsg)
        notifyAdmin(successMsg)
      } else {
        const payload = new FormData()
        payload.append('json', jsonFile)

        const title = formData.title?.trim()
        if (title) {
          payload.append('title', title)
        }

        if (missionUid) {
          payload.append('mission_uid', missionUid)
        }
        if (customOrderNo.trim()) {
          payload.append('order_no', customOrderNo.trim())
        }
        if (customImageFolder.trim()) {
          payload.append('image_folder', customImageFolder.trim())
        }

        // Note: No need to append images here since they were already uploaded in step 2

        if (editingMode === 'table' && editingMissionUid) {
          const response = await fetch(`/api/missions/${encodeURIComponent(missionUid)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mission_data: formData,
              title: formData.title,
              description: formData.description,
              order_no: customOrderNo ? Number(customOrderNo) : undefined,
              assets_prefix: customImageFolder || null
            })
          })

          const result = await response.json()

          if (!response.ok) {
            throw new Error(result.error || result.message || 'Failed to update mission.')
          }

          const successMsg = result.message || 'Mission updated successfully!'
          setUploadSuccessMessage(successMsg)
          notifyAdmin(successMsg)
        } else {
          const response = await fetch('/api/missions/upload', {
            method: 'PUT',
            body: payload
          })

          const result = await response.json()

          if (!response.ok) {
            throw new Error(result.error || result.message || 'Failed to upload mission.')
          }

          const successMsg =
            result.message || 'Mission uploaded successfully!'
          setUploadSuccessMessage(successMsg)
          notifyAdmin(successMsg)
        }
      }

      handleResetForm()
    } catch (error: any) {
      setUploadErrorMessage(error?.message || 'Failed to complete upload.')
      setImageUploadError(error?.message || 'Failed to complete upload.')
    } finally {
      setUploadingComplete(false)
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mission Generator</h1>
          <p className="mt-1 text-sm text-gray-500">Create mission JSON files following Instructables format</p>
          </div>
          <button
            onClick={handleResetForm}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Clear saved form
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form Section */}
          <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-6">
            <Wand2 className="h-8 w-8 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-900">Mission Details</h2>
          </div>

          <div className="space-y-4">
                <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4">
                  <h3 className="text-sm font-semibold text-gray-900">Load Existing Mission</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Select a mission by title or enter a mission UID to load data for editing.
                  </p>
                  <div className="flex flex-col gap-3">
                    {/* Mission Title Dropdown */}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Select Mission by Title
                        </label>
                        <select
                          value={selectedMissionUid}
                          onChange={(e) => handleMissionSelect(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                        >
                          <option value="">
                            {loadingMissions ? 'Loading missions…' : missionOptions.length === 0 ? 'No missions found' : 'Select mission by title…'}
                          </option>
                          {missionOptions.length > 0 ? (
                            missionOptions.map((mission) => (
                              <option key={mission.mission_uid} value={mission.mission_uid}>
                                {mission.title}
                              </option>
                            ))
                          ) : (
                            !loadingMissions && <option value="" disabled>No missions available</option>
                          )}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={fetchMissionsFromDatabase}
                        disabled={loadingMissions}
                        className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 mt-6"
                      >
                        {loadingMissions ? 'Refreshing…' : 'Refresh'}
                      </button>
                    </div>
                    
                    {/* JSON File Dropdown (keep for backward compatibility) */}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Or Select JSON File
                        </label>
                        <select
                          value={jsonFileOptions.includes(loadMissionUid) ? loadMissionUid : ''}
                          onChange={(e) => {
                            setLoadMissionUid(e.target.value)
                            setSelectedMissionUid('')
                          }}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                        >
                          <option value="">
                            {loadingJsonFiles ? 'Loading JSON files…' : 'Select JSON file…'}
                          </option>
                          {jsonFileOptions.map((file) => (
                            <option key={file} value={file}>
                              {file}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={fetchJsonFileOptions}
                        disabled={loadingJsonFiles}
                        className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 mt-6"
                      >
                        {loadingJsonFiles ? 'Refreshing…' : 'Refresh'}
                      </button>
                    </div>
                    
                    {/* Manual UID Input */}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Or Enter Mission UID
                        </label>
                        <input
                          type="text"
                          value={loadMissionUid}
                          onChange={(e) => {
                            setLoadMissionUid(e.target.value)
                            setSelectedMissionUid('')
                          }}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                          placeholder="e.g., 10 or 14.json"
                        />
                      </div>
                      <button
                        onClick={loadMissionFromSupabase}
                        disabled={loadingMission}
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 mt-6"
                      >
                        {loadingMission && (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        )}
                        Load Mission
                      </button>
                      {editingMode && (
                        <button
                          onClick={handleResetForm}
                          className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 mt-6"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  {loadMissionError && (
                    <p className="mt-2 text-xs text-red-600">{loadMissionError}</p>
                  )}
                  {jsonFilesError && (
                    <p className="mt-2 text-xs text-red-600">{jsonFilesError}</p>
                  )}
                  {editingMode === 'table' && editingMissionUid && !loadMissionError && (
                    <p className="mt-2 text-xs text-green-600">
                      Editing mission <strong>{editingMissionUid}</strong>
                    </p>
                  )}
                  {editingMode === 'storage' && editingStorageFile && !loadMissionError && (
                    <p className="mt-2 text-xs text-green-600">
                      Editing storage file <strong>{editingStorageFile}</strong>
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Version</label>
                    <input
                      type="number"
                      value={formData.version}
                      onChange={(e) => updateField('version', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Layout</label>
                    <input
                      type="text"
                      value={formData.layout}
                      onChange={(e) => updateField('layout', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., Keyboard Pilot"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mission UID (for uploads)
                    </label>
                    <input
                      type="text"
                      value={customMissionUid}
                      onChange={(e) => setCustomMissionUid(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="e.g.,1,2,3,.., 10 "
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Used when uploading images/JSON. Defaults to mission reference code or title.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Image Folder (optional)
                    </label>
                    <input
                      type="text"
                      value={customImageFolder}
                      onChange={(e) => setCustomImageFolder(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="e.g., M10"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Leave empty to store images in <code>MUID/images</code>. Avoid spaces or special characters.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Order Number (optional)
                    </label>
                    <input
                      type="number"
                      value={customOrderNo}
                      onChange={(e) => setCustomOrderNo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="e.g., 10"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      If provided, uses this order_no instead of auto-increment.
                    </p>
                  </div>
                </div>

            <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
              <textarea
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                    placeholder="Mission description..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Mission Time (mins)</label>
                    <input
                      type="number"
                      value={formData.mission_time}
                      onChange={(e) => updateField('mission_time', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
                    <input
                      type="number"
                      value={formData.Difficulty}
                      onChange={(e) => updateField('Difficulty', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="1"
                      max="5"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mission Page Image</label>
                  <ImageDropZone
                    title="Mission page image"
                    path={formData.missionPageImage}
                    previewUrl={
                      formData.missionPageImage ? assetPreviews[formData.missionPageImage] : undefined
                    }
                    file={formData.missionPageImage ? assetFiles[formData.missionPageImage] : undefined}
                    onSelect={handleMissionImageSelection}
                    onRemove={formData.missionPageImage ? handleMissionImageRemove : undefined}
                  />
                </div>

                {/* Intro Section */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Intro</h3>
                  <div className="space-y-3">
                    <ImageDropZone
                      title="Intro image"
                      path={formData.intro.image}
                      previewUrl={
                        formData.intro.image ? assetPreviews[formData.intro.image] : undefined
                      }
                      file={formData.intro.image ? assetFiles[formData.intro.image] : undefined}
                      onSelect={handleIntroImageSelection}
                      onRemove={formData.intro.image ? handleIntroImageRemove : undefined}
                    />
                    <input
                      type="text"
                      value={formData.intro.timeAllocated}
                      onChange={(e) => updateField('intro.timeAllocated', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Time allocated"
                    />
                    <textarea
                      value={formData.intro.description}
                      onChange={(e) => updateField('intro.description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows={2}
                      placeholder="Intro description"
                    />
                  </div>
                </div>

                {/* Learn Before You Code */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Learn Before You Code</h3>
                  {formData.learn_before_you_code.map((item, idx) => (
                    <div key={idx} className="mb-3 p-3 border rounded-md">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-sm">Topic {idx + 1}</span>
                        <button
                          onClick={() => removeArrayItem('learn_before_you_code', idx)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={item.topic}
                        onChange={(e) => updateArrayItem('learn_before_you_code', idx, 'topic', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2"
                        placeholder="Topic"
                      />
                      <textarea
                        value={item.explanation}
                        onChange={(e) => updateArrayItem('learn_before_you_code', idx, 'explanation', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        rows={2}
                        placeholder="Explanation"
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => addArrayItem('learn_before_you_code', { topic: '', explanation: '' })}
                    className="flex items-center gap-2 text-purple-600"
                  >
                    <Plus className="h-4 w-4" />
                    Add Topic
                  </button>
                </div>

                {/* Requirements */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Requirements</h3>
                  {formData.requirements.map((req, idx) => (
                    <div key={idx} className="mb-2 flex gap-2">
                      <input
                        type="text"
                        value={req}
                        onChange={(e) => {
                          const newRequirements = [...formData.requirements]
                          newRequirements[idx] = e.target.value
                          setFormData(prev => ({ ...prev, requirements: newRequirements }))
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Requirement"
                      />
                      {formData.requirements.length > 1 && (
                        <button
                          onClick={() => {
                            const newRequirements = formData.requirements.filter((_, i) => i !== idx)
                            setFormData(prev => ({ ...prev, requirements: newRequirements }))
                          }}
                          className="text-red-600 px-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, requirements: [...prev.requirements, ''] }))}
                    className="flex items-center gap-2 text-purple-600"
                  >
                    <Plus className="h-4 w-4" />
                    Add Requirement
                  </button>
                </div>

                {/* Blocks Used */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Blocks Used</h3>
                  {formData.blocks_used.map((block, idx) => (
                    <div key={idx} className="mb-2 flex gap-2">
                      <input
                        type="text"
                        value={block}
                        onChange={(e) => {
                          const newBlocks = [...formData.blocks_used]
                          newBlocks[idx] = e.target.value
                          setFormData(prev => ({ ...prev, blocks_used: newBlocks }))
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Block name"
                      />
                      {formData.blocks_used.length > 1 && (
                        <button
                          onClick={() => {
                            const newBlocks = formData.blocks_used.filter((_, i) => i !== idx)
                            setFormData(prev => ({ ...prev, blocks_used: newBlocks }))
                          }}
                          className="text-red-600 px-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, blocks_used: [...prev.blocks_used, ''] }))}
                    className="flex items-center gap-2 text-purple-600"
                  >
                    <Plus className="h-4 w-4" />
                    Add Block
                  </button>
                </div>

                {/* Steps */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Steps</h3>
                  {formData.steps.map((step, idx) => (
                    <div key={idx} className="mb-4 p-3 border rounded-md">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-medium">Step {idx + 1}</span>
                        <button
                          onClick={() => handleRemoveStep(idx)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={step.title}
                          onChange={(e) => updateArrayItem('steps', idx, 'title', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          placeholder="Step title"
                        />
                        <input
                          type="number"
                          value={step.points}
                          onChange={(e) => updateArrayItem('steps', idx, 'points', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          placeholder="Points"
                        />
                        <textarea
                          value={step.instruction}
                          onChange={(e) => updateArrayItem('steps', idx, 'instruction', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          rows={2}
                          placeholder="Instruction"
                        />
                        <input
                          type="text"
                          value={step.note}
                          onChange={(e) => updateArrayItem('steps', idx, 'note', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          placeholder="Note"
                        />
                        <ImageDropZone
                          title={`Step ${idx + 1} image`}
                          path={step.image}
                          previewUrl={step.image ? assetPreviews[step.image] : undefined}
                          file={step.image ? assetFiles[step.image] : undefined}
                          onSelect={(file) => handleStepImageSelection(idx, file)}
                          onRemove={step.image ? () => handleRemoveStepImage(idx) : undefined}
                        />
                        <textarea
                          value={step.hint}
                          onChange={(e) => updateArrayItem('steps', idx, 'hint', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          rows={2}
                          placeholder="Hint (optional)"
                        />
                        <textarea
                          value={step.important}
                          onChange={(e) => updateArrayItem('steps', idx, 'important', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          rows={2}
                          placeholder="Important note (optional)"
                        />
                        <textarea
                          value={step.tryThis}
                          onChange={(e) => updateArrayItem('steps', idx, 'tryThis', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          rows={2}
                          placeholder="Try This"
                        />
                        <textarea
                          value={step.whyItWorks}
                          onChange={(e) => updateArrayItem('steps', idx, 'whyItWorks', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          rows={2}
                          placeholder="Why It Works"
                        />
                        
                        {/* Blocks Section */}
                        <div className="border-t mt-3 pt-3">
                          <h4 className="font-medium mb-2">Blocks</h4>
                          {step.blocks?.map((block: any, blockIdx: number) => (
                            <div key={blockIdx} className="mb-2 p-2 bg-gray-50 rounded border">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-gray-600">Block {blockIdx + 1}</span>
                                <button
                                  onClick={() => handleRemoveBlock(idx, blockIdx)}
                                  className="text-red-600 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                              <ImageDropZone
                                title={`Block ${blockIdx + 1} image`}
                                path={block.image || ''}
                                previewUrl={
                                  block.image ? assetPreviews[block.image] : undefined
                                }
                                file={block.image ? assetFiles[block.image] : undefined}
                                onSelect={(file) => handleBlockImageSelection(idx, blockIdx, file)}
                                onRemove={
                                  block.image
                                    ? () => handleBlockImageRemove(idx, blockIdx)
                                    : undefined
                                }
                              />
                              <input
                                type="text"
                                value={block.alt || ''}
                                onChange={(e) => {
                                  const newData = JSON.parse(JSON.stringify(formData))
                                  newData.steps[idx].blocks[blockIdx].alt = e.target.value
                                  setFormData(newData)
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2"
                                placeholder="Alt text"
                              />
                              <textarea
                                value={block.description || ''}
                                onChange={(e) => {
                                  const newData = JSON.parse(JSON.stringify(formData))
                                  newData.steps[idx].blocks[blockIdx].description = e.target.value
                                  setFormData(newData)
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                rows={2}
                                placeholder="Description"
                              />
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const newData = JSON.parse(JSON.stringify(formData))
                              if (!newData.steps[idx].blocks) {
                                newData.steps[idx].blocks = []
                              }
                          newData.steps[idx].blocks.push(createEmptyBlock())
                              setFormData(newData)
                            }}
                            className="flex items-center gap-2 text-purple-600 text-sm"
                          >
                            <Plus className="h-4 w-4" />
                            Add Block
                          </button>
                        </div>
                        
                        {/* MCQ Section */}
                        <div className="border-t mt-3 pt-3">
                          <h4 className="font-medium mb-2">MCQ</h4>
                          <select
                            value={
                              step.mcq?.compalsary === null || step.mcq?.compalsary === undefined
                                ? ''
                                : step.mcq?.compalsary
                                  ? 'true'
                                  : 'false'
                            }
                            onChange={(e) => {
                              const newData = JSON.parse(JSON.stringify(formData))
                              if (e.target.value === '') {
                                newData.steps[idx].mcq.compalsary = null
                              } else {
                                newData.steps[idx].mcq.compalsary = e.target.value === 'true'
                              }
                              setFormData(newData)
                            }}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 mb-2"
                          >
                            <option value="">Compulsory question?</option>
                            <option value="true">True</option>
                            <option value="false">False</option>
                          </select>
                        
                          <input
                            type="text"
                            value={step.mcq?.question || ''}
                            onChange={(e) => {
                              const newData = JSON.parse(JSON.stringify(formData))
                              newData.steps[idx].mcq.question = e.target.value
                              setFormData(newData)
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2"
                            placeholder="Question"
                          />
                          <div className="space-y-1">
                            {step.mcq?.options?.map((opt: string, optIdx: number) => (
                              <input
                                key={optIdx}
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const newData = JSON.parse(JSON.stringify(formData))
                                  newData.steps[idx].mcq.options[optIdx] = e.target.value
                                  setFormData(newData)
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                placeholder={`Option ${optIdx + 1}`}
                              />
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Correct Answer (0-3)</label>
                              <input
                                type="number"
                                value={step.mcq?.correctAnswer || 0}
                                onChange={(e) => {
                                  const newData = JSON.parse(JSON.stringify(formData))
                                  newData.steps[idx].mcq.correctAnswer = parseInt(e.target.value)
                                  setFormData(newData)
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                min="0"
                                max="3"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <input
                              type="text"
                              value={step.mcq?.feedback?.success || ''}
                              onChange={(e) => {
                                const newData = JSON.parse(JSON.stringify(formData))
                                newData.steps[idx].mcq.feedback.success = e.target.value
                                setFormData(newData)
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              placeholder="Success feedback"
                            />
                            <input
                              type="text"
                              value={step.mcq?.feedback?.retry || ''}
                              onChange={(e) => {
                                const newData = JSON.parse(JSON.stringify(formData))
                                newData.steps[idx].mcq.feedback.retry = e.target.value
                                setFormData(newData)
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              placeholder="Retry feedback"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => addArrayItem('steps', createEmptyStep())}
                    className="flex items-center gap-2 text-purple-600"
                  >
                    <Plus className="h-4 w-4" />
                    Add Step
                  </button>
                </div>

                {/* Mission Reference Code */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Mission Reference Code</h3>
                  <input
                    type="text"
                    value={formData.mission_reference_code}
                    onChange={(e) => updateField('mission_reference_code', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., all.xml"
                  />
                </div>

                {/* Report Card */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Report Card</h3>
                  {formData.report_card.map((task, idx) => (
                    <div key={idx} className="mb-2 flex gap-2">
                      <input
                        type="text"
                        value={task.task}
                        onChange={(e) => {
                          const newData = JSON.parse(JSON.stringify(formData))
                          newData.report_card[idx].task = e.target.value
                          setFormData(newData)
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Task name"
                      />
                      <input
                        type="number"
                        value={task.points}
                        onChange={(e) => {
                          const newData = JSON.parse(JSON.stringify(formData))
                          newData.report_card[idx].points = parseInt(e.target.value) || 0
                          setFormData(newData)
                        }}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Points"
                      />
                      {formData.report_card.length > 1 && (
                        <button
                          onClick={() => {
                            const newData = JSON.parse(JSON.stringify(formData))
                            newData.report_card = newData.report_card.filter((_: any, i: number) => i !== idx)
                            setFormData(newData)
                          }}
                          className="text-red-600 px-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const newData = JSON.parse(JSON.stringify(formData))
                      newData.report_card.push({ task: '', points: 0 })
                      setFormData(newData)
                    }}
                    className="flex items-center gap-2 text-purple-600"
                  >
                    <Plus className="h-4 w-4" />
                    Add Task
                  </button>
                </div>

                {/* Total Points */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Total Points</h3>
                  <input
                    type="number"
                    value={formData.total_points}
                    onChange={(e) => updateField('total_points', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Total points"
                  />
                </div>

                {/* Learning Outcomes */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Learning Outcomes</h3>
                  {formData.learning_outcomes.map((outcome, idx) => (
                    <div key={idx} className="mb-2 flex gap-2">
                      <input
                        type="text"
                        value={outcome}
                        onChange={(e) => {
                          const newData = JSON.parse(JSON.stringify(formData))
                          newData.learning_outcomes[idx] = e.target.value
                          setFormData(newData)
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Learning outcome"
                      />
                      {formData.learning_outcomes.length > 1 && (
                        <button
                          onClick={() => {
                            const newData = JSON.parse(JSON.stringify(formData))
                            newData.learning_outcomes = newData.learning_outcomes.filter((_: any, i: number) => i !== idx)
                            setFormData(newData)
                          }}
                          className="text-red-600 px-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const newData = JSON.parse(JSON.stringify(formData))
                      newData.learning_outcomes.push('')
                      setFormData(newData)
                    }}
                    className="flex items-center gap-2 text-purple-600"
                  >
                    <Plus className="h-4 w-4" />
                    Add Learning Outcome
                  </button>
                </div>

                {/* Resources */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Resources</h3>
                  {formData.resources.map((resource, idx) => (
                    <div key={idx} className="mb-3 p-3 bg-gray-50 rounded border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-gray-600">Resource {idx + 1}</span>
                        <button
                        onClick={() => handleRemoveResource(idx)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <select
                        value={resource.type}
                        onChange={(e) => {
                          const nextType = e.target.value
                          setFormData((prev) => {
                            const newData = JSON.parse(JSON.stringify(prev)) as FormDataState
                            if (
                              nextType !== 'image' &&
                              newData.resources[idx].type === 'image' &&
                              newData.resources[idx].path
                            ) {
                              removeAssetName(newData.resources[idx].path)
                              newData.resources[idx].path = ''
                            }
                            newData.resources[idx].type = nextType
                            return newData
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2"
                      >
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                        <option value="file">File</option>
                        <option value="link">Link</option>
                </select>
                      {resource.type === 'image' ? (
                        <ImageDropZone
                          title={`Resource ${idx + 1} image`}
                          path={resource.path}
                          previewUrl={
                            resource.path ? assetPreviews[resource.path] : undefined
                          }
                          file={resource.path ? assetFiles[resource.path] : undefined}
                          onSelect={(file) => handleResourceImageSelection(idx, file)}
                          onRemove={
                            resource.path ? () => handleResourceImageRemove(idx) : undefined
                          }
                        />
                      ) : (
                      <input
                        type="text"
                        value={resource.path}
                        onChange={(e) => {
                          const newData = JSON.parse(JSON.stringify(formData))
                          newData.resources[idx].path = e.target.value
                          setFormData(newData)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Resource path"
                      />
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const newData = JSON.parse(JSON.stringify(formData))
                      newData.resources.push({ type: 'image', path: '' })
                      setFormData(newData)
                    }}
                    className="flex items-center gap-2 text-purple-600"
                  >
                    <Plus className="h-4 w-4" />
                    Add Resource
                  </button>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={generateJSON}
                className="w-full px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                Generate JSON
              </button>
              <button
                onClick={() => setShowMissionPrompt('complete')}
                disabled={uploadingComplete}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploadingComplete ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    Complete Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

          {/* JSON Output Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Generated JSON</h2>
              {jsonOutput && (
                <div className="flex gap-2">
                <button
                  onClick={downloadJSON}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <Download className="h-5 w-5" />
                    Download JSON
                </button>
                  <button
                    onClick={handleDownloadPackage}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    disabled={!jsonOutput && Object.keys(assetFiles).length === 0}
                  >
                    <Download className="h-5 w-5" />
                    Download Package
                  </button>
                </div>
              )}
            </div>
            {Object.keys(assetFiles).length > 0 && (
              <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                <p className="font-semibold mb-1">Assets</p>
                <ul className="space-y-1">
                  {Object.keys(assetFiles).map((assetName) => (
                    <li key={assetName} className="flex justify-between gap-2">
                      <span>{assetName}</span>
                      <button
                        type="button"
                        onClick={() => {
                          removeAssetName(assetName)
                          setFormData((prev) => {
                            const newData = JSON.parse(JSON.stringify(prev)) as FormDataState
                            if (newData.missionPageImage === assetName) {
                              newData.missionPageImage = ''
                            }
                            if (newData.intro.image === assetName) {
                              newData.intro.image = ''
                            }
                            newData.steps = newData.steps.map((step) => ({
                              ...step,
                              image: step.image === assetName ? '' : step.image,
                              blocks: step.blocks?.map((block: any) => ({
                                ...block,
                                image: block.image === assetName ? '' : block.image
                              })) || []
                            }))
                            newData.resources = newData.resources.map((resource) => ({
                              ...resource,
                              path: resource.path === assetName ? '' : resource.path
                            }))
                            return newData
                          })
                        }}
                        className="text-blue-700 hover:underline"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {imageUploadError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {imageUploadError}
              </div>
            )}
            {imageUploadSuccess && (
              <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {imageUploadSuccess}
              </div>
            )}
            {uploadErrorMessage && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {uploadErrorMessage}
              </div>
            )}
            {uploadSuccessMessage && (
              <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 whitespace-pre-wrap">
                {uploadSuccessMessage}
              </div>
            )}
            <pre className="bg-gray-50 border rounded-md p-4 overflow-auto max-h-[calc(100vh-200px)] text-sm">
              {jsonOutput || 'Generated JSON will appear here...'}
            </pre>
          </div>
        </div>
      </div>
      {showMissionPrompt && (
        <UploadPrompt
          title={
            showMissionPrompt === 'complete' 
              ? 'Complete Upload to Supabase' 
              : showMissionPrompt === 'json' 
              ? 'Upload Mission to Supabase' 
              : 'Upload Images to Storage'
          }
          description={
            showMissionPrompt === 'complete'
              ? 'Upload images (if any) and mission data to Supabase in one step.'
              : showMissionPrompt === 'json'
              ? 'Set the mission UID and optional image folder before uploading to Supabase.'
              : 'Set the mission UID and optional image folder before uploading images to storage.'
          }
          fields={[
            {
              label: 'Mission UID',
              value: customMissionUid,
              onChange: setCustomMissionUid,
              placeholder: 'e.g., M10 or TEST-MISSION',
              helper: 'Required. Avoid spaces or special characters.'
            },
            {
              label: 'Image Folder (optional)',
              value: customImageFolder,
              onChange: setCustomImageFolder,
              placeholder: 'e.g., M10/custom',
              helper: 'Defaults to MUID/images when left blank.'
            }
          ]}
          confirmLabel={
            showMissionPrompt === 'complete' 
              ? 'Complete Upload' 
              : showMissionPrompt === 'json' 
              ? 'Upload Mission' 
              : 'Upload Images'
          }
          loading={
            showMissionPrompt === 'complete' 
              ? uploadingComplete 
              : showMissionPrompt === 'json' 
              ? uploadingToSupabase 
              : uploadingImages
          }
          onCancel={() => setShowMissionPrompt(null)}
          onConfirm={() => {
            if (showMissionPrompt === 'complete') {
              setShowMissionPrompt(null)
              handleCompleteUpload()
            } else if (showMissionPrompt === 'json') {
              setShowMissionPrompt(null)
              uploadToSupabase()
            } else {
              setShowMissionPrompt(null)
              handleStandaloneImageUpload()
            }
          }}
        />
      )}
    </>
  )
}

