# User Creation Script

This script allows you to create users for the Learniverse application via command-line arguments.

## Prerequisites

1. PostgreSQL must be running
2. Database must exist (default: `learniverse`)
3. `.env` file in `/server` directory with valid `DATABASE_URL`
4. Prisma migrations must be applied: `npx prisma migrate dev --schema=server/prisma/schema.prisma`

## Usage

```bash
npx ts-node --transpile-only server/scripts/createUserBatch.ts <username> <password> [email] [avatar]
```

### Parameters

- **`username`** (required) - Must be unique
- **`password`** (required) - Minimum 6 characters
- **`email`** (optional) - User's email address (must be unique if provided)
- **`avatar`** (optional) - Avatar texture: `adam`, `ash`, `lucy`, or `nancy` (defaults to `adam`)

## Examples

### Basic User (Username + Password Only)

```bash
npx ts-node --transpile-only server/scripts/createUserBatch.ts john password123456
```

Creates:
- Username: `john`
- Password: `password123456`
- Email: (none)
- Avatar: `adam` (default)

### User with Email

```bash
npx ts-node --transpile-only server/scripts/createUserBatch.ts jane password123456 jane@example.com
```

Creates:
- Username: `jane`
- Password: `password123456`
- Email: `jane@example.com`
- Avatar: `adam` (default)

### User with Email and Custom Avatar

```bash
npx ts-node --transpile-only server/scripts/createUserBatch.ts alice password123456 alice@test.com lucy
```

Creates:
- Username: `alice`
- Password: `password123456`
- Email: `alice@test.com`
- Avatar: `lucy`

### User with Avatar but No Email

Use `""` or `null` for the email parameter:

```bash
npx ts-node --transpile-only server/scripts/createUserBatch.ts charlie password123 "" nancy
```

Creates:
- Username: `charlie`
- Password: `password123`
- Email: (none)
- Avatar: `nancy`

## Creating Multiple Users Quickly

You can chain commands to create multiple users at once:

```bash
npx ts-node --transpile-only server/scripts/createUserBatch.ts alice password123 alice@test.com lucy && \
npx ts-node --transpile-only server/scripts/createUserBatch.ts bob password123 bob@test.com ash && \
npx ts-node --transpile-only server/scripts/createUserBatch.ts charlie password123 "" nancy
```

## Available Avatars

- `adam` - Default avatar (male character)
- `ash` - Male character
- `lucy` - Female character
- `nancy` - Female character

## Database Schema

Users are stored with the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Auto-generated unique identifier |
| `username` | String | Unique username (required) |
| `password` | String | Bcrypt hashed password with 10 salt rounds (required) |
| `email` | String | Optional unique email address |
| `avatarTexture` | String | Avatar selection (defaults to "adam") |
| `sessionId` | String | Current Colyseus session (auto-managed by server) |
| `createdAt` | DateTime | Timestamp when user was created (auto-generated) |
| `updatedAt` | DateTime | Timestamp of last update (auto-updated) |

## Troubleshooting

### "Property 'user' does not exist" TypeScript Error

If you see TypeScript compilation errors about missing Prisma Client types:

1. Generate the Prisma Client:
   ```bash
   npx prisma generate --schema=server/prisma/schema.prisma
   ```

2. Always use the `--transpile-only` flag with ts-node to skip type checking:
   ```bash
   npx ts-node --transpile-only server/scripts/createUserBatch.ts ...
   ```

### "Environment variable not found: DATABASE_URL" Error

Ensure your `/server/.env` file contains a valid PostgreSQL connection string:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/learniverse"
```

### "Username already exists" Error

Each username must be unique. To delete an existing user:

```bash
# Connect to PostgreSQL
psql learniverse

# Delete the user
DELETE FROM "User" WHERE username='username_to_delete';
```

Or in one command:

```bash
psql learniverse -c "DELETE FROM \"User\" WHERE username='username_to_delete'"
```

### Viewing All Users

To see all users in the database:

```bash
psql learniverse -c "SELECT username, email, \"avatarTexture\", \"createdAt\" FROM \"User\" ORDER BY \"createdAt\" DESC;"
```

## Security Notes

- ✅ Passwords are automatically hashed using bcrypt with 10 salt rounds
- ✅ Minimum password length is enforced (6 characters)
- ✅ Usernames and emails must be unique
- ✅ Session IDs are automatically managed by the server on login/logout
- ⚠️ Never commit the `/server/.env` file containing database credentials

## Login

After creating a user, they can log in to the application using:
- **Username**: The username you specified
- **Password**: The password you specified

The system uses login-only authentication - there is no self-registration flow. All users must be created using this script.
