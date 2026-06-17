import {
  pgTable,
  serial,
  bigserial,
  varchar,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  decimal,
  date,
  uuid,
  index,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

// ─────────────────────────────────────────────────────────
// LOOKUP TABLES
// ─────────────────────────────────────────────────────────

export const accountType = pgTable("account_type", {
  id: serial("id").primaryKey(),
  description: varchar("description", { length: 100 }).notNull(),
})

export const calculationItemType = pgTable("calculation_item_type", {
  id: serial("id").primaryKey(),
  description: varchar("description", { length: 100 }).notNull(),
})

export const country = pgTable("country", {
  id: serial("id").primaryKey(),
  description: varchar("description", { length: 200 }).notNull(),
})

export const flowType = pgTable("flow_type", {
  id: serial("id").primaryKey(),
  description: varchar("description", { length: 100 }).notNull(),
})

export const maritalStatus = pgTable("marital_status", {
  id: serial("id").primaryKey(),
  description: varchar("description", { length: 100 }).notNull(),
})

export const relationType = pgTable("relation_type", {
  id: serial("id").primaryKey(),
  description: varchar("description", { length: 100 }).notNull(),
})

export const wishes = pgTable("wishes", {
  id: serial("id").primaryKey(),
  description: varchar("description", { length: 200 }).notNull(),
})

// ─────────────────────────────────────────────────────────
// ACCOUNT — Brokers, admins, and (later) customer logins
// account.id is uuid for future Supabase auth.users compatibility
// ─────────────────────────────────────────────────────────

export const account = pgTable(
  "account",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountTypeId: integer("account_type_id").notNull().references(() => accountType.id),
    customerId: integer("customer_id"), // FK constraint declared at relations level; nullable
    email: varchar("email", { length: 255 }).notNull().unique(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    contactNumber: varchar("contact_number", { length: 50 }).notNull().default(""),
    manageAll: boolean("manage_all").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    emailIdx: index("account_email_idx").on(t.email),
    typeIdx: index("account_type_idx").on(t.accountTypeId),
  })
)

// ─────────────────────────────────────────────────────────
// CUSTOMER
// ─────────────────────────────────────────────────────────

export const customer = pgTable(
  "customer",
  {
    id: serial("id").primaryKey(),
    countryId: integer("country_id").notNull().references(() => country.id),
    maritalStatusId: integer("marital_status_id").notNull().references(() => maritalStatus.id),
    wishesId: integer("wishes_id").notNull().references(() => wishes.id),
    assignedTo: uuid("assigned_to").notNull().references(() => account.id),
    title: varchar("title", { length: 10 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    idNumber: varchar("id_number", { length: 20 }).notNull(),
    contactNumber: varchar("contact_number", { length: 50 }).notNull().default(""),
    occupation: varchar("occupation", { length: 255 }).notNull().default(""),
    highestEducation: varchar("highest_education", { length: 100 }).notNull().default(""),
    monthlyIncome: decimal("monthly_income", { precision: 18, scale: 2 }).notNull().default("0"),
    isSmoker: boolean("is_smoker").notNull().default(false),
    registeredDonor: boolean("registered_donor").notNull().default(false),
    willDonate: boolean("will_donate").notNull().default(false),
    dateOfBirth: date("date_of_birth").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").notNull().references(() => account.id),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    assignedToIdx: index("customer_assigned_to_idx").on(t.assignedTo),
    idNumberIdx: index("customer_id_number_idx").on(t.idNumber),
    createdAtIdx: index("customer_created_at_idx").on(t.createdAt),
  })
)

// ─────────────────────────────────────────────────────────
// RELATION + CUSTOMER_RELATION (M:M)
// ─────────────────────────────────────────────────────────

export const relation = pgTable("relation", {
  id: serial("id").primaryKey(),
  relationTypeId: integer("relation_type_id").notNull().references(() => relationType.id),
  title: varchar("title", { length: 10 }).notNull().default(""),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().default(""),
  contactNumber: varchar("contact_number", { length: 50 }).notNull().default(""),
})

export const customerRelation = pgTable(
  "customer_relation",
  {
    customerId: integer("customer_id").notNull().references(() => customer.id),
    relationId: integer("relation_id").notNull().references(() => relation.id),
  },
  (t) => ({
    customerIdx: index("customer_relation_customer_idx").on(t.customerId),
  })
)

// ─────────────────────────────────────────────────────────
// FLOW — Will lifecycle (schema preserved, no endpoints in Phase 2)
// ─────────────────────────────────────────────────────────

export const flow = pgTable(
  "flow",
  {
    id: serial("id").primaryKey(),
    flowTypeId: integer("flow_type_id").notNull().references(() => flowType.id),
    customerId: integer("customer_id").notNull().references(() => customer.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => account.id),
    clientConfirmId: uuid("client_confirm_id").references(() => account.id),
    clientConfirmDate: timestamp("client_confirm_date"),
    receivedId: uuid("received_id").references(() => account.id),
    receivedDate: timestamp("received_date"),
    draftSentId: uuid("draft_sent_id").references(() => account.id),
    draftSentDate: timestamp("draft_sent_date"),
    draftConfirmId: uuid("draft_confirm_id").references(() => account.id),
    draftConfirmDate: timestamp("draft_confirm_date"),
    finalSentId: uuid("final_sent_id").references(() => account.id),
    finalSentDate: timestamp("final_sent_date"),
    finalConfirmId: uuid("final_confirm_id").references(() => account.id),
    finalConfirmDate: timestamp("final_confirm_date"),
    signedId: uuid("signed_id").references(() => account.id),
    signedDate: timestamp("signed_date"),
    verifiedId: uuid("verified_id").references(() => account.id),
    verifiedDate: timestamp("verified_date"),
    finalVerifiedId: uuid("final_verified_id").references(() => account.id),
    finalVerifiedDate: timestamp("final_verified_date"),
  },
  (t) => ({
    customerIdx: index("flow_customer_idx").on(t.customerId),
    finalVerifiedIdx: index("flow_final_verified_idx").on(t.finalVerifiedDate),
  })
)

// ─────────────────────────────────────────────────────────
// FLOW CONTROL — Compliance checklist (PRIMARY workflow)
// ─────────────────────────────────────────────────────────

export const flowControl = pgTable(
  "flow_control",
  {
    id: serial("id").primaryKey(),
    flowTypeId: integer("flow_type_id").notNull().references(() => flowType.id),
    customerId: integer("customer_id").notNull().references(() => customer.id),
    assignedTo: uuid("assigned_to").notNull().references(() => account.id),
    completed: boolean("completed").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => account.id),
  },
  (t) => ({
    customerIdx: index("flow_control_customer_idx").on(t.customerId),
    assignedToIdx: index("flow_control_assigned_to_idx").on(t.assignedTo),
    completedIdx: index("flow_control_completed_idx").on(t.completed),
  })
)

export const flowControlItem = pgTable("flow_control_item", {
  id: serial("id").primaryKey(),
  flowTypeId: integer("flow_type_id").notNull().references(() => flowType.id),
  abbreviation: varchar("abbreviation", { length: 50 }).notNull(),
  description: text("description").notNull(),
  orderBy: integer("order_by").notNull(),
})

export const flowItem = pgTable(
  "flow_item",
  {
    id: serial("id").primaryKey(),
    flowControlId: integer("flow_control_id").notNull().references(() => flowControl.id),
    flowControlItemId: integer("flow_control_item_id")
      .notNull()
      .references(() => flowControlItem.id),
    checkedDate: timestamp("checked_date"),
    checkedBy: uuid("checked_by").references(() => account.id),
    applicable: boolean("applicable").notNull().default(true),
    notes: text("notes").notNull().default(""),
    orderBy: integer("order_by").notNull(),
  },
  (t) => ({
    controlIdx: index("flow_item_control_idx").on(t.flowControlId),
  })
)

// ─────────────────────────────────────────────────────────
// DOCUMENT — Supabase Storage-backed tree
// ─────────────────────────────────────────────────────────

export const document = pgTable(
  "document",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    parentId: bigint("parent_id", { mode: "number" }).notNull().default(0),
    customerId: integer("customer_id").notNull().references(() => customer.id),
    documentName: varchar("document_name", { length: 500 }).notNull(),
    internalName: varchar("internal_name", { length: 255 }).notNull(),
    path: varchar("path", { length: 1000 }).notNull(),
    isFolder: boolean("is_folder").notNull().default(false),
    inVault: boolean("in_vault").notNull().default(false),
    contentType: varchar("content_type", { length: 100 }).notNull().default(""),
    password: varchar("password", { length: 255 }).notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => account.id),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    customerIdx: index("document_customer_idx").on(t.customerId),
    parentIdx: index("document_parent_idx").on(t.parentId),
  })
)

export const documentTemplate = pgTable("document_template", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  parentId: bigint("parent_id", { mode: "number" }).notNull().default(0),
  documentName: varchar("document_name", { length: 500 }).notNull(),
  isFolder: boolean("is_folder").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => account.id),
  deletedAt: timestamp("deleted_at"),
})

export const flowItemDocument = pgTable("flow_item_document", {
  id: serial("id").primaryKey(),
  flowItemId: integer("flow_item_id").notNull().references(() => flowItem.id),
  documentId: bigint("document_id", { mode: "number" }).notNull().references(() => document.id),
})

// ─────────────────────────────────────────────────────────
// CALCULATIONS — Estate Value
// ─────────────────────────────────────────────────────────

export const calculationItem = pgTable(
  "calculation_item",
  {
    id: serial("id").primaryKey(),
    calculationItemTypeId: integer("calculation_item_type_id")
      .notNull()
      .references(() => calculationItemType.id),
    customerId: integer("customer_id").notNull().references(() => customer.id),
    description: varchar("description", { length: 500 }).notNull().default(""),
    value: decimal("value", { precision: 18, scale: 2 }).notNull().default("0"),
  },
  (t) => ({
    customerIdx: index("calculation_item_customer_idx").on(t.customerId),
  })
)

// ─────────────────────────────────────────────────────────
// MAIL OUTBOX — drained by Vercel Cron
// ─────────────────────────────────────────────────────────

export const mail = pgTable(
  "mail",
  {
    id: serial("id").primaryKey(),
    address: varchar("address", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 500 }).notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
  },
  (t) => ({
    createdAtIdx: index("mail_created_at_idx").on(t.createdAt),
  })
)

// ─────────────────────────────────────────────────────────
// RELATIONS (Drizzle relational query helpers)
// ─────────────────────────────────────────────────────────

export const accountRelations = relations(account, ({ one, many }) => ({
  accountType: one(accountType, { fields: [account.accountTypeId], references: [accountType.id] }),
  customer: one(customer, { fields: [account.customerId], references: [customer.id] }),
  assignedCustomers: many(customer, { relationName: "assignedBroker" }),
}))

export const customerRelations = relations(customer, ({ one, many }) => ({
  country: one(country, { fields: [customer.countryId], references: [country.id] }),
  maritalStatus: one(maritalStatus, { fields: [customer.maritalStatusId], references: [maritalStatus.id] }),
  wishes: one(wishes, { fields: [customer.wishesId], references: [wishes.id] }),
  assignedBroker: one(account, {
    fields: [customer.assignedTo],
    references: [account.id],
    relationName: "assignedBroker",
  }),
  creator: one(account, { fields: [customer.createdBy], references: [account.id] }),
  documents: many(document),
  flows: many(flow),
  flowControls: many(flowControl),
  calculationItems: many(calculationItem),
  customerRelations: many(customerRelation),
}))

export const customerRelationRelations = relations(customerRelation, ({ one }) => ({
  customer: one(customer, { fields: [customerRelation.customerId], references: [customer.id] }),
  relation: one(relation, { fields: [customerRelation.relationId], references: [relation.id] }),
}))

export const relationRelations = relations(relation, ({ one, many }) => ({
  relationType: one(relationType, { fields: [relation.relationTypeId], references: [relationType.id] }),
  customerRelations: many(customerRelation),
}))

export const flowRelations = relations(flow, ({ one }) => ({
  customer: one(customer, { fields: [flow.customerId], references: [customer.id] }),
  flowType: one(flowType, { fields: [flow.flowTypeId], references: [flowType.id] }),
}))

export const flowControlRelations = relations(flowControl, ({ one, many }) => ({
  customer: one(customer, { fields: [flowControl.customerId], references: [customer.id] }),
  flowType: one(flowType, { fields: [flowControl.flowTypeId], references: [flowType.id] }),
  assignedBroker: one(account, { fields: [flowControl.assignedTo], references: [account.id] }),
  items: many(flowItem),
}))

export const flowControlItemRelations = relations(flowControlItem, ({ one }) => ({
  flowType: one(flowType, { fields: [flowControlItem.flowTypeId], references: [flowType.id] }),
}))

export const flowItemRelations = relations(flowItem, ({ one, many }) => ({
  flowControl: one(flowControl, { fields: [flowItem.flowControlId], references: [flowControl.id] }),
  flowControlItem: one(flowControlItem, {
    fields: [flowItem.flowControlItemId],
    references: [flowControlItem.id],
  }),
  documents: many(flowItemDocument),
}))

export const flowItemDocumentRelations = relations(flowItemDocument, ({ one }) => ({
  flowItem: one(flowItem, { fields: [flowItemDocument.flowItemId], references: [flowItem.id] }),
  document: one(document, { fields: [flowItemDocument.documentId], references: [document.id] }),
}))

export const documentRelations = relations(document, ({ one }) => ({
  customer: one(customer, { fields: [document.customerId], references: [customer.id] }),
  creator: one(account, { fields: [document.createdBy], references: [account.id] }),
}))

export const calculationItemRelations = relations(calculationItem, ({ one }) => ({
  calculationItemType: one(calculationItemType, {
    fields: [calculationItem.calculationItemTypeId],
    references: [calculationItemType.id],
  }),
  customer: one(customer, { fields: [calculationItem.customerId], references: [customer.id] }),
}))
