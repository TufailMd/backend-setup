# Authentication System Flow

## 1. Authentication Architecture

This authentication system uses:

* JWT Access Token
* JWT Refresh Token
* HttpOnly Cookie
* bcrypt Password Hashing
* bcrypt Refresh Token Hashing
* Session Management
* Refresh Token Rotation
* Single Device Logout
* Logout From All Devices

### Token Lifetime

| Token              |       Lifetime | Storage         |
| ------------------ | -------------: | --------------- |
| Access Token       |     15 minutes | Client          |
| Refresh Token      |         7 days | HttpOnly Cookie |
| Password           |      Permanent | Hashed in DB    |
| Refresh Token Hash | 7 days/session | Database        |

---

# 2. Overall Authentication Flow

```text
                    ┌──────────────┐
                    │    Client    │
                    └──────┬───────┘
                           │
             ┌─────────────┴─────────────┐
             │                           │
          REGISTER                     LOGIN
             │                           │
             └─────────────┬─────────────┘
                           ↓
                    Create Session
                           ↓
              ┌────────────┴────────────┐
              │                         │
        Access Token              Refresh Token
          15 min                     7 days
              │                         │
              ↓                         ↓
        Client Response          HttpOnly Cookie
```

---

# 3. Register Flow

Endpoint example:

```text
POST /auth/register
```

## Flow

```text
Client
  │
  │ username + email + password
  ↓
Validate Input
  │
  ↓
Check Existing User
  │
  ├── User exists → 409
  │
  ↓
Hash Password
  │
  ↓
Create User
  │
  ↓
Create Refresh Token
  │
  ↓
Hash Refresh Token
  │
  ↓
Create Session
  │
  ├── user
  ├── refreshToken
  ├── ip
  ├── userAgent
  └── revoked: false
  │
  ↓
Create Access Token
  │
  ├── userId
  └── sessionId
  │
  ├─────────────────────┐
  ↓                     ↓
Access Token       Refresh Token
  │                     │
  ↓                     ↓
JSON Response       HttpOnly Cookie
```

## Step-by-step

### 1. Receive user data

```js
const { username, email, password } = req.body;
```

### 2. Validate

```text
username missing?
email missing?
password missing?
```

If yes:

```text
400 Bad Request
```

### 3. Check existing user

```js
userModel.findOne({
  $or: [{ username }, { email }],
});
```

If user already exists:

```text
409 Conflict
```

### 4. Hash password

```js
const hashedPassword = await bcrypt.hash(password, 10);
```

Never store the original password.

```text
password
   ↓
bcrypt
   ↓
hashed password
   ↓
Database
```

### 5. Create user

```js
userModel.create({
  username,
  email,
  password: hashedPassword,
});
```

### 6. Create Refresh Token

```js
jwt.sign(
  { userId: user._id },
  REFRESH_TOKEN_SECRET,
  { expiresIn: "7d" }
);
```

### 7. Hash Refresh Token

```js
const refreshTokenHash = await bcrypt.hash(
  refreshToken,
  10
);
```

Only the hash is stored in the database.

```text
Actual Refresh Token
        ↓
     bcrypt
        ↓
Refresh Token Hash
        ↓
      MongoDB
```

### 8. Create Session

```js
{
  user: user._id,
  refreshToken: refreshTokenHash,
  ip: req.ip,
  userAgent: req.headers["user-agent"],
  revoked: false
}
```

### 9. Create Access Token

```js
jwt.sign(
  {
    userId: user._id,
    sessionId: session._id
  },
  ACCESS_TOKEN_SECRET,
  {
    expiresIn: "15m"
  }
);
```

### 10. Store Refresh Token in Cookie

```js
res.cookie("refreshToken", refreshToken, {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
```

### 11. Return response

```text
Access Token
+
User Information
```

---

# 4. Login Flow

Endpoint example:

```text
POST /auth/login
```

## Flow

```text
Client
  │
  │ username + password
  ↓
Validate Input
  ↓
Find User
  │
  ├── Not Found → 401
  │
  ↓
Compare Password
  │
  ├── Wrong → 401
  │
  ↓
Create Refresh Token
  ↓
Hash Refresh Token
  ↓
Create New Session
  ↓
Create Access Token
  ↓
     ┌──────────────────┐
     │                  │
     ↓                  ↓
Access Token       Refresh Token
     │                  │
     ↓                  ↓
JSON Response      HttpOnly Cookie
```

## Important

Every successful login creates a **new session**.

Example:

```text
Laptop Login
    ↓
Session A

Mobile Login
    ↓
Session B

Tablet Login
    ↓
Session C
```

Database:

```text
User
 ├── Session A
 ├── Session B
 └── Session C
```

This allows multiple-device login.

---

# 5. Session Flow

A session represents one login/device.

Example:

```js
{
  user: "USER_ID",
  refreshToken: "HASHED_REFRESH_TOKEN",
  ip: "USER_IP",
  userAgent: "BROWSER_INFORMATION",
  revoked: false
}
```

### `user`

Identifies the owner of the session.

### `refreshToken`

Stores the **hashed** refresh token.

### `ip`

Stores the IP address from which the session was created.

### `userAgent`

Stores browser/device/client information.

Example:

```text
Mozilla/5.0 ...
Chrome/154...
Windows...
```

### `revoked`

```text
false → Session active
true  → Session invalid/revoked
```

---

# 6. Access Token Flow

Access Token is short-lived.

```text
Access Token
     ↓
15 minutes
     ↓
Used for protected APIs
```

Example:

```http
Authorization: Bearer ACCESS_TOKEN
```

The token contains:

```js
{
  userId,
  sessionId
}
```

The `sessionId` connects the Access Token to the user's session.

---

# 7. GET ME Flow

Endpoint example:

```text
GET /auth/me
```

## Flow

```text
Client
  │
  │ Authorization: Bearer ACCESS_TOKEN
  ↓
Extract Access Token
  ↓
jwt.verify()
  │
  ├── Invalid/Expired → 401
  │
  ↓
Get userId + sessionId
  ↓
Check Active Session
  │
  ├── revoked: true → 401
  │
  ↓
Find User
  │
  ├── User not found → 404
  │
  ↓
Return User
```

### Important

The Access Token itself being valid is not enough.

The session should also be active:

```js
{
  user: decoded.userId,
  revoked: false
}
```

This allows logout to invalidate the session.

---

# 8. Refresh Token Flow

The Access Token expires after:

```text
15 minutes
```

Instead of asking the user to login again, the Refresh Token is used.

## Flow

```text
Access Token Expired
        ↓
Client sends Refresh Request
        ↓
Browser sends HttpOnly Refresh Cookie
        ↓
Read Refresh Token
        ↓
jwt.verify()
        ↓
Get userId
        ↓
Find Active Session
        ↓
bcrypt.compare()
        ↓
Token valid?
   │             │
  YES            NO
   │              │
   ↓              ↓
Create New      401
Refresh Token
   ↓
Hash New Refresh Token
   ↓
Replace Old Hash
   ↓
Create New Access Token
   ↓
Replace Cookie
   ↓
Return New Access Token
```

---

# 9. Refresh Token Verification

Important:

Do NOT do this:

```js
const hash = await bcrypt.hash(refreshToken, 10);

findOne({
  refreshToken: hash
});
```

This does not work reliably because bcrypt generates a new salt every time.

Correct approach:

```js
const session = await sessionModel.findOne({
  user: decoded.userId,
  revoked: false,
});

const isValid = await bcrypt.compare(
  refreshToken,
  session.refreshToken
);
```

Conceptually:

```text
Cookie Refresh Token
        │
        │ bcrypt.compare()
        ↓
Database Refresh Token Hash
```

---

# 10. Refresh Token Rotation

After a successful refresh:

```text
Old Refresh Token
       ↓
     Valid
       ↓
Create New Refresh Token
       ↓
Hash New Token
       ↓
Replace DB Hash
       ↓
Send New Token Cookie
```

Example:

```text
Before:

Session
└── Refresh Hash A


After Refresh:

Session
└── Refresh Hash B
```

The old refresh token is replaced.

---

# 11. Logout Flow

Endpoint example:

```text
POST /auth/logout
```

## Flow

```text
Refresh Token Cookie
        ↓
jwt.verify()
        ↓
Get userId
        ↓
Find Active Session
        ↓
bcrypt.compare()
        ↓
Valid?
   │
   ├── NO → 401/400
   │
   YES
    ↓
revoked = true
    ↓
Save Session
    ↓
Clear Cookie
    ↓
Logout Successful
```

### Database before logout

```text
Session
{
  user: USER_ID,
  refreshToken: HASH,
  revoked: false
}
```

### Database after logout

```text
Session
{
  user: USER_ID,
  refreshToken: HASH,
  revoked: true
}
```

---

# 12. Why `revoked` Is Important

Suppose:

```text
Access Token
     ↓
Still has 10 minutes left
```

User logs out.

If you only delete the refresh cookie, the Access Token could still technically be valid.

But your `getMe()` checks:

```js
revoked: false
```

Therefore:

```text
Logout
   ↓
Session revoked
   ↓
getMe()
   ↓
Session not active
   ↓
401 Unauthorized
```

So the session state helps invalidate the Access Token before its natural expiry.

---

# 13. Logout All Devices Flow

Endpoint example:

```text
POST /auth/logout-all
```

Suppose the user is logged in from:

```text
Laptop  → Session A
Mobile  → Session B
Tablet  → Session C
```

Database:

```text
Session A → revoked: false
Session B → revoked: false
Session C → revoked: false
```

## Flow

```text
Refresh Token Cookie
        ↓
jwt.verify()
        ↓
Get userId
        ↓
Find Active Session
        ↓
bcrypt.compare()
        ↓
Valid?
   │
   ├── NO → 400/401
   │
   YES
    ↓
Find ALL active sessions
    ↓
updateMany()
    ↓
revoked = true
    ↓
Clear Current Cookie
    ↓
Logout All Devices
```

After:

```text
Session A → revoked: true
Session B → revoked: true
Session C → revoked: true
```

---

# 14. Logout vs Logout All

## Logout

Only current session:

```text
Laptop  → ❌
Mobile  → ✅
Tablet  → ✅
```

## Logout All

All sessions:

```text
Laptop  → ❌
Mobile  → ❌
Tablet  → ❌
```

---

# 15. Cookie Flow

Refresh Token is stored in:

```text
HttpOnly Cookie
```

Example:

```js
res.cookie("refreshToken", refreshToken, {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
```

### `httpOnly`

JavaScript cannot access the cookie through:

```js
document.cookie
```

### `secure`

```text
Production → HTTPS
Development → HTTP localhost
```

### `sameSite: "strict"`

Helps prevent unwanted cross-site cookie sending.

### `maxAge`

```text
7 days
```

---

# 16. Complete System Flow

```text
                         AUTH SYSTEM
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
       REGISTER                                  LOGIN
          │                                       │
          ↓                                       ↓
    Validate Input                          Validate Input
          ↓                                       ↓
    Check User                              Find User
          ↓                                       ↓
    Hash Password                           Compare Password
          ↓                                       ↓
    Create User                             Create Refresh Token
          ↓                                       ↓
    Create Refresh Token                    Hash Refresh Token
          ↓                                       ↓
    Hash Refresh Token                      Create Session
          ↓                                       ↓
    Create Session                          Create Access Token
          ↓                                       ↓
    Create Access Token                     Set Cookie
          ↓                                       ↓
    Set Cookie                                  Response
          │                                       │
          └───────────────────┬───────────────────┘
                              ↓
                       Authenticated User
                              │
               ┌──────────────┴──────────────┐
               │                             │
          Access Token                  Refresh Token
             15 min                        7 days
               │                             │
               ↓                             ↓
            GET ME                      Refresh API
               │                             │
               ↓                             ↓
        Verify Access Token            Verify JWT
               │                             ↓
               ↓                       Find Session
        Check Session                       ↓
               │                       bcrypt.compare
               ↓                             ↓
          Find User                    Rotate Token
               │                             ↓
               ↓                       New Access Token
          Return User                         │
                                             ↓
                                       New Cookie
```

---

# 17. Complete Token Lifecycle

```text
                    LOGIN / REGISTER
                          │
                          ↓
                 Create Refresh Token
                          │
                          ↓
                    Hash Token
                          │
                          ↓
                   Store Hash in DB
                          │
                          ↓
                Store Token in Cookie
                          │
                          ↓
                 Create Access Token
                          │
                          ↓
                    Use API
                          │
                          ↓
                Access Token Expires
                          │
                          ↓
                  Refresh Token
                          │
                          ↓
                Verify + Compare
                          │
                          ↓
                  Rotate Refresh
                          │
                          ↓
                 New Access Token
                          │
                          ↓
                  Continue Using API
```

---

# 18. Database Relationship

Conceptually:

```text
USER
 │
 ├── Session 1
 │     ├── Refresh Token Hash
 │     ├── IP
 │     ├── User Agent
 │     └── Revoked
 │
 ├── Session 2
 │     ├── Refresh Token Hash
 │     ├── IP
 │     ├── User Agent
 │     └── Revoked
 │
 └── Session 3
       ├── Refresh Token Hash
       ├── IP
       ├── User Agent
       └── Revoked
```

One user can have multiple sessions.

---

# 19. Important Security Rules

### Password

Never store:

```text
plain password
```

Always:

```text
bcrypt hash
```

### Refresh Token

Never store:

```text
plain refresh token
```

Store:

```text
bcrypt hash
```

### Access Token

Keep it short-lived:

```text
15 minutes
```

### Refresh Token

Keep it longer-lived:

```text
7 days
```

### Refresh Cookie

Use:

```text
HttpOnly
Secure in production
SameSite
```

### Session

Always check:

```text
revoked: false
```

when validating an active session.

---

# 20. Function Responsibilities

| Function         | Main Responsibility                         |
| ---------------- | ------------------------------------------- |
| `register()`     | Create user + session + tokens              |
| `login()`        | Authenticate user + create session + tokens |
| `refreshToken()` | Create new access/refresh tokens            |
| `getMe()`        | Verify access token + return user           |
| `logout()`       | Revoke current session                      |
| `logoutAll()`    | Revoke all user sessions                    |

---

# 21. One-Line Revision

```text
REGISTER
Create User → Session → Access Token + Refresh Cookie

LOGIN
Verify Password → Session → Access Token + Refresh Cookie

REFRESH
Verify Refresh → Compare Hash → Rotate Refresh → New Access Token

GET ME
Verify Access → Check Session → Get User

LOGOUT
Verify Refresh → Revoke Current Session → Clear Cookie

LOGOUT ALL
Verify Refresh → Revoke All Sessions → Clear Cookie
```

---

# 22. Most Important Concept

Remember this:

```text
Access Token
    ↓
Used to access APIs

Refresh Token
    ↓
Used to generate new Access Tokens

Session
    ↓
Controls whether the login is still valid

revoked
    ↓
Controls whether the session is active

bcrypt
    ↓
Protects Password + Refresh Token Hashes

HttpOnly Cookie
    ↓
Protects Refresh Token from JavaScript access
```
