const app = document.getElementById("app");

// In the native Android/iOS build, set NEXORA_API_BASE_URL in config.js
// to the HTTPS address where server.js is hosted. Leave it empty for web/local use.
const NEXORA_API_BASE_URL =
  (window.NEXORA_API_BASE_URL || "").replace(/\\/$/, "");

function apiUrl(url) {
  if (!NEXORA_API_BASE_URL) return url;
  return `${NEXORA_API_BASE_URL}${url.startsWith("/") ? url : "/" + url}`;
}

let token =
  localStorage.getItem("nexora_token");

let user =
  JSON.parse(
    localStorage.getItem("nexora_user") || "null"
  );


/* =====================================================
   API
===================================================== */

async function api(
  url,
  options = {}
) {

  options.headers = {
    ...(options.headers || {}),
    "Content-Type":
      "application/json"
  };

  if (token) {

    options.headers.Authorization =
      "Bearer " + token;
  }

  const response =
    await fetch(apiUrl(url), options);

  const data =
    await response.json()
      .catch(() => ({}));

  if (!response.ok) {

    throw new Error(
      data.error ||
      "Something went wrong"
    );
  }

  return data;
}


/* =====================================================
   HELPERS
===================================================== */

function esc(value = "") {

  return String(value).replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[character])
  );
}


function toast(message) {

  const toastElement =
    document.getElementById("toast");

  toastElement.textContent =
    message;

  toastElement.classList.add(
    "show"
  );

  setTimeout(
    () => {
      toastElement.classList.remove(
        "show"
      );
    },
    3000
  );
}


function initials(name = "") {

  return name
    .split(" ")
    .map(word => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}


function saveSession(data) {

  token =
    data.token;

  user =
    data.user;

  localStorage.setItem(
    "nexora_token",
    token
  );

  localStorage.setItem(
    "nexora_user",
    JSON.stringify(user)
  );
}


function logout() {

  localStorage.removeItem(
    "nexora_token"
  );

  localStorage.removeItem(
    "nexora_user"
  );

  token = null;

  user = null;

  showAuth(false);
}


/* =====================================================
   SUCCESS MODAL
===================================================== */

function successModal(
  title,
  message,
  buttonText = "Continue",
  callback = null
) {

  document.getElementById(
    "modalRoot"
  ).innerHTML = `

    <div class="modal">

      <div class="modal-box success-modal">

        <div class="success-icon">
          🎉
        </div>

        <h2>
          ${esc(title)}
        </h2>

        <p class="muted">
          ${esc(message)}
        </p>

        <br>

        <button
          class="btn primary"
          onclick="closeSuccessModal()"
        >
          ${esc(buttonText)}
        </button>

      </div>

    </div>
  `;

  window.successCallback =
    callback;
}


function closeSuccessModal() {

  document.getElementById(
    "modalRoot"
  ).innerHTML = "";

  if (
    typeof window.successCallback ===
    "function"
  ) {

    window.successCallback();
  }
}


/* =====================================================
   GOOGLE LOGIN
===================================================== */

function startGoogleLogin(role) {
  if (!["seeker", "employer"].includes(role)) {
    toast("Please select Candidate or Company first.");
    return;
  }

  window.location.href =
    `${apiUrl("/auth/google")}?role=${encodeURIComponent(role)}`;
}

function handleGoogleCallback() {
  const hash = window.location.hash || "";
  if (!hash.startsWith("#google_")) return false;

  const params = new URLSearchParams(hash.substring(1));
  const googleToken = params.get("google_token");
  const googleRole = params.get("google_role");
  const googleError = params.get("google_error");

  window.history.replaceState(
    {},
    document.title,
    window.location.pathname + window.location.search
  );

  if (googleError) {
    showRoleSelection();
    setTimeout(() => toast(googleError), 100);
    return true;
  }

  if (googleToken) {
    try {
      const payload = JSON.parse(atob(googleToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (payload.role !== googleRole) {
        throw new Error("Invalid Google account role.");
      }

      saveSession({
        token: googleToken,
        user: {
          id: payload.id,
          name: payload.name,
          email: payload.email,
          role: payload.role
        }
      });

      localStorage.removeItem("selectedRole");
      showPage("dashboard");
      return true;
    } catch (error) {
      token = null;
      user = null;
      localStorage.removeItem("nexora_token");
      localStorage.removeItem("nexora_user");
      showRoleSelection();
      setTimeout(() => toast("Google Login session is invalid. Please try again."), 100);
      return true;
    }
  }

  return false;
}

/* =====================================================
   AUTH
===================================================== */

function showAuth(register = false) {

  const selectedRole = localStorage.getItem("selectedRole") || "seeker";

  app.innerHTML = `

    <div class="auth-page">

      <div class="auth-left">

        <div class="brand">
          Nexora<span>Jobs</span>
        </div>


        <div class="auth-hero">

          <h1>
            Your next opportunity starts here.
          </h1>

          <p>
            Discover meaningful work,
            build your professional profile
            and connect with companies
            looking for talented people.
          </p>


          <div class="auth-points">

            <div class="auth-point">
              ✓ Discover new opportunities
            </div>

            <div class="auth-point">
              ✓ Build your professional resume
            </div>

            <div class="auth-point">
              ✓ Track applications and interviews
            </div>

          </div>

        </div>

      </div>


      <div class="auth-right">

        <div class="auth-card">

          <h2>
            ${
              register
                ? "Create your account"
                : "Welcome back"
            }
          </h2>


          <p>
            ${
              register
                ? "Start your career journey with NexoraJobs."
                : "Login to continue your journey."
            }
          </p>


          <form
            class="form"
            onsubmit="
              event.preventDefault();
              ${
                register
                  ? "registerUser()"
                  : "loginUser()"
              }
            "
          >

            <div class="muted" style="text-align:center">or use email and password</div>

            ${
              register
                ? `

                <input
                  id="name"
                  class="input"
                  placeholder="Full Name / Company Name"
                  required
                >

                `
                : ""
            }


            ${
              register
                ? `

                <select
                  id="role"
                  required
                >

                  <option value="seeker" ${selectedRole === "seeker" ? "selected" : ""}>
                    Candidate
                  </option>

                  <option value="employer" ${selectedRole === "employer" ? "selected" : ""}>
                    Company / Employer
                  </option>

                </select>

                `
                : ""
            }


            <input
              id="email"
              class="input"
              type="email"
              placeholder="Email Address"
              required
            >


            <input
              id="password"
              class="input"
              type="password"
              placeholder="Password"
              minlength="6"
              required
            >


            <button
              class="btn primary"
              type="submit"
            >

              ${
                register
                  ? "Create Account"
                  : "Login"
              }

            </button>

            ${
              selectedRole
                ? `
                  <button
                    class="btn ghost google-login-btn"
                    type="button"
                    onclick="startGoogleLogin('${selectedRole}')"
                    style="width:100%; margin-top:12px; display:flex; align-items:center; justify-content:center; gap:10px;"
                  >
                    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20c10 0 19-8 19-20 0-1.2-.1-2.3-.4-3.5z"/>
                      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6.1 29.3 4 24 4c-7.6 0-14.2 4.3-17.7 10.7z"/>
                      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.7-3.3-11.3-8H6.1v5.3C9.6 39.7 16.2 44 24 44z"/>
                      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.7 5.7-7.1 7.1l.1.1 6.2 5.2C34.1 40.9 43 35 43 24c0-1.2-.1-2.3-.4-3.5z"/>
                    </svg>
                    Continue with Google
                  </button>
                  `
                : ""
            }

          </form>


          <br>


          <button
            class="btn ghost"
            onclick="showAuth(${!register})"
          >

            ${
              register
                ? "Already have an account? Login"
                : "New to NexoraJobs? Create an account"
            }

          </button>

        </div>

      </div>

    </div>
  `;
}


async function registerUser() {

  try {

    const data =
      await api(
        "/api/auth/register",
        {
          method:
            "POST",

          body:
            JSON.stringify({
              name:
                document.getElementById(
                  "name"
                ).value,

              email:
                document.getElementById(
                  "email"
                ).value,

              password:
                document.getElementById(
                  "password"
                ).value,

              role:
                document.getElementById(
                  "role"
                ).value
            })
        }
      );


    saveSession(data);
    localStorage.removeItem("selectedRole");


    successModal(
      "Welcome to NexoraJobs!",
      "Your account has been successfully created. Let's get started.",
      "Continue",
      () => showPage("dashboard")
    );

  } catch (error) {

    toast(error.message);
  }
}


async function loginUser() {

  try {

    const selectedRole = localStorage.getItem("selectedRole");

    if (!selectedRole) {
      toast("Please select Candidate or Company first, then choose Login.");
      return;
    }

    const data =
      await api(
        "/api/auth/login",
        {
          method:
            "POST",

          body:
            JSON.stringify({
              email:
                document.getElementById(
                  "email"
                ).value,

              password:
                document.getElementById(
                  "password"
                ).value,

              role: selectedRole
            })
        }
      );


    saveSession(data);
    localStorage.removeItem("selectedRole");

    showPage("dashboard");

  } catch (error) {

    toast(error.message);
  }
}


/* =====================================================
   MAIN LAYOUT
===================================================== */

function layout(
  page,
  content
) {

  const candidate =
    user.role === "seeker";


  const candidateNav = `

    <button
      class="${page === "jobs" ? "active" : ""}"
      onclick="showPage('jobs')"
    >
      Find Jobs
    </button>

    <button
      class="${page === "dashboard" ? "active" : ""}"
      onclick="showPage('dashboard')"
    >
      Dashboard
    </button>

    <button
      class="${page === "applications" ? "active" : ""}"
      onclick="showPage('applications')"
    >
      My Applications
    </button>

    <button
      class="${page === "saved" ? "active" : ""}"
      onclick="showPage('saved')"
    >
      Saved Jobs
    </button>

    <button
      class="${page === "resume" ? "active" : ""}"
      onclick="showPage('resume')"
    >
      Resume Builder
    </button>

    <button
      class="${page === "profile" ? "active" : ""}"
      onclick="showPage('profile')"
    >
      My Profile
    </button>
  `;


  const employerNav = `

    <button
      class="${page === "dashboard" ? "active" : ""}"
      onclick="showPage('dashboard')"
    >
      Dashboard
    </button>

    <button
      class="${page === "company-jobs" ? "active" : ""}"
      onclick="showPage('company-jobs')"
    >
      Post Job
    </button>

    <button
      class="${page === "applicants" ? "active" : ""}"
      onclick="showPage('applicants')"
    >
      Applicants
    </button>

    <button
      class="${page === "verification" ? "active" : ""}"
      onclick="showPage('verification')"
    >
      Verification
    </button>

    <button
      class="${page === "company-profile" ? "active" : ""}"
      onclick="showPage('company-profile')"
    >
      Company Profile
    </button>
  `;


  app.innerHTML = `

    <div class="app-layout">

      <aside class="sidebar">

        <div class="sidebar-brand">
          Nexora<span>Jobs</span>
        </div>


        <nav class="nav">

          ${
            candidate
              ? candidateNav
              : employerNav
          }

        </nav>


        <div class="nav-bottom">

          <nav class="nav">

            <button
              onclick="logout()"
            >
              Sign Out
            </button>

          </nav>

        </div>

      </aside>


      <main class="main-area">

        <header class="topbar">

          <div class="topbar-title">
            NexoraJobs
          </div>


          <div class="user-box">

            <div>

              <b>
                ${esc(user.name)}
              </b>

              <br>

              <small class="muted">

                ${
                  candidate
                    ? "Candidate"
                    : "Company"
                }

              </small>

            </div>


            <div class="avatar">

              ${initials(user.name)}

            </div>

          </div>

        </header>


        <div class="content">

          ${content}

        </div>

      </main>

    </div>
  `;
}


/* =====================================================
   ROUTER
===================================================== */

function showPage(page) {

  if (!user) {

    showAuth(false);

    return;
  }

  // Role-based navigation: candidates can never open employer-only pages,
  // and employers can never open candidate-only pages.
  if (user.role === "seeker" && [
    "company-jobs",
    "applicants",
    "verification",
    "company-profile"
  ].includes(page)) {
    toast("Company pages are not available to candidate accounts.");
    return;
  }

  if (user.role === "employer" && [
    "applications",
    "saved",
    "resume",
    "profile"
  ].includes(page)) {
    toast("This page is only available to candidate accounts.");
    return;
  }


  if (
    page === "dashboard"
  ) {

    if (
      user.role === "seeker"
    ) {

      candidateDashboard();

    } else {

      companyDashboard();
    }

    return;
  }


  if (page === "jobs") {

    jobsPage();
  }


  if (page === "applications") {

    applicationsPage();
  }


  if (page === "saved") {

    savedJobsPage();
  }


  if (page === "resume") {

    resumePage();
  }


  if (page === "profile") {

    profilePage();
  }


  if (page === "company-jobs") {

    companyJobsPage();
  }


  if (page === "applicants") {

    applicantsPage();
  }


  if (page === "verification") {

    verificationPage();
  }


  if (page === "company-profile") {

    companyProfilePage();
  }
}


/* =====================================================
   CANDIDATE DASHBOARD
===================================================== */

async function candidateDashboard() {

  try {

    const stats =
      await api("/api/stats");


    const applications =
      await api(
        "/api/my-applications"
      );


    layout(
      "dashboard",

      `

      <div class="page-header">

        <div>

          <h1>
            Welcome back, ${esc(user.name)} 👋
          </h1>

          <p>
            Everything you need for your
            career journey in one place.
          </p>

        </div>


        <button
          class="btn primary"
          onclick="showPage('jobs')"
        >
          Browse Jobs
        </button>

      </div>


      <div class="stats">

        <div class="stat">

          <span>
            Available Jobs
          </span>

          <b>
            ${stats.jobs || 0}
          </b>

        </div>


        <div class="stat">

          <span>
            My Applications
          </span>

          <b>
            ${stats.applications || 0}
          </b>

        </div>


        <div class="stat">

          <span>
            Saved Jobs
          </span>

          <b>
            ${stats.saved || 0}
          </b>

        </div>

      </div>


      <div class="page-header">

        <div>

          <h2>
            Recent Applications
          </h2>

          <p>
            Track your latest activity.
          </p>

        </div>

      </div>


      <div class="grid">

        ${
          applications
            .slice(0, 6)
            .map(
              item => `

              <div class="job-card">

                <h3>
                  ${esc(item.title)}
                </h3>

                <div class="job-company">
                  ${esc(item.company)}
                </div>

                <span class="status">
                  ${esc(item.status)}
                </span>

              </div>
            `
            )
            .join("")

          ||

          `
            <div class="card empty">
              You have not applied for any jobs yet.
            </div>
          `
        }

      </div>
      `
    );

  } catch (error) {

    toast(error.message);
  }
}


/* =====================================================
   JOBS
===================================================== */

async function jobsPage() {

  layout(
    "jobs",

    `

    <div class="page-header">

      <div>

        <h1>
          Find Your Next Job
        </h1>

        <p>
          Discover opportunities that match your skills.
        </p>

      </div>

    </div>


    <div class="search-panel">

      <input
        id="jobSearch"
        class="input"
        placeholder="Job title, skills or company"
      >


      <input
        id="jobLocation"
        class="input"
        placeholder="Address"
      >


      <select id="jobType">

        <option value="">
          All Job Types
        </option>

        <option>
          Full-time
        </option>

        <option>
          Part-time
        </option>

        <option>
          Contract
        </option>

        <option>
          Internship
        </option>

        <option>
          Remote
        </option>

      </select>


      <button
        class="btn primary"
        onclick="loadJobs()"
      >
        Search
      </button>

    </div>


    <div
      id="jobsList"
      class="grid"
    ></div>
    `
  );


  loadJobs();
}


async function loadJobs() {

  try {

    const q =
      document.getElementById(
        "jobSearch"
      )?.value || "";

    const location =
      document.getElementById(
        "jobLocation"
      )?.value || "";

    const type =
      document.getElementById(
        "jobType"
      )?.value || "";


    const jobs =
      await api(
        `/api/jobs?q=${encodeURIComponent(q)}&location=${encodeURIComponent(location)}&type=${encodeURIComponent(type)}`
      );


    document.getElementById(
      "jobsList"
    ).innerHTML =

      jobs.map(
        job => `

        <div class="job-card">

          <h3>
            ${esc(job.title)}
          </h3>


          <div class="job-company">

            ${esc(job.company)}

          </div>


          <div class="job-meta">

            📍 ${esc(job.location)}
            ·
            💼 ${esc(job.type)}

          </div>


          ${
            job.salary
              ? `
                <p>
                  💰 ${esc(job.salary)}
                </p>
              `
              : ""
          }


          <br>


          <p class="muted">

            ${esc(
              String(
                job.description
              ).slice(0, 140)
            )}...

          </p>


          <br>


          ${
            String(
              job.skills || ""
            )
              .split(",")
              .filter(Boolean)
              .slice(0, 5)
              .map(
                skill => `
                  <span class="tag">
                    ${esc(skill.trim())}
                  </span>
                `
              )
              .join("")
          }


          <br><br>


          <button
            class="btn primary"
            onclick="viewJob(${job.id})"
          >
            View Job
          </button>


          <button
            class="btn secondary"
            onclick="saveJob(${job.id})"
          >
            Save
          </button>

        </div>
      `
      )
      .join("")

      ||

      `
        <div class="card empty">
          No jobs found.
        </div>
      `;

  } catch (error) {

    toast(error.message);
  }
}


/* =====================================================
   JOB DETAILS
===================================================== */

async function viewJob(id) {

  try {

    const job =
      await api(
        `/api/jobs/${id}`
      );


    document.getElementById(
      "modalRoot"
    ).innerHTML = `

      <div class="modal">

        <div class="modal-box">

          <div class="page-header">

            <div>

              <h2>
                ${esc(job.title)}
              </h2>

              <p>
                ${esc(job.company)}
              </p>

            </div>


            <button
              class="btn ghost"
              onclick="closeModal()"
            >
              ✕
            </button>

          </div>


          <p>
            📍 ${esc(job.location)}
            ·
            ${esc(job.type)}
          </p>


          <br>


          <h3>
            Job Description
          </h3>


          <br>


          <p class="muted">

            ${esc(job.description)}

          </p>


          <br>


          <h3>
            Skills
          </h3>


          <br>


          ${
            String(job.skills || "")
              .split(",")
              .filter(Boolean)
              .map(
                skill => `
                  <span class="tag">
                    ${esc(skill.trim())}
                  </span>
                `
              )
              .join("")
          }


          <br><br>


          ${
            user.role === "seeker"

              ? `

              <button
                class="btn primary"
                onclick="openApply(${job.id})"
              >
                Apply Now
              </button>

              `

              : ""
          }

        </div>

      </div>
    `;

  } catch (error) {

    toast(error.message);
  }
}


function closeModal() {

  document.getElementById(
    "modalRoot"
  ).innerHTML = "";
}


/* =====================================================
   APPLY
===================================================== */

async function openApply(id) {

  closeModal();


  document.getElementById(
    "modalRoot"
  ).innerHTML = `

    <div class="modal">

      <div class="modal-box">

        <div class="page-header">

          <h2>
            Apply for this Job
          </h2>


          <button
            class="btn ghost"
            onclick="closeModal()"
          >
            ✕
          </button>

        </div>


        <form
          class="form"
          onsubmit="
            event.preventDefault();
            applyJob(${id})
          "
        >

          <input
            id="resumeLink"
            class="input"
            placeholder="Resume URL"
            required
          >


          <textarea
            id="coverLetter"
            placeholder="Write your cover letter"
            required
          ></textarea>


          <button
            class="btn primary"
            type="submit"
          >
            Submit Application
          </button>

        </form>

      </div>

    </div>
  `;
}


async function applyJob(id) {

  try {

    const resume =
      document.getElementById(
        "resumeLink"
      ).value.trim();

    const cover =
      document.getElementById(
        "coverLetter"
      ).value.trim();


    if (!resume || !cover) {

      toast(
        "Resume and cover letter are required."
      );

      return;
    }


    await api(
      `/api/jobs/${id}/apply`,
      {
        method:
          "POST",

        body:
          JSON.stringify({

            resume,

            cover_letter:
              cover
          })
      }
    );


    closeModal();


    successModal(
      "Application Submitted!",
      "Your application has successfully been sent to the company.",
      "View Applications",
      () => showPage("applications")
    );

  } catch (error) {

    toast(error.message);
  }
}


/* =====================================================
   SAVE JOB
===================================================== */

async function saveJob(id) {

  try {

    await api(
      `/api/jobs/${id}/save`,
      {
        method:
          "POST"
      }
    );


    toast(
      "Job saved successfully!"
    );

  } catch (error) {

    toast(error.message);
  }
}


/* =====================================================
   APPLICATIONS
===================================================== */

async function applicationsPage() {

  try {

    const applications =
      await api(
        "/api/my-applications"
      );


    layout(
      "applications",

      `

      <div class="page-header">

        <div>

          <h1>
            My Applications
          </h1>

          <p>
            Track every stage of your application journey.
          </p>

        </div>

      </div>


      <div class="grid">

        ${
          applications
            .map(
              item => `

              <div class="card">

                <h3>
                  ${esc(item.title)}
                </h3>


                <p>
                  ${esc(item.company)}
                </p>


                <br>


                <span class="status">
                  ${esc(item.status)}
                </span>


                <br><br>


                <p class="muted">

                  Application submitted:
                  ${new Date(
                    item.created_at
                  ).toLocaleDateString()}

                </p>

              </div>
            `
            )
            .join("")

          ||

          `
            <div class="card empty">
              You have not submitted any applications.
            </div>
          `
        }

      </div>
      `
    );

  } catch (error) {

    toast(error.message);
  }
}


/* =====================================================
   SAVED JOBS
===================================================== */

async function savedJobsPage() {

  try {

    const jobs =
      await api(
        "/api/saved-jobs"
      );


    layout(
      "saved",

      `

      <div class="page-header">

        <div>

          <h1>
            Saved Jobs
          </h1>

          <p>
            Opportunities you saved for later.
          </p>

        </div>

      </div>


      <div class="grid">

        ${
          jobs
            .map(
              job => `

              <div class="job-card">

                <h3>
                  ${esc(job.title)}
                </h3>

                <p>
                  ${esc(job.company)}
                </p>

                <br>

                <button
                  class="btn primary"
                  onclick="viewJob(${job.id})"
                >
                  View Job
                </button>

              </div>
            `
            )
            .join("")

          ||

          `
            <div class="card empty">
              No saved jobs yet.
            </div>
          `
        }

      </div>
      `
    );

  } catch (error) {

    toast(error.message);
  }
}

/* =====================================================
   RESUME BUILDER
===================================================== */

let selectedTemplate = null;
let resumeCertificateFile = null;

async function getCandidateProfileData() {
  const data = await api("/api/profile");
  return data.profile || {};
}

function readSelectedCertificate() {
  return new Promise((resolve, reject) => {
    const input = document.getElementById("resume_certification_file");
    const file = input?.files?.[0];

    if (!file) {
      resolve(resumeCertificateFile);
      return;
    }

    const allowed = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg"
    ];

    if (!allowed.includes(file.type)) {
      reject(new Error("Please upload a PDF, PNG or JPG certificate file."));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("Certificate file must be 5 MB or smaller."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      resumeCertificateFile = {
        name: file.name,
        type: file.type,
        data: reader.result
      };
      resolve(resumeCertificateFile);
    };
    reader.onerror = () => reject(new Error("Could not read the certificate file."));
    reader.readAsDataURL(file);
  });
}

async function resumePage() {
  try {
    const [resume, profile] = await Promise.all([
      api("/api/resume"),
      getCandidateProfileData()
    ]);

    if (!selectedTemplate) {
      selectedTemplate = resume.template || "professional";
    }

    // Profile is the single source of truth. Existing resume values are only
    // used when the profile has not been filled yet.
    const data = {
      full_name: user.name || resume.full_name || "",
      email: user.email || resume.email || "",
      phone: profile.phone || resume.phone || "",
      location: profile.location || resume.location || "",
      headline: profile.headline || resume.headline || "",
      qualifications: profile.qualifications || resume.qualifications || "",
      bio: profile.bio || resume.summary || "",
      education: profile.education || resume.education || "",
      experience: profile.experience || resume.experience || "",
      skills: profile.skills || resume.skills || "",
      projects: profile.projects || resume.projects || "",
      certifications: profile.certifications || resume.certifications || "",
      certificate_file_name:
        profile.certificate_file_name || resume.certificate_file_name || "",
      certificate_file_data:
        profile.certificate_file_data || resume.certificate_file_data || "",
      certificate_file_type:
        profile.certificate_file_type || resume.certificate_file_type || ""
    };

    resumeCertificateFile = data.certificate_file_data
      ? {
          name: data.certificate_file_name,
          type: data.certificate_file_type,
          data: data.certificate_file_data
        }
      : null;

    layout(
      "resume",
      `
      <div class="page-header">
        <div>
          <h1>Resume Builder</h1>
          <p>Your resume uses the same information as your profile.</p>
        </div>
        <button class="btn secondary" onclick="downloadResume()">
          Download Resume
        </button>
      </div>

      <div class="card">
        <h2>Choose Your Template</h2>
        <p class="muted">Click a template, then download your resume in that exact design.</p>
        <br>
        <div class="template-grid">
          ${templateCard("professional", "Professional")}
          ${templateCard("modern", "Modern")}
          ${templateCard("minimal", "Minimal")}
        </div>
      </div>

      <div class="card">
        <form class="form" onsubmit="event.preventDefault(); saveResume()">
          <div class="two-col">
            <input id="resume_name" class="input" placeholder="Full Name" value="${esc(data.full_name)}" required>
            <input id="resume_email" class="input" type="email" placeholder="Email" value="${esc(data.email)}" required>
          </div>

          <div class="two-col">
            <input id="resume_phone" class="input" placeholder="Phone Number" value="${esc(data.phone)}" required>
            <input id="resume_location" class="input" placeholder="Address" value="${esc(data.location)}" required>
          </div>

          <input id="resume_headline" class="input" placeholder="Professional Headline" value="${esc(data.headline)}">

          <textarea id="resume_qualifications" placeholder="Qualifications" required>${esc(data.qualifications || "")}</textarea>

          <textarea id="resume_summary" placeholder="Professional Summary" required>${esc(data.bio)}</textarea>
          <textarea id="resume_education" placeholder="Education" required>${esc(data.education)}</textarea>
          <textarea id="resume_experience" placeholder="Work Experience" required>${esc(data.experience)}</textarea>
          <textarea id="resume_skills" placeholder="Skills" required>${esc(data.skills)}</textarea>
          <textarea id="resume_projects" placeholder="Projects">${esc(data.projects)}</textarea>

          <div>
            <label><b>Certificate</b></label>
            <input id="resume_certification_file" class="input" type="file" accept=".pdf,.png,.jpg,.jpeg">
            <small class="muted">
              Upload one certificate file (PDF, PNG or JPG, maximum 5 MB).
              ${data.certificate_file_name ? `Current file: ${esc(data.certificate_file_name)}` : ""}
            </small>
          </div>

          <button class="btn primary" type="submit">Save My Resume</button>
          <button class="btn secondary" type="button" onclick="downloadResume()">Download Selected Template</button>
        </form>
      </div>
      `
    );
  } catch (error) {
    toast(error.message);
  }
}

async function selectTemplate(id) {
  const draft = document.getElementById("resume_name")
    ? resumeFormData()
    : null;

  try {
    // Preserve a newly selected certificate while switching templates.
    await readSelectedCertificate();
  } catch (error) {
    toast(error.message);
    return;
  }

  selectedTemplate = id;
  await resumePage();

  // Restore unsaved text entered before changing the template.
  if (draft) {
    const fields = {
      resume_name: draft.full_name,
      resume_email: draft.email,
      resume_phone: draft.phone,
      resume_location: draft.location,
      resume_headline: draft.headline,
      resume_summary: draft.summary,
      resume_education: draft.education,
      resume_experience: draft.experience,
      resume_skills: draft.skills,
      resume_projects: draft.projects
    };

    Object.entries(fields).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.value = value;
    });
  }
}

function resumeFormData() {
  return {
    full_name: document.getElementById("resume_name")?.value || "",
    email: document.getElementById("resume_email")?.value || "",
    phone: document.getElementById("resume_phone")?.value || "",
    location: document.getElementById("resume_location")?.value || "",
    headline: document.getElementById("resume_headline")?.value || "",
    summary: document.getElementById("resume_summary")?.value || "",
    education: document.getElementById("resume_education")?.value || "",
    experience: document.getElementById("resume_experience")?.value || "",
    skills: document.getElementById("resume_skills")?.value || "",
    projects: document.getElementById("resume_projects")?.value || ""
  };
}

function splitSkills(value = "") {
  return String(value)
    .split(/[,\n]/)
    .map(v => v.trim())
    .filter(Boolean);
}

function resumePrintHtml(data) {
  const skills = splitSkills(data.skills);
  const certificate = data.certificate_file_name
    ? `<div class="section"><h3>Certificate</h3><p>${esc(data.certificate_file_name)}</p></div>`
    : "";

  const section = (title, value) => value
    ? `<div class="section"><h3>${title}</h3><div class="text">${esc(value).replace(/\n/g, "<br>")}</div></div>`
    : "";

  if (selectedTemplate === "modern") {
    return `
      <div class="resume modern">
        <aside class="side">
          <div class="avatar">${esc(initials(data.full_name))}</div>
          <h1>${esc(data.full_name)}</h1>
          <p class="headline">${esc(data.headline)}</p>
          <div class="contact">${esc(data.email)}<br>${esc(data.phone)}<br>${esc(data.location)}</div>
          ${skills.length ? `<h3>SKILLS</h3><ul>${skills.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
        </aside>
        <main class="body">
          ${section("PROFILE", data.summary)}
          ${section("QUALIFICATIONS", data.qualifications)}
          ${section("EXPERIENCE", data.experience)}
          ${section("EDUCATION", data.education)}
          ${section("PROJECTS", data.projects)}
          ${certificate}
        </main>
      </div>`;
  }

  if (selectedTemplate === "minimal") {
    return `
      <div class="resume minimal">
        <h1>${esc(data.full_name)}</h1>
        <div class="headline">${esc(data.headline)}</div>
        <div class="contact">${esc(data.email)} · ${esc(data.phone)} · ${esc(data.location)}</div>
        ${section("PROFILE", data.summary)}
        ${section("QUALIFICATIONS", data.qualifications)}
        ${section("EXPERIENCE", data.experience)}
        ${section("EDUCATION", data.education)}
        ${section("PROJECTS", data.projects)}
        ${skills.length ? `<div class="section"><h3>SKILLS</h3><p>${skills.map(esc).join(" · ")}</p></div>` : ""}
        ${certificate}
      </div>`;
  }

  return `
    <div class="resume professional">
      <header>
        <h1>${esc(data.full_name)}</h1>
        <div class="headline">${esc(data.headline)}</div>
        <div class="contact">${esc(data.email)} · ${esc(data.phone)} · ${esc(data.location)}</div>
      </header>
      ${section("PROFILE", data.summary)}
      ${section("QUALIFICATIONS", data.qualifications)}
      ${section("EXPERIENCE", data.experience)}
      ${section("EDUCATION", data.education)}
      ${section("PROJECTS", data.projects)}
      ${skills.length ? `<div class="section"><h3>SKILLS</h3><p>${skills.map(s => `<span class="skill">${esc(s)}</span>`).join("")}</p></div>` : ""}
      ${certificate}
    </div>`;
}

async function downloadResume() {
  if (!user || user.role !== "seeker") {
    toast("Only candidate accounts can download resumes.");
    return;
  }

  try {
    const data = resumeFormData();
    if (!data.full_name || !data.email || !data.phone || !data.location ||
        !data.qualifications || !data.summary || !data.education || !data.experience || !data.skills) {
      toast("Please complete your profile/resume before downloading.");
      return;
    }

    data.certificate_file_name = resumeCertificateFile?.name || "";

    const printWindow = window.open("", "_blank", "width=1000,height=900");
    if (!printWindow) {
      toast("Please allow pop-ups to download your resume.");
      return;
    }

    printWindow.document.write(`<!doctype html><html><head><title>${esc(data.full_name)} - Resume</title>
      <style>
        @page { size: A4; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; background: #eee; font-family: Arial, sans-serif; color: #222; }
        .resume { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 18mm; }
        h1 { margin: 0 0 5px; font-size: 30px; }
        h3 { margin: 0 0 8px; font-size: 12px; letter-spacing: 1.5px; }
        .headline { font-size: 15px; margin-bottom: 7px; }
        .contact { font-size: 11px; color: #555; }
        .section { margin-top: 20px; }
        .section .text, .section p { font-size: 11px; line-height: 1.55; }
        .skill { display: inline-block; margin: 0 7px 5px 0; }
        .modern { display: grid; grid-template-columns: 65mm 1fr; padding: 0; }
        .modern .side { padding: 18mm 10mm; background: #f2f4f7; min-height: 297mm; }
        .modern .body { padding: 18mm 14mm; }
        .modern .side h1 { font-size: 23px; }
        .modern .side h3 { margin-top: 30px; }
        .modern ul { padding-left: 17px; font-size: 11px; line-height: 1.7; }
        .avatar { width: 54px; height: 54px; border-radius: 50%; border: 1px solid #999; display:flex; align-items:center; justify-content:center; margin-bottom: 18px; font-weight: bold; }
        .minimal { padding: 20mm; }
        .minimal h1 { font-size: 34px; }
        .minimal .section { display: grid; grid-template-columns: 32mm 1fr; gap: 8mm; border-top: 1px solid #ddd; padding-top: 12px; }
        .minimal .section h3 { margin-top: 2px; }
        @media print { body { background: #fff; } .resume { margin: 0; } }
      </style></head><body>${resumePrintHtml(data)}</body></html>`);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 350);
  } catch (error) {
    toast(error.message);
  }
}

async function saveResume() {
  try {
    const file = await readSelectedCertificate();
    const data = resumeFormData();

    if (!data.full_name || !data.email || !data.phone || !data.location ||
        !data.qualifications || !data.summary || !data.education || !data.experience || !data.skills) {
      toast("Please complete all required resume details.");
      return;
    }

    await api("/api/resume", {
      method: "PUT",
      body: JSON.stringify({
        template: selectedTemplate,
        ...data,
        certifications: file?.name || "",
        certificate_file_name: file?.name || "",
        certificate_file_data: file?.data || "",
        certificate_file_type: file?.type || ""
      })
    });

    // Keep Profile and Resume exactly synchronized.
    await api("/api/profile", {
      method: "PUT",
      body: JSON.stringify({
        phone: data.phone,
        location: data.location,
        headline: data.headline,
        qualifications: data.qualifications,
        bio: data.summary,
        education: data.education,
        experience: data.experience,
        skills: data.skills,
        projects: data.projects,
        certifications: file?.name || "",
        certificate_file_name: file?.name || "",
        certificate_file_data: file?.data || "",
        certificate_file_type: file?.type || ""
      })
    });

    successModal(
      "Resume Saved Successfully!",
      `Your ${selectedTemplate} resume has been saved. Your profile and resume now use the same details.`,
      "Download Resume",
      () => downloadResume()
    );
  } catch (error) {
    toast(error.message);
  }
}

function templateCard(id, name) {
  const selected = selectedTemplate === id ? "selected" : "";
  let preview = "";

  if (id === "professional") {
    preview = `
      <div class="resume-preview professional-preview">
        <div class="preview-header">
          <div class="preview-name">Your Name</div>
          <div class="preview-role">Professional Headline</div>
          <div class="preview-contact">Email · Phone · Address</div>
        </div>
        <div class="preview-section"><b>PROFILE</b><div class="preview-line long"></div><div class="preview-line"></div></div>
        <div class="preview-section"><b>EXPERIENCE</b><div class="preview-line"></div><div class="preview-line short"></div></div>
        <div class="preview-section"><b>EDUCATION</b><div class="preview-line medium"></div></div>
      </div>`;
  }

  if (id === "modern") {
    preview = `
      <div class="resume-preview modern-preview">
        <div class="modern-sidebar">
          <div class="modern-avatar">YN</div>
          <h4>Your Name</h4>
          <small>PROFESSIONAL</small>
          <div class="modern-info"><b>CONTACT</b><div class="preview-line small"></div><div class="preview-line small"></div></div>
          <div class="modern-info"><b>SKILLS</b><div class="skill-dot"></div><div class="skill-dot"></div><div class="skill-dot"></div></div>
        </div>
        <div class="modern-content"><h3>EXPERIENCE</h3><div class="preview-line long"></div><div class="preview-line medium"></div><h3>EDUCATION</h3><div class="preview-line long"></div><h3>PROJECTS</h3><div class="preview-line medium"></div></div>
      </div>`;
  }

  if (id === "minimal") {
    preview = `
      <div class="resume-preview minimal-preview">
        <div class="minimal-name">Your Name</div>
        <div class="minimal-role">Professional Headline</div>
        <div class="minimal-contact">Email · Phone · Address</div>
        <div class="minimal-divider"></div>
        <div class="minimal-section"><span>EXPERIENCE</span><div><div class="preview-line long"></div><div class="preview-line medium"></div></div></div>
        <div class="minimal-section"><span>EDUCATION</span><div><div class="preview-line medium"></div></div></div>
      </div>`;
  }

  return `
    <div class="template-card ${selected}" onclick="selectTemplate('${id}')">
      <div class="template-preview">${preview}</div>
      <div class="template-name">
        <span>${name}</span>
        ${selectedTemplate === id ? `<span class="template-selected">✓ Selected</span>` : ""}
      </div>
    </div>`;
}

/* =====================================================
   PROFILE
===================================================== */

async function profilePage() {
  if (!user || user.role !== "seeker") {
    toast("Profile is only available to candidate accounts.");
    return;
  }

  try {
    const data = await api("/api/profile");
    const profile = data.profile || {};
    window.currentProfileResume = profile.resume_file_data ? {
      name: profile.resume_file_name || "resume",
      type: profile.resume_file_type || "application/octet-stream",
      data: profile.resume_file_data
    } : null;

    layout(
      "profile",
      `
      <div class="page-header">
        <div>
          <h1>My Profile</h1>
          <p>Fill your profile once. The same details automatically appear in Resume Builder.</p>
        </div>
      </div>

      <div class="card">
        <form class="form" onsubmit="event.preventDefault(); saveProfile()">
          <div class="two-col">
            <input class="input" value="${esc(user.name || "")}" disabled>
            <input class="input" value="${esc(user.email || "")}" disabled>
          </div>

          <div class="two-col">
            <input id="profile_phone" class="input" placeholder="Phone Number" value="${esc(profile.phone || "")}" required>
            <input id="profile_location" class="input" placeholder="Address" value="${esc(profile.location || "")}" required>
          </div>

          <input id="profile_headline" class="input" placeholder="Professional Headline" value="${esc(profile.headline || "")}" required>
          <textarea id="profile_qualifications" placeholder="Qualifications" required>${esc(profile.qualifications || "")}</textarea>
          <textarea id="profile_bio" placeholder="Professional Summary" required>${esc(profile.bio || "")}</textarea>
          <textarea id="profile_education" placeholder="Education" required>${esc(profile.education || "")}</textarea>
          <textarea id="profile_experience" placeholder="Work Experience" required>${esc(profile.experience || "")}</textarea>
          <textarea id="profile_skills" placeholder="Skills" required>${esc(profile.skills || "")}</textarea>
          <textarea id="profile_projects" placeholder="Projects">${esc(profile.projects || "")}</textarea>

          <div>
            <label><b>Upload Resume from Your Personal Device</b></label>
            <input id="profile_resume_file" class="input" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
            <small class="muted">
              Upload your existing resume as PDF, DOC or DOCX (maximum 10 MB).
              ${profile.resume_file_name ? `Current file: ${esc(profile.resume_file_name)}` : ""}
            </small>
            ${profile.resume_file_data ? `<br><button class="btn secondary" type="button" onclick="downloadUploadedResume()">Download Uploaded Resume</button>` : ""}
          </div>

          <div>
            <label><b>Certificate</b></label>
            <input id="profile_certificate_file" class="input" type="file" accept=".pdf,.png,.jpg,.jpeg">
            <small class="muted">
              ${profile.certificate_file_name ? `Current file: ${esc(profile.certificate_file_name)}. Choose another file only if you want to replace it.` : "Upload a PDF, PNG or JPG certificate (maximum 5 MB)."}
            </small>
          </div>

          <button class="btn primary" type="submit">Save Profile</button>
          <button class="btn secondary" type="button" onclick="showPage('resume')">Open Resume Builder</button>
        </form>
      </div>
      `
    );
  } catch (error) {
    toast(error.message);
  }
}

function readProfileResume() {
  return new Promise((resolve, reject) => {
    const input = document.getElementById("profile_resume_file");
    const file = input?.files?.[0];

    if (!file) {
      resolve(null);
      return;
    }

    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];

    const extension = file.name.toLowerCase().split(".").pop();
    if (!allowed.includes(file.type) && !["pdf", "doc", "docx"].includes(extension)) {
      reject(new Error("Please upload a PDF, DOC or DOCX resume file."));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      reject(new Error("Resume file must be 10 MB or smaller."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      type: file.type || "application/octet-stream",
      data: reader.result
    });
    reader.onerror = () => reject(new Error("Could not read the resume file."));
    reader.readAsDataURL(file);
  });
}

function downloadUploadedResume() {
  const data = window.currentProfileResume;
  if (!data?.data) {
    toast("No uploaded resume found. Please upload your resume first.");
    return;
  }

  const link = document.createElement("a");
  link.href = data.data;
  link.download = data.name || "resume";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function readProfileCertificate() {
  return new Promise((resolve, reject) => {
    const input = document.getElementById("profile_certificate_file");
    const file = input?.files?.[0];

    if (!file) {
      resolve(null);
      return;
    }

    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowed.includes(file.type)) {
      reject(new Error("Please upload a PDF, PNG or JPG certificate file."));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("Certificate file must be 5 MB or smaller."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      type: file.type,
      data: reader.result
    });
    reader.onerror = () => reject(new Error("Could not read the certificate file."));
    reader.readAsDataURL(file);
  });
}

async function saveProfile() {
  try {
    const certificate = await readProfileCertificate();
    const uploadedResume = await readProfileResume();

    await api("/api/profile", {
      method: "PUT",
      body: JSON.stringify({
        phone: document.getElementById("profile_phone").value,
        location: document.getElementById("profile_location").value,
        headline: document.getElementById("profile_headline").value,
        qualifications: document.getElementById("profile_qualifications").value,
        bio: document.getElementById("profile_bio").value,
        education: document.getElementById("profile_education").value,
        experience: document.getElementById("profile_experience").value,
        skills: document.getElementById("profile_skills").value,
        projects: document.getElementById("profile_projects").value,
        ...(certificate ? {
          certifications: certificate.name,
          certificate_file_name: certificate.name,
          certificate_file_data: certificate.data,
          certificate_file_type: certificate.type
        } : {}),
        ...(uploadedResume ? {
          resume_file_name: uploadedResume.name,
          resume_file_data: uploadedResume.data,
          resume_file_type: uploadedResume.type
        } : {})
      })
    });

    toast("Profile updated successfully! Resume Builder will use these same details.");
  } catch (error) {
    toast(error.message);
  }
}

/* =====================================================
   COMPANY DASHBOARD
===================================================== */

async function companyDashboard() {

  try {

    const stats =
      await api("/api/stats");


    layout(
      "dashboard",

      `

      <div class="page-header">

        <div>

          <h1>
            Welcome back, ${esc(user.name)} 👋
          </h1>

          <p>
            Manage your hiring activity from one place.
          </p>

        </div>


        <button
          class="btn primary"
          onclick="showPage('company-jobs')"
        >
          Post a Job
        </button>

      </div>


      <div class="stats">

        <div class="stat">

          <span>
            Jobs Posted
          </span>

          <b>
            ${stats.jobs || 0}
          </b>

        </div>


        <div class="stat">

          <span>
            Total Applicants
          </span>

          <b>
            ${stats.applications || 0}
          </b>

        </div>


        <div class="stat">

          <span>
            Shortlisted
          </span>

          <b>
            ${stats.shortlisted || 0}
          </b>

        </div>

      </div>


      <div class="grid">

        <div class="card">

          <h3>
            Post Job
          </h3>

          <br>

          <p class="muted">
            Post and manage opportunities.
          </p>

          <br>

          <button
            class="btn primary"
            onclick="showPage('company-jobs')"
          >
            Post Job
          </button>

        </div>


        <div class="card">

          <h3>
            Review Applicants
          </h3>

          <br>

          <p class="muted">
            Discover and manage candidates.
          </p>

          <br>

          <button
            class="btn primary"
            onclick="showPage('applicants')"
          >
            View Applicants
          </button>

        </div>


        <div class="card">

          <h3>
            Company Profile
          </h3>

          <br>

          <p class="muted">
            Manage how candidates see your company.
          </p>

          <br>

          <button
            class="btn primary"
            onclick="showPage('company-profile')"
          >
            Edit Profile
          </button>

        </div>

      </div>
      `
    );

  } catch (error) {

    toast(error.message);
  }
}


/* =====================================================
   COMPANY JOBS
===================================================== */

async function companyJobsPage() {

  try {

    const jobs =
      await api(
        "/api/employer/jobs"
      );


    layout(
      "company-jobs",

      `

      <div class="page-header">

        <div>

          <h1>
            Post Job
          </h1>

          <p>
            Create and publish new job opportunities for candidates.
          </p>

        </div>

      </div>


      <div class="card">

        <h2>
          Post a New Job
        </h2>

        <br>


        <form
          class="form"
          onsubmit="
            event.preventDefault();
            postJob()
          "
        >

          <div class="two-col">

            <input
              id="jt"
              class="input"
              placeholder="Job Title"
              required
            >

            <input
              id="company"
              class="input"
              placeholder="Company Name"
              required
            >

          </div>


          <div class="two-col">

            <input
              id="loc"
              class="input"
              placeholder="Address"
              required
            >


            <select
              id="jtype"
            >

              <option>
                Full-time
              </option>

              <option>
                Part-time
              </option>

              <option>
                Contract
              </option>

              <option>
                Internship
              </option>

              <option>
                Remote
              </option>

            </select>

          </div>


          <input
            id="salary"
            class="input"
            placeholder="Salary"
          >


          <input
            id="skills"
            class="input"
            placeholder="Skills separated by commas"
          >


          <textarea
            id="desc"
            placeholder="Detailed Job Description"
            required
          ></textarea>


          <button
            class="btn primary"
            type="submit"
          >
            Publish Job
          </button>

        </form>

      </div>


      <br><br>


      <h2>
        Your Posted Jobs
      </h2>


      <br>


      <div class="grid">

        ${
          jobs.map(
            job => `

            <div class="job-card">

              <h3>
                ${esc(job.title)}
              </h3>


              <p>
                ${esc(job.location)}
                ·
                ${esc(job.type)}
              </p>


              <br>


              <span class="status">

                ${job.application_count}
                Applicants

              </span>


              <br><br>


              <button
                class="btn danger"
                onclick="deleteJob(${job.id})"
              >
                Delete
              </button>

            </div>
          `
          ).join("")

          ||

          `
            <div class="card empty">
              You haven't posted any jobs yet.
            </div>
          `
        }

      </div>
      `
    );

  } catch (error) {

    toast(error.message);
  }
}


async function postJob() {

  try {

    await api(
      "/api/jobs",
      {
        method:
          "POST",

        body:
          JSON.stringify({

            title:
              document.getElementById(
                "jt"
              ).value,

            company:
              document.getElementById(
                "company"
              ).value,

            location:
              document.getElementById(
                "loc"
              ).value,

            type:
              document.getElementById(
                "jtype"
              ).value,

            salary:
              document.getElementById(
                "salary"
              ).value,

            skills:
              document.getElementById(
                "skills"
              ).value,

            description:
              document.getElementById(
                "desc"
              ).value
          })
      }
    );


    successModal(
      "Job Published!",
      "Your job is now visible to candidates on NexoraJobs.",
      "Continue",
      () => companyJobsPage()
    );

  } catch (error) {

    toast(error.message);
  }
}


async function deleteJob(id) {

  if (
    !confirm(
      "Are you sure you want to delete this job?"
    )
  ) {

    return;
  }


  try {

    await api(
      `/api/jobs/${id}`,
      {
        method:
          "DELETE"
      }
    );


    toast(
      "Job deleted successfully."
    );


    companyJobsPage();

  } catch (error) {

    toast(error.message);
  }
}


/* =====================================================
   APPLICANTS
===================================================== */

async function applicantsPage() {

  try {

    const applications =
      await api(
        "/api/employer/applications"
      );


    layout(
      "applicants",

      `

      <div class="page-header">

        <div>

          <h1>
            Applicants
          </h1>

          <p>
            Review candidates and manage your hiring pipeline.
          </p>

        </div>

      </div>


      <div class="table-wrap">

        <table class="table">

          <tr>

            <th>
              Candidate
            </th>

            <th>
              Job
            </th>

            <th>
              Email
            </th>

            <th>
              Status
            </th>

            <th>
              Resume
            </th>

          </tr>


          ${
            applications.map(
              item => `

              <tr>

                <td>

                  <b>
                    ${esc(item.seeker_name)}
                  </b>

                  <br>

                  <small class="muted">

                    ${esc(
                      item.seeker_headline || ""
                    )}

                  </small>

                </td>


                <td>
                  ${esc(item.title)}
                </td>


                <td>
                  ${esc(item.seeker_email)}
                </td>


                <td>

                  <select
                    onchange="
                      updateStatus(
                        ${item.id},
                        this.value,
                        ${JSON.stringify(item.seeker_name || "")},
                        ${JSON.stringify(item.title || "")}
                      )
                    "
                  >

                    ${[
                      "Applied",
                      "Under Review",
                      "Shortlisted",
                      "Interview",
                      "Rejected",
                      "Hired"
                    ]
                      .map(
                        status => `

                        <option
                          ${
                            item.status === status
                              ? "selected"
                              : ""
                          }
                        >

                          ${status}

                        </option>
                      `
                      )
                      .join("")}

                  </select>

                </td>


                <td>

                  <a
                    href="${esc(item.resume)}"
                    target="_blank"
                  >
                    View Resume
                  </a>

                </td>

              </tr>
            `
            )
            .join("")

            ||

            `
              <tr>

                <td
                  colspan="5"
                  class="empty"
                >
                  No applicants yet.

                </td>

              </tr>
            `
          }

        </table>

      </div>
      `
    );

  } catch (error) {

    toast(error.message);
  }
}


function openInterviewModal(
  id,
  candidateName,
  jobTitle
) {

  document.getElementById(
    "modalRoot"
  ).innerHTML = `

    <div class="modal">

      <div class="modal-box">

        <div class="page-header">

          <div>

            <h2>
              Schedule Interview
            </h2>

            <p class="muted">
              Add the interview details for this candidate.
            </p>

          </div>

          <button
            class="btn ghost"
            onclick="closeModal()"
            type="button"
          >
            ✕
          </button>

        </div>


        <div class="card">

          <h3>
            Candidate
          </h3>

          <br>

          <p>
            <strong>${esc(candidateName)}</strong>
          </p>

          <p class="muted">
            ${esc(jobTitle)}
          </p>

        </div>


        <br>


        <form
          class="form"
          onsubmit="
            event.preventDefault();
            saveInterview(
              ${id},
              ${JSON.stringify(candidateName)},
              ${JSON.stringify(jobTitle)}
            )
          "
        >

          <div class="two-col">

            <div>

              <label>
                Interview Date
              </label>

              <input
                id="interview_date"
                class="input"
                type="date"
                required
              >

            </div>


            <div>

              <label>
                Interview Time
              </label>

              <input
                id="interview_time"
                class="input"
                type="time"
                required
              >

            </div>

          </div>


          <label>
            Interview Address / Meeting Link
          </label>

          <input
            id="interview_location"
            class="input"
            placeholder="Office address / Google Meet link"
            required
          >


          <label>
            Interview Type
          </label>

          <select
            id="interview_type"
            class="input"
            required
          >

            <option value="In-person">
              In-person
            </option>

            <option value="Video Call">
              Video Call
            </option>

            <option value="Phone Call">
              Phone Call
            </option>

          </select>


          <label>
            Interviewer
          </label>

          <input
            id="interviewer"
            class="input"
            placeholder="Interviewer name"
            required
          >


          <label>
            Additional Notes
          </label>

          <textarea
            id="interview_notes"
            placeholder="Any instructions or notes for the candidate"
          ></textarea>


          <div>

            <button
              class="btn ghost"
              type="button"
              onclick="closeModal()"
            >
              Cancel
            </button>

            <button
              class="btn primary"
              type="submit"
            >
              Schedule Interview
            </button>

          </div>

        </form>

      </div>

    </div>
  `;
}


async function saveInterview(
  id,
  candidateName,
  jobTitle
) {

  try {

    const interviewDate =
      document.getElementById(
        "interview_date"
      ).value;

    const interviewTime =
      document.getElementById(
        "interview_time"
      ).value;

    const interviewLocation =
      document.getElementById(
        "interview_location"
      ).value.trim();

    const interviewType =
      document.getElementById(
        "interview_type"
      ).value;

    const interviewer =
      document.getElementById(
        "interviewer"
      ).value.trim();

    const interviewNotes =
      document.getElementById(
        "interview_notes"
      ).value.trim();


    if (
      !interviewDate ||
      !interviewTime ||
      !interviewLocation ||
      !interviewer
    ) {

      toast(
        "Please fill in all required interview details."
      );

      return;
    }


    await api(
      `/api/applications/${id}`,
      {
        method:
          "PATCH",

        body:
          JSON.stringify({

            status:
              "Interview",

            interview_date:
              interviewDate,

            interview_time:
              interviewTime,

            interview_location:
              interviewLocation,

            interview_type:
              interviewType,

            interviewer:
              interviewer,

            interview_notes:
              interviewNotes

          })
      }
    );


    closeModal();


    successModal(
      "Interview Scheduled!",
      `Interview scheduled for ${candidateName} for the ${jobTitle} position.`,
      "Continue",
      () => applicantsPage()
    );

  } catch (error) {

    toast(error.message);
  }
}


async function updateStatus(
  id,
  status,
  candidateName = "",
  jobTitle = ""
) {

  if (status === "Interview") {

    openInterviewModal(
      id,
      candidateName,
      jobTitle
    );

    return;
  }


  try {

    await api(
      `/api/applications/${id}`,
      {
        method:
          "PATCH",

        body:
          JSON.stringify({
            status
          })
      }
    );


    toast(
      "Application status updated!"
    );

    applicantsPage();

  } catch (error) {

    toast(error.message);
  }
}


/* =====================================================
   VERIFICATION
===================================================== */

function readFileAsDataURL(inputId, allowedTypes, maxBytes, label) {
  return new Promise((resolve, reject) => {
    const input = document.getElementById(inputId);
    const file = input?.files?.[0];
    if (!file) return resolve(null);
    if (!allowedTypes.includes(file.type)) {
      reject(new Error(`Please upload a valid ${label} file.`));
      return;
    }
    if (file.size > maxBytes) {
      reject(new Error(`${label} file must be ${Math.round(maxBytes / (1024 * 1024))} MB or smaller.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result });
    reader.onerror = () => reject(new Error(`Could not read the ${label} file.`));
    reader.readAsDataURL(file);
  });
}

async function verificationPage() {
  try {
    const verification = await api('/api/company-verification');
    layout('verification', `
      <div class="page-header">
        <div>
          <h1>Company Verification</h1>
          <p>Submit an official company document to build trust with candidates.</p>
        </div>
      </div>

      <div class="card">
        <form class="form" onsubmit="event.preventDefault(); saveCompanyVerification()">
          <input id="company_registration" class="input" placeholder="Company Registration Number" value="${esc(verification.registration_number || '')}" required>
          <input id="company_website_verify" class="input" placeholder="Official Company Website" value="${esc(verification.website || '')}" required>
          <input id="company_email_verify" class="input" type="email" placeholder="Official Business Email" value="${esc(verification.business_email || '')}" required>

          <div>
            <label><b>Official Company Proof Type</b></label>
            <select id="verification_proof_type" class="input" required>
              <option value="">Select document type</option>
              <option value="GSTIN" ${verification.proof_type === 'GSTIN' ? 'selected' : ''}>GSTIN</option>
              <option value="Aadhaar Card" ${verification.proof_type === 'Aadhaar Card' ? 'selected' : ''}>Aadhaar Card</option>
              <option value="PAN Card" ${verification.proof_type === 'PAN Card' ? 'selected' : ''}>PAN Card</option>
            </select>
          </div>

          <div>
            <label><b>Upload Official Company Proof</b></label>
            <input id="verification_proof_file" class="input" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" ${verification.proof_file_name ? '' : 'required'}>
            <small class="muted">Upload the selected GSTIN, Aadhaar Card or PAN Card proof (PDF, PNG or JPG, maximum 10 MB). ${verification.proof_file_name ? `Current file: ${esc(verification.proof_file_name)}` : ''}</small>
          </div>

          <button class="btn primary" type="submit">Submit Verification</button>
        </form>
      </div>
    `);
  } catch (error) {
    toast(error.message);
  }
}

async function saveCompanyVerification() {
  try {
    const proof = await readFileAsDataURL(
      'verification_proof_file',
      ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
      10 * 1024 * 1024,
      'company proof'
    );
    await api('/api/company-verification', {
      method: 'PUT',
      body: JSON.stringify({
        registration_number: document.getElementById('company_registration').value,
        website: document.getElementById('company_website_verify').value,
        business_email: document.getElementById('company_email_verify').value,
        proof_type: document.getElementById('verification_proof_type').value,
        proof_file_name: proof?.name,
        proof_file_data: proof?.data,
        proof_file_type: proof?.type
      })
    });
    successModal('Verification Submitted!', 'Your official company proof has been submitted successfully.');
  } catch (error) {
    toast(error.message);
  }
}


/* =====================================================
   COMPANY PROFILE
===================================================== */

async function companyProfilePage() {
  try {
    const profile = await api('/api/company-profile');
    layout('company-profile', `
      <div class="page-header">
        <div>
          <h1>Company Profile</h1>
          <p>Create a strong company presence for candidates.</p>
        </div>
      </div>

      <div class="card">
        <form class="form" onsubmit="event.preventDefault(); saveCompanyProfile()">
          <div>
            <label><b>Company Logo / Photo</b></label>
            <input id="company_logo_file" class="input" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg">
            <small class="muted">Upload your company's official logo or profile photo (PNG or JPG, maximum 5 MB). ${profile.logo_file_name ? `Current file: ${esc(profile.logo_file_name)}` : ''}</small>
            ${profile.logo_file_data ? `<div style="margin-top:12px"><img src="${profile.logo_file_data}" alt="Company logo" style="max-width:140px;max-height:140px;border-radius:16px;object-fit:contain;border:1px solid #ddd;padding:8px"></div>` : ''}
          </div>

          <input id="company_name" class="input" placeholder="Company Name" value="${esc(profile.company_name || '')}" required>
          <input id="industry" class="input" placeholder="Industry" value="${esc(profile.industry || '')}" required>
          <input id="company_location" class="input" placeholder="Company Address" value="${esc(profile.location || '')}" required>
          <input id="website" class="input" placeholder="Company Website" value="${esc(profile.website || '')}">
          <textarea id="company_description" placeholder="Tell candidates about your company">${esc(profile.description || '')}</textarea>

          <button class="btn primary" type="submit">Save Company Profile</button>
        </form>
      </div>
    `);
  } catch (error) {
    toast(error.message);
  }
}


async function saveCompanyProfile() {

  try {
    const logo = await readFileAsDataURL(
      'company_logo_file',
      ['image/png', 'image/jpeg', 'image/jpg'],
      5 * 1024 * 1024,
      'company logo'
    );

    await api(
      "/api/company-profile",
      {
        method:
          "PUT",

        body:
          JSON.stringify({

            company_name:
              document.getElementById(
                "company_name"
              ).value,

            industry:
              document.getElementById(
                "industry"
              ).value,

            location:
              document.getElementById(
                "company_location"
              ).value,

            website:
              document.getElementById(
                "website"
              ).value,

            description:
              document.getElementById(
                "company_description"
              ).value,

            logo_file_name: logo?.name,
            logo_file_data: logo?.data,
            logo_file_type: logo?.type
          })
      }
    );


    successModal(
      "Profile Updated!",
      "Your company profile has been successfully updated."
    );

  } catch (error) {

    toast(error.message);
  }
}
/* =====================================================
   ROLE SELECTION PAGE
===================================================== */

function showRoleSelection() {

  app.innerHTML = `

    <div class="role-selection-page">

      <div class="role-selection-container">

        <div class="role-logo">

          <h1>
            NEXORA<span>JOBS</span>
          </h1>

          <p>
            Find opportunities. Build careers. Hire exceptional talent.
          </p>

        </div>


        <div class="role-selection-header">

          <h2>
            How would you like to continue?
          </h2>

          <p>
            Choose the experience that best describes you.
          </p>

        </div>


        <div class="role-options">


          <!-- CANDIDATE -->

          <div
            class="role-option candidate-option"
            onclick="selectUserRole('seeker')"
          >

            <div class="role-icon">
              👤
            </div>


            <h2>
              I am a Candidate
            </h2>


            <p>
              Discover opportunities, build your professional resume,
              apply to jobs and track your career journey.
            </p>


            <button class="role-btn">
              Explore Jobs →
            </button>

          </div>



          <!-- COMPANY -->

          <div
            class="role-option company-option"
            onclick="selectUserRole('employer')"
          >

            <div class="role-icon">
              🏢
            </div>


            <h2>
              I am a Company
            </h2>


            <p>
              Post opportunities, manage applications and discover
              exceptional candidates for your organisation.
            </p>


            <button class="role-btn">
              Hire Talent →
            </button>

          </div>


        </div>


        <div class="role-footer">

          <p>

            Already have an account?

            <button
              class="login-link"
              onclick="openRoleLogin()"
            >
              Login
            </button>

          </p>

        </div>

      </div>

    </div>

  `;
}


/* =====================================================
   SELECT ROLE
===================================================== */

function selectUserRole(role) {

  // Save selected role
  localStorage.setItem(
    "selectedRole",
    role
  );


  // Open registration with the selected role pre-selected
  showAuth(true);

}


/* =====================================================
   LOGIN FROM START PAGE
===================================================== */

function openRoleLogin() {

  // Clear selected role because login can be either user type
  localStorage.removeItem("selectedRole");


  // Open the login screen
  showAuth(false);

}

/* =====================================================
   START APP
===================================================== */

if (!handleGoogleCallback()) {
  if (user && token) {
    // User is already logged in
    showPage("dashboard");
  } else {
    // Show Candidate / Company selection page first
    showRoleSelection();
  }
}