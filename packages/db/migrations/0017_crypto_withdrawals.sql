ALTER TABLE "withdrawals" DROP CONSTRAINT "withdrawals_method_check";--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "destination" text;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_method_check" CHECK (method in ('stripe_connect','paypal','crypto'));