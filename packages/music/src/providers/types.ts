// The music data provider interface (build proposal section 4.4). Every provider returns only what its
// own API reference documents; a metric it cannot give is simply not in supportedMetrics().
import type { ArtistMetric, TrackMetric } from '../metrics'

export type ResolvedTrack = {
  providerTrackId: string
  title: string
  artistName: string | null
  providerArtistId: string | null
  isrc: string | null
}

export type SeriesPoint = { date: string; value: number; isCumulative: boolean; country?: string; city?: string }

/**
 * What one call to the provider answered, kept on the pull run so staff can see why a pull gave no
 * numbers (soundcharts-fix, 15 Nov). Never holds a key or a header.
 */
export type ProviderCall = {
  /** The path asked, without the host. Query values are dates and paging only. */
  path: string
  status: number
  /** Top-level field names of the answer, e.g. related, items, page, errors. */
  fields?: string[]
  /** Dated entries in the answer (audience), and how many of them held at least one number. */
  dates?: number
  datesWithNumbers?: number
  /** First and last day in the answer. */
  firstDate?: string | null
  lastDate?: string | null
  /** The Spotify ids seen in the answer (audience plots or the song's identifiers). */
  identifiers?: string[]
  /** page.total from the answer, when there is one. */
  total?: number | null
  /** Messages from the answer's root errors array. */
  errors?: string[]
}

export interface MusicDataProvider {
  /** Also the `source` written on every row it gives. */
  readonly name: 'soundcharts' | 'none'
  /** Calls made since the provider was built, for music_job_runs.requests_used. */
  readonly requests: number
  resolveTrack(input: { isrc?: string | null; spotifyTrackId?: string | null }): Promise<ResolvedTrack | null>
  /** Dated values between two UTC days, both included. */
  getTrackSeries(providerTrackId: string, metric: TrackMetric, from: string, to: string): Promise<SeriesPoint[]>
  getArtistSeries(providerArtistId: string, metric: ArtistMetric, from: string, to: string): Promise<SeriesPoint[]>
  supportedTrackMetrics(): TrackMetric[]
  supportedArtistMetrics(): ArtistMetric[]
  /** The calls made since the last time this was asked, then forgotten. Providers without calls give []. */
  takeCalls?(): ProviderCall[]
  /**
   * Asked once when a pull gave no numbers at all: which platform ids the provider holds for the song, so
   * staff can tell "the id is missing at the provider" from "the provider has no numbers yet".
   */
  explainEmpty?(providerTrackId: string): Promise<void>
}

/** The provider said no: the plan does not include the endpoint (403), the credentials are wrong (401), or the quota is used up (429). */
export class MusicProviderRefused extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'MusicProviderRefused'
  }
}
