import { env } from '@mde/config'
import { db, getSetting, tables } from '@mde/db'
import {
  CHART_PLATFORM_LABEL,
  METRIC_LABEL,
  SOURCE_LABEL,
  SOUND_CHECK_LABEL,
  buildMusicProvider,
  musicReport,
  providerRequestsThisMonth,
  type FlowBlock,
  type LevelBlock,
  type Metric,
  type Source,
  type SoundCheckStatus,
  type TrackReport,
} from '@mde/music'
import { EmptyState } from '@mde/ui'
import { asc, eq } from 'drizzle-orm'
import { Card, Th } from './parts'
import {
  ChartEntryForm,
  ManualMetricForm,
  MatchButtons,
  MusicSetupForm,
  RemoveManual,
  SoundchartsDisplay,
  type SetupValues,
} from './music-forms'

// The campaign's Music tab (owner, 2026-11-12; build proposal 7.1, 7.2 and 7.4): the song and its links,
// the provider's match, every number with where it came from, typed-in numbers and data health. Staff only.

const n = (v: number) => Math.round(v).toLocaleString('en-US')
const pct = (v: number | null) => (v === null ? 'No comparison' : `${v > 0 ? '+' : ''}${v}%`)
const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const day = (d: string) => dayFmt.format(new Date(`${d}T00:00:00Z`))
const sourceName = (s: string) => SOURCE_LABEL[s as Source] ?? s
const metricName = (m: string) => METRIC_LABEL[m as Metric] ?? m

export async function CampaignMusic({
  campaignId,
  campaignStart,
  canEdit,
  isAdmin,
}: {
  campaignId: string
  campaignStart: Date | null
  canEdit: boolean
  isAdmin: boolean
}) {
  const d = db()
  const [display, artistRows, trackRows] = await Promise.all([
    getSetting(d, 'music_client_display_allowed'),
    d.select().from(tables.musicArtists).where(eq(tables.musicArtists.campaignId, campaignId)),
    d
      .select()
      .from(tables.musicTracks)
      .where(eq(tables.musicTracks.campaignId, campaignId))
      .orderBy(asc(tables.musicTracks.createdAt)),
  ])
  const report = await musicReport(d, campaignId, { audience: 'admin', clientDisplay: display })
  const provider = buildMusicProvider(env())
  const requests = provider.name === 'none' ? 0 : await providerRequestsThisMonth(d, provider.name)
  const artist = artistRows[0]
  const blank: SetupValues = {
    artistName: artist?.name ?? '',
    spotifyArtistUrl: artist?.spotifyArtistId ? `https://open.spotify.com/artist/${artist.spotifyArtistId}` : '',
    tiktokHandle: artist?.tiktokHandle ?? '',
    instagramHandle: artist?.instagramHandle ?? '',
    youtubeChannelId: artist?.youtubeChannelId ?? '',
    s4aAccessStatus: artist?.s4aAccessStatus ?? 'not_requested',
    amfaAccessStatus: artist?.amfaAccessStatus ?? 'not_requested',
    title: '',
    spotifyTrackUrl: '',
    isrc: '',
    tiktokSoundUrl: '',
    instagramAudioUrl: '',
    youtubeVideoUrl: '',
    releaseDate: '',
    launchDate: campaignStart ? campaignStart.toISOString().slice(0, 10) : '',
    targetCountries: '',
    baselineDays: '28',
    soundRule: 'warn',
  }

  return (
    <>
      <Card
        title="Music data"
        note="Streams, Shazams, uses of the sound and charts for this campaign's song. Staff see every number here; the client report shows what it may, with its source."
      >
        <div className="flex flex-col gap-3 text-[13px]">
          <p className="m-0">
            Provider:{' '}
            <b>
              {provider.name === 'none'
                ? 'none switched on (sound counts and typed-in numbers only)'
                : `Soundcharts, ${n(requests)} requests this month`}
            </b>
          </p>
          <p className="m-0 text-muted">
            Soundcharts numbers on client reports:{' '}
            {display.soundcharts ? 'shown' : 'hidden (no written permission yet)'}
          </p>
          {isAdmin ? <SoundchartsDisplay campaignId={campaignId} allowed={display.soundcharts} /> : null}
        </div>
      </Card>

      {trackRows.map((t) => {
        const r = report?.tracks.find((x) => x.id === t.id)
        return (
          <Card
            key={t.id}
            title={`${t.title}${artist ? ` by ${artist.name}` : ''}`}
            note={`Launch ${day(t.launchDate)}`}
          >
            <div className="flex flex-col gap-6">
              <Match t={t} r={r} campaignId={campaignId} canEdit={canEdit} providerOn={provider.name !== 'none'} />
              {r ? <Figures r={r} /> : null}
              <details>
                <summary className="cursor-pointer text-[13px] font-semibold">Edit the song and artist</summary>
                <div className="mt-4">
                  <MusicSetupForm
                    campaignId={campaignId}
                    trackId={t.id}
                    canEdit={canEdit}
                    initial={{
                      ...blank,
                      title: t.title,
                      spotifyTrackUrl: t.spotifyTrackId ? `https://open.spotify.com/track/${t.spotifyTrackId}` : '',
                      isrc: t.isrc ?? '',
                      tiktokSoundUrl: t.tiktokSoundUrl ?? '',
                      instagramAudioUrl: t.instagramAudioUrl ?? '',
                      youtubeVideoUrl: t.youtubeVideoId ? `https://www.youtube.com/watch?v=${t.youtubeVideoId}` : '',
                      releaseDate: t.releaseDate ?? '',
                      launchDate: t.launchDate,
                      targetCountries: (t.targetCountries ?? []).join(', '),
                      baselineDays: String(t.baselineDays),
                      soundRule: t.soundRule,
                    }}
                  />
                </div>
              </details>
              {canEdit ? (
                <>
                  <details>
                    <summary className="cursor-pointer text-[13px] font-semibold">
                      Type in a number from Spotify for Artists or Apple Music for Artists
                    </summary>
                    <div className="mt-4">
                      <ManualMetricForm campaignId={campaignId} trackId={t.id} />
                    </div>
                  </details>
                  <details>
                    <summary className="cursor-pointer text-[13px] font-semibold">Add a chart place</summary>
                    <div className="mt-4">
                      <ChartEntryForm campaignId={campaignId} trackId={t.id} />
                    </div>
                  </details>
                </>
              ) : null}
              {r?.admin ? <Health r={r} campaignId={campaignId} canEdit={canEdit} /> : null}
            </div>
          </Card>
        )
      })}

      {trackRows.length === 0 && !canEdit ? (
        <EmptyState body="No song is tracked on this campaign yet. Finance or an admin can add one." />
      ) : null}
      {canEdit ? (
        <Card
          title={trackRows.length ? 'Add another song' : 'Track a song on this campaign'}
          note="Works for past campaigns too: enter the song and the day clips started, and its history is pulled when a provider is switched on."
        >
          <MusicSetupForm campaignId={campaignId} trackId={null} canEdit={canEdit} initial={blank} />
        </Card>
      ) : null}
    </>
  )
}

function Match({
  t,
  r,
  campaignId,
  canEdit,
  providerOn,
}: {
  t: typeof tables.musicTracks.$inferSelect
  r: TrackReport | undefined
  campaignId: string
  canEdit: boolean
  providerOn: boolean
}) {
  const baseline: Record<string, string> = {
    pending: 'Waiting for history',
    ready: 'Enough days before launch to compare',
    short: 'Fewer than 7 days before launch: no comparison',
    unavailable: 'No days before launch: no comparison',
  }
  return (
    <div className="flex flex-col gap-2 text-[13px]">
      <p className="m-0">
        {t.providerTrackId
          ? `Provider match: "${t.providerTitle ?? ''}"${t.providerArtistName ? ` by ${t.providerArtistName}` : ''}${
              t.matchConfirmedAt ? ', confirmed' : ', not confirmed yet'
            }`
          : providerOn
            ? 'Not matched with the provider yet.'
            : 'No provider: streams come only from numbers typed in.'}
      </p>
      <p className="m-0 text-muted">
        Before launch: {baseline[t.baselineStatus] ?? t.baselineStatus}. Sound rule:{' '}
        {t.soundRule === 'reject' ? 'flag posts without the official sound' : 'warn the reviewer'}.
        {t.tiktokClipId ? '' : ' No TikTok sound link, so posts are not sound checked.'}
      </p>
      {r?.newRelease ? (
        <p className="m-0 text-muted">Released on or after launch: numbers since launch only, no before and after.</p>
      ) : null}
      {canEdit && providerOn ? (
        <MatchButtons
          campaignId={campaignId}
          trackId={t.id}
          canFind={!t.matchConfirmedAt}
          canConfirm={!!t.providerTrackId && !t.matchConfirmedAt}
        />
      ) : null}
    </div>
  )
}

function Figures({ r }: { r: TrackReport }) {
  const flows = [r.streams, r.algorithmic, r.shazams].filter((b): b is FlowBlock => !!b)
  const levels = [r.listeners, ...r.following].filter((b): b is LevelBlock => !!b)
  return (
    <div className="flex flex-col gap-4">
      {flows.length || levels.length || r.sound ? (
        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-field">
            <tr>
              <Th>Number</Th>
              <Th right>Before launch, a day</Th>
              <Th right>Since launch, a day</Th>
              <Th right>Change</Th>
              <Th>Source</Th>
            </tr>
          </thead>
          <tbody>
            {flows.map((b) => (
              <tr key={b.metric} className="border-0 border-t border-solid border-line">
                <td className="px-3 py-2">{b.label}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {b.baseline.average === null ? 'No data' : n(b.baseline.average)}
                  <span className="block text-[11px] text-muted">{b.baseline.days} days</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {b.since.average === null ? 'No data' : n(b.since.average)}
                  <span className="block text-[11px] text-muted">
                    {b.since.days} days{b.extraTotal !== null ? `, ${n(b.extraTotal)} above the before average` : ''}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{pct(b.changePercent)}</td>
                <td className="px-3 py-2">{b.sources.map(sourceName).join(', ')}</td>
              </tr>
            ))}
            {levels.map((b) => (
              <tr key={b.metric} className="border-0 border-t border-solid border-line">
                <td className="px-3 py-2">{b.label}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {b.before ? `${n(b.before.value)} on ${day(b.before.date)}` : 'No data'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {b.latest ? `${n(b.latest.value)} on ${day(b.latest.date)}` : 'No data'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {b.change === null ? 'No comparison' : `${b.change > 0 ? '+' : ''}${n(b.change)}`}
                </td>
                <td className="px-3 py-2">{b.sources.map(sourceName).join(', ')}</td>
              </tr>
            ))}
            {r.sound ? (
              <tr className="border-0 border-t border-solid border-line">
                <td className="px-3 py-2">TikTok videos using the sound</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.sound.atLaunch
                    ? `${n(r.sound.atLaunch.value)} on ${day(r.sound.atLaunch.date)}`
                    : 'Counting started after launch'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.sound.total ? `${n(r.sound.total.value)} on ${day(r.sound.total.date)}` : 'No data'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.sound.newSinceLaunch === null ? 'No comparison' : `+${n(r.sound.newSinceLaunch)}`}
                  {r.sound.outsideCampaign !== null ? (
                    <span className="block text-[11px] text-muted">
                      {r.sound.outsideIsEstimate ? 'about ' : ''}
                      {n(r.sound.outsideCampaign)} outside the campaign, {n(r.sound.campaignVideos)} campaign posts
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">Scrape Creators</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      ) : (
        <p className="m-0 text-[13px] text-muted">No numbers yet.</p>
      )}
      {r.charts ? (
        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-field">
            <tr>
              <Th>Chart</Th>
              <Th>Place</Th>
              <Th right>Best place</Th>
              <Th>First seen</Th>
            </tr>
          </thead>
          <tbody>
            {[...r.charts.sinceLaunch, ...r.charts.beforeLaunch].map((c) => (
              <tr
                key={`${c.chartPlatform}${c.chartName}${c.country}${c.city}`}
                className="border-0 border-t border-solid border-line"
              >
                <td className="px-3 py-2">
                  {CHART_PLATFORM_LABEL[c.chartPlatform as keyof typeof CHART_PLATFORM_LABEL] ?? c.chartPlatform}{' '}
                  {c.chartName}
                </td>
                <td className="px-3 py-2">{[c.city, c.country].filter(Boolean).join(', ') || 'Worldwide'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.bestPosition}</td>
                <td className="px-3 py-2">
                  {day(c.firstDate)}
                  {r.charts!.beforeLaunch.includes(c) ? ' (already charting before launch)' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}

function Health({ r, campaignId, canEdit }: { r: TrackReport; campaignId: string; canEdit: boolean }) {
  const a = r.admin!
  const checks = Object.entries(a.soundChecks)
  return (
    <div className="flex flex-col gap-4 text-[13px]">
      {checks.length ? (
        <div>
          <h3 className="m-0 mb-2 text-[13px] font-semibold">Sound check on TikTok posts (rejected posts left out)</h3>
          <ul className="m-0 pl-5">
            {checks.map(([k, v]) => (
              <li key={k}>
                {SOUND_CHECK_LABEL[k as SoundCheckStatus] ?? k}: {n(v)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <h3 className="m-0 mb-2 text-[13px] font-semibold">Data health</h3>
        {a.health.length ? (
          <table className="w-full border-collapse">
            <thead className="bg-field">
              <tr>
                <Th>Number</Th>
                <Th>Source</Th>
                <Th>Latest day</Th>
                <Th right>Rows</Th>
              </tr>
            </thead>
            <tbody>
              {a.health.map((h) => (
                <tr key={`${h.metric}${h.source}`} className="border-0 border-t border-solid border-line">
                  <td className="px-3 py-2">{metricName(h.metric)}</td>
                  <td className="px-3 py-2">{sourceName(h.source)}</td>
                  <td className="px-3 py-2">{day(h.lastDate)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(h.rows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="m-0 text-muted">Nothing stored yet.</p>
        )}
        {a.runs.length ? (
          <ul className="m-0 mt-3 pl-5 text-muted">
            {a.runs.slice(0, 5).map((run, i) => (
              <li key={i}>
                {day(run.runDate)}: {run.status === 'ok' ? 'pulled' : run.status === 'failed' ? 'failed' : 'running'}
                {Object.entries(run.requestsUsed)
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => `, ${v} ${sourceName(k)} requests`)
                  .join('')}
                {run.error ? `. ${run.error}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 mt-3 text-muted">No pull has run yet. The worker pulls each song once a day.</p>
        )}
      </div>
      {a.manual.length ? (
        <div>
          <h3 className="m-0 mb-2 text-[13px] font-semibold">Typed-in numbers</h3>
          <table className="w-full border-collapse">
            <thead className="bg-field">
              <tr>
                <Th>Day</Th>
                <Th>Number</Th>
                <Th>Place</Th>
                <Th right>Value</Th>
                <Th>{''}</Th>
              </tr>
            </thead>
            <tbody>
              {a.manual.map((m) => (
                <tr key={m.id} className="border-0 border-t border-solid border-line">
                  <td className="px-3 py-2">
                    {m.periodStart ? `${day(m.periodStart)} to ${day(m.date)}` : day(m.date)}
                  </td>
                  <td className="px-3 py-2">
                    {metricName(m.metric)} ({sourceName(m.source)})
                  </td>
                  <td className="px-3 py-2">{[m.city, m.country].filter(Boolean).join(', ') || 'Worldwide'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(m.value)}</td>
                  <td className="px-3 py-2 text-right">
                    {canEdit ? <RemoveManual campaignId={campaignId} id={m.id} /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
