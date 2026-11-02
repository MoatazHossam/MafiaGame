import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('mafia_rooms', {
  code: text('code').primaryKey(), version: integer('version').notNull().default(1), state: text('state').notNull(), expires: integer('expires').notNull(),
}, t => [index('rooms_expiry').on(t.expires)]);
export const sessions = sqliteTable('mafia_sessions', {
  hash: text('hash').primaryKey(), roomCode: text('room_code').notNull().references(() => rooms.code, { onDelete: 'cascade' }),
  memberId: text('member_id').notNull(), clientId: text('client_id').notNull(), expires: integer('expires').notNull(),
}, t => [index('sessions_room').on(t.roomCode), index('sessions_expiry').on(t.expires)]);
export const presence = sqliteTable('mafia_presence', {
  memberId: text('member_id').primaryKey(), roomCode: text('room_code').notNull().references(() => rooms.code, { onDelete: 'cascade' }), lastSeen: integer('last_seen').notNull(),
}, t => [index('presence_room').on(t.roomCode)]);
export const limits = sqliteTable('mafia_limits', { key: text('key').primaryKey(), count: integer('count').notNull(), expires: integer('expires').notNull() }, t => [index('limits_expiry').on(t.expires)]);
