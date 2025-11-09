#!/usr/bin/env node
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

async function createTestUser() {
  console.log("\n=== Creating Test User ===\n");

  try {
    const username = "testuser";
    const password = "password123";
    const email = "test@example.com";
    const avatarTexture = "adam";

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      console.log(`❌ User "${username}" already exists`);
      console.log(`   To delete: psql learniverse -c "DELETE FROM \\"User\\" WHERE username='${username}'"`);
      process.exit(1);
    }

    // Hash password
    console.log("⏳ Creating user...");
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        email,
        avatarTexture,
      },
    });

    console.log(`\n✅ Test user created successfully!`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log(`   Email: ${email}`);
    console.log(`   Avatar: ${avatarTexture}\n`);
  } catch (error) {
    console.error("\n❌ Error creating user:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
