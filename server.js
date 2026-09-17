require("dotenv").config();

const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = process.env.PORT || 5000;

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "nexorajobs-super-secret-change-in-production";


/* =========================================================
   DATABASE
========================================================= */

const db = new Database(
  path.join(__dirname, "nexora.db")
);

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL
    CHECK(role IN ('seeker','employer')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  phone TEXT DEFAULT '',
  location TEXT DEFAULT '',
  headline TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  qualifications TEXT DEFAULT '',
  linkedin TEXT DEFAULT '', 
  portfolio TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(user_id)
  REFERENCES users(id)
);


CREATE TABLE IF NOT EXISTS company_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employer_id INTEGER UNIQUE NOT NULL,
  company_name TEXT DEFAULT '',
  industry TEXT DEFAULT '',
  location TEXT DEFAULT '',
  website TEXT DEFAULT '',
  description TEXT DEFAULT '',
  logo_file_name TEXT DEFAULT '',
  logo_file_data TEXT DEFAULT '',
  logo_file_type TEXT DEFAULT '',
  verification_proof_type TEXT DEFAULT '',
  verification_proof_file_name TEXT DEFAULT '',
  verification_proof_file_data TEXT DEFAULT '',
  verification_proof_file_type TEXT DEFAULT '',
  verification_registration_number TEXT DEFAULT '',
  verification_website TEXT DEFAULT '',
  verification_business_email TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(employer_id)
  REFERENCES users(id)
);


CREATE TABLE IF NOT EXISTS resumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seeker_id INTEGER UNIQUE NOT NULL,

  template TEXT DEFAULT 'professional',

  full_name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  location TEXT DEFAULT '',

  linkedin TEXT DEFAULT '',
  portfolio TEXT DEFAULT '',

  summary TEXT DEFAULT '',
  qualifications TEXT DEFAULT '',
  education TEXT DEFAULT '', 
  experience TEXT DEFAULT '',
  skills TEXT DEFAULT '',
  projects TEXT DEFAULT '',
  certifications TEXT DEFAULT '',

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(seeker_id)
  REFERENCES users(id)
);


CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  employer_id INTEGER NOT NULL,

  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL,
  type TEXT NOT NULL,

  salary TEXT DEFAULT '',
  description TEXT NOT NULL,
  skills TEXT DEFAULT '',

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(employer_id)
  REFERENCES users(id)
);


CREATE TABLE IF NOT EXISTS saved_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  seeker_id INTEGER NOT NULL,
  job_id INTEGER NOT NULL,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(seeker_id, job_id),

  FOREIGN KEY(seeker_id)
  REFERENCES users(id),

  FOREIGN KEY(job_id)
  REFERENCES jobs(id)
);


CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  job_id INTEGER NOT NULL,
  seeker_id INTEGER NOT NULL,

  resume TEXT NOT NULL,
  cover_letter TEXT NOT NULL,

  status TEXT DEFAULT 'Applied',

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(job_id, seeker_id),

  FOREIGN KEY(job_id)
  REFERENCES jobs(id),

  FOREIGN KEY(seeker_id)
  REFERENCES users(id)
);


CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  user_id INTEGER NOT NULL,

  message TEXT NOT NULL,

  type TEXT DEFAULT 'info',

  is_read INTEGER DEFAULT 0,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(user_id)
  REFERENCES users(id)
);


CREATE TABLE IF NOT EXISTS interviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  application_id INTEGER UNIQUE NOT NULL,

  employer_id INTEGER NOT NULL,
  seeker_id INTEGER NOT NULL,

  interview_date TEXT NOT NULL,
  interview_time TEXT NOT NULL,

  interview_type TEXT NOT NULL,

  meeting_details TEXT NOT NULL,

  message TEXT DEFAULT '',

  status TEXT DEFAULT 'Scheduled',

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(application_id)
  REFERENCES applications(id),

  FOREIGN KEY(employer_id)
  REFERENCES users(id),

  FOREIGN KEY(seeker_id)
  REFERENCES users(id)
);
`);

/* =========================================================
   DATABASE MIGRATIONS
========================================================= */

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some(item => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Keep older NexoraJobs databases compatible with the new profile/resume fields.
ensureColumn("profiles", "education", "TEXT DEFAULT ''");
ensureColumn("profiles", "experience", "TEXT DEFAULT ''");
ensureColumn("profiles", "skills", "TEXT DEFAULT ''");
ensureColumn("profiles", "projects", "TEXT DEFAULT ''");
ensureColumn("profiles", "certifications", "TEXT DEFAULT ''");
ensureColumn("profiles", "certificate_file_name", "TEXT DEFAULT ''");
ensureColumn("profiles", "certificate_file_data", "TEXT DEFAULT ''");
ensureColumn("profiles", "certificate_file_type", "TEXT DEFAULT ''");
ensureColumn("profiles", "resume_file_name", "TEXT DEFAULT ''");
ensureColumn("profiles", "resume_file_data", "TEXT DEFAULT ''");
ensureColumn("profiles", "resume_file_type", "TEXT DEFAULT ''");
ensureColumn("resumes", "headline", "TEXT DEFAULT ''");
ensureColumn("resumes", "certificate_file_name", "TEXT DEFAULT ''");
ensureColumn("resumes", "certificate_file_data", "TEXT DEFAULT ''");
ensureColumn("resumes", "certificate_file_type", "TEXT DEFAULT ''");
ensureColumn("profiles", "qualifications", "TEXT DEFAULT ''");
ensureColumn("resumes", "qualifications", "TEXT DEFAULT ''");
ensureColumn("company_profiles", "logo_file_name", "TEXT DEFAULT ''");
ensureColumn("company_profiles", "logo_file_data", "TEXT DEFAULT ''");
ensureColumn("company_profiles", "logo_file_type", "TEXT DEFAULT ''");
ensureColumn("company_profiles", "verification_proof_type", "TEXT DEFAULT ''");
ensureColumn("company_profiles", "verification_proof_file_name", "TEXT DEFAULT ''");
ensureColumn("company_profiles", "verification_proof_file_data", "TEXT DEFAULT ''");
ensureColumn("company_profiles", "verification_proof_file_type", "TEXT DEFAULT ''");
ensureColumn("company_profiles", "verification_registration_number", "TEXT DEFAULT ''");
ensureColumn("company_profiles", "verification_website", "TEXT DEFAULT ''");
ensureColumn("company_profiles", "verification_business_email", "TEXT DEFAULT ''");


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(express.json({ limit: "20mb" }));

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);


/* =========================================================
   AUTH HELPERS
========================================================= */

function auth(
  req,
  res,
  next
) {

  const authHeader =
    req.headers.authorization ||
    "";


  const token =
    authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;


  if (!token) {

    return res.status(401).json({
      error:
        "Login required"
    });

  }


  try {

    req.user =
      jwt.verify(
        token,
        JWT_SECRET
      );

    next();

  } catch (error) {

    return res.status(401).json({
      error:
        "Invalid or expired session"
    });

  }

}


function role(
  requiredRole
) {

  return (
    req,
    res,
    next
  ) => {

    if (
      req.user.role !==
      requiredRole
    ) {

      return res.status(403).json({
        error:
          "Access denied"
      });

    }


    next();

  };

}


function tokenFor(
  user
) {

  return jwt.sign(
    {
      id:
        user.id,

      name:
        user.name,

      email:
        user.email,

      role:
        user.role
    },

    JWT_SECRET,

    {
      expiresIn:
        "7d"
    }
  );

}


/* =========================================================
   GOOGLE OAUTH
========================================================= */

function googleConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ||
      `http://localhost:${PORT}/auth/google/callback`
  };
}

function googleErrorRedirect(res, message) {
  const url = new URL(`http://localhost:${PORT}/`);
  url.hash = `google_error=${encodeURIComponent(message)}`;
  return res.redirect(url.toString());
}

app.get("/auth/google", (req, res) => {
  const { clientId, clientSecret, redirectUri } = googleConfig();
  if (!clientId || !clientSecret) {
    return googleErrorRedirect(
      res,
      "Google Login is not configured on the server. Please check your .env file."
    );
  }

  const requestedRole = String(req.query.role || "").toLowerCase();
  if (!["seeker", "employer"].includes(requestedRole)) {
    return googleErrorRedirect(res, "Please select Candidate or Company before using Google Login.");
  }

  const state = jwt.sign(
    { role: requestedRole, nonce: require("crypto").randomBytes(16).toString("hex") },
    JWT_SECRET,
    { expiresIn: "10m" }
  );

  const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleUrl.searchParams.set("client_id", clientId);
  googleUrl.searchParams.set("redirect_uri", redirectUri);
  googleUrl.searchParams.set("response_type", "code");
  googleUrl.searchParams.set("scope", "openid email profile");
  googleUrl.searchParams.set("state", state);
  googleUrl.searchParams.set("access_type", "online");
  googleUrl.searchParams.set("prompt", "select_account");

  return res.redirect(googleUrl.toString());
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const { clientId, clientSecret, redirectUri } = googleConfig();
    if (!clientId || !clientSecret) {
      return googleErrorRedirect(res, "Google Login is not configured on the server.");
    }

    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    if (!code || !state) {
      return googleErrorRedirect(res, "Google Login was cancelled or returned an invalid response.");
    }

    const stateData = jwt.verify(state, JWT_SECRET);
    const requestedRole = stateData.role;
    if (!["seeker", "employer"].includes(requestedRole)) {
      return googleErrorRedirect(res, "Invalid account type.");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Google token exchange failed:", tokenData);
      return googleErrorRedirect(res, "Google Login could not be completed.");
    }

    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const googleUser = await userInfoResponse.json();

    if (!userInfoResponse.ok || !googleUser.email) {
      return googleErrorRedirect(res, "Google did not provide a valid email address.");
    }

    const email = String(googleUser.email).trim().toLowerCase();
    const name = String(googleUser.name || email.split("@")[0] || "NexoraJobs User").trim();

    let existingUser = db.prepare(`SELECT id, name, email, password, role FROM users WHERE email = ?`).get(email);

    if (existingUser && existingUser.role !== requestedRole) {
      const accountType = existingUser.role === "seeker" ? "Candidate" : "Company";
      return googleErrorRedirect(
        res,
        `This Google email is already registered as a ${accountType}. Please use the correct account type.`
      );
    }

    if (!existingUser) {
      const randomPassword = require("crypto").randomBytes(32).toString("hex");
      const passwordHash = bcrypt.hashSync(randomPassword, 10);
      const result = db.prepare(`
        INSERT INTO users (name, email, password, role)
        VALUES (?, ?, ?, ?)
      `).run(name, email, passwordHash, requestedRole);

      existingUser = db.prepare(`
        SELECT id, name, email, role
        FROM users
        WHERE id = ?
      `).get(result.lastInsertRowid);

      addNotification(existingUser.id, "Welcome to NexoraJobs!", "welcome");
    }

    const safeUser = {
      id: existingUser.id,
      name: existingUser.name,
      email: existingUser.email,
      role: existingUser.role
    };

    const appUrl = new URL(`http://localhost:${PORT}/`);
    appUrl.hash =
      `google_token=${encodeURIComponent(tokenFor(safeUser))}` +
      `&google_role=${encodeURIComponent(safeUser.role)}`;

    return res.redirect(appUrl.toString());
  } catch (error) {
    console.error("Google OAuth error:", error);
    return googleErrorRedirect(
      res,
      error.name === "TokenExpiredError" || error.name === "JsonWebTokenError"
        ? "Google Login session expired. Please try again."
        : "Google Login failed. Please try again."
    );
  }
});


/* =========================================================
   NOTIFICATION HELPER
========================================================= */

function addNotification(
  userId,
  message,
  type = "info"
) {

  db.prepare(`
    INSERT INTO notifications
    (
      user_id,
      message,
      type
    )
    VALUES (?, ?, ?)
  `).run(
    userId,
    message,
    type
  );

}


/* =========================================================
   AUTH
========================================================= */


// Register

app.post(
  "/api/auth/register",
  (
    req,
    res
  ) => {

    try {

      const {
        name,
        email,
        password,
        role
      } = req.body || {};


      const cleanName =
        String(name || "")
          .trim();


      const cleanEmail =
        String(email || "")
          .trim()
          .toLowerCase();


      const cleanPassword =
        String(password || "");


      if (
        !cleanName ||
        !cleanEmail ||
        !cleanPassword ||
        ![
          "seeker",
          "employer"
        ].includes(role)
      ) {

        return res.status(400).json({
          error:
            "Please fill all fields correctly"
        });

      }


      if (
        cleanPassword.length < 6
      ) {

        return res.status(400).json({
          error:
            "Password must be at least 6 characters"
        });

      }


      const hash =
        bcrypt.hashSync(
          cleanPassword,
          10
        );


      const result =
        db.prepare(`
          INSERT INTO users
          (
            name,
            email,
            password,
            role
          )
          VALUES (?, ?, ?, ?)
        `).run(
          cleanName,
          cleanEmail,
          hash,
          role
        );


      const user =
        db.prepare(`
          SELECT
            id,
            name,
            email,
            role
          FROM users
          WHERE id = ?
        `).get(
          result.lastInsertRowid
        );


      addNotification(
        user.id,
        "Welcome to NexoraJobs!",
        "welcome"
      );


      return res.json({
        token:
          tokenFor(user),

        user
      });


    } catch (
      error
    ) {

      if (
        String(
          error.message
        ).includes(
          "UNIQUE"
        )
      ) {

        return res.status(409).json({
          error:
            "Email is already registered. Please login instead."
        });

      }


      console.error(
        error
      );


      return res.status(500).json({
        error:
          "Could not create account"
      });

    }

  }
);


// Login

app.post(
  "/api/auth/login",
  (
    req,
    res
  ) => {

    const {
      email,
      password,
      role
    } =
      req.body || {};


    if (!['seeker', 'employer'].includes(role)) {
      return res.status(400).json({
        error: "Please select Candidate or Company before logging in"
      });
    }


    const cleanEmail =
      String(
        email || ""
      )
        .trim()
        .toLowerCase();


    if (
      !cleanEmail ||
      !password
    ) {

      return res.status(400).json({
        error:
          "Please enter email and password"
      });

    }


    const user =
      db.prepare(`
        SELECT *
        FROM users
        WHERE email = ?
      `).get(
        cleanEmail
      );


    if (
      !user ||
      !bcrypt.compareSync(
        String(password),
        user.password
      )
    ) {

      return res.status(401).json({
        error:
          "Invalid email or password"
      });

    }


    if (user.role !== role) {

      return res.status(403).json({
        error:
          role === "employer"
            ? "This account is a Candidate account. Only Company accounts can log in to the Company section."
            : "This account is a Company account. Only Candidate accounts can log in to the Candidate section."
      });

    }


    const safeUser = {

      id:
        user.id,

      name:
        user.name,

      email:
        user.email,

      role:
        user.role

    };


    return res.json({

      token:
        tokenFor(
          safeUser
        ),

      user:
        safeUser

    });

  }
);


app.get(
  "/api/me",
  auth,
  (
    req,
    res
  ) => {

    res.json(
      req.user
    );

  }
);


/* =========================================================
   CANDIDATE PROFILE
========================================================= */


app.get(
  "/api/profile",
  auth,
  role("seeker"),
  (
    req,
    res
  ) => {
    const profile = db.prepare(`
      SELECT *
      FROM profiles
      WHERE user_id = ?
    `).get(req.user.id);

    res.json({
      user: req.user,
      profile: profile || {}
    });
  }
);


app.put(
  "/api/profile",
  auth,
  role("seeker"),
  (
    req,
    res
  ) => {
    const {
      phone = "",
      location = "",
      headline = "",
      bio = "",
      qualifications = "",
      education = "",
      experience = "",
      skills = "",
      projects = "",
      certifications = "",
      certificate_file_name = "",
      certificate_file_data = "",
      certificate_file_type = "",
      resume_file_name = "",
      resume_file_data = "",
      resume_file_type = ""
    } = req.body || {};

    db.prepare(`
      INSERT INTO profiles
      (
        user_id, phone, location, headline, bio, qualifications,
        education, experience, skills, projects, certifications,
        certificate_file_name, certificate_file_data, certificate_file_type,
        resume_file_name, resume_file_data, resume_file_type,
        linkedin, portfolio, updated_at
      )
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        phone = excluded.phone,
        location = excluded.location,
        headline = excluded.headline,
        bio = excluded.bio,
        qualifications = excluded.qualifications,
        education = excluded.education,
        experience = excluded.experience,
        skills = excluded.skills,
        projects = excluded.projects,
        certifications = excluded.certifications,
        certificate_file_name = excluded.certificate_file_name,
        certificate_file_data = excluded.certificate_file_data,
        certificate_file_type = excluded.certificate_file_type,
        resume_file_name = excluded.resume_file_name,
        resume_file_data = excluded.resume_file_data,
        resume_file_type = excluded.resume_file_type,
        linkedin = '',
        portfolio = '',
        updated_at = CURRENT_TIMESTAMP
    `).run(
      req.user.id,
      String(phone), String(location), String(headline), String(bio), String(qualifications),
      String(education), String(experience), String(skills), String(projects), String(certifications),
      String(certificate_file_name), String(certificate_file_data), String(certificate_file_type),
      String(resume_file_name), String(resume_file_data), String(resume_file_type)
    );

    db.prepare(`
      INSERT INTO resumes
      (
        seeker_id, template, full_name, email, phone, location, headline,
        linkedin, portfolio, summary, qualifications, education, experience,
        skills, projects, certifications, certificate_file_name,
        certificate_file_data, certificate_file_type, updated_at
      )
      VALUES
      (?, 'professional', ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(seeker_id) DO UPDATE SET
        full_name = excluded.full_name,
        email = excluded.email,
        phone = excluded.phone,
        location = excluded.location,
        headline = excluded.headline,
        linkedin = '',
        portfolio = '',
        summary = excluded.summary,
        qualifications = excluded.qualifications,
        education = excluded.education,
        experience = excluded.experience,
        skills = excluded.skills,
        projects = excluded.projects,
        certifications = excluded.certifications,
        certificate_file_name = excluded.certificate_file_name,
        certificate_file_data = excluded.certificate_file_data,
        certificate_file_type = excluded.certificate_file_type,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      req.user.id,
      String(req.user.name), String(req.user.email), String(phone), String(location), String(headline),
      String(bio), String(qualifications), String(education), String(experience), String(skills),
      String(projects), String(certifications), String(certificate_file_name), String(certificate_file_data),
      String(certificate_file_type)
    );

    res.json({ message: "Profile updated successfully" });
  }
);

/* =========================================================
   COMPANY ACCOUNT PRIVACY
========================================================= */

// Candidate accounts are deliberately blocked from opening employer accounts/profiles.
app.get(
  "/api/companies/:id",
  auth,
  (req, res) => {
    if (req.user.role !== "employer") {
      return res.status(403).json({
        error: "Candidate accounts are not allowed to open company accounts."
      });
    }

    const company = db.prepare(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        cp.company_name,
        cp.industry,
        cp.location,
        cp.website,
        cp.description
      FROM users u
      LEFT JOIN company_profiles cp
        ON cp.employer_id = u.id
      WHERE u.id = ?
        AND u.role = 'employer'
    `).get(req.params.id);

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json(company);
  }
);


/* =========================================================
   COMPANY PROFILE
========================================================= */


app.get(
  "/api/company-profile",
  auth,
  role("employer"),
  (
    req,
    res
  ) => {

    const profile =
      db.prepare(`
        SELECT *
        FROM company_profiles
        WHERE employer_id = ?
      `).get(
        req.user.id
      );


    res.json(
      profile || {}
    );

  }
);


app.put(
  "/api/company-profile",
  auth,
  role("employer"),
  (
    req,
    res
  ) => {

    const {

      company_name = "",
      industry = "",
      location = "",
      website = "",
      description = "",
      logo_file_name,
      logo_file_data,
      logo_file_type

    } =
      req.body || {};


    db.prepare(`
      INSERT INTO company_profiles
      (
        employer_id,
        company_name,
        industry,
        location,
        website,
        description,
        logo_file_name,
        logo_file_data,
        logo_file_type,
        updated_at
      )
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)

      ON CONFLICT(employer_id)
      DO UPDATE SET

        company_name =
          excluded.company_name,

        industry =
          excluded.industry,

        location =
          excluded.location,

        website =
          excluded.website,

        description =
          excluded.description,

        logo_file_name =
          COALESCE(excluded.logo_file_name, logo_file_name),

        logo_file_data =
          COALESCE(excluded.logo_file_data, logo_file_data),

        logo_file_type =
          COALESCE(excluded.logo_file_type, logo_file_type),

        updated_at =
          CURRENT_TIMESTAMP
    `).run(

      req.user.id,

      String(company_name),

      String(industry),

      String(location),

      String(website),

      String(description),
      logo_file_name ? String(logo_file_name) : null,
      logo_file_data ? String(logo_file_data) : null,
      logo_file_type ? String(logo_file_type) : null

    );


    res.json({
      message:
        "Company profile updated successfully"
    });

  }
);


/* =========================================================
   COMPANY VERIFICATION
========================================================= */

app.get(
  "/api/company-verification",
  auth,
  role("employer"),
  (req, res) => {
    const profile = db.prepare(`
      SELECT
        verification_registration_number AS registration_number,
        verification_website AS website,
        verification_business_email AS business_email,
        verification_proof_type AS proof_type,
        verification_proof_file_name AS proof_file_name,
        verification_proof_file_data AS proof_file_data,
        verification_proof_file_type AS proof_file_type
      FROM company_profiles
      WHERE employer_id = ?
    `).get(req.user.id);
    res.json(profile || {});
  }
);

app.put(
  "/api/company-verification",
  auth,
  role("employer"),
  (req, res) => {
    const {
      registration_number = "",
      website = "",
      business_email = "",
      proof_type = "",
      proof_file_name,
      proof_file_data,
      proof_file_type
    } = req.body || {};

    const allowedTypes = ["GSTIN", "Aadhaar Card", "PAN Card"];
    if (!allowedTypes.includes(String(proof_type))) {
      return res.status(400).json({ error: "Please select GSTIN, Aadhaar Card or PAN Card." });
    }
    if (!proof_file_data && !proof_file_name) {
      const existing = db.prepare(`SELECT verification_proof_file_data FROM company_profiles WHERE employer_id = ?`).get(req.user.id);
      if (!existing?.verification_proof_file_data) {
        return res.status(400).json({ error: "Please upload the official company proof document." });
      }
    }
    if (proof_file_data && String(proof_file_data).length > 14 * 1024 * 1024) {
      return res.status(400).json({ error: "Company proof file is too large." });
    }

    db.prepare(`
      INSERT INTO company_profiles (
        employer_id,
        verification_registration_number,
        verification_website,
        verification_business_email,
        verification_proof_type,
        verification_proof_file_name,
        verification_proof_file_data,
        verification_proof_file_type,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(employer_id) DO UPDATE SET
        verification_registration_number = excluded.verification_registration_number,
        verification_website = excluded.verification_website,
        verification_business_email = excluded.verification_business_email,
        verification_proof_type = excluded.verification_proof_type,
        verification_proof_file_name = COALESCE(excluded.verification_proof_file_name, verification_proof_file_name),
        verification_proof_file_data = COALESCE(excluded.verification_proof_file_data, verification_proof_file_data),
        verification_proof_file_type = COALESCE(excluded.verification_proof_file_type, verification_proof_file_type),
        updated_at = CURRENT_TIMESTAMP
    `).run(
      req.user.id,
      String(registration_number),
      String(website),
      String(business_email),
      String(proof_type),
      proof_file_name ? String(proof_file_name) : null,
      proof_file_data ? String(proof_file_data) : null,
      proof_file_type ? String(proof_file_type) : null
    );

    res.json({ message: "Company verification submitted successfully" });
  }
);


/* =========================================================
   RESUME BUILDER
========================================================= */


app.get(
  "/api/resume",
  auth,
  role("seeker"),
  (
    req,
    res
  ) => {
    const resume = db.prepare(`
      SELECT *
      FROM resumes
      WHERE seeker_id = ?
    `).get(req.user.id);

    // Return the profile-backed resume. This keeps both screens identical.
    const profile = db.prepare(`
      SELECT *
      FROM profiles
      WHERE user_id = ?
    `).get(req.user.id) || {};

    res.json({
      ...(resume || {}),
      full_name: req.user.name,
      email: req.user.email,
      phone: profile.phone || resume?.phone || "",
      location: profile.location || resume?.location || "",
      headline: profile.headline || resume?.headline || "",
      qualifications: profile.qualifications || resume?.qualifications || "",
      summary: profile.bio || resume?.summary || "",
      education: profile.education || resume?.education || "",
      experience: profile.experience || resume?.experience || "",
      skills: profile.skills || resume?.skills || "",
      projects: profile.projects || resume?.projects || "",
      certifications: profile.certifications || resume?.certifications || "",
      certificate_file_name: profile.certificate_file_name || resume?.certificate_file_name || "",
      certificate_file_data: profile.certificate_file_data || resume?.certificate_file_data || "",
      certificate_file_type: profile.certificate_file_type || resume?.certificate_file_type || ""
    });
  }
);


app.put(
  "/api/resume",
  auth,
  role("seeker"),
  (
    req,
    res
  ) => {
    const {
      template = "professional",
      full_name,
      email,
      phone,
      location,
      headline = "",
      qualifications = "",
      summary,
      education,
      experience,
      skills,
      projects = "",
      certifications = "",
      certificate_file_name = "",
      certificate_file_data = "",
      certificate_file_type = ""
    } = req.body || {};

    const requiredFields = [full_name, email, phone, location, headline, qualifications, summary, education, experience, skills];
    if (requiredFields.some(field => !String(field || "").trim())) {
      return res.status(400).json({ error: "Please complete all required resume details" });
    }

    const cleanTemplate = ["professional", "modern", "minimal"].includes(String(template))
      ? String(template) : "professional";

    db.prepare(`
      INSERT INTO resumes
      (
        seeker_id, template, full_name, email, phone, location, headline,
        linkedin, portfolio, summary, qualifications, education, experience,
        skills, projects, certifications, certificate_file_name,
        certificate_file_data, certificate_file_type, updated_at
      )
      VALUES
      (?, ?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(seeker_id) DO UPDATE SET
        template = excluded.template,
        full_name = excluded.full_name,
        email = excluded.email,
        phone = excluded.phone,
        location = excluded.location,
        headline = excluded.headline,
        linkedin = '',
        portfolio = '',
        summary = excluded.summary,
        qualifications = excluded.qualifications,
        education = excluded.education,
        experience = excluded.experience,
        skills = excluded.skills,
        projects = excluded.projects,
        certifications = excluded.certifications,
        certificate_file_name = excluded.certificate_file_name,
        certificate_file_data = excluded.certificate_file_data,
        certificate_file_type = excluded.certificate_file_type,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      req.user.id, cleanTemplate, String(full_name), String(email), String(phone), String(location), String(headline),
      String(summary), String(qualifications), String(education), String(experience), String(skills), String(projects),
      String(certifications), String(certificate_file_name), String(certificate_file_data), String(certificate_file_type)
    );

    db.prepare(`
      INSERT INTO profiles
      (
        user_id, phone, location, headline, bio, qualifications, education,
        experience, skills, projects, certifications, certificate_file_name,
        certificate_file_data, certificate_file_type, linkedin, portfolio, updated_at
      )
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        phone = excluded.phone,
        location = excluded.location,
        headline = excluded.headline,
        bio = excluded.bio,
        qualifications = excluded.qualifications,
        education = excluded.education,
        experience = excluded.experience,
        skills = excluded.skills,
        projects = excluded.projects,
        certifications = excluded.certifications,
        certificate_file_name = excluded.certificate_file_name,
        certificate_file_data = excluded.certificate_file_data,
        certificate_file_type = excluded.certificate_file_type,
        linkedin = '',
        portfolio = '',
        updated_at = CURRENT_TIMESTAMP
    `).run(
      req.user.id, String(phone), String(location), String(headline), String(summary), String(qualifications),
      String(education), String(experience), String(skills), String(projects), String(certifications),
      String(certificate_file_name), String(certificate_file_data), String(certificate_file_type)
    );

    res.json({ message: "Resume saved successfully" });
  }
);

/* =========================================================
   JOBS
========================================================= */


// Get all jobs

app.get(
  "/api/jobs",
  (
    req,
    res
  ) => {

    const {

      q = "",
      location = "",
      type = ""

    } =
      req.query;


    const rows =
      db.prepare(`
        SELECT

          j.*,

          u.name AS employer_name,

          (
            SELECT COUNT(*)
            FROM applications a
            WHERE a.job_id = j.id
          ) AS application_count

        FROM jobs j

        JOIN users u
        ON u.id = j.employer_id

        WHERE

          (
            j.title LIKE ?
            OR j.company LIKE ?
            OR j.skills LIKE ?
            OR j.description LIKE ?
          )

          AND j.location LIKE ?

          AND j.type LIKE ?

        ORDER BY
          j.id DESC
      `).all(

       `%${q}%`,

        `%${q}%`,

        `%${q}%`,

        `%${q}%`,

        `%${location}%`,

        `%${type}%`

      );


    res.json(
      rows
    );

  }
);


// Job details

app.get(
  "/api/jobs/:id",
  (
    req,
    res
  ) => {

    const job =
      db.prepare(`
        SELECT

          j.*,

          u.name AS employer_name

        FROM jobs j

        JOIN users u
        ON u.id = j.employer_id

        WHERE j.id = ?
      `).get(
        req.params.id
      );


    if (!job) {

      return res.status(404).json({
        error:
          "Job not found"
      });

    }


    res.json(
      job
    );

  }
);


// Post job

app.post(
  "/api/jobs",
  auth,
  role("employer"),
  (
    req,
    res
  ) => {

    const {

      title,
      company,
      location,
      type,
      salary = "",
      description,
      skills = ""

    } =
      req.body || {};


    if (
      !String(title || "").trim() ||
      !String(company || "").trim() ||
      !String(location || "").trim() ||
      !String(type || "").trim() ||
      !String(description || "").trim()
    ) {

      return res.status(400).json({
        error:
          "Title, company, location, type and description are required"
      });

    }


    const result =
      db.prepare(`
        INSERT INTO jobs
        (
          employer_id,
          title,
          company,
          location,
          type,
          salary,
          description,
          skills
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(

        req.user.id,

        String(title).trim(),

        String(company).trim(),

        String(location).trim(),

        String(type).trim(),

        String(salary).trim(),

        String(description).trim(),

        String(skills).trim()

      );


    const seekers =
      db.prepare(`
        SELECT id
        FROM users
        WHERE role = 'seeker'
      `).all();


    for (
      const seeker
      of seekers
    ) {

      addNotification(

        seeker.id,

        `A new job has been posted: ${String(title).trim()}`,

        "job"

      );

    }


    res.json({

      message:
        "Job posted successfully",

      id:
        result.lastInsertRowid

    });

  }
);


// Delete job

app.delete(
  "/api/jobs/:id",
  auth,
  role("employer"),
  (
    req,
    res
  ) => {

    const job =
      db.prepare(`
        SELECT *
        FROM jobs
        WHERE
          id = ?
          AND employer_id = ?
      `).get(

        req.params.id,

        req.user.id

      );


    if (!job) {

      return res.status(404).json({
        error:
          "Job not found or not owned by you"
      });

    }


    db.prepare(`
      DELETE FROM interviews
      WHERE application_id IN
      (
        SELECT id
        FROM applications
        WHERE job_id = ?
      )
    `).run(
      req.params.id
    );


    db.prepare(`
      DELETE FROM applications
      WHERE job_id = ?
    `).run(
      req.params.id
    );


    db.prepare(`
      DELETE FROM saved_jobs
      WHERE job_id = ?
    `).run(
      req.params.id
    );


    db.prepare(`
      DELETE FROM jobs
      WHERE id = ?
    `).run(
      req.params.id
    );


    res.json({
      message:
        "Job deleted successfully"
    });

  }
);


/* =========================================================
   SAVED JOBS
========================================================= */


app.get(
  "/api/saved-jobs",
  auth,
  role("seeker"),
  (
    req,
    res
  ) => {

    const jobs =
      db.prepare(`
        SELECT

          j.*,

          s.created_at AS saved_at

        FROM saved_jobs s

        JOIN jobs j
        ON j.id = s.job_id

        WHERE s.seeker_id = ?

        ORDER BY s.id DESC
      `).all(
        req.user.id
      );


    res.json(
      jobs
    );

  }
);


app.post(
  "/api/jobs/:id/save",
  auth,
  role("seeker"),
  (
    req,
    res
  ) => {

    const job =
      db.prepare(`
        SELECT id
        FROM jobs
        WHERE id = ?
      `).get(
        req.params.id
      );


    if (!job) {

      return res.status(404).json({
        error:
          "Job not found"
      });

    }


    try {

      db.prepare(`
        INSERT INTO saved_jobs
        (
          seeker_id,
          job_id
        )
        VALUES (?, ?)
      `).run(

        req.user.id,

        req.params.id

      );


      res.json({
        message:
          "Job saved successfully"
      });


    } catch (
      error
    ) {

      res.status(409).json({
        error:
          "This job is already saved"
      });

    }

  }
);


app.delete(
  "/api/jobs/:id/save",
  auth,
  role("seeker"),
  (
    req,
    res
  ) => {

    db.prepare(`
      DELETE FROM saved_jobs
      WHERE
        seeker_id = ?
        AND job_id = ?
    `).run(

      req.user.id,

      req.params.id

    );


    res.json({
      message:
        "Job removed from saved jobs"
    });

  }
);


/* =========================================================
   APPLICATIONS
========================================================= */


// Apply for a job

app.post(
  "/api/jobs/:id/apply",
  auth,
  role("seeker"),
  (
    req,
    res
  ) => {

    const {

      resume,
      cover_letter

    } =
      req.body || {};


    const cleanResume =
      String(
        resume || ""
      ).trim();


    const cleanCoverLetter =
      String(
        cover_letter || ""
      ).trim();


    if (
      !cleanResume ||
      !cleanCoverLetter
    ) {

      return res.status(400).json({
        error:
          "Resume and cover letter are required to apply"
      });

    }


    const job =
      db.prepare(`
        SELECT *
        FROM jobs
        WHERE id = ?
      `).get(
        req.params.id
      );


    if (!job) {

      return res.status(404).json({
        error:
          "Job not found"
      });

    }


    try {

      db.prepare(`
        INSERT INTO applications
        (
          job_id,
          seeker_id,
          resume,
          cover_letter
        )
        VALUES (?, ?, ?, ?)
      `).run(

        req.params.id,

        req.user.id,

        cleanResume,

        cleanCoverLetter

      );


      addNotification(

        job.employer_id,

        `${req.user.name} applied for ${job.title}`,

        "application"

      );


      addNotification(

        req.user.id,

        `Congratulations! Your application for ${job.title} has been submitted successfully.`,

        "success"

      );


      res.json({
        message:
          "Application submitted successfully"
      });


    } catch (
      error
    ) {

      res.status(409).json({
        error:
          "You have already applied for this job"
      });

    }

  }
);


// Candidate applications

app.get(
  "/api/my-applications",
  auth,
  role("seeker"),
  (
    req,
    res
  ) => {

    const rows =
      db.prepare(`
        SELECT

          a.*,

          j.title,
          j.company,
          j.location,
          j.type,
          j.salary

        FROM applications a

        JOIN jobs j
        ON j.id = a.job_id

        WHERE a.seeker_id = ?

        ORDER BY a.id DESC
      `).all(
        req.user.id
      );


    res.json(
      rows
    );

  }
);


/* =========================================================
   EMPLOYER JOBS
========================================================= */


app.get(
  "/api/employer/jobs",
  auth,
  role("employer"),
  (
    req,
    res
  ) => {

    const jobs =
      db.prepare(`
        SELECT

          j.*,

          (
            SELECT COUNT(*)
            FROM applications a
            WHERE a.job_id = j.id
          ) AS application_count

        FROM jobs j

        WHERE j.employer_id = ?

        ORDER BY j.id DESC
      `).all(
        req.user.id
      );


    res.json(
      jobs
    );

  }
);


/* =========================================================
   EMPLOYER APPLICANTS
========================================================= */


app.get(
  "/api/employer/applications",
  auth,
  role("employer"),
  (
    req,
    res
  ) => {

    const rows =
      db.prepare(`
        SELECT

          a.id,
          a.resume,
          a.cover_letter,
          a.status,
          a.created_at,

          u.id AS seeker_id,
          u.name AS seeker_name,
          u.email AS seeker_email,

          p.phone AS seeker_phone,
          p.location AS seeker_location,
          p.headline AS seeker_headline,

          j.title,
          j.company

        FROM applications a

        JOIN jobs j
        ON j.id = a.job_id

        JOIN users u
        ON u.id = a.seeker_id

        LEFT JOIN profiles p
        ON p.user_id = u.id

        WHERE j.employer_id = ?

        ORDER BY a.id DESC
      `).all(
        req.user.id
      );


    res.json(
      rows
    );

  }
);


/* =========================================================
   APPLICATION STATUS
========================================================= */


app.patch(
  "/api/applications/:id",
  auth,
  role("employer"),
  (
    req,
    res
  ) => {

    const {
      status
    } =
      req.body || {};


    const allowed = [

      "Applied",

      "Under Review",

      "Shortlisted",

      "Accepted",

      "Interview",

      "Rejected",

      "Hired"

    ];


    if (
      !allowed.includes(
        status
      )
    ) {

      return res.status(400).json({
        error:
          "Invalid application status"
      });

    }


    const application =
      db.prepare(`
        SELECT

          a.id,

          a.seeker_id,

          j.title

        FROM applications a

        JOIN jobs j
        ON j.id = a.job_id

        WHERE
          a.id = ?
          AND j.employer_id = ?
      `).get(

        req.params.id,

        req.user.id

      );


    if (!application) {

      return res.status(404).json({
        error:
          "Application not found"
      });

    }


    db.prepare(`
      UPDATE applications
      SET status = ?
      WHERE id = ?
    `).run(

      status,

      req.params.id

    );


    let notificationMessage =
      `Your application for ${application.title} is now: ${status}`;


    if (
      status === "Shortlisted"
    ) {

      notificationMessage =
        `Congratulations! You have been shortlisted for ${application.title}.`;

    }


    if (
      status === "Accepted"
    ) {

      notificationMessage =
        `Congratulations! Your application for ${application.title} has been accepted.`;

    }


    if (
      status === "Hired"
    ) {

      notificationMessage =
        `Congratulations! You have been hired for ${application.title}!`;

    }


    addNotification(

      application.seeker_id,

      notificationMessage,

      "status"

    );


    res.json({
      message:
        "Application status updated"
    });

  }
);


/* =========================================================
   INTERVIEWS
========================================================= */


// Schedule interview

app.post(
  "/api/interviews",
  auth,
  role("employer"),
  (
    req,
    res
  ) => {

    try {

      const {

        application_id,

        interview_date,

        interview_time,

        interview_type,

        meeting_details,

        message = ""

      } =
        req.body || {};


      if (

        !application_id ||

        !interview_date ||

        !interview_time ||

        !interview_type ||

        !meeting_details

      ) {

        return res.status(400).json({
          error:
            "Please fill all interview details"
        });

      }


      const application =
        db.prepare(`
          SELECT

            a.id,

            a.seeker_id,

            j.employer_id,

            j.title

          FROM applications a

          JOIN jobs j
          ON j.id = a.job_id

          WHERE
            a.id = ?
            AND j.employer_id = ?
        `).get(

          application_id,

          req.user.id

        );


      if (!application) {

        return res.status(404).json({
          error:
            "Application not found"
        });

      }


      const existing =
        db.prepare(`
          SELECT id
          FROM interviews
          WHERE application_id = ?
        `).get(
          application_id
        );


      if (existing) {

        return res.status(409).json({
          error:
            "An interview has already been scheduled for this applicant"
        });

      }


      const result =
        db.prepare(`
          INSERT INTO interviews
          (
            application_id,
            employer_id,
            seeker_id,
            interview_date,
            interview_time,
            interview_type,
            meeting_details,
            message
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(

          application_id,

          req.user.id,

          application.seeker_id,

          String(
            interview_date
          ),

          String(
            interview_time
          ),

          String(
            interview_type
          ),

          String(
            meeting_details
          ),

          String(
            message || ""
          )

        );


      db.prepare(`
        UPDATE applications
        SET status = 'Interview'
        WHERE id = ?
      `).run(
        application_id
      );


      addNotification(

        application.seeker_id,

        `Congratulations! You have been invited for an interview for ${application.title}.`,

        "interview"

      );


      res.json({

        message:
          "Interview scheduled successfully!",

        id:
          result.lastInsertRowid

      });


    } catch (
      error
    ) {

      console.error(
        error
      );


      res.status(500).json({
        error:
          "Could not schedule interview"
      });

    }

  }
);


// Candidate interviews

app.get(
  "/api/my-interviews",
  auth,
  role("seeker"),
  (
    req,
    res
  ) => {

    const interviews =
      db.prepare(`
        SELECT

          i.*,

          j.title,

          j.company,

          u.name AS employer_name

        FROM interviews i

        JOIN applications a
        ON a.id = i.application_id

        JOIN jobs j
        ON j.id = a.job_id

        JOIN users u
        ON u.id = i.employer_id

        WHERE i.seeker_id = ?

        ORDER BY

          i.interview_date ASC,

          i.interview_time ASC
      `).all(
        req.user.id
      );


    res.json(
      interviews
    );

  }
);


// Employer interviews

app.get(
  "/api/employer/interviews",
  auth,
  role("employer"),
  (
    req,
    res
  ) => {

    const interviews =
      db.prepare(`
        SELECT

          i.*,

          u.name AS seeker_name,

          u.email AS seeker_email,

          j.title,

          j.company

        FROM interviews i

        JOIN applications a
        ON a.id = i.application_id

        JOIN users u
        ON u.id = i.seeker_id

        JOIN jobs j
        ON j.id = a.job_id

        WHERE i.employer_id = ?

        ORDER BY

          i.interview_date ASC,

          i.interview_time ASC
      `).all(
        req.user.id
      );


    res.json(
      interviews
    );

  }
);


/* =========================================================
   NOTIFICATIONS
========================================================= */


app.get(
  "/api/notifications",
  auth,
  (
    req,
    res
  ) => {

    const rows =
      db.prepare(`
        SELECT *
        FROM notifications
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 50
      `).all(
        req.user.id
      );


    res.json(
      rows
    );

  }
);


app.post(
  "/api/notifications/read",
  auth,
  (
    req,
    res
  ) => {

    db.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = ?
    `).run(
      req.user.id
    );


    res.json({
      message:
        "Notifications marked as read"
    });

  }
);


/* =========================================================
   DASHBOARD STATISTICS
========================================================= */


app.get(
  "/api/stats",
  auth,
  (
    req,
    res
  ) => {

    if (
      req.user.role ===
      "employer"
    ) {

      const jobs =
        db.prepare(`
          SELECT COUNT(*) AS count
          FROM jobs
          WHERE employer_id = ?
        `).get(
          req.user.id
        ).count;


      const applications =
        db.prepare(`
          SELECT COUNT(*) AS count

          FROM applications a

          JOIN jobs j
          ON j.id = a.job_id

          WHERE j.employer_id = ?
        `).get(
          req.user.id
        ).count;


      const shortlisted =
        db.prepare(`
          SELECT COUNT(*) AS count

          FROM applications a

          JOIN jobs j
          ON j.id = a.job_id

          WHERE
            j.employer_id = ?

            AND
            a.status = 'Shortlisted'
        `).get(
          req.user.id
        ).count;


      const interviews =
        db.prepare(`
          SELECT COUNT(*) AS count
          FROM interviews
          WHERE employer_id = ?
        `).get(
          req.user.id
        ).count;


      return res.json({

        jobs,

        applications,

        shortlisted,

        interviews

      });

    }


    const jobs =
      db.prepare(`
        SELECT COUNT(*) AS count
        FROM jobs
      `).get().count;


    const applications =
      db.prepare(`
        SELECT COUNT(*) AS count
        FROM applications
        WHERE seeker_id = ?
      `).get(
        req.user.id
      ).count;


    const saved =
      db.prepare(`
        SELECT COUNT(*) AS count
        FROM saved_jobs
        WHERE seeker_id = ?
      `).get(
        req.user.id
      ).count;


    const interviews =
      db.prepare(`
        SELECT COUNT(*) AS count
        FROM interviews
        WHERE seeker_id = ?
      `).get(
        req.user.id
      ).count;


    res.json({

      jobs,

      applications,

      saved,

      interviews

    });

  }
);


/* =========================================================
   FRONTEND
========================================================= */


app.get(
  "*",
  (
    req,
    res
  ) => {

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );

  }
);


/* =========================================================
   START SERVER
========================================================= */


app.listen(
  PORT,
  () => {

    console.log("");
    console.log("======================================");
    console.log("       NEXORAJOBS SERVER RUNNING");
    console.log("======================================");
    console.log("");
    console.log(
      `Open: http://localhost:${PORT}`
    );
    console.log("");

  }
);