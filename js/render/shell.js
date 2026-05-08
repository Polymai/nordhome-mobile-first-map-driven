function active(route, name) {
  return route.name === name ? "active" : "";
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function navItems(route) {
  return `
    <a class="nav-link ${active(route, "browse")}" href="#/browse">Browse</a>
    <a class="nav-link ${active(route, "map")}" href="#/map">Areas</a>
    <a class="nav-link ${active(route, "favorites")}" href="#/favorites">Favorites</a>
    <a class="nav-link ${active(route, "create")}" href="#/create">List</a>
    <a class="nav-link ${active(route, "account")}" href="#/account">Account</a>
  `;
}

function mobileNav(route) {
  return `
    <nav class="mobile-nav" aria-label="Primary mobile navigation">
      <a class="nav-link ${active(route, "browse")}" href="#/browse"><span>Browse</span></a>
      <a class="nav-link ${active(route, "map")}" href="#/map"><span>Areas</span></a>
      <a class="nav-link ${active(route, "favorites")}" href="#/favorites"><span>Saved</span></a>
      <a class="nav-link ${active(route, "create")}" href="#/create"><span>List</span></a>
      <a class="nav-link ${active(route, "account")}" href="#/account"><span>Account</span></a>
    </nav>
  `;
}

export function renderShell(state, outletHtml) {
  const signedIn = Boolean(state.user);
  const profileName = state.profile && state.profile.full_name ? state.profile.full_name : "";
  return `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-inner">
          <a class="wordmark" href="#/browse" aria-label="Nordhome home">
            <strong>Nordhome</strong>
            <span>Nordic property marketplace</span>
          </a>
          <nav class="desktop-nav" aria-label="Primary navigation">
            ${navItems(state.route)}
          </nav>
          <div class="topbar-actions">
            ${
              signedIn
                ? `<a class="button secondary" href="#/account">${escapeHtml(profileName || "Account")}</a>
                   <button class="icon-button" type="button" data-action="sign-out" aria-label="Sign out">Out</button>`
                : `<a class="button secondary" href="#/account">Sign in</a>`
            }
          </div>
        </div>
      </header>
      <main id="route-outlet" class="route-outlet">${outletHtml}</main>
      ${mobileNav(state.route)}
      <div id="drawer-root"></div>
      ${
        state.notice
          ? `<aside class="notice ${state.notice.tone === "error" ? "error" : ""}" role="status">
              <div class="toolbar">
                <p>${escapeHtml(state.notice.message)}</p>
                <button class="text-button" type="button" data-action="clear-notice">Dismiss</button>
              </div>
            </aside>`
          : ""
      }
    </div>
  `;
}

export function bindShellEvents({ onSignOut, onClearNotice }) {
  document.querySelector('[data-action="sign-out"]')?.addEventListener("click", onSignOut);
  document.querySelector('[data-action="clear-notice"]')?.addEventListener("click", onClearNotice);
}
