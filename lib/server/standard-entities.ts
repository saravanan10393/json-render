import type { EntityDefinition } from "./entity-store";

/**
 * The standard e-commerce entity contracts fragments are written against
 * (field ids are FIXED — see fragments/ecommerce/index.ts). Used by the
 * fragment test harness, the draft evaluator, and the studio sandbox seeder.
 */
export const STANDARD_ENTITIES: EntityDefinition[] = [
  {
    name: "Product",
    label: "Products",
    fields: [
      { id: "Name", name: "Name", type: "text" },
      { id: "Description", name: "Description", type: "text" },
      { id: "Price", name: "Price", type: "number" },
      { id: "Category", name: "Category", type: "select", options: ["Audio", "Wearables", "Accessories"] },
      { id: "ImageUrl", name: "Image URL", type: "text" },
      { id: "Rating", name: "Rating", type: "number" },
      { id: "Stock", name: "Stock", type: "number" },
    ],
  },
  {
    name: "CartItem",
    label: "Cart items",
    fields: [
      { id: "ProductId", name: "Product id", type: "text" },
      { id: "Name", name: "Name", type: "text" },
      { id: "Price", name: "Price", type: "number" },
      { id: "Quantity", name: "Quantity", type: "number" },
      { id: "LineTotal", name: "Line total", type: "number" },
    ],
  },
  {
    name: "Order",
    label: "Orders",
    fields: [
      { id: "CustomerName", name: "Customer", type: "text" },
      { id: "Email", name: "Email", type: "text" },
      { id: "Address", name: "Address", type: "text" },
      { id: "City", name: "City", type: "text" },
      { id: "Zip", name: "Zip", type: "text" },
      { id: "Status", name: "Status", type: "select", options: ["Placed", "Shipped", "Delivered", "Cancelled"] },
      { id: "Total", name: "Total", type: "number" },
      { id: "PlacedAt", name: "Placed at", type: "date" },
    ],
  },
  {
    name: "Review",
    label: "Reviews",
    fields: [
      { id: "ProductId", name: "Product id", type: "text" },
      { id: "Author", name: "Author", type: "text" },
      { id: "Rating", name: "Rating", type: "number" },
      { id: "Title", name: "Title", type: "text" },
      { id: "Body", name: "Body", type: "text" },
      { id: "CreatedAt", name: "Created at", type: "date" },
    ],
  },
  // CRM entity contracts (field ids are FIXED — see fragments/crm/index.ts).
  // The crm bundle hardcodes these bdo names in build(), so the test harness
  // and studio sandbox must define them for those fragments to validate.
  {
    name: "Contact",
    label: "Contacts",
    fields: [
      { id: "Name", name: "Name", type: "text" },
      { id: "Email", name: "Email", type: "text" },
      { id: "Phone", name: "Phone", type: "text" },
      { id: "Company", name: "Company", type: "text" },
      { id: "Title", name: "Title", type: "text" },
      { id: "Status", name: "Status", type: "select", options: ["Lead", "Active", "Inactive"] },
    ],
  },
  {
    name: "Deal",
    label: "Deals",
    fields: [
      { id: "Name", name: "Name", type: "text" },
      { id: "ContactName", name: "Contact name", type: "text" },
      { id: "Company", name: "Company", type: "text" },
      { id: "Value", name: "Value", type: "number" },
      { id: "Stage", name: "Stage", type: "select", options: ["Lead", "Qualified", "Proposal", "Won", "Lost"] },
      { id: "CloseDate", name: "Close date", type: "date" },
      { id: "Owner", name: "Owner", type: "text" },
    ],
  },
  {
    name: "Activity",
    label: "Activities",
    fields: [
      { id: "Subject", name: "Subject", type: "text" },
      { id: "Type", name: "Type", type: "select", options: ["Call", "Email", "Meeting", "Note"] },
      { id: "RelatedTo", name: "Related to", type: "text" },
      { id: "Date", name: "Date", type: "date" },
      { id: "Notes", name: "Notes", type: "text" },
    ],
  },
  // Helpdesk entity contracts (field ids are FIXED — see fragments/helpdesk/index.ts).
  // The helpdesk bundle hardcodes these bdo names in build(), so the test harness
  // and studio sandbox must define them for those fragments to validate.
  {
    name: "Ticket",
    label: "Tickets",
    fields: [
      { id: "Subject", name: "Subject", type: "text" },
      { id: "Description", name: "Description", type: "text" },
      { id: "Status", name: "Status", type: "select", options: ["Open", "In Progress", "Waiting", "Resolved", "Closed"] },
      { id: "Priority", name: "Priority", type: "select", options: ["Low", "Medium", "High", "Urgent"] },
      { id: "Requester", name: "Requester", type: "text" },
      { id: "Assignee", name: "Assignee", type: "text" },
      { id: "Category", name: "Category", type: "select", options: ["Billing", "Technical", "Account", "General"] },
      { id: "CreatedAt", name: "Created at", type: "date" },
    ],
  },
  {
    name: "Agent",
    label: "Agents",
    fields: [
      { id: "Name", name: "Name", type: "text" },
      { id: "Email", name: "Email", type: "text" },
      { id: "Team", name: "Team", type: "select", options: ["Tier 1", "Tier 2", "Escalations"] },
      { id: "ResolvedCount", name: "Resolved count", type: "number" },
    ],
  },
  {
    name: "Reply",
    label: "Replies",
    fields: [
      { id: "TicketId", name: "Ticket id", type: "text" },
      { id: "Author", name: "Author", type: "text" },
      { id: "Body", name: "Body", type: "text" },
      { id: "CreatedAt", name: "Created at", type: "date" },
      { id: "Internal", name: "Internal", type: "boolean" },
    ],
  },
  // Blog/CMS entity contracts (field ids are FIXED — see fragments/blog/index.ts).
  // The blog bundle hardcodes these bdo names in build(), so the test harness
  // and studio sandbox must define them for those fragments to validate.
  {
    name: "Post",
    label: "Posts",
    fields: [
      { id: "Title", name: "Title", type: "text" },
      { id: "Slug", name: "Slug", type: "text" },
      { id: "Excerpt", name: "Excerpt", type: "text" },
      { id: "Body", name: "Body", type: "text" },
      { id: "AuthorName", name: "Author name", type: "text" },
      { id: "Category", name: "Category", type: "select", options: ["General", "Technology", "Design", "Business", "News"] },
      { id: "Status", name: "Status", type: "select", options: ["Draft", "Published", "Archived"] },
      { id: "CoverUrl", name: "Cover URL", type: "text" },
      { id: "PublishedAt", name: "Published at", type: "date" },
    ],
  },
  {
    name: "Author",
    label: "Authors",
    fields: [
      { id: "Name", name: "Name", type: "text" },
      { id: "Bio", name: "Bio", type: "text" },
      { id: "AvatarUrl", name: "Avatar URL", type: "text" },
      { id: "Email", name: "Email", type: "text" },
    ],
  },
  {
    name: "Category",
    label: "Categories",
    fields: [
      { id: "Name", name: "Name", type: "text" },
      { id: "Description", name: "Description", type: "text" },
    ],
  },
  // Projects entity contracts (field ids are FIXED — see fragments/projects/index.ts).
  // The projects bundle hardcodes these bdo names in build(), so the test
  // harness and studio sandbox must define them for those fragments to validate.
  {
    name: "Project",
    label: "Projects",
    fields: [
      { id: "Name", name: "Name", type: "text" },
      { id: "Description", name: "Description", type: "text" },
      { id: "Status", name: "Status", type: "select", options: ["Planning", "Active", "OnHold", "Done"] },
      { id: "Owner", name: "Owner", type: "text" },
      { id: "DueDate", name: "Due date", type: "date" },
    ],
  },
  {
    name: "Task",
    label: "Tasks",
    fields: [
      { id: "Title", name: "Title", type: "text" },
      { id: "ProjectName", name: "Project name", type: "text" },
      { id: "Assignee", name: "Assignee", type: "text" },
      { id: "Status", name: "Status", type: "select", options: ["Todo", "In Progress", "Review", "Done"] },
      { id: "Priority", name: "Priority", type: "select", options: ["Low", "Medium", "High"] },
      { id: "Estimate", name: "Estimate", type: "number" },
      { id: "DueDate", name: "Due date", type: "date" },
    ],
  },
];

/** Demo records for the studio sandbox so previews render with real data. */
export const STANDARD_SEEDS: Record<string, Array<Record<string, unknown>>> = {
  Product: [
    { Name: "Nimbus Headphones", Description: "Over-ear noise cancelling headphones", Price: 199, Category: "Audio", ImageUrl: "https://picsum.photos/seed/nimbus/400/300", Rating: 4.5, Stock: 12 },
    { Name: "Pulse Earbuds", Description: "True wireless earbuds with long battery", Price: 89, Category: "Audio", ImageUrl: "https://picsum.photos/seed/pulse/400/300", Rating: 4.1, Stock: 30 },
    { Name: "Tempo Watch", Description: "Fitness watch with GPS and heart-rate", Price: 249, Category: "Wearables", ImageUrl: "https://picsum.photos/seed/tempo/400/300", Rating: 4.7, Stock: 8 },
    { Name: "Strap Band", Description: "Replacement silicone watch band", Price: 19, Category: "Accessories", ImageUrl: "https://picsum.photos/seed/strap/400/300", Rating: 3.9, Stock: 50 },
    { Name: "Aero Speaker", Description: "Portable bluetooth speaker, 20h playtime", Price: 129, Category: "Audio", ImageUrl: "https://picsum.photos/seed/aero/400/300", Rating: 4.3, Stock: 17 },
    { Name: "Lumen Ring", Description: "Sleep + recovery tracking smart ring", Price: 299, Category: "Wearables", ImageUrl: "https://picsum.photos/seed/lumen/400/300", Rating: 4.0, Stock: 6 },
  ],
  CartItem: [
    { ProductId: "demo-1", Name: "Nimbus Headphones", Price: 199, Quantity: 1, LineTotal: 199 },
    { ProductId: "demo-2", Name: "Strap Band", Price: 19, Quantity: 1, LineTotal: 19 },
  ],
  Order: [
    { CustomerName: "Maya Lin", Email: "maya@example.com", Address: "12 Cedar Way", City: "Austin", Zip: "73301", Status: "Delivered", Total: 218, PlacedAt: "2026-05-28" },
    { CustomerName: "Tom Hale", Email: "tom@example.com", Address: "8 Birch Road", City: "Denver", Zip: "80014", Status: "Shipped", Total: 129, PlacedAt: "2026-06-02" },
    { CustomerName: "Ana Cruz", Email: "ana@example.com", Address: "3 Palm Court", City: "Miami", Zip: "33101", Status: "Placed", Total: 299, PlacedAt: "2026-06-08" },
  ],
  Review: [
    { ProductId: "demo-1", Author: "Maya L.", Rating: 5, Title: "Fantastic sound", Body: "Crisp highs and deep bass — the noise cancelling is excellent on flights.", CreatedAt: "2026-06-10" },
    { ProductId: "demo-1", Author: "Tom H.", Rating: 4, Title: "Comfortable, great value", Body: "Light on the ears for long sessions. Battery easily lasts a full day.", CreatedAt: "2026-06-04" },
    { ProductId: "demo-1", Author: "Ana C.", Rating: 5, Title: "Worth it", Body: "Build quality feels premium and pairing is instant.", CreatedAt: "2026-05-29" },
    { ProductId: "demo-2", Author: "Riya S.", Rating: 3, Title: "Decent band", Body: "Does the job but the clasp is a little stiff at first.", CreatedAt: "2026-05-25" },
  ],
  Contact: [
    { Name: "Maya Lin", Email: "maya@example.com", Phone: "512-555-0142", Company: "Cedarworks", Title: "VP Operations", Status: "Active" },
    { Name: "Tom Hale", Email: "tom@example.com", Phone: "303-555-0177", Company: "Birchline", Title: "Procurement Lead", Status: "Lead" },
    { Name: "Ana Cruz", Email: "ana@example.com", Phone: "305-555-0190", Company: "Palmetto Co", Title: "CTO", Status: "Inactive" },
  ],
  Deal: [
    { Name: "Cedarworks renewal", ContactName: "Maya Lin", Company: "Cedarworks", Value: 24000, Stage: "Proposal", CloseDate: "2026-07-15", Owner: "Sam Reed" },
    { Name: "Birchline pilot", ContactName: "Tom Hale", Company: "Birchline", Value: 8000, Stage: "Qualified", CloseDate: "2026-06-30", Owner: "Sam Reed" },
    { Name: "Palmetto expansion", ContactName: "Ana Cruz", Company: "Palmetto Co", Value: 56000, Stage: "Lead", CloseDate: "2026-09-01", Owner: "Jo Park" },
    { Name: "Cedarworks add-on", ContactName: "Maya Lin", Company: "Cedarworks", Value: 6500, Stage: "Won", CloseDate: "2026-05-20", Owner: "Jo Park" },
  ],
  Activity: [
    { Subject: "Intro call with Maya", Type: "Call", RelatedTo: "Cedarworks renewal", Date: "2026-06-05", Notes: "Discussed renewal scope" },
    { Subject: "Sent proposal deck", Type: "Email", RelatedTo: "Birchline pilot", Date: "2026-06-07", Notes: "Awaiting feedback" },
    { Subject: "On-site demo", Type: "Meeting", RelatedTo: "Palmetto expansion", Date: "2026-06-09", Notes: "Demo went well" },
  ],
  Ticket: [
    { Subject: "Cannot log in after password reset", Description: "User reset their password but the new one is rejected.", Status: "Open", Priority: "Urgent", Requester: "Maya Lin", Assignee: "Sam Reed", Category: "Account", CreatedAt: "2026-06-08" },
    { Subject: "Invoice total looks wrong", Description: "May invoice shows duplicate line items.", Status: "In Progress", Priority: "High", Requester: "Tom Hale", Assignee: "Jo Park", Category: "Billing", CreatedAt: "2026-06-06" },
    { Subject: "Feature request: dark mode", Description: "Would love a dark theme for the dashboard.", Status: "Waiting", Priority: "Low", Requester: "Ana Cruz", Assignee: "Sam Reed", Category: "General", CreatedAt: "2026-06-02" },
    { Subject: "Export to CSV times out", Description: "Large exports fail after 30 seconds.", Status: "Resolved", Priority: "Medium", Requester: "Maya Lin", Assignee: "Jo Park", Category: "Technical", CreatedAt: "2026-05-28" },
  ],
  Agent: [
    { Name: "Sam Reed", Email: "sam@example.com", Team: "Tier 1", ResolvedCount: 42 },
    { Name: "Jo Park", Email: "jo@example.com", Team: "Tier 2", ResolvedCount: 31 },
    { Name: "Riya Shah", Email: "riya@example.com", Team: "Escalations", ResolvedCount: 18 },
  ],
  Reply: [
    { TicketId: "demo-1", Author: "Sam Reed", Body: "Thanks for reporting — looking into the reset flow now.", CreatedAt: "2026-06-08", Internal: false },
    { TicketId: "demo-1", Author: "Sam Reed", Body: "Repro'd locally; auth token cache looks stale.", CreatedAt: "2026-06-09", Internal: true },
    { TicketId: "demo-2", Author: "Jo Park", Body: "We've credited the duplicate items; new invoice on the way.", CreatedAt: "2026-06-07", Internal: false },
  ],
  Post: [
    { Title: "Designing calm interfaces", Slug: "designing-calm-interfaces", Excerpt: "Why less chrome means more focus.", Body: "Calm interfaces reduce visual noise so users can focus on the task at hand…", AuthorName: "Maya Lin", Category: "Design", Status: "Published", CoverUrl: "https://picsum.photos/seed/calm/400/200", PublishedAt: "2026-05-30" },
    { Title: "Shipping faster with fragments", Slug: "shipping-faster-with-fragments", Excerpt: "Composable page blocks in practice.", Body: "Fragments let teams assemble pages from tested building blocks…", AuthorName: "Tom Hale", Category: "Technology", Status: "Published", CoverUrl: "https://picsum.photos/seed/fragments/400/200", PublishedAt: "2026-06-04" },
    { Title: "Q3 product roadmap preview", Slug: "q3-roadmap-preview", Excerpt: "A look at what's coming next quarter.", Body: "Here is an early look at the themes we are exploring for Q3…", AuthorName: "Ana Cruz", Category: "Business", Status: "Draft", CoverUrl: "https://picsum.photos/seed/roadmap/400/200", PublishedAt: "2026-06-09" },
    { Title: "Welcome to the new blog", Slug: "welcome-new-blog", Excerpt: "Same writers, fresh coat of paint.", Body: "We rebuilt the blog on our own platform — here is what changed…", AuthorName: "Maya Lin", Category: "News", Status: "Archived", CoverUrl: "https://picsum.photos/seed/welcome/400/200", PublishedAt: "2026-04-12" },
  ],
  Author: [
    { Name: "Maya Lin", Bio: "Design lead writing about interfaces and systems.", AvatarUrl: "https://picsum.photos/seed/maya/96/96", Email: "maya@example.com" },
    { Name: "Tom Hale", Bio: "Engineer covering tooling and platform topics.", AvatarUrl: "https://picsum.photos/seed/tom/96/96", Email: "tom@example.com" },
    { Name: "Ana Cruz", Bio: "Product strategist sharing roadmap and business notes.", AvatarUrl: "https://picsum.photos/seed/ana/96/96", Email: "ana@example.com" },
  ],
  Category: [
    { Name: "General", Description: "Announcements and everything else" },
    { Name: "Technology", Description: "Engineering and tooling deep dives" },
    { Name: "Design", Description: "Interface and product design notes" },
    { Name: "Business", Description: "Strategy, roadmap, and company updates" },
    { Name: "News", Description: "Product and company news" },
  ],
  Project: [
    { Name: "Website revamp", Description: "Marketing site redesign", Status: "Active", Owner: "Sam Reed", DueDate: "2026-07-30" },
    { Name: "Mobile app v2", Description: "React Native rewrite", Status: "Planning", Owner: "Jo Park", DueDate: "2026-09-15" },
    { Name: "Data warehouse", Description: "ETL + reporting stack", Status: "Done", Owner: "Maya Lin", DueDate: "2026-05-01" },
  ],
  Task: [
    { Title: "Design homepage hero", ProjectName: "Website revamp", Assignee: "Jo Park", Status: "In Progress", Priority: "High", Estimate: 8, DueDate: "2026-06-20" },
    { Title: "Set up CI pipeline", ProjectName: "Mobile app v2", Assignee: "Sam Reed", Status: "Todo", Priority: "Medium", Estimate: 5, DueDate: "2026-06-25" },
    { Title: "Migrate analytics events", ProjectName: "Data warehouse", Assignee: "Maya Lin", Status: "Review", Priority: "High", Estimate: 13, DueDate: "2026-06-18" },
    { Title: "Write release notes", ProjectName: "Website revamp", Assignee: "Sam Reed", Status: "Done", Priority: "Low", Estimate: 2, DueDate: "2026-06-10" },
  ],
};
