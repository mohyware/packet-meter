import { eq, and, or } from 'drizzle-orm';
import { db, users, sessions } from '../db';
import { hashPassword, verifyPassword, generateSessionToken } from '../utils/auth';
import { OAuth2Client } from 'google-auth-library';
import { GOOGLE_CLIENT_ID } from '../config/env';

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

/**
 * Register a new user
 */
export async function registerUser(input: RegisterInput) {
  // Check if username or email already exists
  const existingUser = await db.query.users.findFirst({
    where: or(
      eq(users.username, input.username),
      eq(users.email, input.email)
    ),
  });

  if (existingUser) {
    throw new Error('Username or email already exists');
  }

  const passwordHash = await hashPassword(input.password);

  const [newUser] = await db.insert(users).values({
    username: input.username,
    email: input.email,
    passwordHash,
  }).returning();

  return {
    id: newUser.id,
    username: newUser.username,
    email: newUser.email,
    createdAt: newUser.createdAt,
  };
}

/**
 * Verify user credentials
 */
export async function verifyUser(input: LoginInput): Promise<typeof users.$inferSelect | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.username, input.username),
  });

  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(input.password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  return user;
}

/**
 * Create a new session for a user
 */
export async function createSession(userId: string) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const [session] = await db.insert(sessions).values({
    userId,
    token,
    expiresAt,
    status: 'active',
  }).returning();

  return session;
}

/**
 * Get session by token
 */
export async function getSessionByToken(token: string) {
  return db.query.sessions.findFirst({
    where: and(
      eq(sessions.token, token),
      eq(sessions.status, 'active')
    ),
  });
}

/**
 * Deactivate session
 */
export async function deactivateSession(sessionId: string) {
  await db.update(sessions)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

/**
 * Verify Google OAuth token and get user info
 * Accepts either an ID token or access token
 */
export async function verifyGoogleToken(token: string): Promise<{
  email: string;
  name: string;
  picture?: string;
  sub: string;
}> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }

  const client = new OAuth2Client(GOOGLE_CLIENT_ID);

  try {
    // First try to verify as ID token
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (payload?.email) {
        return {
          email: payload.email,
          name: payload.name || payload.email.split('@')[0],
          picture: payload.picture,
          sub: payload.sub,
        };
      }
    } catch (idTokenError: any) {
      // If ID token verification fails, try as access token
      console.log('ID token verification failed, trying as access token:', idTokenError.message);
    }

    // Try as access token - fetch user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      console.error('Google userinfo API error:', userInfoResponse.status, errorText);
      throw new Error(`Failed to fetch user info from Google: ${userInfoResponse.status} ${errorText}`);
    }

    const userInfo = await userInfoResponse.json();

    if (!userInfo.email) {
      console.error('No email in Google user info:', userInfo);
      throw new Error('No email in Google user info');
    }

    return {
      email: userInfo.email,
      name: userInfo.name || userInfo.email.split('@')[0],
      picture: userInfo.picture,
      sub: userInfo.id,
    };
  } catch (error: any) {
    console.error('Google token verification error:', error);
    // Preserve the original error message if available
    if (error.message && error.message !== 'Failed to verify Google token') {
      throw error;
    }
    throw new Error(`Failed to verify Google token: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Login or register user with Google OAuth
 */
export async function loginOrRegisterWithGoogle(token: string) {
  // Verify Google token
  const googleUser = await verifyGoogleToken(token);

  // Check if user exists by email
  let user = await db.query.users.findFirst({
    where: eq(users.email, googleUser.email),
  });

  if (!user) {
    // Create new user - use email prefix as username, generate a dummy password hash
    // For Google OAuth users, we'll use a special password hash that can't be used for login
    const dummyPasswordHash = await hashPassword(`google_oauth_${googleUser.sub}_${Date.now()}`);

    // Generate unique username from email if needed
    let username = googleUser.email.split('@')[0];
    let counter = 1;
    while (await db.query.users.findFirst({ where: eq(users.username, username) })) {
      username = `${googleUser.email.split('@')[0]}${counter}`;
      counter++;
    }

    const [newUser] = await db.insert(users).values({
      username,
      email: googleUser.email,
      passwordHash: dummyPasswordHash,
    }).returning();

    user = newUser;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
}

