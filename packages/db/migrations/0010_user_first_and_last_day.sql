ALTER TABLE "users" RENAME COLUMN "ends_on" TO "last_day";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_day" date;
