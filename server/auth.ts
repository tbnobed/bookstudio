import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { verifyInviteToken, invalidateInviteToken } from "./email";
import { User as SelectUser } from "@shared/schema";
import { AuditService } from "./services/auditService";
import { Issuer, generators } from "openid-client";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  // Check if the password is already hashed (contains a salt)
  if (stored.includes(".")) {
    try {
      const [hashed, salt] = stored.split(".");
      const hashedBuf = Buffer.from(hashed, "hex");
      const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
      return timingSafeEqual(hashedBuf, suppliedBuf);
    } catch (error) {
      console.error("Error comparing hashed passwords:", error);
      return false;
    }
  } else {
    // For plaintext passwords (legacy)
    return supplied === stored;
  }
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "studio-booking-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: process.env.COOKIE_SECURE === 'true' ? true : false,
      sameSite: (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') || 'lax',
      httpOnly: true
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Invalid username" });
        }
        
        // Check if password matches using our comparePasswords function
        if (!(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid password" });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Direct registration is disabled - users must register via an invite link
  app.post("/api/register", async (req, res) => {
    return res.status(403).json({ 
      message: "Direct registration is disabled. Please use an invitation link to register." 
    });
  });
  
  // Registration with an invite token
  app.post("/api/register/invite/:token", async (req, res, next) => {
    try {
      const { token } = req.params;
      
      // Verify the invite token
      const inviteInfo = await verifyInviteToken(token);
      
      if (!inviteInfo) {
        return res.status(400).json({ 
          message: "Invalid or expired invitation link. Please request a new invitation." 
        });
      }
      
      const { role, email } = inviteInfo;
      
      // Ensure the email in the form matches the invited email
      if (req.body.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(400).json({ 
          message: "The email address does not match the invitation. Please use the email address that was invited." 
        });
      }
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Set the role from the invitation
      const userData = {
        ...req.body,
        role,
        password: await hashPassword(req.body.password)
      };
      
      const user = await storage.createUser(userData);
      
      // Invalidate the used token
      await invalidateInviteToken(token);

      // Log the user in
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        // Log failed login attempt
        try {
          await AuditService.log(
            {
              userId: null,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent')
            },
            "LOGIN_FAILED",
            "authentication",
            undefined,
            `Failed login attempt for username: ${req.body.username}`,
            { 
              username: req.body.username,
              reason: info?.message || "Invalid credentials",
              ipAddress: req.ip
            }
          );
        } catch (auditError) {
          console.error("Failed to log login attempt:", auditError);
        }
        return res.status(401).json({ message: info?.message || "Login failed" });
      }
      req.login(user, async (err: any) => {
        if (err) {
          return next(err);
        }
        
        // Log successful login
        try {
          await AuditService.log(
            {
              userId: user.id,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent')
            },
            "LOGIN",
            "authentication",
            user.id,
            `User ${user.username} logged in`,
            {
              username: user.username,
              name: user.name,
              role: user.role,
              ipAddress: req.ip
            }
          );
        } catch (auditError) {
          console.error("Failed to log successful login:", auditError);
        }
        
        return res.json(user);
      });
    })(req, res, next);
  });
  
  // For backward compatibility
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        // Log failed login attempt
        try {
          await AuditService.log(
            {
              userId: null,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent')
            },
            "LOGIN_FAILED",
            "authentication",
            undefined,
            `Failed login attempt for username: ${req.body.username}`,
            { 
              username: req.body.username,
              reason: info?.message || "Invalid credentials",
              ipAddress: req.ip
            }
          );
        } catch (auditError) {
          console.error("Failed to log login attempt:", auditError);
        }
        return res.status(401).json({ message: info?.message || "Login failed" });
      }
      req.login(user, async (err: any) => {
        if (err) {
          return next(err);
        }
        
        // Log successful login
        try {
          await AuditService.log(
            {
              userId: user.id,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent')
            },
            "LOGIN",
            "authentication",
            user.id,
            `User ${user.username} logged in`,
            {
              username: user.username,
              name: user.name,
              role: user.role,
              ipAddress: req.ip
            }
          );
        } catch (auditError) {
          console.error("Failed to log successful login:", auditError);
        }
        
        return res.json({ user });
      });
    })(req, res, next);
  });

  app.post("/api/logout", async (req, res, next) => {
    const user = req.user as SelectUser;
    
    // Log logout before actually logging out
    if (user) {
      try {
        await AuditService.log(
          {
            userId: user.id,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          },
          "LOGOUT",
          "authentication",
          user.id,
          `User ${user.username} logged out`,
          {
            username: user.username,
            name: user.name,
            role: user.role,
            ipAddress: req.ip
          }
        );
      } catch (auditError) {
        console.error("Failed to log logout:", auditError);
      }
    }
    
    req.logout((err: any) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });
  
  // For backward compatibility
  app.post("/api/auth/logout", async (req, res, next) => {
    const user = req.user as SelectUser;
    
    // Log logout before actually logging out
    if (user) {
      try {
        await AuditService.log(
          {
            userId: user.id,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          },
          "LOGOUT",
          "authentication",
          user.id,
          `User ${user.username} logged out`,
          {
            username: user.username,
            name: user.name,
            role: user.role,
            ipAddress: req.ip
          }
        );
      } catch (auditError) {
        console.error("Failed to log logout:", auditError);
      }
    }
    
    req.logout((err: any) => {
      if (err) return next(err);
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });
  
  // For backward compatibility
  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json({ user: req.user });
  });

  // ─── SSO / OIDC via Authentik ───────────────────────────────────────────────
  const OIDC_ENABLED =
    process.env.OIDC_ENABLED === "true" &&
    !!process.env.OIDC_CLIENT_ID &&
    !!process.env.OIDC_CLIENT_SECRET &&
    !!process.env.OIDC_ISSUER_URL;

  // Expose SSO availability to the frontend
  app.get("/api/auth/sso-config", (_req, res) => {
    res.json({ enabled: OIDC_ENABLED });
  });

  if (OIDC_ENABLED) {
    // Lazily initialise the OIDC client on first request (avoids blocking startup)
    let oidcClientPromise: Promise<import("openid-client").Client> | null = null;

    const getOidcClient = () => {
      if (!oidcClientPromise) {
        oidcClientPromise = (async () => {
          const issuer = await Issuer.discover(process.env.OIDC_ISSUER_URL!);
          return new issuer.Client({
            client_id: process.env.OIDC_CLIENT_ID!,
            client_secret: process.env.OIDC_CLIENT_SECRET!,
            redirect_uris: [], // set dynamically per request
            response_types: ["code"],
          });
        })();
      }
      return oidcClientPromise;
    };

    // Step 1 — redirect the browser to Authentik
    app.get("/auth/sso", async (req, res) => {
      try {
        const client = await getOidcClient();
        const redirectUri = `${req.protocol}://${req.get("host")}/auth/sso/callback`;
        const state = generators.state();
        const nonce = generators.nonce();
        const codeVerifier = generators.codeVerifier();
        const codeChallenge = generators.codeChallenge(codeVerifier);

        // Persist state in session for callback verification
        (req.session as any).oidcState = state;
        (req.session as any).oidcNonce = nonce;
        (req.session as any).oidcCodeVerifier = codeVerifier;
        (req.session as any).oidcRedirectUri = redirectUri;

        const authUrl = client.authorizationUrl({
          scope: "openid email profile",
          redirect_uri: redirectUri,
          state,
          nonce,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
        });

        res.redirect(authUrl);
      } catch (err) {
        console.error("SSO initiation error:", err);
        res.redirect("/auth?error=sso_init_failed");
      }
    });

    // Step 2 — Authentik redirects back here with ?code=…&state=…
    app.get("/auth/sso/callback", async (req, res, next) => {
      try {
        const client = await getOidcClient();
        const { oidcState, oidcNonce, oidcCodeVerifier, oidcRedirectUri } = req.session as any;

        if (!oidcState || req.query.state !== oidcState) {
          return res.redirect("/auth?error=sso_state_mismatch");
        }

        const params = client.callbackParams(req);
        const tokenSet = await client.callback(oidcRedirectUri, params, {
          state: oidcState,
          nonce: oidcNonce,
          code_verifier: oidcCodeVerifier,
        });

        const claims = tokenSet.claims();
        const ssoId = claims.sub;
        const email = (claims.email as string | undefined) || "";
        const name = (claims.name as string) || (claims.preferred_username as string) || email.split("@")[0] || "SSO User";
        const preferredUsername = ((claims.preferred_username as string) || email.split("@")[0] || `sso_${ssoId.slice(0, 8)}`).replace(/[^a-zA-Z0-9_-]/g, "_");

        // Clean up session SSO state
        delete (req.session as any).oidcState;
        delete (req.session as any).oidcNonce;
        delete (req.session as any).oidcCodeVerifier;
        delete (req.session as any).oidcRedirectUri;

        // 1. Look up by SSO ID (fastest path — returning SSO user)
        let user = await storage.getUserBySsoId("authentik", ssoId);

        // 2. Match existing local account by email → link it
        if (!user && email) {
          const existing = await storage.getUserByEmail(email);
          if (existing) {
            user = await storage.updateUser(existing.id, {
              ssoProvider: "authentik",
              ssoId,
            } as any) as SelectUser;
          }
        }

        // 3. Auto-provision a new account
        if (!user) {
          // Ensure username is unique
          let username = preferredUsername;
          let attempt = 0;
          while (await storage.getUserByUsername(username)) {
            attempt++;
            username = `${preferredUsername}_${attempt}`;
          }

          const randomPassword = randomBytes(32).toString("hex");
          user = await storage.createUser({
            username,
            password: await hashPassword(randomPassword),
            email: email || `${username}@sso.local`,
            name,
            role: "producer",
            ssoProvider: "authentik",
            ssoId,
          } as any);
        }

        req.login(user, async (err) => {
          if (err) return next(err);
          try {
            await AuditService.log(
              { userId: user!.id, ipAddress: req.ip, userAgent: req.get("User-Agent") },
              "LOGIN",
              "authentication",
              user!.id,
              `User ${user!.username} logged in via SSO (Authentik)`,
              { username: user!.username, method: "sso", provider: "authentik" }
            );
          } catch (_) {}
          res.redirect("/");
        });
      } catch (err) {
        console.error("SSO callback error:", err);
        res.redirect("/auth?error=sso_callback_failed");
      }
    });
  }
}