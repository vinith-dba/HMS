import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Named admin seed — Mallesh, Suresh, Arjun.
 *
 * Idempotent: safe to run repeatedly (upsert by username). Run it against
 * whatever DATABASE_URL is set, e.g. the production Supabase Postgres:
 *
 *   npx tsx prisma/seed-admins.ts
 *
 * Login handle is the gmail address (stored lowercase — the login form
 * lowercases what's typed). Password is @Name2026.
 */
const prisma = new PrismaClient();

const ADMINS: { name: string; username: string; phone: string; password: string }[] = [
  { name: "Mallesh", username: "mallesh@gmail.com", phone: "9000000101", password: "@Mallesh2026" },
  { name: "Suresh",  username: "suresh@gmail.com",  phone: "9000000102", password: "@Suresh2026"  },
  { name: "Arjun",   username: "arjun@gmail.com",   phone: "9000000103", password: "@Arjun2026"   },
];

async function main() {
  for (const a of ADMINS) {
    const passwordHash = await bcrypt.hash(a.password, 12);
    const username = a.username.toLowerCase();
    await prisma.user.upsert({
      where: { username },
      update: {
        name: a.name,
        email: username,
        role: "ADMIN" as Role,
        isActive: true,
        passwordHash, // reset the password to the specified value on every run
      },
      create: {
        username,
        phone: a.phone,
        email: username,
        name: a.name,
        role: "ADMIN" as Role,
        passwordHash,
      },
    });
    console.log(`  ✓ admin ready: ${a.name}  ·  login "${username}"`);
  }
  console.log(`\n  ${ADMINS.length} admins seeded. They sign in on the admin portal with their gmail + @Name2026.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
