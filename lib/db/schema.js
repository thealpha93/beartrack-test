import {
  pgTable, pgEnum, uuid, text, integer, boolean,
  date, numeric, jsonb, timestamp,
} from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['employee', 'manager', 'admin'])
export const entitlementBasisEnum = pgEnum('entitlement_basis', ['FIXED', 'ACCRUAL'])
export const prorationRoundingEnum = pgEnum('proration_rounding', ['FLOOR', 'CEIL', 'HALF_UP'])
export const attachmentPolicyEnum = pgEnum('attachment_policy', ['NONE', 'OPTIONAL', 'REQUIRED'])
export const genderRestrictionEnum = pgEnum('gender_restriction', ['FEMALE', 'MALE'])
export const requestStatusEnum = pgEnum('request_status', [
  'draft', 'pending', 'approved', 'rejected', 'cancelled',
  'revoke_requested', 'revoked', 'revoke_denied',
])
export const dayTypeEnum = pgEnum('day_type', ['FULL', 'HALF_AM', 'HALF_PM', 'HOURLY'])
export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', ['CARRY_FORWARD', 'MANUAL_ADJUSTMENT'])

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  timezone: text('timezone').notNull().default('UTC'),
  fiscal_year_start_month: integer('fiscal_year_start_month').notNull().default(1),
  working_week: integer('working_week').array().notNull().default([1, 2, 3, 4, 5]),
  hours_per_workday: integer('hours_per_workday').notNull().default(8),
  min_headcount_threshold: integer('min_headcount_threshold').notNull().default(1),
  created_at: timestamp('created_at').notNull().defaultNow(),
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  email: text('email').notNull(),
  password_hash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: roleEnum('role').notNull().default('employee'),
  manager_id: uuid('manager_id').references(() => users.id),
  join_date: date('join_date').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').notNull().defaultNow(),
})

export const invites = pgTable('invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  email: text('email').notNull(),
  role: roleEnum('role').notNull().default('employee'),
  invited_by: uuid('invited_by').notNull().references(() => users.id),
  token_hash: text('token_hash').notNull(),
  expires_at: timestamp('expires_at').notNull(),
  accepted_at: timestamp('accepted_at'),
  created_at: timestamp('created_at').notNull().defaultNow(),
})

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id),
  token_hash: text('token_hash').notNull(),
  expires_at: timestamp('expires_at').notNull(),
  used_at: timestamp('used_at'),
  created_at: timestamp('created_at').notNull().defaultNow(),
})

export const leaveTypes = pgTable('leave_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  code: text('code').notNull(),
  color: text('color').notNull().default('#6B7280'),
  paid: boolean('paid').notNull().default(true),
  active: boolean('active').notNull().default(true),
  entitlement_basis: entitlementBasisEnum('entitlement_basis').notNull().default('FIXED'),
  annual_entitlement_days: numeric('annual_entitlement_days', { precision: 6, scale: 2 }).notNull().default('0'),
  accrual_rate_per_month: numeric('accrual_rate_per_month', { precision: 6, scale: 2 }),
  accrual_day_of_month: integer('accrual_day_of_month'),
  max_accrual_balance: numeric('max_accrual_balance', { precision: 6, scale: 2 }),
  role_overrides: jsonb('role_overrides').notNull().default({}),
  prorate_on_join: boolean('prorate_on_join').notNull().default(true),
  proration_rounding: prorationRoundingEnum('proration_rounding').notNull().default('FLOOR'),
  prorate_on_exit: boolean('prorate_on_exit').notNull().default(false),
  allow_carry_forward: boolean('allow_carry_forward').notNull().default(false),
  carry_forward_max_days: numeric('carry_forward_max_days', { precision: 6, scale: 2 }),
  carry_forward_expiry_days: integer('carry_forward_expiry_days'),
  allow_negative_balance: boolean('allow_negative_balance').notNull().default(false),
  max_negative_days: numeric('max_negative_days', { precision: 6, scale: 2 }),
  requires_approval: boolean('requires_approval').notNull().default(true),
  min_notice_days: integer('min_notice_days').notNull().default(0),
  max_consecutive_days: integer('max_consecutive_days'),
  min_consecutive_days: integer('min_consecutive_days').notNull().default(1),
  allow_half_day: boolean('allow_half_day').notNull().default(false),
  allow_hourly: boolean('allow_hourly').notNull().default(false),
  attachment_policy: attachmentPolicyEnum('attachment_policy').notNull().default('NONE'),
  attachment_required_after_days: integer('attachment_required_after_days'),
  visible_to_all: boolean('visible_to_all').notNull().default(true),
  gender_restriction: genderRestrictionEnum('gender_restriction'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
})

export const leaveRequests = pgTable('leave_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  employee_id: uuid('employee_id').notNull().references(() => users.id),
  leave_type_id: uuid('leave_type_id').notNull().references(() => leaveTypes.id),
  status: requestStatusEnum('status').notNull().default('pending'),
  start_date: date('start_date').notNull(),
  end_date: date('end_date').notNull(),
  day_type: dayTypeEnum('day_type').notNull().default('FULL'),
  hours: numeric('hours', { precision: 5, scale: 2 }),
  working_days: numeric('working_days', { precision: 5, scale: 2 }).notNull(),
  note: text('note'),
  attachment_url: text('attachment_url'),
  reviewed_by: uuid('reviewed_by').references(() => users.id),
  reviewed_at: timestamp('reviewed_at'),
  review_note: text('review_note'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
})

export const leaveLedger = pgTable('leave_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  employee_id: uuid('employee_id').notNull().references(() => users.id),
  leave_type_id: uuid('leave_type_id').notNull().references(() => leaveTypes.id),
  entry_type: ledgerEntryTypeEnum('entry_type').notNull(),
  days: numeric('days', { precision: 6, scale: 2 }).notNull(),
  fiscal_year: integer('fiscal_year').notNull(),
  expires_on: date('expires_on'),
  reason: text('reason'),
  adjusted_by: uuid('adjusted_by').references(() => users.id),
  created_at: timestamp('created_at').notNull().defaultNow(),
})

export const publicHolidays = pgTable('public_holidays', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  date: date('date').notNull(),
  name: text('name').notNull(),
  year: integer('year').notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
})
