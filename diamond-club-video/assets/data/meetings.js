/* ============================================================
   PLACEHOLDER DATA — MEETINGS
   ------------------------------------------------------------
   The recurring schedule (last Sunday of each month, 3:00 PM,
   venue approved by the General House) comes directly from
   Section 21 of the Club constitution. Specific dates, venues
   and notices below are SAMPLE DATA to be updated by an
   administrator (e.g. from GET /api/meetings).
   ============================================================ */
window.DC_DATA = window.DC_DATA || {};

window.DC_DATA.meetings = [
  {
    isPlaceholder: true,
    id: "mtg-upcoming-1",
    status: "upcoming",
    title: "Monthly General Meeting",
    date: "2026-01-25",
    time: "3:00 PM",
    location: "Venue to be approved by the General House",
    type: "General Meeting",
    notice: "Per the constitution, this meeting holds on the last Sunday of the month. Members are encouraged to confirm attendance."
  },
  {
    isPlaceholder: true,
    id: "mtg-upcoming-2",
    status: "upcoming",
    title: "Executive Committee Meeting",
    date: "2026-01-11",
    time: "Time to be confirmed",
    location: "Venue to be approved by the Committee / President",
    type: "Executive Committee",
    notice: "Closed session — Executive Members only, as provided in Section 21(ii) of the constitution."
  },
  {
    isPlaceholder: true,
    id: "mtg-past-1",
    status: "past",
    title: "Monthly General Meeting",
    date: "2025-11-30",
    time: "3:00 PM",
    location: "Venue approved by the General House",
    type: "General Meeting",
    notice: "Minutes circulated by the Secretary's office ahead of the next meeting."
  },
  {
    isPlaceholder: true,
    id: "mtg-past-2",
    status: "past",
    title: "Monthly General Meeting",
    date: "2025-10-26",
    time: "3:00 PM",
    location: "Venue approved by the General House",
    type: "General Meeting",
    notice: "Quarterly financial update presented by the Financial Secretary."
  }
];
