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
}

/** The provider said no: the plan does not include the endpoint (403), or the credentials are wrong (401). */
export class MusicProviderRefused extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'MusicProviderRefused'
  }
}
