CREATE TABLE "performed_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"planned_action_id" uuid,
	"name" text NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"comments" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_id" uuid NOT NULL,
	"date" date NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"comments" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rounds_routine_date_unique" UNIQUE("routine_id","date")
);
--> statement-breakpoint
CREATE TABLE "plan_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"planned_action_id" uuid NOT NULL,
	"length_minutes" integer DEFAULT 0 NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "plan_actions_plan_action_unique" UNIQUE("plan_id","planned_action_id")
);
--> statement-breakpoint
CREATE TABLE "planned_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_id" uuid NOT NULL,
	"name" text NOT NULL,
	"equipment" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_id" uuid NOT NULL,
	"start_time" time,
	"period_start" date NOT NULL,
	"period_end" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"time_zone" text DEFAULT 'Europe/Madrid' NOT NULL,
	"week_start_day" integer DEFAULT 1 NOT NULL,
	"chart_hue" integer DEFAULT 30 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "performed_actions" ADD CONSTRAINT "performed_actions_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performed_actions" ADD CONSTRAINT "performed_actions_planned_action_id_planned_actions_id_fk" FOREIGN KEY ("planned_action_id") REFERENCES "public"."planned_actions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_actions" ADD CONSTRAINT "plan_actions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_actions" ADD CONSTRAINT "plan_actions_planned_action_id_planned_actions_id_fk" FOREIGN KEY ("planned_action_id") REFERENCES "public"."planned_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_actions" ADD CONSTRAINT "planned_actions_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "performed_actions_round_planned_unique" ON "performed_actions" USING btree ("round_id","planned_action_id") WHERE "performed_actions"."planned_action_id" is not null;--> statement-breakpoint
CREATE INDEX "performed_actions_round_ended_idx" ON "performed_actions" USING btree ("round_id","ended_at");--> statement-breakpoint
CREATE INDEX "rounds_date_idx" ON "rounds" USING btree ("date");--> statement-breakpoint
CREATE INDEX "plans_routine_period_idx" ON "plans" USING btree ("routine_id","period_start");--> statement-breakpoint
-- Hand-written, not generated: drizzle-kit cannot express an EXCLUDE
-- constraint. Two Plans of the same Routine may never cover the same day —
-- otherwise a Round's date would not identify a single Plan, which is the
-- assumption the whole recording flow rests on (the user picks a date, never
-- a plan). An open-ended plan (period_end IS NULL) runs to 'infinity'.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_no_overlap" EXCLUDE USING gist (
	"routine_id" WITH =,
	daterange("period_start", COALESCE("period_end", 'infinity'::date), '[]') WITH &&
);
