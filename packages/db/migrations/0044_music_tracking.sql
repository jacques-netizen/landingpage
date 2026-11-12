CREATE TABLE "chart_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"music_track_id" uuid NOT NULL,
	"date" date NOT NULL,
	"chart_platform" text NOT NULL,
	"chart_name" text NOT NULL,
	"country" text,
	"city" text,
	"position" integer NOT NULL,
	"previous_position" integer,
	"source" text NOT NULL,
	"entered_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chart_entries_point" UNIQUE NULLS NOT DISTINCT("music_track_id","date","chart_platform","chart_name","country","city"),
	CONSTRAINT "chart_entries_position_check" CHECK (position > 0)
);
--> statement-breakpoint
CREATE TABLE "music_artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" text NOT NULL,
	"spotify_artist_id" text,
	"provider" text,
	"provider_artist_id" text,
	"tiktok_handle" text,
	"instagram_handle" text,
	"youtube_channel_id" text,
	"s4a_access_status" text DEFAULT 'not_requested' NOT NULL,
	"amfa_access_status" text DEFAULT 'not_requested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "music_artists_campaign" UNIQUE("campaign_id"),
	CONSTRAINT "music_artists_s4a_check" CHECK (s4a_access_status in ('not_requested','requested','granted','declined')),
	CONSTRAINT "music_artists_amfa_check" CHECK (amfa_access_status in ('not_requested','requested','granted','declined'))
);
--> statement-breakpoint
CREATE TABLE "music_job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_name" text NOT NULL,
	"music_track_id" uuid,
	"run_date" date NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"error" text,
	"requests_used" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "music_job_runs_status_check" CHECK (status in ('running','ok','failed'))
);
--> statement-breakpoint
CREATE TABLE "music_metric_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"music_track_id" uuid,
	"music_artist_id" uuid,
	"date" date NOT NULL,
	"period_start" date,
	"period_end" date,
	"source" text NOT NULL,
	"metric" text NOT NULL,
	"value" bigint NOT NULL,
	"is_cumulative" boolean DEFAULT false NOT NULL,
	"country" text,
	"city" text,
	"entered_by" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "music_metric_snapshots_point" UNIQUE NULLS NOT DISTINCT("music_track_id","music_artist_id","date","source","metric","country","city"),
	CONSTRAINT "music_metric_snapshots_one_owner" CHECK ((music_track_id is null) <> (music_artist_id is null)),
	CONSTRAINT "music_metric_snapshots_value_check" CHECK (value >= 0)
);
--> statement-breakpoint
CREATE TABLE "music_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"music_artist_id" uuid,
	"title" text NOT NULL,
	"isrc" text,
	"spotify_track_id" text,
	"provider" text,
	"provider_track_id" text,
	"provider_title" text,
	"provider_artist_name" text,
	"match_confirmed_at" timestamp with time zone,
	"match_confirmed_by" uuid,
	"tiktok_sound_url" text,
	"tiktok_clip_id" text,
	"tiktok_music_id" text,
	"instagram_audio_url" text,
	"instagram_audio_id" text,
	"youtube_video_id" text,
	"release_date" date,
	"launch_date" date NOT NULL,
	"target_countries" text[],
	"baseline_days" integer DEFAULT 28 NOT NULL,
	"baseline_status" text DEFAULT 'pending' NOT NULL,
	"tracking_end_date" date,
	"sound_rule" text DEFAULT 'warn' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "music_tracks_baseline_status_check" CHECK (baseline_status in ('pending','ready','short','unavailable')),
	CONSTRAINT "music_tracks_sound_rule_check" CHECK (sound_rule in ('warn','reject')),
	CONSTRAINT "music_tracks_baseline_days_check" CHECK (baseline_days between 1 and 365)
);
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "sound_check_status" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "detected_sound_id" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "detected_sound_title" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "sound_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chart_entries" ADD CONSTRAINT "chart_entries_music_track_id_music_tracks_id_fk" FOREIGN KEY ("music_track_id") REFERENCES "public"."music_tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_entries" ADD CONSTRAINT "chart_entries_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_artists" ADD CONSTRAINT "music_artists_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_job_runs" ADD CONSTRAINT "music_job_runs_music_track_id_music_tracks_id_fk" FOREIGN KEY ("music_track_id") REFERENCES "public"."music_tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_metric_snapshots" ADD CONSTRAINT "music_metric_snapshots_music_track_id_music_tracks_id_fk" FOREIGN KEY ("music_track_id") REFERENCES "public"."music_tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_metric_snapshots" ADD CONSTRAINT "music_metric_snapshots_music_artist_id_music_artists_id_fk" FOREIGN KEY ("music_artist_id") REFERENCES "public"."music_artists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_metric_snapshots" ADD CONSTRAINT "music_metric_snapshots_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD CONSTRAINT "music_tracks_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD CONSTRAINT "music_tracks_music_artist_id_music_artists_id_fk" FOREIGN KEY ("music_artist_id") REFERENCES "public"."music_artists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD CONSTRAINT "music_tracks_match_confirmed_by_users_id_fk" FOREIGN KEY ("match_confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "music_job_runs_track" ON "music_job_runs" USING btree ("music_track_id","run_date");--> statement-breakpoint
CREATE INDEX "music_metric_snapshots_track" ON "music_metric_snapshots" USING btree ("music_track_id","metric","date");--> statement-breakpoint
CREATE INDEX "music_tracks_campaign" ON "music_tracks" USING btree ("campaign_id");--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_sound_check_status_check" CHECK (sound_check_status is null or sound_check_status in ('matched','original_sound','different_sound','not_checked'));