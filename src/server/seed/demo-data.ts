/**
 * Demo dataset for "Mwangaza Studio", a small Nairobi digital agency.
 * Dates are expressed as day offsets from today so the demo never goes stale.
 */
import type {
  ClientStatus,
  EventType,
  MilestoneStatus,
  ApprovalStatus,
  PaymentMethod,
  Priority,
  ProjectStatus,
  TaskStatus,
  WorkspaceRole,
} from "@/server/db/schema";

export const DEMO_WORKSPACE = {
  name: "Mwangaza Studio",
  slug: "mwangaza-studio",
  email: "hello@mwangaza.studio",
  phone: "+254 712 345 678",
  address: "The Mirage, Tower 2, 9th Floor\nChiromo Road, Westlands\nNairobi, Kenya",
};

export type DemoPersonKey = "victor" | "sarah" | "brian" | "aisha" | "david" | "grace";

export const DEMO_PEOPLE: Record<
  DemoPersonKey,
  { fullName: string; email: string; role: WorkspaceRole; title: string; client?: string }
> = {
  victor: { fullName: "Victor Otieno", email: "victor@flowdesk-demo.com", role: "OWNER", title: "Founder & Creative Director" },
  sarah: { fullName: "Sarah Wanjiku", email: "sarah@flowdesk-demo.com", role: "ADMIN", title: "Operations Lead" },
  brian: { fullName: "Brian Kiprop", email: "brian@flowdesk-demo.com", role: "MEMBER", title: "Full-stack Developer" },
  aisha: { fullName: "Aisha Mohamed", email: "aisha@flowdesk-demo.com", role: "MEMBER", title: "Product Designer" },
  david: { fullName: "David Mutua", email: "david@flowdesk-demo.com", role: "MEMBER", title: "Frontend Developer" },
  grace: {
    fullName: "Grace Achieng",
    email: "grace@flowdesk-demo.com",
    role: "CLIENT",
    title: "Marketing Director",
    client: "northstar",
  },
};

/** Which demo personas the public "View demo" page offers. */
export const DEMO_LOGIN_PERSONAS: { key: DemoPersonKey; blurb: string }[] = [
  { key: "victor", blurb: "Full access: finances, team, settings and every project." },
  { key: "brian", blurb: "A developer who only sees the projects they're staffed on." },
  { key: "grace", blurb: "A client using the portal to follow their project and pay invoices." },
];

type ClientSeed = {
  key: string;
  company: string;
  name: string;
  email: string;
  phone: string;
  website?: string;
  address?: string;
  status: ClientStatus;
  tags: string[];
  notes?: string;
  createdDaysAgo: number;
  contacts?: { name: string; email: string; jobTitle: string; phone?: string }[];
};

export const DEMO_CLIENTS: ClientSeed[] = [
  {
    key: "northstar",
    company: "Northstar Digital",
    name: "Grace Achieng",
    email: "grace@northstar.co.ke",
    phone: "+254 722 410 118",
    website: "https://northstar.co.ke",
    address: "Westlands Square, Nairobi",
    status: "ACTIVE",
    tags: ["retainer", "e-commerce"],
    notes:
      "Long-term retainer client since last year. Grace prefers a weekly Thursday sync and written summaries afterwards. Finance contact is Michael for invoice queries.",
    createdDaysAgo: 240,
    contacts: [
      { name: "Michael Ouma", email: "finance@northstar.co.ke", jobTitle: "Finance Manager", phone: "+254 733 902 114" },
    ],
  },
  {
    key: "greenline",
    company: "Greenline Café",
    name: "Peter Njoroge",
    email: "peter@greenlinecafe.co.ke",
    phone: "+254 711 223 909",
    website: "https://greenlinecafe.co.ke",
    address: "Ngong Road, Kilimani, Nairobi",
    status: "ACTIVE",
    tags: ["hospitality"],
    notes: "Three branches (Kilimani, Karen, CBD). Wants online ordering with M-Pesa before the December rush.",
    createdDaysAgo: 120,
  },
  {
    key: "nova",
    company: "Nova Interiors",
    name: "Linda Chebet",
    email: "linda@novainteriors.co.ke",
    phone: "+254 720 556 781",
    website: "https://novainteriors.co.ke",
    address: "Lavington Green, Nairobi",
    status: "ACTIVE",
    tags: ["design", "website"],
    notes: "Portfolio-heavy site. Photography delivered late, which pushed the review stage.",
    createdDaysAgo: 95,
  },
  {
    key: "kibo",
    company: "Kibo Labs",
    name: "James Mwangi",
    email: "james@kibolabs.io",
    phone: "+254 799 114 520",
    website: "https://kibolabs.io",
    address: "iHub, Senteu Plaza, Nairobi",
    status: "ACTIVE",
    tags: ["saas", "startup"],
    notes: "Seed-stage agritech startup. Fast decision making; prefers async updates in the project thread.",
    createdDaysAgo: 200,
    contacts: [{ name: "Wanjiru Kamau", email: "wanjiru@kibolabs.io", jobTitle: "Head of Product" }],
  },
  {
    key: "savannah",
    company: "Savannah Safaris",
    name: "Joseph Lekishon",
    email: "joseph@savannahsafaris.com",
    phone: "+254 734 870 332",
    website: "https://savannahsafaris.com",
    address: "Bogani Road, Karen, Nairobi",
    status: "ACTIVE",
    tags: ["travel", "booking"],
    notes: "Booking platform for lodges in the Mara and Amboseli. Integrations with two channel managers.",
    createdDaysAgo: 150,
  },
  {
    key: "baraka",
    company: "Baraka Health Clinic",
    name: "Dr. Faith Ndungu",
    email: "faith@barakahealth.co.ke",
    phone: "+254 718 004 667",
    status: "LEAD",
    tags: ["healthcare"],
    notes: "Referred by Kibo Labs. Interested in online appointment booking. Proposal sent, awaiting board approval.",
    createdDaysAgo: 12,
  },
  {
    key: "pwani",
    company: "Pwani Fresh Foods",
    name: "Hassan Ali",
    email: "hassan@pwanifresh.co.ke",
    phone: "+254 741 663 210",
    address: "Nyali, Mombasa",
    status: "INACTIVE",
    tags: ["retail"],
    notes: "Paused all digital work after a change in management.",
    createdDaysAgo: 210,
  },
  {
    key: "tujenge",
    company: "Tujenge Microfinance",
    name: "Esther Kamau",
    email: "esther@tujenge.co.ke",
    phone: "+254 702 338 114",
    website: "https://tujenge.co.ke",
    address: "Upper Hill, Nairobi",
    status: "ACTIVE",
    tags: ["fintech"],
    createdDaysAgo: 170,
  },
  {
    key: "amani",
    company: "Amani Legal Partners",
    name: "Collins Omondi",
    email: "collins@amanilegal.co.ke",
    phone: "+254 725 990 431",
    status: "LEAD",
    tags: ["legal"],
    notes: "Wants a refreshed brand and a client intake form. First call booked.",
    createdDaysAgo: 5,
  },
  {
    key: "zuri",
    company: "Zuri Beauty Co.",
    name: "Wambui Gitau",
    email: "wambui@zuribeauty.co.ke",
    phone: "+254 790 210 556",
    website: "https://zuribeauty.co.ke",
    status: "ACTIVE",
    tags: ["e-commerce"],
    createdDaysAgo: 80,
  },
  {
    key: "mara",
    company: "Mara Logistics",
    name: "Kevin Rotich",
    email: "kevin@maralogistics.co.ke",
    phone: "+254 713 448 902",
    status: "ARCHIVED",
    tags: ["logistics"],
    notes: "Project finished last year. Archived.",
    createdDaysAgo: 330,
  },
  {
    key: "urbanbean",
    company: "Urban Bean Roasters",
    name: "Naliaka Wekesa",
    email: "naliaka@urbanbean.co.ke",
    phone: "+254 708 771 245",
    status: "LEAD",
    tags: ["hospitality", "branding"],
    createdDaysAgo: 2,
  },
];

type MilestoneSeed = {
  title: string;
  status: MilestoneStatus;
  dueOffset: number;
  approval?: ApprovalStatus;
  description?: string;
};

type TaskSeed = {
  title: string;
  status: TaskStatus;
  priority?: Priority;
  assignee?: DemoPersonKey;
  dueOffset?: number;
  labels?: string[];
  description?: string;
  comments?: { author: DemoPersonKey; body: string; hoursAgo: number }[];
};

type ProjectSeed = {
  key: string;
  client: string | null;
  name: string;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  startOffset: number;
  dueOffset: number;
  budget: number;
  team: DemoPersonKey[];
  milestones?: MilestoneSeed[];
  tasks: TaskSeed[];
  manualProgress?: number;
};

export const DEMO_LABELS = [
  { name: "Frontend", color: "blue" },
  { name: "Backend", color: "violet" },
  { name: "Design", color: "pink" },
  { name: "Bug", color: "red" },
  { name: "Content", color: "amber" },
  { name: "QA", color: "teal" },
  { name: "DevOps", color: "slate" },
] as const;

export const DEMO_PROJECTS: ProjectSeed[] = [
  {
    key: "ecommerce",
    client: "northstar",
    name: "E-commerce Redesign",
    description:
      "Full redesign of the Northstar online store: new design system, faster product listing pages, a simplified three-step checkout with M-Pesa STK push, and a CMS for the marketing team.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    startOffset: -62,
    dueOffset: 24,
    budget: 850000,
    team: ["brian", "aisha", "david"],
    milestones: [
      { title: "Discovery", status: "COMPLETED", dueOffset: -50, approval: "APPROVED", description: "Stakeholder interviews, analytics review and sitemap." },
      { title: "Design", status: "COMPLETED", dueOffset: -30, approval: "APPROVED", description: "Design system and high-fidelity screens for all key flows." },
      { title: "Development", status: "COMPLETED", dueOffset: -6, approval: "NOT_REQUIRED", description: "Storefront, checkout and CMS build." },
      { title: "Testing", status: "CURRENT", dueOffset: 9, approval: "PENDING", description: "UAT on staging with the Northstar team. Sign-off required before launch." },
      { title: "Launch", status: "UPCOMING", dueOffset: 24, description: "DNS cut-over, monitoring and handover." },
    ],
    tasks: [
      { title: "Run stakeholder interviews", status: "DONE", assignee: "aisha", dueOffset: -55, labels: ["Design"] },
      { title: "Audit current analytics funnel", status: "DONE", assignee: "brian", dueOffset: -52 },
      { title: "Design system: colours, type and components", status: "DONE", assignee: "aisha", dueOffset: -38, labels: ["Design"] },
      { title: "High-fidelity product page designs", status: "DONE", assignee: "aisha", dueOffset: -32, labels: ["Design"] },
      { title: "Set up Next.js storefront and CI", status: "DONE", assignee: "brian", dueOffset: -28, labels: ["DevOps"] },
      { title: "Build product listing with filters", status: "DONE", assignee: "david", dueOffset: -20, labels: ["Frontend"] },
      { title: "Integrate M-Pesa STK push at checkout", status: "DONE", priority: "URGENT", assignee: "brian", dueOffset: -12, labels: ["Backend"],
        description: "Use Daraja sandbox first. Callback must be idempotent; store the CheckoutRequestID against the order.",
        comments: [
          { author: "brian", body: "Callback handler is idempotent now — duplicate callbacks from Safaricom are ignored.", hoursAgo: 300 },
          { author: "sarah", body: "Great. Can we get a short note in the handover doc on how to rotate the passkey?", hoursAgo: 290 },
        ] },
      { title: "CMS for homepage banners", status: "DONE", assignee: "david", dueOffset: -8, labels: ["Frontend"] },
      { title: "Cross-browser QA on staging", status: "IN_PROGRESS", priority: "HIGH", assignee: "david", dueOffset: 3, labels: ["QA"],
        comments: [{ author: "david", body: "Safari 17 has a sticky header glitch on the cart drawer — fixing today.", hoursAgo: 20 }] },
      { title: "Fix cart total rounding on discounts", status: "REVIEW", priority: "URGENT", assignee: "brian", dueOffset: 1, labels: ["Bug", "Backend"],
        description: "Percentage discounts on bundles round each line separately, leaving the total off by up to KSh 2." },
      { title: "Performance pass: images and fonts", status: "TODO", priority: "MEDIUM", assignee: "david", dueOffset: 12, labels: ["Frontend"] },
      { title: "Write launch checklist and rollback plan", status: "TODO", assignee: "brian", dueOffset: 18, labels: ["DevOps"] },
    ],
  },
  {
    key: "ordering",
    client: "greenline",
    name: "Restaurant Ordering System",
    description:
      "Online ordering for three Greenline branches with pickup and delivery, a kitchen display screen and M-Pesa payments.",
    status: "IN_PROGRESS",
    priority: "URGENT",
    startOffset: -44,
    dueOffset: 9,
    budget: 620000,
    team: ["brian", "david"],
    milestones: [
      { title: "Menu & ordering flow", status: "COMPLETED", dueOffset: -20 },
      { title: "Kitchen display", status: "CURRENT", dueOffset: 2 },
      { title: "Pilot at Kilimani branch", status: "UPCOMING", dueOffset: 9, approval: "NOT_REQUIRED" },
    ],
    tasks: [
      { title: "Menu data model with modifiers", status: "DONE", assignee: "brian", dueOffset: -30, labels: ["Backend"] },
      { title: "Ordering flow UI", status: "DONE", assignee: "david", dueOffset: -22, labels: ["Frontend"] },
      { title: "Branch selection and opening hours", status: "DONE", assignee: "david", dueOffset: -15, labels: ["Frontend"] },
      { title: "Kitchen display real-time updates", status: "IN_PROGRESS", priority: "URGENT", assignee: "brian", dueOffset: -1, labels: ["Backend"],
        comments: [{ author: "brian", body: "Switched to server-sent events; the kitchen tablets kept dropping websockets on the café Wi-Fi.", hoursAgo: 6 }] },
      { title: "Delivery fee calculation by zone", status: "TODO", priority: "HIGH", assignee: "brian", dueOffset: 4, labels: ["Backend"] },
      { title: "Print receipts on Epson TM-T20", status: "TODO", assignee: "david", dueOffset: 6 },
      { title: "Staff training session", status: "TODO", priority: "LOW", dueOffset: 8, labels: ["Content"] },
    ],
  },
  {
    key: "nova-site",
    client: "nova",
    name: "Brand Website",
    description: "Portfolio website for Nova Interiors with project case studies, a lookbook and a consultation booking form.",
    status: "REVIEW",
    priority: "MEDIUM",
    startOffset: -50,
    dueOffset: -3,
    budget: 280000,
    team: ["aisha", "david"],
    milestones: [
      { title: "Design", status: "COMPLETED", dueOffset: -30, approval: "APPROVED" },
      { title: "Build", status: "COMPLETED", dueOffset: -10 },
      { title: "Client review", status: "CURRENT", dueOffset: -3, approval: "CHANGES_REQUESTED" },
    ],
    tasks: [
      { title: "Moodboard and art direction", status: "DONE", assignee: "aisha", dueOffset: -42, labels: ["Design"] },
      { title: "Case study page template", status: "DONE", assignee: "aisha", dueOffset: -30, labels: ["Design"] },
      { title: "Build lookbook gallery", status: "DONE", assignee: "david", dueOffset: -14, labels: ["Frontend"] },
      { title: "Consultation booking form", status: "DONE", assignee: "david", dueOffset: -9, labels: ["Frontend"] },
      { title: "Replace placeholder photography", status: "REVIEW", priority: "HIGH", assignee: "aisha", dueOffset: -4, labels: ["Content"],
        description: "Final photos from the Lavington shoot arrived. Needs colour-matching before upload." },
      { title: "Apply client feedback on About page", status: "IN_PROGRESS", priority: "HIGH", assignee: "david", dueOffset: -2, labels: ["Frontend"] },
    ],
  },
  {
    key: "kibo-landing",
    client: "kibo",
    name: "Mobile App Landing Page",
    description: "Launch landing page for the Kibo farmer app with waitlist capture and app-store links.",
    status: "COMPLETED",
    priority: "MEDIUM",
    startOffset: -92,
    dueOffset: -60,
    budget: 150000,
    team: ["aisha", "david"],
    tasks: [
      { title: "Landing page design", status: "DONE", assignee: "aisha", dueOffset: -80, labels: ["Design"] },
      { title: "Build and deploy landing page", status: "DONE", assignee: "david", dueOffset: -70, labels: ["Frontend"] },
      { title: "Waitlist integration", status: "DONE", assignee: "david", dueOffset: -64 },
    ],
  },
  {
    key: "kibo-dashboard",
    client: "kibo",
    name: "Investor Dashboard MVP",
    description: "Internal dashboard showing farmer onboarding, loan disbursement and repayment metrics for Kibo's investors.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    startOffset: -28,
    dueOffset: 48,
    budget: 1200000,
    team: ["brian", "aisha"],
    milestones: [
      { title: "Metrics definition", status: "COMPLETED", dueOffset: -14, approval: "APPROVED" },
      { title: "Dashboard build", status: "CURRENT", dueOffset: 25 },
      { title: "Investor demo", status: "UPCOMING", dueOffset: 48 },
    ],
    tasks: [
      { title: "Define KPI formulas with Kibo finance", status: "DONE", assignee: "brian", dueOffset: -16 },
      { title: "Dashboard wireframes", status: "DONE", assignee: "aisha", dueOffset: -10, labels: ["Design"] },
      { title: "Data pipeline from loan ledger", status: "IN_PROGRESS", priority: "HIGH", assignee: "brian", dueOffset: 10, labels: ["Backend"] },
      { title: "Cohort retention chart", status: "TODO", assignee: "brian", dueOffset: 20, labels: ["Frontend"] },
      { title: "Visual design for charts", status: "IN_PROGRESS", assignee: "aisha", dueOffset: 7, labels: ["Design"] },
      { title: "Role-based access for investors", status: "TODO", priority: "HIGH", dueOffset: 30, labels: ["Backend"] },
    ],
  },
  {
    key: "booking",
    client: "savannah",
    name: "Booking Platform",
    description: "Direct booking platform for lodges with live availability from two channel managers and deposit payments.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    startOffset: -78,
    dueOffset: -6,
    budget: 950000,
    team: ["brian", "david", "aisha"],
    milestones: [
      { title: "Availability engine", status: "COMPLETED", dueOffset: -40 },
      { title: "Booking & payments", status: "CURRENT", dueOffset: -6 },
      { title: "Go-live", status: "UPCOMING", dueOffset: 14 },
    ],
    tasks: [
      { title: "Channel manager sync (NightsBridge)", status: "DONE", assignee: "brian", dueOffset: -45, labels: ["Backend"] },
      { title: "Availability calendar UI", status: "DONE", assignee: "david", dueOffset: -35, labels: ["Frontend"] },
      { title: "Second channel manager integration", status: "IN_PROGRESS", priority: "URGENT", assignee: "brian", dueOffset: -8, labels: ["Backend"],
        description: "Their API rate limits are much stricter than documented. Need a queue with back-off.",
        comments: [
          { author: "victor", body: "Joseph is asking for a revised date. What's realistic?", hoursAgo: 30 },
          { author: "brian", body: "About 10 more working days once their sandbox stops throwing 429s.", hoursAgo: 26 },
        ] },
      { title: "Deposit payments with card + M-Pesa", status: "REVIEW", priority: "HIGH", assignee: "brian", dueOffset: -5, labels: ["Backend"] },
      { title: "Booking confirmation emails", status: "TODO", assignee: "david", dueOffset: -2, labels: ["Frontend"] },
      { title: "Lodge photography gallery", status: "TODO", priority: "LOW", assignee: "aisha", dueOffset: 5, labels: ["Design"] },
    ],
  },
  {
    key: "audit",
    client: "tujenge",
    name: "Loan Portal UX Audit",
    description: "Heuristic review and usability testing of the Tujenge loan application portal, with prioritised recommendations.",
    status: "COMPLETED",
    priority: "MEDIUM",
    startOffset: -120,
    dueOffset: -95,
    budget: 180000,
    team: ["aisha"],
    tasks: [
      { title: "Heuristic evaluation", status: "DONE", assignee: "aisha", dueOffset: -110 },
      { title: "Usability sessions with 6 borrowers", status: "DONE", assignee: "aisha", dueOffset: -102 },
      { title: "Findings report and presentation", status: "DONE", assignee: "aisha", dueOffset: -96, labels: ["Content"] },
    ],
  },
  {
    key: "mobile-money",
    client: "tujenge",
    name: "Mobile Money Integration",
    description: "Disbursement and repayment via M-Pesa B2C/C2B with automated reconciliation against the loan book.",
    status: "PLANNING",
    priority: "HIGH",
    startOffset: 7,
    dueOffset: 70,
    budget: 540000,
    team: ["brian"],
    tasks: [
      { title: "Technical scoping workshop", status: "TODO", assignee: "brian", dueOffset: 9 },
      { title: "Daraja B2C sandbox proof of concept", status: "TODO", assignee: "brian", dueOffset: 16, labels: ["Backend"] },
    ],
  },
  {
    key: "zuri-migration",
    client: "zuri",
    name: "Shopify Store Migration",
    description: "Migrate Zuri Beauty from WooCommerce to Shopify, preserving SEO and customer accounts.",
    status: "ON_HOLD",
    priority: "MEDIUM",
    startOffset: -35,
    dueOffset: 30,
    budget: 400000,
    team: ["david"],
    tasks: [
      { title: "Product catalogue export", status: "DONE", assignee: "david", dueOffset: -25 },
      { title: "URL redirect map", status: "IN_PROGRESS", assignee: "david", dueOffset: 10, labels: ["Content"] },
      { title: "Theme customisation", status: "TODO", assignee: "david", dueOffset: 20, labels: ["Frontend"] },
    ],
  },
  {
    key: "northstar-q4",
    client: "northstar",
    name: "Q4 Campaign Microsite",
    description: "A festive-season campaign microsite with a product gift guide and newsletter sign-up.",
    status: "PLANNING",
    priority: "MEDIUM",
    startOffset: 10,
    dueOffset: 55,
    budget: 320000,
    team: ["aisha", "david"],
    tasks: [
      { title: "Campaign concept and copy", status: "TODO", assignee: "aisha", dueOffset: 15, labels: ["Content"] },
      { title: "Gift guide layout", status: "TODO", assignee: "aisha", dueOffset: 22, labels: ["Design"] },
    ],
  },
  {
    key: "baraka-site",
    client: "baraka",
    name: "Patient Booking Website",
    description: "Proposal stage: a simple clinic website with appointment booking and SMS reminders.",
    status: "PLANNING",
    priority: "LOW",
    startOffset: 20,
    dueOffset: 75,
    budget: 260000,
    team: [],
    tasks: [],
  },
  {
    key: "pwani-inventory",
    client: "pwani",
    name: "Inventory System",
    description: "Stock management across two Mombasa warehouses. Cancelled after the client paused digital work.",
    status: "CANCELLED",
    priority: "MEDIUM",
    startOffset: -150,
    dueOffset: -60,
    budget: 480000,
    team: ["brian"],
    tasks: [{ title: "Warehouse process mapping", status: "DONE", assignee: "brian", dueOffset: -140 }],
  },
];

/** Internal (no project) tasks. */
export const DEMO_INTERNAL_TASKS: TaskSeed[] = [
  { title: "Prepare Q4 pipeline review", status: "TODO", priority: "MEDIUM", assignee: "victor", dueOffset: 5 },
  { title: "Renew Figma and Vercel subscriptions", status: "TODO", priority: "LOW", assignee: "sarah", dueOffset: 2 },
  { title: "Send proposal to Baraka Health", status: "IN_PROGRESS", priority: "HIGH", assignee: "victor", dueOffset: 1 },
  { title: "Update studio portfolio with Kibo case study", status: "TODO", assignee: "aisha", dueOffset: 14, labels: ["Content"] },
  { title: "Chase overdue Savannah Safaris invoice", status: "TODO", priority: "HIGH", assignee: "sarah", dueOffset: -1 },
];

type InvoiceSeed = {
  client: string;
  project?: string;
  issueOffset: number;
  termsDays: number;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
  taxRate?: number;
  discount?: { type: "PERCENT" | "FIXED"; value: number };
  items: { description: string; quantity: number; unitPrice: number }[];
  notes?: string;
  payments?: { amountFraction: number; method: PaymentMethod; reference: string; daysAfterIssue: number }[];
};

export const DEMO_INVOICES: InvoiceSeed[] = [
  { client: "mara", issueOffset: -232, termsDays: 14, status: "PAID", items: [{ description: "Fleet tracking dashboard — final milestone", quantity: 1, unitPrice: 260000 }],
    payments: [{ amountFraction: 1, method: "BANK", reference: "FT24081599K2", daysAfterIssue: 12 }] },
  { client: "pwani", project: "pwani-inventory", issueOffset: -205, termsDays: 14, status: "PAID", items: [{ description: "Warehouse process mapping workshop", quantity: 2, unitPrice: 45000 }],
    payments: [{ amountFraction: 1, method: "MPESA", reference: "QHK2L8M1TZ", daysAfterIssue: 6 }] },
  { client: "northstar", issueOffset: -180, termsDays: 14, status: "PAID", items: [{ description: "Monthly design & development retainer", quantity: 1, unitPrice: 150000 }],
    payments: [{ amountFraction: 1, method: "BANK", reference: "FT24092201NS", daysAfterIssue: 9 }] },
  { client: "kibo", project: "kibo-landing", issueOffset: -150, termsDays: 14, status: "PAID", items: [
      { description: "Landing page design", quantity: 1, unitPrice: 60000 },
      { description: "Landing page build & deployment", quantity: 1, unitPrice: 75000 },
    ], payments: [{ amountFraction: 1, method: "CARD", reference: "ch_3PkL92Kibo", daysAfterIssue: 4 }] },
  { client: "northstar", issueOffset: -150, termsDays: 14, status: "PAID", items: [{ description: "Monthly design & development retainer", quantity: 1, unitPrice: 150000 }],
    payments: [{ amountFraction: 1, method: "BANK", reference: "FT24102208NS", daysAfterIssue: 11 }] },
  { client: "tujenge", project: "audit", issueOffset: -118, termsDays: 30, status: "PAID", items: [
      { description: "Heuristic evaluation", quantity: 1, unitPrice: 60000 },
      { description: "Moderated usability sessions", quantity: 6, unitPrice: 12500 },
      { description: "Findings report & workshop", quantity: 1, unitPrice: 45000 },
    ], payments: [
      { amountFraction: 0.5, method: "MPESA", reference: "QJA4K7P2WX", daysAfterIssue: 3 },
      { amountFraction: 0.5, method: "MPESA", reference: "QJF8R2N6YB", daysAfterIssue: 28 },
    ] },
  { client: "savannah", project: "booking", issueOffset: -110, termsDays: 14, status: "PAID", items: [{ description: "Booking platform — 30% deposit", quantity: 1, unitPrice: 285000 }],
    payments: [{ amountFraction: 1, method: "BANK", reference: "FT24111877SV", daysAfterIssue: 7 }] },
  { client: "northstar", project: "ecommerce", issueOffset: -90, termsDays: 14, status: "PAID", items: [
      { description: "E-commerce redesign — discovery phase", quantity: 1, unitPrice: 170000 },
    ], payments: [{ amountFraction: 1, method: "BANK", reference: "FT24120344NS", daysAfterIssue: 10 }] },
  { client: "greenline", project: "ordering", issueOffset: -75, termsDays: 14, status: "PAID", discount: { type: "PERCENT", value: 5 }, items: [
      { description: "Ordering system — 40% deposit", quantity: 1, unitPrice: 248000 },
    ], payments: [{ amountFraction: 1, method: "MPESA", reference: "QKC1T9D4LM", daysAfterIssue: 2 }] },
  { client: "zuri", project: "zuri-migration", issueOffset: -62, termsDays: 14, status: "PAID", items: [
      { description: "Store migration — discovery & catalogue export", quantity: 1, unitPrice: 120000 },
    ], payments: [{ amountFraction: 1, method: "MPESA", reference: "QKM5Z3H8RE", daysAfterIssue: 5 }] },
  { client: "northstar", project: "ecommerce", issueOffset: -58, termsDays: 14, status: "PAID", items: [
      { description: "Design system & high-fidelity screens", quantity: 1, unitPrice: 210000 },
      { description: "Usability testing round", quantity: 1, unitPrice: 40000 },
    ], payments: [{ amountFraction: 1, method: "BANK", reference: "FT25010917NS", daysAfterIssue: 13 }] },
  { client: "kibo", project: "kibo-dashboard", issueOffset: -40, termsDays: 14, status: "PAID", items: [
      { description: "Investor dashboard — metrics definition sprint", quantity: 1, unitPrice: 240000 },
    ], payments: [{ amountFraction: 1, method: "CARD", reference: "ch_3QmT11Kibo", daysAfterIssue: 1 }] },
  { client: "nova", project: "nova-site", issueOffset: -38, termsDays: 14, status: "PAID", items: [
      { description: "Brand website — design phase", quantity: 1, unitPrice: 112000 },
    ], payments: [{ amountFraction: 1, method: "MPESA", reference: "QLB7W2K9PA", daysAfterIssue: 8 }] },
  { client: "savannah", project: "booking", issueOffset: -34, termsDays: 14, status: "OVERDUE", items: [
      { description: "Booking platform — availability engine milestone", quantity: 1, unitPrice: 330000 },
    ], notes: "Second reminder sent. Joseph confirmed payment is with their finance team." },
  { client: "northstar", project: "ecommerce", issueOffset: -26, termsDays: 14, status: "PAID", items: [
      { description: "Storefront development sprint 1", quantity: 80, unitPrice: 3500 },
      { description: "M-Pesa checkout integration", quantity: 1, unitPrice: 65000 },
    ], payments: [{ amountFraction: 1, method: "BANK", reference: "FT25020611NS", daysAfterIssue: 12 }] },
  { client: "greenline", project: "ordering", issueOffset: -20, termsDays: 14, status: "OVERDUE", items: [
      { description: "Ordering system — ordering flow milestone", quantity: 1, unitPrice: 186000 },
      { description: "Additional branch configuration", quantity: 2, unitPrice: 15000 },
    ], payments: [{ amountFraction: 0.4, method: "MPESA", reference: "QMD2P5X7CJ", daysAfterIssue: 10 }] },
  { client: "tujenge", issueOffset: -12, termsDays: 30, status: "SENT", items: [
      { description: "Mobile money integration — technical proposal", quantity: 1, unitPrice: 54000 },
    ] },
  { client: "nova", project: "nova-site", issueOffset: -9, termsDays: 14, status: "SENT", items: [
      { description: "Brand website — build phase", quantity: 1, unitPrice: 112000 },
      { description: "Lookbook photography retouching", quantity: 24, unitPrice: 1500 },
    ] },
  { client: "northstar", project: "ecommerce", issueOffset: -4, termsDays: 14, status: "SENT", items: [
      { description: "Storefront development sprint 2", quantity: 72, unitPrice: 3500 },
      { description: "CMS configuration & training", quantity: 1, unitPrice: 35000 },
    ] },
  { client: "kibo", project: "kibo-dashboard", issueOffset: -1, termsDays: 14, status: "DRAFT", items: [
      { description: "Investor dashboard — data pipeline sprint", quantity: 1, unitPrice: 320000 },
    ] },
  { client: "baraka", issueOffset: 0, termsDays: 7, status: "DRAFT", taxRate: 0, items: [
      { description: "Discovery workshop (half day)", quantity: 1, unitPrice: 35000 },
    ], notes: "Billed only if the proposal is accepted." },
  { client: "zuri", project: "zuri-migration", issueOffset: -16, termsDays: 14, status: "CANCELLED", items: [
      { description: "Theme customisation — deposit", quantity: 1, unitPrice: 80000 },
    ], notes: "Cancelled while the project is on hold." },
];

type MessageSeed = { project?: string; client?: string; author: DemoPersonKey; body: string; hoursAgo: number; internal?: boolean };

export const DEMO_MESSAGES: MessageSeed[] = [
  { project: "ecommerce", author: "grace", body: "Hi team — the staging link works well on my phone. The new checkout feels so much faster!", hoursAgo: 52 },
  { project: "ecommerce", author: "victor", body: "Thanks Grace! Testing is underway. We'll share a UAT checklist by Friday so your team can sign off.", hoursAgo: 50 },
  { project: "ecommerce", author: "brian", body: "Heads up: cart rounding fix is in review. Should be on staging tomorrow morning.", hoursAgo: 22, internal: true },
  { project: "ecommerce", author: "grace", body: "Could we also move the newsletter sign-up above the footer on mobile?", hoursAgo: 8 },
  { project: "ecommerce", author: "aisha", body: "Yes — I'll mock that up and drop it in the files tab today.", hoursAgo: 6 },
  { project: "ordering", author: "sarah", body: "Peter confirmed the Kilimani pilot date. Kitchen display needs to be stable by then.", hoursAgo: 30, internal: true },
  { project: "ordering", author: "brian", body: "On it. SSE fallback is working on the test tablets.", hoursAgo: 5 },
  { project: "booking", author: "victor", body: "Let's keep Joseph updated twice a week until the second integration is done.", hoursAgo: 28, internal: true },
  { client: "northstar", author: "sarah", body: "Hi Grace, a quick reminder that invoice for sprint 2 has been sent. Let me know if Michael needs anything else.", hoursAgo: 70 },
  { client: "northstar", author: "grace", body: "Received, thank you Sarah. Michael will process it with this week's payments.", hoursAgo: 64 },
  { author: "victor", body: "Team lunch on Friday at Java House Westgate — 1pm. 🎉", hoursAgo: 26 },
  { author: "sarah", body: "Reminder: please log your hours for September by end of day tomorrow.", hoursAgo: 4 },
];

type EventSeed = { title: string; type: EventType; dayOffset: number; time?: string; durationMin?: number; project?: string; client?: string; location?: string; description?: string };

export const DEMO_EVENTS: EventSeed[] = [
  { title: "Northstar weekly sync", type: "MEETING", dayOffset: 1, time: "10:00", durationMin: 45, project: "ecommerce", client: "northstar", location: "Google Meet" },
  { title: "Greenline kitchen display demo", type: "MEETING", dayOffset: 2, time: "14:30", durationMin: 60, project: "ordering", client: "greenline", location: "Greenline Kilimani" },
  { title: "Baraka Health proposal call", type: "MEETING", dayOffset: 3, time: "11:00", durationMin: 30, client: "baraka", location: "Phone" },
  { title: "Studio planning", type: "MEETING", dayOffset: 4, time: "09:00", durationMin: 60, location: "Studio" },
  { title: "Kibo dashboard design review", type: "MEETING", dayOffset: 6, time: "15:00", durationMin: 45, project: "kibo-dashboard", client: "kibo", location: "Zoom" },
  { title: "Amani Legal intro call", type: "MEETING", dayOffset: 8, time: "12:00", durationMin: 30, client: "amani", location: "Google Meet" },
  { title: "Northstar weekly sync", type: "MEETING", dayOffset: 8, time: "10:00", durationMin: 45, project: "ecommerce", client: "northstar", location: "Google Meet" },
  { title: "VAT return due", type: "DEADLINE", dayOffset: 16, description: "File monthly VAT return on iTax." },
  { title: "Savannah Safaris status call", type: "MEETING", dayOffset: -2, time: "16:00", durationMin: 30, project: "booking", client: "savannah", location: "Phone" },
  { title: "Northstar weekly sync", type: "MEETING", dayOffset: -6, time: "10:00", durationMin: 45, project: "ecommerce", client: "northstar", location: "Google Meet" },
];

/** Small, real files uploaded to Storage during seeding so downloads work. */
export const DEMO_FILES: {
  name: string;
  mimeType: string;
  project?: string;
  client?: string;
  folder?: string;
  uploader: DemoPersonKey;
  shared?: boolean;
  daysAgo: number;
  content: string;
}[] = [
  {
    name: "Project brief.md",
    mimeType: "text/markdown",
    project: "ecommerce",
    client: "northstar",
    folder: "Briefs",
    uploader: "victor",
    shared: true,
    daysAgo: 60,
    content:
      "# Northstar — E-commerce Redesign\n\n## Goals\n- Reduce checkout drop-off by 30%\n- Mobile-first product discovery\n- Marketing team can update banners without developers\n\n## Scope\n1. Discovery\n2. Design system\n3. Storefront + checkout (M-Pesa STK push)\n4. CMS\n5. Testing & launch\n",
  },
  {
    name: "Sitemap.csv",
    mimeType: "text/csv",
    project: "ecommerce",
    client: "northstar",
    folder: "Briefs",
    uploader: "aisha",
    shared: true,
    daysAgo: 48,
    content: "page,path,owner\nHome,/,Marketing\nShop,/shop,Product\nProduct,/shop/[slug],Product\nCart,/cart,Product\nCheckout,/checkout,Engineering\nAbout,/about,Marketing\n",
  },
  {
    name: "Brand palette.svg",
    mimeType: "image/svg+xml",
    project: "nova-site",
    client: "nova",
    folder: "Design assets",
    uploader: "aisha",
    shared: true,
    daysAgo: 35,
    content:
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><rect width="100" height="100" fill="#2f3e46"/><rect x="100" width="100" height="100" fill="#84a98c"/><rect x="200" width="100" height="100" fill="#cad2c5"/><rect x="300" width="100" height="100" fill="#e9c46a"/></svg>',
  },
  {
    name: "UAT checklist.md",
    mimeType: "text/markdown",
    project: "ecommerce",
    client: "northstar",
    uploader: "david",
    shared: true,
    daysAgo: 2,
    content: "# UAT checklist\n\n- [ ] Browse categories on mobile\n- [ ] Add to cart, apply discount code\n- [ ] Checkout with M-Pesa (sandbox)\n- [ ] Receive order confirmation email\n- [ ] Update homepage banner in CMS\n",
  },
  {
    name: "Rate limits notes.txt",
    mimeType: "text/plain",
    project: "booking",
    client: "savannah",
    uploader: "brian",
    daysAgo: 9,
    content: "Channel manager B: 60 req/min documented, ~20 req/min in practice.\nPlan: queue + exponential back-off, nightly full sync, webhook for deltas.\n",
  },
  {
    name: "Studio rate card.md",
    mimeType: "text/markdown",
    folder: "Studio",
    uploader: "victor",
    daysAgo: 90,
    content: "# Mwangaza Studio — rate card\n\n| Service | Rate |\n|---|---|\n| Design (per day) | KSh 28,000 |\n| Development (per hour) | KSh 3,500 |\n| Discovery workshop | KSh 35,000 |\n",
  },
];
