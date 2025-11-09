#!/usr/bin/env node
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import * as readline from "readline";

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

function questionPassword(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(prompt);

    // Hide input for password
    if ((stdin as any).setRawMode) {
      (stdin as any).setRawMode(true);
    }

    let password = "";
    stdin.resume();
    stdin.setEncoding("utf8");

    const onData = (char: string) => {
      char = char.toString("utf8");

      switch (char) {
        case "\n":
        case "\r":
        case "\u0004": // Ctrl+D
          stdin.removeListener("data", onData);
          if ((stdin as any).setRawMode) {
            (stdin as any).setRawMode(false);
          }
          stdin.pause();
          stdout.write("\n");
          resolve(password);
          break;
        case "\u0003": // Ctrl+C
          process.exit();
          break;
        case "\u007f": // Backspace
        case "\b":
          if (password.length > 0) {
            password = password.slice(0, -1);
            stdout.write("\b \b");
          }
          break;
        default:
          password += char;
          stdout.write("*");
          break;
      }
    };

    stdin.on("data", onData);
  });
}

async function createUser() {
  console.log("\n=== Create New User ===\n");

  try {
    // Get username
    const username = await question("Username: ");
    if (!username) {
      console.error("❌ Username is required");
      process.exit(1);
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      console.error(`❌ Username "${username}" already exists`);
      process.exit(1);
    }

    // Get password
    const password = await questionPassword("Password: ");
    if (!password) {
      console.error("\n❌ Password is required");
      process.exit(1);
    }

    if (password.length < 6) {
      console.error("❌ Password must be at least 6 characters");
      process.exit(1);
    }

    // Confirm password
    const confirmPassword = await questionPassword("Confirm Password: ");
    if (password !== confirmPassword) {
      console.error("\n❌ Passwords do not match");
      process.exit(1);
    }

    // Get email (optional)
    const email = await question("\nEmail (optional): ");

    // Get avatar texture
    console.log("\nAvailable avatars: adam, ash, lucy, nancy");
    const avatarTexture = await question("Avatar (default: adam): ");
    const validAvatars = ["adam", "ash", "lucy", "nancy"];
    const finalAvatar = validAvatars.includes(avatarTexture)
      ? avatarTexture
      : "adam";

    // Hash password
    console.log("\n⏳ Creating user...");
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        email: email || null,
        avatarTexture: finalAvatar,
      },
    });

    console.log(`\n✅ User created successfully!`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email || "(none)"}`);
    console.log(`   Avatar: ${user.avatarTexture}`);
    console.log(`   Created: ${user.createdAt.toISOString()}\n`);
  } catch (error) {
    console.error("\n❌ Error creating user:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

createUser();
