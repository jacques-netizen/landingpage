CREATE TABLE "music_playlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"music_track_id" uuid NOT NULL,
	"source" text NOT NULL,
	"platform" text NOT NULL,
	"playlist_id" text NOT NULL,
	"playlist_identifier" text,
	"name" text NOT NULL,
	"type" text,
	"country" text,
	"followers" bigint,
	"entry_date" date NOT NULL,
	"exit_date" date,
	"position" integer,
	"peak_position" integer,
	"position_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "music_playlist_entries_point" UNIQUE("music_track_id","source","platform","playlist_id","entry_date")
);
--> statement-breakpoint
ALTER TABLE "chart_entries" ADD COLUMN "entry_date" date;--> statement-breakpoint
ALTER TABLE "music_playlist_entries" ADD CONSTRAINT "music_playlist_entries_music_track_id_music_tracks_id_fk" FOREIGN KEY ("music_track_id") REFERENCES "public"."music_tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "music_playlist_entries_track" ON "music_playlist_entries" USING btree ("music_track_id","entry_date");