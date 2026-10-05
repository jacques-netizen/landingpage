// Campaign templates (01_PRODUCT.md section 6.2). A template pre-fills rule fields and adds
// type-specific fields; staff can change any of them afterwards. Safe to import in the browser.

export type CampaignType = 'clipping' | 'logo' | 'music' | 'ugc'

export type TemplateField = {
  key: string
  label: string
  kind: 'url' | 'number' | 'text' | 'boolean'
  helper?: string
}

export type Template = {
  type: CampaignType
  label: string
  description: string
  defaults: {
    requiredHashtags: string[]
    requireAdDisclosure: boolean
    minDurationSeconds: number | null
    keepLiveDays: number
  }
  fields: TemplateField[]
  /** How posts are checked, shown to staff and on the campaign page. */
  checks: string[]
}

export const TEMPLATES: Record<CampaignType, Template> = {
  clipping: {
    type: 'clipping',
    label: 'Clipping',
    description: 'Footage provided by the client. Creators cut and post clips.',
    defaults: { requiredHashtags: [], requireAdDisclosure: true, minDurationSeconds: null, keepLiveDays: 30 },
    fields: [],
    checks: [
      'Required hashtags are present',
      'The video meets the minimum duration',
      'The same clip is not re-uploaded by the same creator',
    ],
  },
  logo: {
    type: 'logo',
    label: 'Logo',
    description: 'Creators place the client’s logo on their own content.',
    defaults: { requiredHashtags: [], requireAdDisclosure: true, minDurationSeconds: null, keepLiveDays: 30 },
    fields: [
      { key: 'logoFileUrl', label: 'Logo file', kind: 'url' },
      { key: 'safeZoneImageUrl', label: 'Safe zone image', kind: 'url' },
      { key: 'minSecondsVisible', label: 'Minimum seconds the logo is visible', kind: 'number' },
      { key: 'maxCoverPercent', label: 'Most of the logo the app interface may cover (percent)', kind: 'number' },
    ],
    checks: ['Manual review with a checklist: logo visible for the minimum time, inside the safe zone, not covered'],
  },
  music: {
    type: 'music',
    label: 'Music',
    description: 'Creators use the client’s sound in their posts.',
    defaults: { requiredHashtags: [], requireAdDisclosure: true, minDurationSeconds: null, keepLiveDays: 30 },
    fields: [
      { key: 'audioUrl', label: 'Audio link', kind: 'url' },
      { key: 'minAudioLevelPercent', label: 'Minimum audio level (percent)', kind: 'number' },
      { key: 'noStacking', label: 'No other sound campaign in the same post', kind: 'boolean' },
    ],
    checks: ['Manual review with a checklist: the sound is used at the minimum level for the minimum duration'],
  },
  ugc: {
    type: 'ugc',
    label: 'UGC',
    description: 'Original content made to the brief.',
    defaults: { requiredHashtags: [], requireAdDisclosure: true, minDurationSeconds: null, keepLiveDays: 30 },
    fields: [],
    checks: ['Manual review against the brief'],
  },
}

export const PLATFORM_LABELS = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', x: 'X' } as const
export type Platform = keyof typeof PLATFORM_LABELS
