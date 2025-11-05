import { eq, or } from 'drizzle-orm';
import { db, users } from '../db';
import { hashPassword, verifyPassword } from '../utils/auth';
import { OAuth2Client } from 'google-auth-library';
import { GOOGLE_CLIENT_ID } from '../config/env';

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  timezone?: string;
}

export interface LoginInput {
  username: string;
  password: string;
  timezone?: string;
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
    timezone: input.timezone || 'UTC',
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

  // If timezone is provided and user doesn't have one set (or is UTC), update it
  if (input.timezone && (user.timezone === 'UTC' || !user.timezone)) {
    await db.update(users)
      .set({
        timezone: input.timezone,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    return updatedUser || user;
  }

  return user;
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
export async function loginOrRegisterWithGoogle(token: string, timezone?: string) {
  // Verify Google token
  const googleUser = await verifyGoogleToken(token);

  // Check if user exists by email
  let user = await db.query.users.findFirst({
    where: eq(users.email, googleUser.email),
  });

  if (!user) {
    const dummyPasswordHash = await hashPassword(`google_oauth_${googleUser.sub}_${Date.now()}`);

    let username = googleUser.name
      .substring(0, 100);

    const [newUser] = await db.insert(users).values({
      username,
      email: googleUser.email,
      passwordHash: dummyPasswordHash,
      timezone: timezone || 'UTC',
    }).returning();

    user = newUser;
  } else {
    // If timezone is provided and user doesn't have one set (or is UTC), update it
    if (timezone && (user.timezone === 'UTC' || !user.timezone)) {
      await db.update(users)
        .set({
          timezone,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      const updatedUser = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      });
      if (updatedUser) user = updatedUser;
    }
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string) {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
  });
}

/**
 * Update user timezone
 */
export async function updateUserTimezone(userId: string, timezone: string) {
  const [updatedUser] = await db.update(users)
    .set({
      timezone,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  return updatedUser;
}

