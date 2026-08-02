import { customType, pgTable, text, timestamp, integer, boolean, index } from 'drizzle-orm/pg-core';
export const vector = customType({
    dataType() {
        return 'vector';
    },
});
export const users = pgTable('users', {
    id: text('id').primaryKey(), // usr_...
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    name: text('name').notNull(),
    plan: text('plan', { enum: ['free', 'paid'] }).default('free').notNull(),
    sessionCount: integer('session_count').default(0).notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    provider: text('provider', { enum: ['credentials', 'google', 'github'] }).default('credentials').notNull(),
    providerId: text('provider_id'),
    verificationCode: text('verification_code'),
    verificationExpiresAt: timestamp('verification_expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
export const sessions = pgTable('sessions', {
    id: text('id').primaryKey(), // sess_...
    userId: text('user_id').references(() => users.id).notNull(),
    status: text('status', { enum: ['active', 'completed', 'failed'] }).default('active').notNull(),
    jobTitle: text('job_title'),
    jobDescription: text('job_description'),
    resumeText: text('resume_text'),
    audioMode: text('audio_mode', { enum: ['hands_free', 'push_to_talk'] }).default('hands_free').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
}));
export const turns = pgTable('turns', {
    id: text('id').primaryKey(), // trn_...
    sessionId: text('session_id').references(() => sessions.id).notNull(),
    turnIndex: integer('turn_index').notNull(),
    role: text('role', { enum: ['user', 'assistant'] }).notNull(),
    transcript: text('transcript').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    sessionIdIdx: index('turns_session_id_idx').on(table.sessionId),
}));
export const reports = pgTable('reports', {
    id: text('id').primaryKey(), // rpt_...
    sessionId: text('session_id').references(() => sessions.id).notNull().unique(),
    userId: text('user_id').references(() => users.id).notNull(),
    overallScore: integer('overall_score').notNull(),
    technicalScore: integer('technical_score').notNull(),
    communicationScore: integer('communication_score').notNull(),
    behavioralScore: integer('behavioral_score').notNull(),
    feedback: text('feedback').notNull(), // Markdown format
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const knowledge = pgTable('knowledge', {
    id: text('id').primaryKey(), // knw_...
    role: text('role').notNull(), // e.g. "frontend-engineer"
    question: text('question').notNull(),
    idealKeywords: text('ideal_keywords').notNull(),
    embedding: vector('embedding'),
}, (table) => ({
    roleIdx: index('knowledge_role_idx').on(table.role),
}));
