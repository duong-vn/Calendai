import { z } from 'zod';

export const UserProfileSchema = z.object({
  id: z.string().min(1).max(255),
  email: z.string().email().max(320),
  name: z.string().min(1).max(256),
  picture: z.string().url().max(2048).optional(),
});

export const GoogleTokensSchema = z.object({
  accessToken: z.string().min(1).max(16384),
  refreshToken: z.string().min(1).max(16384).optional(),
  expiresAt: z.number().int().positive().safe(),
  tokenType: z.literal('Bearer'),
  scope: z.string().max(8192),
});

export const SessionDataSchema = z.object({
  user: UserProfileSchema,
  tokens: GoogleTokensSchema,
  createdAt: z.number().int().positive().safe(),
  kind: z.literal('mobile').optional(),
  expiresAt: z.number().int().positive().safe().optional(),
});

export const MobileSessionDataSchema = SessionDataSchema.extend({
  kind: z.literal('mobile'),
  expiresAt: z.number().int().positive().safe(),
  tokens: GoogleTokensSchema.extend({ refreshToken: z.string().min(1).max(16384) }),
});

export type GoogleTokens = z.infer<typeof GoogleTokensSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type SessionData = z.infer<typeof SessionDataSchema>;
export type MobileSessionData = z.infer<typeof MobileSessionDataSchema>;
