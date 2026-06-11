# Verification screenshots

Browser (Playwright + system Chrome) click-through of a fragments-mode
benchmark app (`bench fragments task r1`), proving the generic kit renders and
functions end-to-end:

- `1-dashboard.png` — Dashboard: StatsRow KPI cards + ChartCard (live recharts
  bar chart of tasks by status) + app.json sidebar nav.
- `2-tasklist.png` — Tasks page: PageHeader (New Task), FilterBar (search +
  Status/Priority selects), DataTable with typed columns (badges, formatted
  dates) and per-row Edit/Delete.
- `5-edit-prefill.png` — RecordFormDialog opened in EDIT mode with every field
  prefilled (Title/Description/Status/Priority/Due Date) + "saved successfully"
  toast — confirms the `$cond` prefill path and save→toast→refresh.
