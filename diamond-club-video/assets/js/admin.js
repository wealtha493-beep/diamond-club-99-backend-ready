/* ============================================================
   DIAMOND CLUB 99 OF EKITI — ADMIN PANEL SHARED UI
   ------------------------------------------------------------
   Sidebar/topbar chrome (same DOM pattern as the members area),
   modal + confirm-dialog helpers, toast, table search/filter,
   and small formatting helpers shared across every admin page.
   ============================================================ */

const DCAdminUI = (function () {

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso + "T00:00:00");
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    } catch (e) { return iso; }
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + "h ago";
    const days = Math.floor(hrs / 24);
    return days + "d ago";
  }

  /* ---------------- Shell: topbar + sidebar ---------------- */
  function initShell(adminLabel) {
    const sidebar = document.getElementById("sidebar");
    const scrim = document.getElementById("sidebarScrim");
    const toggle = document.getElementById("sidebarToggle");

    function closeSidebar() {
      sidebar && sidebar.classList.remove("open");
      scrim && scrim.classList.remove("open");
      toggle && toggle.classList.remove("open");
    }
    function openSidebar() {
      sidebar && sidebar.classList.add("open");
      scrim && scrim.classList.add("open");
      toggle && toggle.classList.add("open");
    }
    toggle && toggle.addEventListener("click", () => {
      sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
    });
    scrim && scrim.addEventListener("click", closeSidebar);
    document.querySelectorAll(".side-nav a").forEach(a => a.addEventListener("click", closeSidebar));

    const current = location.pathname.split("/").pop() || "dashboard.html";
    document.querySelectorAll(".side-nav a[data-page]").forEach(a => {
      if (a.dataset.page === current) a.classList.add("active");
    });

    document.querySelectorAll("[data-dropdown-trigger]").forEach(trigger => {
      const panel = document.getElementById(trigger.getAttribute("data-dropdown-trigger"));
      if (!panel) return;
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = panel.classList.contains("open");
        document.querySelectorAll(".dropdown-panel.open").forEach(p => p.classList.remove("open"));
        if (!isOpen) panel.classList.add("open");
      });
    });
    document.addEventListener("click", () => {
      document.querySelectorAll(".dropdown-panel.open").forEach(p => p.classList.remove("open"));
    });

    document.querySelectorAll("[data-logout]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (window.DCAdminAuth) window.DCAdminAuth.logout();
        location.href = "login.html";
      });
    });

    if (adminLabel) {
      document.querySelectorAll("[data-admin-name]").forEach(el => el.textContent = adminLabel);
    }
  }

  /* ---------------- Modal ---------------- */
  function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("open");
    document.body.style.overflow = "";
  }
  function initModalDismiss() {
    document.querySelectorAll(".modal-scrim").forEach(scrim => {
      scrim.addEventListener("click", (e) => { if (e.target === scrim) closeModal(scrim.id); });
    });
    document.querySelectorAll("[data-modal-close]").forEach(btn => {
      btn.addEventListener("click", () => closeModal(btn.getAttribute("data-modal-close")));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-scrim.open").forEach(m => closeModal(m.id));
      }
    });
  }

  /* ---------------- Confirm dialog ---------------- */
  let confirmCallback = null;
  function confirmAction(message, onConfirm, title) {
    const modal = document.getElementById("confirmModal");
    if (!modal) { if (window.confirm(message)) onConfirm(); return; }
    document.getElementById("confirmModalText").textContent = message;
    if (title) document.getElementById("confirmModalTitle").textContent = title;
    confirmCallback = onConfirm;
    openModal("confirmModal");
  }
  function initConfirmModal() {
    const btn = document.getElementById("confirmModalAction");
    if (!btn) return;
    btn.addEventListener("click", () => {
      closeModal("confirmModal");
      if (confirmCallback) { confirmCallback(); confirmCallback = null; }
    });
  }

  /* ---------------- Toast ---------------- */
  function toast(message) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2400);
  }

  /* ---------------- Table search/filter ---------------- */
  function initSearch(inputId, rowSelector, matchFn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      document.querySelectorAll(rowSelector).forEach(row => {
        row.style.display = matchFn(row, q) ? "" : "none";
      });
    });
  }

  function statusBadge(status) {
    const map = { Active: "st-active", Pending: "st-pending", Inactive: "st-inactive" };
    return `<span class="st ${map[status] || "st-inactive"}">${status}</span>`;
  }

  function publishToggle(id, published, entity) {
    return `<label class="toggle" title="${published ? 'Published' : 'Draft'}">
      <input type="checkbox" ${published ? "checked" : ""} data-publish-toggle="${entity}" data-id="${id}">
      <span class="track"></span>
    </label>`;
  }

  return {
    formatDate, timeAgo, initShell, openModal, closeModal, initModalDismiss,
    confirmAction, initConfirmModal, toast, initSearch, statusBadge, publishToggle
  };
})();
