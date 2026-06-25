CREATE TYPE "public"."attachment_policy" AS ENUM('NONE', 'OPTIONAL', 'REQUIRED');--> statement-breakpoint
CREATE TYPE "public"."day_type" AS ENUM('FULL', 'HALF_AM', 'HALF_PM', 'HOURLY');--> statement-breakpoint
CREATE TYPE "public"."entitlement_basis" AS ENUM('FIXED', 'ACCRUAL');--> statement-breakpoint
CREATE TYPE "public"."gender_restriction" AS ENUM('FEMALE', 'MALE');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('CARRY_FORWARD', 'MANUAL_ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."proration_rounding" AS ENUM('FLOOR', 'CEIL', 'HALF_UP');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('draft', 'pending', 'approved', 'rejected', 'cancelled', 'revoke_requested', 'revoked', 'revoke_denied');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('employee', 'manager', 'admin');--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "role" DEFAULT 'employee' NOT NULL,
	"invited_by" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"entry_type" "ledger_entry_type" NOT NULL,
	"days" numeric(6, 2) NOT NULL,
	"fiscal_year" integer NOT NULL,
	"expires_on" date,
	"reason" text,
	"adjusted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"day_type" "day_type" DEFAULT 'FULL' NOT NULL,
	"hours" numeric(5, 2),
	"working_days" numeric(5, 2) NOT NULL,
	"note" text,
	"attachment_url" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"review_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"color" text DEFAULT '#6B7280' NOT NULL,
	"paid" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"entitlement_basis" "entitlement_basis" DEFAULT 'FIXED' NOT NULL,
	"annual_entitlement_days" numeric(6, 2) DEFAULT '0' NOT NULL,
	"accrual_rate_per_month" numeric(6, 2),
	"accrual_day_of_month" integer,
	"max_accrual_balance" numeric(6, 2),
	"role_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"prorate_on_join" boolean DEFAULT true NOT NULL,
	"proration_rounding" "proration_rounding" DEFAULT 'FLOOR' NOT NULL,
	"prorate_on_exit" boolean DEFAULT false NOT NULL,
	"allow_carry_forward" boolean DEFAULT false NOT NULL,
	"carry_forward_max_days" numeric(6, 2),
	"carry_forward_expiry_days" integer,
	"allow_negative_balance" boolean DEFAULT false NOT NULL,
	"max_negative_days" numeric(6, 2),
	"requires_approval" boolean DEFAULT true NOT NULL,
	"min_notice_days" integer DEFAULT 0 NOT NULL,
	"max_consecutive_days" integer,
	"min_consecutive_days" integer DEFAULT 1 NOT NULL,
	"allow_half_day" boolean DEFAULT false NOT NULL,
	"allow_hourly" boolean DEFAULT false NOT NULL,
	"attachment_policy" "attachment_policy" DEFAULT 'NONE' NOT NULL,
	"attachment_required_after_days" integer,
	"visible_to_all" boolean DEFAULT true NOT NULL,
	"gender_restriction" "gender_restriction",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"year" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"fiscal_year_start_month" integer DEFAULT 1 NOT NULL,
	"working_week" integer[] DEFAULT '{1,2,3,4,5}' NOT NULL,
	"hours_per_workday" integer DEFAULT 8 NOT NULL,
	"min_headcount_threshold" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "role" DEFAULT 'employee' NOT NULL,
	"manager_id" uuid,
	"join_date" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_ledger" ADD CONSTRAINT "leave_ledger_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_ledger" ADD CONSTRAINT "leave_ledger_employee_id_users_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_ledger" ADD CONSTRAINT "leave_ledger_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_ledger" ADD CONSTRAINT "leave_ledger_adjusted_by_users_id_fk" FOREIGN KEY ("adjusted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_users_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_holidays" ADD CONSTRAINT "public_holidays_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;