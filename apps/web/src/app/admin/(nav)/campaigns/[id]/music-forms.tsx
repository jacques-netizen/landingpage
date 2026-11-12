'use client'

import { CHART_PLATFORM_LABEL, CHART_PLATFORMS, MANUAL_METRICS, METRIC_LABEL, SOURCE_LABEL } from '@mde/music/metrics'
import { Button, Field, Input, Select } from '@mde/ui'
import { useActionState, useState, useTransition } from 'react'
import { Notice } from '../../_components/ui'
import {
  addChartEntryAction,
  addManualMetricAction,
  confirmMatchAction,
  deleteManualMetricAction,
  matchTrackAction,
  saveMusicSetupAction,
  setSoundchartsDisplayAction,
  type MusicFormState,
} from './music-actions'

export type SetupValues = {
  artistName: string
  spotifyArtistUrl: string
  tiktokHandle: string
  instagramHandle: string
  youtubeChannelId: string
  s4aAccessStatus: string
  amfaAccessStatus: string
  title: string
  spotifyTrackUrl: string
  isrc: string
  tiktokSoundUrl: string
  instagramAudioUrl: string
  youtubeVideoUrl: string
  releaseDate: string
  launchDate: string
  targetCountries: string
  baselineDays: string
  soundRule: string
}

const ACCESS = [
  { value: 'not_requested', label: 'Not asked yet' },
  { value: 'requested', label: 'Asked' },
  { value: 'granted', label: 'Access given' },
  { value: 'declined', label: 'Said no' },
]

function Text({
  label,
  name,
  value,
  error,
  helper,
  type = 'text',
  disabled,
  placeholder,
}: {
  label: string
  name: string
  value?: string
  error?: string
  helper?: string
  type?: string
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <Field label={label} error={error} helper={helper}>
      {(p) => (
        <Input
          id={p.id}
          aria-describedby={p.describedBy}
          invalid={p.invalid}
          name={name}
          type={type}
          defaultValue={value}
          disabled={disabled}
          placeholder={placeholder}
        />
      )}
    </Field>
  )
}

function Choice({
  label,
  name,
  value,
  options,
  error,
  disabled,
}: {
  label: string
  name: string
  value: string
  options: { value: string; label: string }[]
  error?: string
  disabled?: boolean
}) {
  return (
    <Field label={label} error={error}>
      {(p) => (
        <Select
          id={p.id}
          aria-describedby={p.describedBy}
          invalid={p.invalid}
          name={name}
          defaultValue={value}
          options={options}
          disabled={disabled}
        />
      )}
    </Field>
  )
}

function State({ s }: { s: MusicFormState }) {
  return s.ok ? <Notice kind="ok">{s.ok}</Notice> : s.error ? <Notice kind="bad">{s.error}</Notice> : null
}

/** The artist and one song. A new song when trackId is null. */
export function MusicSetupForm({
  campaignId,
  trackId,
  initial,
  canEdit,
}: {
  campaignId: string
  trackId: string | null
  initial: SetupValues
  canEdit: boolean
}) {
  const [state, action, pending] = useActionState<MusicFormState, FormData>(
    saveMusicSetupAction.bind(null, campaignId, trackId),
    {},
  )
  const f = state.fields ?? {}
  const d = !canEdit
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <State s={state} />
      <h3 className="m-0 text-[13px] font-semibold">Artist</h3>
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <Text label="Artist name" name="artistName" value={initial.artistName} error={f.artistName} disabled={d} />
        <Text
          label="Spotify artist link"
          name="spotifyArtistUrl"
          value={initial.spotifyArtistUrl}
          error={f.spotifyArtistUrl}
          disabled={d}
          placeholder="https://open.spotify.com/artist/..."
        />
        <Text label="TikTok handle" name="tiktokHandle" value={initial.tiktokHandle} disabled={d} />
        <Text label="Instagram handle" name="instagramHandle" value={initial.instagramHandle} disabled={d} />
        <Text label="YouTube channel id" name="youtubeChannelId" value={initial.youtubeChannelId} disabled={d} />
        <div />
        <Choice
          label="Spotify for Artists access"
          name="s4aAccessStatus"
          value={initial.s4aAccessStatus}
          options={ACCESS}
          disabled={d}
        />
        <Choice
          label="Apple Music for Artists access"
          name="amfaAccessStatus"
          value={initial.amfaAccessStatus}
          options={ACCESS}
          disabled={d}
        />
      </div>
      <h3 className="m-0 text-[13px] font-semibold">Song</h3>
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <Text label="Song title" name="title" value={initial.title} error={f.title} disabled={d} />
        <Text
          label="Spotify song link"
          name="spotifyTrackUrl"
          value={initial.spotifyTrackUrl}
          error={f.spotifyTrackUrl}
          disabled={d}
          placeholder="https://open.spotify.com/track/..."
        />
        <Text
          label="ISRC"
          name="isrc"
          value={initial.isrc}
          error={f.isrc}
          disabled={d}
          helper="Optional. Finds the song more surely than the link."
        />
        <Text
          label="TikTok sound link"
          name="tiktokSoundUrl"
          value={initial.tiktokSoundUrl}
          error={f.tiktokSoundUrl}
          disabled={d}
          placeholder="https://www.tiktok.com/music/..."
          helper="The sound clippers are given. Used for the sound check and the count of videos using it."
        />
        <Text
          label="Instagram audio link"
          name="instagramAudioUrl"
          value={initial.instagramAudioUrl}
          error={f.instagramAudioUrl}
          disabled={d}
          placeholder="https://www.instagram.com/reels/audio/..."
        />
        <Text
          label="Official YouTube video link"
          name="youtubeVideoUrl"
          value={initial.youtubeVideoUrl}
          error={f.youtubeVideoUrl}
          disabled={d}
        />
        <Text
          label="Release date"
          name="releaseDate"
          type="date"
          value={initial.releaseDate}
          error={f.releaseDate}
          disabled={d}
          helper="A song released on or after launch has no before to compare with."
        />
        <Text
          label="Launch date"
          name="launchDate"
          type="date"
          value={initial.launchDate}
          error={f.launchDate}
          disabled={d}
          helper="The day clips started going out."
        />
        <Text
          label="Target countries"
          name="targetCountries"
          value={initial.targetCountries}
          error={f.targetCountries}
          disabled={d}
          placeholder="FR, NG, ZA"
        />
        <Text
          label="Days before launch to compare with"
          name="baselineDays"
          value={initial.baselineDays}
          error={f.baselineDays}
          disabled={d}
        />
        <Choice
          label="Posts without the official sound"
          name="soundRule"
          value={initial.soundRule}
          options={[
            { value: 'warn', label: 'Show a warning to the reviewer' },
            { value: 'reject', label: 'Flag the post for the reviewer' },
          ]}
          disabled={d}
        />
      </div>
      {canEdit ? (
        <div>
          <Button type="submit" loading={pending}>
            {trackId ? 'Save song' : 'Add song'}
          </Button>
        </div>
      ) : null}
    </form>
  )
}

/** "Find the song" and "This is the right song" for the provider's match. */
export function MatchButtons({
  campaignId,
  trackId,
  canFind,
  canConfirm,
}: {
  campaignId: string
  trackId: string
  canFind: boolean
  canConfirm: boolean
}) {
  const [state, setState] = useState<MusicFormState>({})
  const [busy, start] = useTransition()
  return (
    <div className="flex flex-col gap-3">
      <State s={state} />
      <div className="flex gap-2">
        {canFind ? (
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            onClick={() => start(async () => setState(await matchTrackAction(campaignId, trackId)))}
          >
            Find the song
          </Button>
        ) : null}
        {canConfirm ? (
          <Button
            size="sm"
            loading={busy}
            onClick={() => start(async () => setState(await confirmMatchAction(campaignId, trackId)))}
          >
            This is the right song
          </Button>
        ) : null}
      </div>
    </div>
  )
}

const WHAT = MANUAL_METRICS.flatMap((g) =>
  g.metrics.map((m) => ({ value: `${g.source}:${m}`, label: `${SOURCE_LABEL[g.source]}: ${METRIC_LABEL[m]}` })),
)

/** One number from Spotify for Artists, Apple Music for Artists or another place staff can see. */
export function ManualMetricForm({ campaignId, trackId }: { campaignId: string; trackId: string }) {
  const [state, action, pending] = useActionState<MusicFormState, FormData>(
    addManualMetricAction.bind(null, campaignId, trackId),
    {},
  )
  const f = state.fields ?? {}
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <State s={state} />
      <Choice label="What the number is" name="what" value={WHAT[0]!.value} options={WHAT} error={f.metric} />
      <div className="grid grid-cols-3 gap-5 max-md:grid-cols-1">
        <Text
          label="Day, or first day"
          name="periodStart"
          type="date"
          error={f.periodStart}
          helper="For a weekly figure, the first day of the week."
        />
        <Text
          label="Last day"
          name="periodEnd"
          type="date"
          error={f.periodEnd}
          helper="Only for a figure that covers several days."
        />
        <Text label="Number" name="value" error={f.value} />
        <Text label="Country" name="country" error={f.country} helper="Two letters. Empty for worldwide." />
        <Text label="City" name="city" helper="Optional." />
        <Text label="Note" name="note" helper="Optional, for staff." />
      </div>
      <div>
        <Button type="submit" loading={pending}>
          Save number
        </Button>
      </div>
    </form>
  )
}

export function RemoveManual({ campaignId, id }: { campaignId: string; id: string }) {
  const [busy, start] = useTransition()
  const [state, setState] = useState<MusicFormState>({})
  return state.ok ? (
    <span className="text-[12px] text-muted">Removed</span>
  ) : (
    <Button
      size="sm"
      variant="quiet"
      loading={busy}
      onClick={() => start(async () => setState(await deleteManualMetricAction(campaignId, id)))}
    >
      Remove
    </Button>
  )
}

export function ChartEntryForm({ campaignId, trackId }: { campaignId: string; trackId: string }) {
  const [state, action, pending] = useActionState<MusicFormState, FormData>(
    addChartEntryAction.bind(null, campaignId, trackId),
    {},
  )
  const f = state.fields ?? {}
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <State s={state} />
      <div className="grid grid-cols-3 gap-5 max-md:grid-cols-1">
        <Text label="Day" name="date" type="date" error={f.date} />
        <Choice
          label="Platform"
          name="chartPlatform"
          value="spotify"
          options={CHART_PLATFORMS.map((p) => ({ value: p, label: CHART_PLATFORM_LABEL[p] }))}
          error={f.chartPlatform}
        />
        <Text label="Chart" name="chartName" error={f.chartName} placeholder="Top 50" />
        <Text label="Country" name="country" error={f.country} helper="Two letters. Empty for a global chart." />
        <Text label="City" name="city" helper="Optional." />
        <Text label="Place" name="position" error={f.position} />
      </div>
      <div>
        <Button type="submit" loading={pending}>
          Save chart place
        </Button>
      </div>
    </form>
  )
}

/** Admin only: whether Soundcharts numbers may show on client reports. */
export function SoundchartsDisplay({ campaignId, allowed }: { campaignId: string; allowed: boolean }) {
  const [state, setState] = useState<MusicFormState>({})
  const [busy, start] = useTransition()
  return (
    <div className="flex flex-col gap-3">
      <label className="flex cursor-pointer items-center gap-3 text-[13px]">
        <input
          type="checkbox"
          defaultChecked={allowed}
          disabled={busy}
          onChange={(e) => {
            const on = e.currentTarget.checked
            start(async () => setState(await setSoundchartsDisplayAction(campaignId, on)))
          }}
          className="size-4 accent-[#D8C58F]"
        />
        <span>
          Show Soundcharts numbers on client reports
          <span className="block text-[12px] text-muted">
            Only once Soundcharts has said yes in writing: its terms do not allow its data in a paid service to others
            without permission. Applies to every campaign. Shown with &quot;Source: www.soundcharts.com&quot;.
          </span>
        </span>
      </label>
      <State s={state} />
    </div>
  )
}
