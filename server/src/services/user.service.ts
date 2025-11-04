import { eq, and, or } from 'drizzle-orm';
import { db, users, sessions } from '../db';
import { hashPassword, verifyPassword, generateSessionToken } from '../utils/auth';

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

