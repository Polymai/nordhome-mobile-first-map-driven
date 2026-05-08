import { escapeHtml } from "./shell.js";
import { APP_CONFIG, formatMinorMoney } from "../config.js";

const publishPlan = APP_CONFIG.publishPlans.standard_publish;

function publishPriceLabel() {
  return formatMinorMoney(publishPlan.amount, publishPlan.currency);
}

function listingStatus(listing) {
  return `<span class="pill">${escapeHtml((listing.status || "draft").replace("_", " "))}</span>`;
}

function formatPaymentAmount(payment) {
  const amount = Number(payment.amount_total || 0) / 100;
  if (!amount) return "Amount pending";
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: (payment.currency || "sek").toUpperCase(),
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPaymentDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium" }).format(date);
}

function paymentRecords(state) {
  if (!state.payments.length) return `<p class="muted">No listing payments yet.</p>`;

  return state.payments
    .map((payment) => {
      const paymentDate = formatPaymentDate(payment.paid_at || payment.updated_at || payment.created_at);
      const invoiceCopy = payment.stripe_invoice_id
        ? `Invoice ${payment.stripe_invoice_id}`
        : "Receipt details appear here after payment is complete.";
      const status = String(payment.payment_status || "pending").replace("_", " ");
      const paymentLabel = `Nordhome listing publish${paymentDate ? ` - ${paymentDate}` : ""}`;
      return `
        <div class="management-item payment-item">
          <div class="listing-title-row">
            <strong>${escapeHtml(formatPaymentAmount(payment))}</strong>
            <span class="pill">${escapeHtml(status)}</span>
          </div>
          <p class="muted">${escapeHtml(paymentLabel)}</p>
          <small class="muted">${escapeHtml(invoiceCopy)}</small>
        </div>
      `;
    })
    .join("");
}

function accountSection({ eyebrow, title, summary, body, open = false }) {
  return `
    <details class="account-section" ${open ? "open" : ""}>
      <summary>
        <span>
          ${eyebrow ? `<span class="eyebrow">${escapeHtml(eyebrow)}</span>` : ""}
          <strong>${escapeHtml(title)}</strong>
          ${summary ? `<small>${escapeHtml(summary)}</small>` : ""}
        </span>
      </summary>
      <div class="account-section-body">
        ${body}
      </div>
    </details>
  `;
}

function authView(state) {
  return `
    <section class="section-heading">
      <div>
        <p class="eyebrow">Account</p>
        <h1>Sign in to save, list, and publish.</h1>
        <p>Use your account to save favorites, publish listings, and manage billing.</p>
      </div>
    </section>
    <section class="account-grid">
      <form class="auth-panel" data-form="sign-in">
        <h2>Sign in</h2>
        <label class="field"><span>Email</span><input name="email" type="email" required autocomplete="email" /></label>
        <label class="field"><span>Password</span><input name="password" type="password" required autocomplete="current-password" /></label>
        <button class="button" type="submit">${state.loading.action ? "Working..." : "Sign in"}</button>
      </form>
      <form class="auth-panel" data-form="sign-up">
        <h2>Create account</h2>
        <label class="field"><span>Name</span><input name="fullName" required autocomplete="name" /></label>
        <label class="field"><span>Email</span><input name="email" type="email" required autocomplete="email" /></label>
        <label class="field"><span>Password</span><input name="password" type="password" required autocomplete="new-password" minlength="6" /></label>
        <button class="button secondary" type="submit">Create account</button>
      </form>
    </section>
  `;
}

function sellerListings(state) {
  if (!state.userListings.length) {
    return `<div class="empty-card"><h3>No seller listings yet.</h3><p class="muted">Create your first draft from the listing workspace.</p><a class="button" href="#/create">Create listing</a></div>`;
  }

  function listingActions(listing) {
    const status = listing.status || "draft";
    const publishable = ["draft", "pending_payment", "payment_failed"].includes(status);
    const published = status === "published";
    return `
      <div class="toolbar">
        <a class="button secondary" href="#/create?listing=${encodeURIComponent(listing.id)}">Edit</a>
        ${
          publishable
            ? `<button class="button copper" type="button" data-publish="${escapeHtml(listing.id)}">Pay ${escapeHtml(publishPriceLabel())}</button>`
            : ""
        }
        ${
          published
            ? `<a class="button secondary" href="#/listing/${encodeURIComponent(listing.id)}">View listing</a>`
            : ""
        }
        ${
          status !== "archived"
            ? `<button class="button ghost" type="button" data-archive="${escapeHtml(listing.id)}">Archive</button>`
            : ""
        }
      </div>
    `;
  }

  return `
    <div class="management-list">
      ${state.userListings
        .map(
          (listing) => `
            <article class="management-item">
              <div class="listing-title-row">
                <strong>${escapeHtml(listing.title)}</strong>
                ${listingStatus(listing)}
              </div>
              <p class="muted">${escapeHtml([listing.city, listing.address].filter(Boolean).join(", "))}</p>
              ${listingActions(listing)}
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function signedInView(state) {
  const profile = state.profile || {};
  const company = state.companies[0] || {};
  const profileSummary = [profile.full_name || state.user.email, profile.role || "buyer"].filter(Boolean).join(" · ");
  const companySummary = company.name ? [company.name, company.city].filter(Boolean).join(" · ") : "No company profile yet";
  const cleanProfileSummary = [profile.full_name || state.user.email, profile.role || "buyer"].filter(Boolean).join(" - ");
  const cleanCompanySummary = company.name ? [company.name, company.city].filter(Boolean).join(" - ") : "No company profile yet";
  const listingSummary = state.userListings.length
    ? `${state.userListings.length} listing${state.userListings.length === 1 ? "" : "s"}`
    : "No listings yet";
  const paymentSummary = state.payments.length
    ? `${state.payments.length} payment record${state.payments.length === 1 ? "" : "s"}`
    : "No payments yet";
  return `
    <section class="section-heading">
      <div>
        <p class="eyebrow">Account</p>
        <h1>Manage your Nordhome workspace.</h1>
        <p>Open only the sections you need.</p>
      </div>
    </section>
    <section class="account-grid">
      <div class="management-list">
        ${accountSection({
          eyebrow: "Seller listings",
          title: "Your drafts and published homes",
          summary: listingSummary,
          open: true,
          body: sellerListings(state),
        })}
        ${accountSection({
          eyebrow: "Profile",
          title: "Personal details",
          summary: cleanProfileSummary,
          body: `
            <form class="account-form" data-form="profile">
              <div class="form-grid two">
                <label class="field"><span>Name</span><input name="full_name" value="${escapeHtml(profile.full_name || "")}" /></label>
                <label class="field"><span>Phone</span><input name="phone" value="${escapeHtml(profile.phone || "")}" /></label>
                <label class="field"><span>Role</span><select name="role">
                  <option value="buyer" ${profile.role === "buyer" ? "selected" : ""}>Buyer</option>
                  <option value="seller" ${profile.role === "seller" ? "selected" : ""}>Seller</option>
                  <option value="admin" ${profile.role === "admin" ? "selected" : ""}>Admin</option>
                </select></label>
              </div>
              <button class="button" type="submit">Save profile</button>
            </form>
          `,
        })}
        ${accountSection({
          eyebrow: "Company",
          title: "Seller company",
          summary: cleanCompanySummary,
          body: `
            <form class="account-form" data-form="company">
              <input type="hidden" name="id" value="${escapeHtml(company.id || "")}" />
              <div class="form-grid two">
                <label class="field"><span>Company name</span><input name="name" required value="${escapeHtml(company.name || "")}" /></label>
                <label class="field"><span>City</span><input name="city" value="${escapeHtml(company.city || "")}" /></label>
                <label class="field"><span>Email</span><input name="email" type="email" value="${escapeHtml(company.email || state.user.email || "")}" /></label>
                <label class="field"><span>Phone</span><input name="phone" value="${escapeHtml(company.phone || "")}" /></label>
                <label class="field"><span>Website</span><input name="website" value="${escapeHtml(company.website || "")}" /></label>
              </div>
              <label class="field"><span>Description</span><textarea name="description">${escapeHtml(company.description || "")}</textarea></label>
              <button class="button secondary" type="submit">Save company</button>
            </form>
          `,
        })}
      </div>
      <aside class="management-list">
        ${accountSection({
          eyebrow: "Billing",
          title: "Invoices and payment methods",
          summary: profile.stripe_customer_id ? "Billing ready" : "No billing history yet",
          body: `
            <p class="muted">View receipts, invoices, and payment methods for your Nordhome listing purchases.</p>
            ${
              profile.stripe_customer_id
                ? `<button class="button" type="button" data-action="billing-portal">Open billing</button>`
                : `<div class="status-card"><strong>No billing history yet.</strong><p>Publish a listing once to enable receipts and billing tools.</p></div>`
            }
          `,
        })}
        ${accountSection({
          eyebrow: "Payments",
          title: "Listing payment status",
          summary: paymentSummary,
          open: Boolean(state.payments.length),
          body: `
            <div class="management-list">
              ${paymentRecords(state)}
            </div>
          `,
        })}
      </aside>
    </section>
    <section class="account-sign-out-panel">
      <button class="button secondary" type="button" data-action="account-sign-out">Sign out</button>
    </section>
  `;
}

export function renderAccount(state) {
  return state.user ? signedInView(state) : authView(state);
}

export function renderSuccess(state) {
  const sessionId = state.route.query.get("session_id") || "";
  const status = state.successStatus;
  const paid = status?.payment_status === "paid";
  const missingSession = !sessionId;
  return `
    <section class="success-view">
      <div class="status-card ${paid ? "success" : missingSession ? "error" : ""}">
        <p class="eyebrow">Publish return</p>
        <h1>${paid ? "Your listing is published." : missingSession ? "We could not check the payment." : "Checking payment status."}</h1>
        <p class="muted">${
          paid
            ? "Your payment has been confirmed and the listing is ready in your account."
            : missingSession
              ? "Open your account to check the latest listing status."
              : "Nordhome is confirming the payment and updating your listing."
        }</p>
      </div>
      <div class="toolbar">
        <a class="button" href="#/account">Open account</a>
        <a class="button secondary" href="#/browse">Browse listings</a>
      </div>
    </section>
  `;
}

export function bindAccountEvents({
  onSignIn,
  onSignUp,
  onProfile,
  onCompany,
  onBilling,
  onPublish,
  onArchive,
  onSignOut,
}) {
  document.querySelector('[data-form="sign-in"]')?.addEventListener("submit", (event) => {
    event.preventDefault();
    onSignIn(new FormData(event.currentTarget));
  });
  document.querySelector('[data-form="sign-up"]')?.addEventListener("submit", (event) => {
    event.preventDefault();
    onSignUp(new FormData(event.currentTarget));
  });
  document.querySelector('[data-form="profile"]')?.addEventListener("submit", (event) => {
    event.preventDefault();
    onProfile(new FormData(event.currentTarget));
  });
  document.querySelector('[data-form="company"]')?.addEventListener("submit", (event) => {
    event.preventDefault();
    onCompany(new FormData(event.currentTarget));
  });
  document.querySelector('[data-action="billing-portal"]')?.addEventListener("click", onBilling);
  document.querySelector('[data-action="account-sign-out"]')?.addEventListener("click", onSignOut);
  document.querySelectorAll("[data-publish]").forEach((button) => {
    button.addEventListener("click", () => onPublish(button.dataset.publish, button));
  });
  document.querySelectorAll("[data-archive]").forEach((button) => {
    button.addEventListener("click", () => onArchive(button.dataset.archive));
  });
}
