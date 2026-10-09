export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Unix timestamp ms
  tokenType: string;
  scope: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface SessionData {
  user: UserProfile;
  tokens: GoogleTokens;
  createdAt: number;
}
