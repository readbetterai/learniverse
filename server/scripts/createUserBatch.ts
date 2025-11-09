#!/usr/bin/env node
import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

// Load .env from server directory
config({ path: resolve(__dirname, "../.env") });

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

interface UserData {
  username: string;
  password: string;
  email?: string;
  avatarTexture?: string;
}

async function createUser(userData: UserData) {
  try {
    // Validate input
    if (!userData.username) {
      throw new Error("Username is required");
    }
    if (!userData.password) {
      throw new Error("Password is required");
    }
    if (userData.password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: userData.username },
    });

    if (existingUser) {
      throw new Error(`Username "${userData.username}" already exists`);
    }

    // Validate avatar
    const validAvatars = ["adam", "ash", "lucy", "nancy"];
    const avatarTexture = validAvatars.includes(userData.avatarTexture || "")
      ? userData.avatarTexture
      : "adam";

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        username: userData.username,
        password: hashedPassword,
        email: userData.email || null,
        avatarTexture: avatarTexture,
      },
    });

    console.log(`✅ User "${user.username}" created successfully!`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email || "(none)"}`);
    console.log(`   Avatar: ${user.avatarTexture}`);

    return user;
  } catch (error) {
    console.error(`❌ Error creating user "${userData.username}":`, error instanceof Error ? error.message : error);
    throw error;
  }
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("\n=== Batch User Creation Script ===\n");
    console.log("Usage: npx ts-node --transpile-only server/scripts/createUserBatch.ts <username> <password> [email] [avatar]\n");
    console.log("Examples:");
    console.log("  npx ts-node --transpile-only server/scripts/createUserBatch.ts john pass123456");
    console.log("  npx ts-node --transpile-only server/scripts/createUserBatch.ts jane pass123456 jane@example.com lucy");
    console.log("\nAvailable avatars: adam (default), ash, lucy, nancy\n");
    process.exit(1);
  }

  const [username, password, email, avatarTexture] = args;

  console.log("\n=== Creating User ===\n");
  console.log(`Username: ${username}`);
  console.log(`Email: ${email || "(none)"}`);
  console.log(`Avatar: ${avatarTexture || "adam (default)"}`);
  console.log("\n⏳ Processing...\n");

  try {
    await createUser({
      username,
      password,
      email,
      avatarTexture,
    });
  } catch (error) {
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
