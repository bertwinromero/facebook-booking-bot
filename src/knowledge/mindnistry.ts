/**
 * Mindnistry Knowledge Base
 *
 * Structured knowledge about Mindnistry (Fellowship Flow Manager) for the AI assistant.
 * This gets injected into the system prompt based on user queries.
 */

export const knowledge = {
  about: {
    name: 'Mindnistry',
    fullName: 'Fellowship Flow Manager',
    description: 'A comprehensive church management system designed for small to mid-sized churches in the Philippines.',
    mission: 'Help churches streamline administration and member engagement by replacing scattered spreadsheets and paper records with one unified platform.',
    tagline: 'Your church, organized.',
    targetAudience: [
      'Small to mid-sized churches (50-1,000+ members)',
      'Church plants just getting started',
      'Growing churches moving from spreadsheets',
      'Multi-campus churches and church networks',
    ],
    uniqueSellingPoints: [
      'Only platform with a truly FREE tier (50-100 members)',
      'Philippine-focused with local payment gateways (Xendit, PayMongo)',
      'Modern tech stack (fast, reliable, mobile-friendly)',
      'Pay only for features you need with modular add-ons',
      'No setup fees or hidden costs',
      'Tagalog support and Philippine timezone optimized',
    ],
    website: 'https://mindnistry.com',
  },

  features: {
    core: [
      {
        name: 'Member Management',
        description: 'Complete member profiles with contact info, family relationships, status tracking, and spiritual journey milestones.',
        highlights: [
          'CSV import/export for easy migration',
          'Custom fields for church-specific data',
          'Member status tracking (New, Regular, Active, etc.)',
          'Family relationship mapping',
          'Birthday and anniversary reminders',
          'Member directory with search and filters',
        ],
      },
      {
        name: 'Events Management',
        description: 'Create and manage unlimited events with registration, attendance tracking, and analytics.',
        highlights: [
          'Unlimited events creation',
          'Online registration with QR codes',
          'Attendance tracking (manual or QR scan)',
          'Event reminders via email/SMS',
          'Recurring events support',
          'Event analytics and reports',
        ],
      },
      {
        name: 'Meetups & Small Groups',
        description: 'Organize and track cell groups, Bible studies, and small group meetings.',
        highlights: [
          'Group creation and management',
          'Leader assignment and tracking',
          'Meeting schedules with reminders',
          'Attendance per meetup',
          'Group growth analytics',
          'Member-to-group assignment',
        ],
      },
      {
        name: 'Positions & Roles',
        description: 'Define organizational hierarchy and manage volunteer positions.',
        highlights: [
          'Custom position hierarchy',
          'Role-based permissions',
          'Volunteer scheduling',
          'Position history tracking',
          'Leadership pipeline visibility',
        ],
      },
      {
        name: 'Ministry Management',
        description: 'Organize church ministries and track volunteer participation.',
        highlights: [
          'Ministry/department creation',
          'Volunteer assignment',
          'Service history tracking',
          'Ministry-specific communications',
        ],
      },
      {
        name: 'Dashboard & Analytics',
        description: 'Visual insights into church growth, engagement, and health metrics.',
        highlights: [
          'Member growth trends',
          'Attendance patterns',
          'Engagement metrics',
          'Ministry participation stats',
          'Exportable reports',
        ],
      },
    ],

    addons: [
      {
        name: 'Meetups Add-on',
        price: 399,
        currency: 'PHP',
        period: 'month',
        description: 'Enhanced small groups management with advanced scheduling and attendance.',
        highlights: [
          'Advanced group scheduling',
          'Automated attendance reminders',
          'Group health scoring',
          'Leader training tracking',
        ],
      },
      {
        name: 'Status Automation',
        price: 299,
        currency: 'PHP',
        period: 'month',
        description: 'Automatically progress member status based on attendance and participation.',
        highlights: [
          'Rule-based status changes',
          'Attendance-triggered progression',
          'Inactivity alerts',
          'Re-engagement workflows',
        ],
      },
      {
        name: 'Payment Processing',
        price: 799,
        currency: 'PHP',
        period: 'month',
        description: 'Accept tithes, offerings, and event fees online with Philippine payment gateways.',
        highlights: [
          'Xendit integration',
          'PayMongo integration',
          'Stripe support',
          'Automated giving receipts',
          'Giving history and reports',
          'Recurring giving setup',
        ],
      },
      {
        name: 'Advanced Accounting',
        price: 799,
        currency: 'PHP',
        period: 'month',
        description: 'Full accounting features for church finances.',
        highlights: [
          'Budget management',
          'Expense tracking',
          'Financial reports',
          'Audit trails',
          'Multi-fund accounting',
        ],
      },
      {
        name: 'Growth Tracks',
        price: 799,
        currency: 'PHP',
        period: 'month',
        description: 'Discipleship courses with progress tracking and certificates.',
        highlights: [
          'Custom discipleship courses',
          'Lesson and module creation',
          'Progress tracking per member',
          'Certificate generation',
          'Prerequisite courses',
          'Completion analytics',
        ],
      },
      {
        name: 'Facial Recognition',
        price: 999,
        currency: 'PHP',
        period: 'month',
        description: 'Contactless attendance using facial recognition technology.',
        highlights: [
          'One-time face enrollment',
          'Instant check-in via camera',
          'Works on any device with camera',
          'Privacy-focused (data stays local)',
          'Fallback to QR code',
        ],
      },
      {
        name: 'Multi-Church Network',
        price: 999,
        currency: 'PHP',
        period: 'month',
        description: 'Manage multiple campuses or church network from one dashboard.',
        highlights: [
          'Centralized member database',
          'Per-campus reporting',
          'Shared resources across campuses',
          'Network-wide analytics',
          'Campus-level admin roles',
        ],
      },
      {
        name: 'Kanban Project Management',
        price: 499,
        currency: 'PHP',
        period: 'month',
        description: 'Visual task boards for church projects and ministry coordination.',
        highlights: [
          'Drag-and-drop task boards',
          'Task assignment',
          'Due dates and reminders',
          'File attachments',
          'Team collaboration',
        ],
      },
    ],
  },

  pricing: {
    currency: 'PHP',
    tiers: [
      {
        name: 'FREE',
        memberRange: '50-100',
        monthly: 0,
        annual: 0,
        description: 'Perfect for small churches just getting started.',
        includes: [
          'All core features',
          'Up to 100 members',
          'Unlimited events',
          'Basic analytics',
          'Email support',
        ],
      },
      {
        name: 'Starter',
        memberRange: '101-500',
        monthly: 999,
        annual: 9990,
        annualSavings: '17%',
        description: 'For growing churches with expanding needs.',
        includes: [
          'Everything in FREE',
          'Up to 500 members',
          'Priority email support',
          'Data export',
        ],
      },
      {
        name: 'Growth',
        memberRange: '501-1,000',
        monthly: 1999,
        annual: 19990,
        annualSavings: '17%',
        description: 'For established churches with active ministries.',
        includes: [
          'Everything in Starter',
          'Up to 1,000 members',
          'Phone support',
          'Custom reports',
        ],
      },
      {
        name: 'Enterprise',
        memberRange: 'Unlimited',
        monthly: 3499,
        annual: 34990,
        annualSavings: '17%',
        description: 'For large churches and multi-campus networks.',
        includes: [
          'Everything in Growth',
          'Unlimited members',
          'Dedicated support',
          'Custom integrations',
          'SLA guarantee',
        ],
      },
    ],
  },

  faq: [
    {
      question: 'How do I get started?',
      answer: 'Sign up for a FREE account at mindnistry.com. You can import your existing member data via CSV and start using the platform immediately. We also offer free demo calls to walk you through the setup.',
    },
    {
      question: 'Is there a free trial?',
      answer: 'Better than a trial - we have a completely FREE tier for churches with up to 100 members. No credit card required, no time limit. You can upgrade anytime as your church grows.',
    },
    {
      question: 'How do I migrate from spreadsheets?',
      answer: 'Export your spreadsheet as CSV, then use our import wizard. We support Excel and Google Sheets exports. Our team can also assist with data migration for larger churches.',
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept GCash, Maya (PayMaya), credit/debit cards, and bank transfers via Xendit and PayMongo. For annual plans, we also accept check payments.',
    },
    {
      question: 'Can I upgrade or downgrade anytime?',
      answer: 'Yes! You can change your plan at any time. Upgrades are prorated, and downgrades take effect at the next billing cycle.',
    },
    {
      question: 'How does facial recognition work?',
      answer: 'Members enroll their face once using any device camera. For check-in, they simply look at the camera and are instantly marked present. All face data is encrypted and stored securely.',
    },
    {
      question: 'Can I manage multiple church locations?',
      answer: "Yes! With the Multi-Church Network add-on, you can manage unlimited campuses from one dashboard. Each campus can have its own admins while sharing a unified member database.",
    },
    {
      question: "What's included in the free tier?",
      answer: 'The FREE tier includes ALL core features: member management, events, meetups, positions, ministries, and basic analytics. The only limitation is the 100 member cap.',
    },
    {
      question: 'Do you offer training or support?',
      answer: 'Yes! All plans include email support. We offer free onboarding calls, video tutorials, and documentation. Paid plans get priority support, and Enterprise includes dedicated support.',
    },
    {
      question: 'Is my data secure?',
      answer: 'Absolutely. We use industry-standard encryption, secure hosting on Supabase (backed by AWS), and follow data privacy best practices. Your church data is never shared or sold.',
    },
    {
      question: 'Can I export my data?',
      answer: 'Yes, all plans allow data export. You can export members, attendance records, and other data as CSV files anytime.',
    },
    {
      question: 'Do you support Filipino churches?',
      answer: 'Yes! Mindnistry was built specifically for Philippine churches. We support Tagalog, Philippine timezones, local payment methods (GCash, Maya), and peso pricing.',
    },
  ],

  gettingStarted: {
    steps: [
      {
        step: 1,
        title: 'Sign Up',
        description: 'Create your free account at mindnistry.com. No credit card required.',
      },
      {
        step: 2,
        title: 'Set Up Your Church',
        description: 'Enter your church details, logo, and basic settings.',
      },
      {
        step: 3,
        title: 'Import Members',
        description: 'Upload your existing member list via CSV or add members manually.',
      },
      {
        step: 4,
        title: 'Configure Features',
        description: 'Set up ministries, positions, member statuses, and other settings.',
      },
      {
        step: 5,
        title: 'Invite Your Team',
        description: 'Add admin users and assign roles to your leadership team.',
      },
      {
        step: 6,
        title: 'Go Live',
        description: 'Start using Mindnistry for events, attendance, and member management!',
      },
    ],
  },

  comparisons: {
    vsSpreadsheets: {
      title: 'Mindnistry vs Spreadsheets',
      points: [
        { category: 'Real-time updates', mindnistry: 'Yes, instant sync', other: 'Manual, version conflicts' },
        { category: 'Mobile access', mindnistry: 'Full mobile app', other: 'Limited, clunky' },
        { category: 'Attendance tracking', mindnistry: 'QR codes, facial recognition', other: 'Manual entry' },
        { category: 'Analytics', mindnistry: 'Automatic dashboards', other: 'Manual chart creation' },
        { category: 'Multi-user access', mindnistry: 'Role-based permissions', other: 'File sharing issues' },
        { category: 'Data backup', mindnistry: 'Automatic cloud backup', other: 'Manual, easy to lose' },
      ],
    },
    vsOtherCMS: {
      title: 'Mindnistry vs Other Church Management Systems',
      points: [
        { category: 'Free tier', mindnistry: 'Yes (100 members)', other: 'Usually no or very limited' },
        { category: 'Philippine pricing', mindnistry: 'PHP, local payments', other: 'USD, international cards only' },
        { category: 'Modular features', mindnistry: 'Pay for what you need', other: 'All-or-nothing packages' },
        { category: 'Local support', mindnistry: 'Philippine timezone', other: 'US timezone, delayed responses' },
        { category: 'Facial recognition', mindnistry: 'Available', other: 'Rare or expensive' },
        { category: 'Setup fees', mindnistry: 'None', other: 'Often $500+' },
      ],
    },
  },

  contact: {
    email: 'support@mindnistry.com',
    website: 'https://mindnistry.com',
    demo: 'Book a free demo through our website or this chat!',
  },
};

export type Knowledge = typeof knowledge;
