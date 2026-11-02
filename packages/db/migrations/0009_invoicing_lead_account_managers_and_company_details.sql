CREATE TABLE "client_account_managers" (
	"client_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	CONSTRAINT "client_account_managers_client_id_user_id_pk" PRIMARY KEY("client_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "organization_number" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "legal_name" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "registered_address" text[];--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "invoicing_lead_id" bigint;--> statement-breakpoint
ALTER TABLE "client_account_managers" ADD CONSTRAINT "client_account_managers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_account_managers" ADD CONSTRAINT "client_account_managers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_account_managers_user_id" ON "client_account_managers" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_invoicing_lead_id_users_id_fk" FOREIGN KEY ("invoicing_lead_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organizationNumber_unique" UNIQUE("organization_number");