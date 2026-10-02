CREATE TYPE "public"."user_role" AS ENUM('manager');--> statement-breakpoint
CREATE TABLE "assignment_rates" (
	"project_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"valid_from" date NOT NULL,
	"rate" integer NOT NULL,
	CONSTRAINT "assignment_rates_project_id_user_id_valid_from_pk" PRIMARY KEY("project_id","user_id","valid_from"),
	CONSTRAINT "rate_not_negative" CHECK ("assignment_rates"."rate" >= 0)
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "clients_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	CONSTRAINT "clients_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "organizations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"currency" char(3) NOT NULL,
	"full_day_minutes" integer NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "full_day_minutes_range" CHECK ("organizations"."full_day_minutes" between 1 and 1440)
);
--> statement-breakpoint
CREATE TABLE "project_assignments" (
	"project_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"org_id" bigint NOT NULL,
	"starts_on" date,
	"ends_on" date,
	CONSTRAINT "project_assignments_project_id_user_id_pk" PRIMARY KEY("project_id","user_id"),
	CONSTRAINT "ends_after_start" CHECK ("project_assignments"."ends_on" >= "project_assignments"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "project_organizations" (
	"project_id" bigint NOT NULL,
	"org_id" bigint NOT NULL,
	"is_owner" boolean DEFAULT false NOT NULL,
	CONSTRAINT "project_organizations_project_id_org_id_pk" PRIMARY KEY("project_id","org_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "projects_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"client_id" bigint NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"billable" boolean NOT NULL,
	"open_to_everyone" boolean DEFAULT false NOT NULL,
	"counts_toward_billable_base" boolean DEFAULT true NOT NULL,
	"starts_on" date,
	"ends_on" date,
	CONSTRAINT "projects_code_unique" UNIQUE("code"),
	CONSTRAINT "projects_clientId_name_unique" UNIQUE("client_id","name"),
	CONSTRAINT "code_length" CHECK (length("projects"."code") <= 16),
	CONSTRAINT "open_projects_not_billable" CHECK (not ("projects"."open_to_everyone" and "projects"."billable")),
	CONSTRAINT "billable_projects_count_toward_base" CHECK (not "projects"."billable" or "projects"."counts_toward_billable_base"),
	CONSTRAINT "ends_after_start" CHECK ("projects"."ends_on" >= "projects"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"token_hash" text NOT NULL,
	"user_id" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tasks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"project_id" bigint NOT NULL,
	"name" text NOT NULL,
	"ends_on" date,
	CONSTRAINT "tasks_projectId_name_unique" UNIQUE("project_id","name")
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "time_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"task_id" bigint NOT NULL,
	"spent_on" date NOT NULL,
	"minutes" integer NOT NULL,
	"notes" text,
	"rate" integer,
	"currency" char(3),
	CONSTRAINT "time_entries_userId_taskId_spentOn_unique" UNIQUE("user_id","task_id","spent_on"),
	CONSTRAINT "minutes_range" CHECK ("time_entries"."minutes" between 0 and 1440),
	CONSTRAINT "rate_not_negative" CHECK ("time_entries"."rate" >= 0),
	CONSTRAINT "rate_has_currency" CHECK (("time_entries"."rate" is null) = ("time_entries"."currency" is null))
);
--> statement-breakpoint
CREATE TABLE "user_identities" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_identities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"provider" text NOT NULL,
	"tenant_id" text NOT NULL,
	"subject" text NOT NULL,
	CONSTRAINT "user_identities_provider_tenantId_subject_unique" UNIQUE("provider","tenant_id","subject")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" bigint NOT NULL,
	"role" "user_role" NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"email" text NOT NULL,
	"org_id" bigint NOT NULL,
	"ends_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_id_orgId_unique" UNIQUE("id","org_id")
);
--> statement-breakpoint
ALTER TABLE "assignment_rates" ADD CONSTRAINT "assignment_rates_project_id_user_id_project_assignments_project_id_user_id_fk" FOREIGN KEY ("project_id","user_id") REFERENCES "public"."project_assignments"("project_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_user_in_organization" FOREIGN KEY ("user_id","org_id") REFERENCES "public"."users"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_organization_on_project" FOREIGN KEY ("project_id","org_id") REFERENCES "public"."project_organizations"("project_id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_organizations" ADD CONSTRAINT "project_organizations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_organizations" ADD CONSTRAINT "project_organizations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_assignments_user_id" ON "project_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_organizations_one_owner" ON "project_organizations" USING btree ("project_id") WHERE "project_organizations"."is_owner";--> statement-breakpoint
CREATE INDEX "sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "time_entries_task_id" ON "time_entries" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_org_id" ON "users" USING btree ("org_id");