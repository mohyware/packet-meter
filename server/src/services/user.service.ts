import { eq, or } from 'drizzle-orm';
import { db, users } from '../db';
import { hashPassword, verifyPassword } from '../utils/auth';
import { OAuth2Client } from 'google-auth-library';
import { GOOGLE_CLIENT_ID } from '../config/env';
import { getErrorMessage } from '../utils/errors';
import logger from '../utils/logger';

export interface UserInfoResponse {
  email: string;
  name: string;
  picture?: string;
  id: string;
  sub?: string;
}

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
    where: or(eq(users.username, input.username), eq(users.email, input.email)),
  });

  if (existingUser) {
    throw new Error('Username or email already exists');
  }

  const passwordHash = await hashPassword(input.password);

  const [newUser] = await db
    .insert(users)
    .values({
      username: input.username,
      email: input.email,
      passwordHash,
      timezone: input.timezone ?? 'UTC',
    })
    .returning();

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
export async function verifyUser(
  input: LoginInput
): Promise<typeof users.$inferSelect | null> {
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
    await db
      .update(users)
      .set({
        timezone: input.timezone,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    return updatedUser ?? user;
  }

  return user;
}

/**
 * Verify Google OAuth ID token and get user info
 */
export async function verifyGoogleToken(token: string) {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }

  const client = new OAuth2Client(GOOGLE_CLIENT_ID);

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (payload?.email) {
      return {
        email: payload.email,
        name: payload.name ?? payload.email.split('@')[0],
        picture: payload.picture,
        sub: payload.sub,
      };
    }
  } catch (error: unknown) {
    logger.error('Google token verification error:', error);
    // Preserve the original error message if available
    const errorMessage = getErrorMessage(error);
    if (errorMessage && errorMessage !== 'Failed to verify Google token') {
      throw error instanceof Error ? error : new Error(errorMessage);
    }
    throw new Error(
      `Failed to verify Google token: ${errorMessage || 'Unknown error'}`
    );
  }
}

/**
 * Login or register user with Google OAuth
 */
export async function loginOrRegisterWithGoogle(
  token: string,
  timezone?: string
) {
  // Verify Google token
  const googleUser = (await verifyGoogleToken(token)) as
    | UserInfoResponse
    | undefined;

  if (!googleUser) {
    throw new Error('Failed to verify Google token');
  }

  // Check if user exists by email
  let user = await db.query.users.findFirst({
    where: eq(users.email, googleUser.email),
  });

  if (!user) {
    const dummyPasswordHash = await hashPassword(
      `google_oauth_${googleUser.sub}_${Date.now()}`
    );

    const username = googleUser.name.substring(0, 100);

    const [newUser] = await db
      .insert(users)
      .values({
        username,
        email: googleUser.email,
        passwordHash: dummyPasswordHash,
        timezone: timezone ?? 'UTC',
      })
      .returning();

    user = newUser;
  } else {
    // If timezone is provided and user doesn't have one set (or is UTC), update it
    if (timezone && (user.timezone === 'UTC' || !user.timezone)) {
      await db
        .update(users)
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
  const [updatedUser] = await db
    .update(users)
    .set({
      timezone,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  return updatedUser;
}

/**
 * Find user's timezone
 */
export async function findUserTimezone(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  return user?.timezone ?? 'UTC';
}
