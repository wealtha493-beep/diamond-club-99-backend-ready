/* ============================================================
   DIAMOND CLUB 99 OF EKITI — MEMBERS AREA SHARED UI
   ------------------------------------------------------------
   Sidebar/topbar chrome, dropdowns, tabs, lightbox, read-more
   toggles and small render helpers shared across every members
   page. Each page's own inline script calls into DCUI to render
   its specific data-driven sections.
   ============================================================ */

const DCUI = (function () {

  function formatDate(iso) {
    try {
      const d = new Date(iso + "T00:00:00");
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    } catch (e) {
      return iso;
    }
  }

  function dayMonth(iso) {
    const d = new Date(iso + "T00:00:00");
    return {
      dd: d.toLocaleDateString("en-GB", { day: "2-digit" }),
      mm: d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase()
    };
  }

  function sampleBadge() {
    return '<span class="sample-tag">Sample data</span>';
  }

  /* ---------------- Shell: topbar + sidebar + dropdowns ---------------- */
  function initShell(memberName) {
    const sidebar = document.getElementById("sidebar");
    const scrim = document.getElementById("sidebarScrim");
    const toggle = document.getElementById("sidebarToggle");

    function closeSidebar() {
      sidebar && sidebar.classList.remove("open");
      scrim && scrim.classList.remove("open");
      toggle && toggle.classList.remove("open");
      toggle && toggle.setAttribute("aria-expanded", "false");
    }
    function openSidebar() {
      sidebar && sidebar.classList.add("open");
      scrim && scrim.classList.add("open");
      toggle && toggle.classList.add("open");
      toggle && toggle.setAttribute("aria-expanded", "true");
    }
    if (toggle) {
      toggle.addEventListener("click", () => {
        sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
      });
    }
    scrim && scrim.addEventListener("click", closeSidebar);
    document.querySelectorAll(".side-nav a").forEach(a => a.addEventListener("click", closeSidebar));

    // Highlight active nav item by current filename
    const current = location.pathname.split("/").pop() || "dashboard.html";
    document.querySelectorAll(".side-nav a[data-page]").forEach(a => {
      if (a.dataset.page === current) a.classList.add("active");
    });

    // Dropdowns (notifications + profile)
    document.querySelectorAll("[data-dropdown-trigger]").forEach(trigger => {
      const panelId = trigger.getAttribute("data-dropdown-trigger");
      const panel = document.getElementById(panelId);
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

    // Logout (any element with data-logout)
    document.querySelectorAll("[data-logout]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (window.DCAuth) window.DCAuth.logout();
        location.href = "login.html";
      });
    });

    // Fill member name placeholders
    if (memberName) {
      document.querySelectorAll("[data-member-name]").forEach(el => el.textContent = memberName);
    }
  }

  /* ---------------- Read more toggles (announcements/news) ---------------- */
  function initReadMore(container) {
    (container || document).querySelectorAll(".read-more").forEach(btn => {
      btn.addEventListener("click", () => {
        const card = btn.closest(".post-card");
        const full = card.querySelector(".full-text");
        const open = full.classList.toggle("open");
        btn.querySelector("span").textContent = open ? "Show less" : "Read more";
        btn.classList.toggle("is-open", open);
      });
    });
  }

  /* ---------------- Tabs ---------------- */
  function initTabs(scope) {
    const root = scope || document;
    root.querySelectorAll(".tabs").forEach(tabGroup => {
      const buttons = tabGroup.querySelectorAll(".tab-btn");
      buttons.forEach(btn => {
        btn.addEventListener("click", () => {
          const target = btn.dataset.tabTarget;
          buttons.forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          const panelGroup = document.querySelectorAll("[data-tab-panel]");
          panelGroup.forEach(p => {
            p.classList.toggle("active", p.dataset.tabPanel === target);
          });
        });
      });
    });
  }

  /* ---------------- Gallery filters ---------------- */
  function initGalleryFilters() {
    const chips = document.querySelectorAll(".filter-chip");
    const items = document.querySelectorAll(".mem-gallery-item");
    chips.forEach(chip => {
      chip.addEventListener("click", () => {
        chips.forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        const cat = chip.dataset.filter;
        items.forEach(item => {
          const show = cat === "all" || item.dataset.category === cat;
          item.style.display = show ? "" : "none";
        });
      });
    });
  }

  /* ---------------- Lightbox (gallery) ---------------- */
  function initLightbox() {
    const items = Array.from(document.querySelectorAll(".mem-gallery-item"));
    const lightbox = document.getElementById("memLightbox");
    if (!lightbox || items.length === 0) return;
    const imgEl = document.getElementById("memLightboxImg");
    const capEl = document.getElementById("memLightboxCaption");
    let currentIndex = 0;

    function visibleItems() {
      return items.filter(i => i.style.display !== "none");
    }

    function show(index) {
      const list = visibleItems();
      if (list.length === 0) return;
      currentIndex = (index + list.length) % list.length;
      const item = list[currentIndex];
      const img = item.querySelector("img");
      imgEl.src = img.src;
      imgEl.alt = img.alt;
      capEl.textContent = item.dataset.caption || "";
    }

    items.forEach((item) => {
      item.addEventListener("click", () => {
        const list = visibleItems();
        const idx = list.indexOf(item);
        show(idx);
        lightbox.classList.add("open");
        document.body.style.overflow = "hidden";
      });
    });

    function close() {
      lightbox.classList.remove("open");
      document.body.style.overflow = "";
    }

    document.getElementById("memLightboxClose").addEventListener("click", close);
    lightbox.addEventListener("click", (e) => { if (e.target === lightbox) close(); });
    document.getElementById("memLightboxPrev").addEventListener("click", () => show(currentIndex - 1));
    document.getElementById("memLightboxNext").addEventListener("click", () => show(currentIndex + 1));
    document.addEventListener("keydown", (e) => {
      if (!lightbox.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(currentIndex - 1);
      if (e.key === "ArrowRight") show(currentIndex + 1);
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

  /* ---------------- Render helpers ---------------- */
  function renderAnnouncementCard(item) {
    return `
    <article class="post-card reveal">
      <div class="thumb"><img src="${item.image}" alt="${item.title}" loading="lazy"></div>
      <div class="body">
        <div class="meta-row">
          <span class="tag-chip">${item.category}</span>
          <span class="post-date">${formatDate(item.date)}</span>
          ${item.isPlaceholder ? sampleBadge() : ""}
        </div>
        <h3>${item.title}</h3>
        <p class="excerpt">${item.excerpt}</p>
        <div class="full-text">${item.body}</div>
        <button class="read-more" type="button"><span>Read more</span> &rarr;</button>
      </div>
    </article>`;
  }

  function renderNewsCard(item) {
    return renderAnnouncementCard(item); // same visual pattern
  }

  function renderProjectCard(item) {
    const statusLabel = item.status.charAt(0).toUpperCase() + item.status.slice(1);
    return `
    <article class="project-card reveal">
      <div class="thumb"><img src="${item.image}" alt="${item.title}" loading="lazy"></div>
      <div class="body">
        <div class="p-top">
          <h3>${item.title}</h3>
          <span class="status-badge ${item.status}">${statusLabel}</span>
        </div>
        <p>${item.description}</p>
        <div class="p-date">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          ${item.date}
        </div>
        ${item.isPlaceholder ? `<div style="margin-top:10px;">${sampleBadge()}</div>` : ""}
      </div>
    </article>`;
  }

  function renderOfficerCard(item) {
    return `
    <article class="officer-card reveal">
      <div class="officer-photo"><img src="${item.photo}" alt="${item.name}"></div>
      <h3>${item.name}</h3>
      <div class="position">${item.position}</div>
      <p class="desc">${item.description}</p>
      <div class="tenure">${item.tenure}</div>
      ${item.isPlaceholder ? `<div style="margin-top:10px;">${sampleBadge()}</div>` : ""}
    </article>`;
  }

  function renderMeetingItem(item) {
    const { dd, mm } = dayMonth(item.date);
    return `
    <div class="meeting-item reveal">
      <div class="meeting-date-badge"><div class="dd">${dd}</div><div class="mm">${mm}</div></div>
      <div class="meeting-info" style="flex:1;">
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:space-between;">
          <h4>${item.title}</h4>
          <span class="status-pill ${item.status}">${item.status === "upcoming" ? "Upcoming" : "Past"}</span>
        </div>
        <div class="m-detail"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>${item.time}</div>
        <div class="m-detail"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 10c0 5.5-8 12-8 12s-8-6.5-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${item.location}</div>
        <div class="m-detail"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/></svg>${item.type}</div>
        ${item.notice ? `<div class="meeting-notice">${item.notice}</div>` : ""}
        ${item.isPlaceholder ? `<div style="margin-top:10px;">${sampleBadge()}</div>` : ""}
      </div>
    </div>`;
  }

  function renderGalleryItem(item) {
    return `
    <div class="mem-gallery-item reveal" data-caption="${item.caption}" data-category="${item.category}">
      <img src="${item.image}" alt="${item.caption}" loading="lazy">
    </div>`;
  }

  return {
    formatDate, dayMonth, sampleBadge, initShell, initReadMore, initTabs,
    initGalleryFilters, initLightbox, toast,
    renderAnnouncementCard, renderNewsCard, renderProjectCard,
    renderOfficerCard, renderMeetingItem, renderGalleryItem
  };
})();

/* Note: the members area intentionally does not use scroll-triggered
   reveal animations — content should never be hidden pending a scroll
   event on an internal dashboard. See assets/css/members.css (.reveal). */
