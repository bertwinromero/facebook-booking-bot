/**
 * Knowledge Retrieval Service
 *
 * Simple keyword-based retrieval to inject relevant knowledge into the system prompt.
 * This keeps context usage efficient by only including relevant sections.
 */

import { knowledge } from '../knowledge/mindnistry.js';

interface KeywordMap {
  keywords: string[];
  sections: string[];
}

const keywordMappings: KeywordMap[] = [
  {
    keywords: ['what is', 'about', 'mindnistry', 'who are', 'tell me about', 'introduce'],
    sections: ['about'],
  },
  {
    keywords: ['price', 'pricing', 'cost', 'how much', 'free', 'tier', 'plan', 'subscription', 'monthly', 'annual', 'pay'],
    sections: ['pricing'],
  },
  {
    keywords: ['feature', 'what can', 'capabilities', 'offer', 'include', 'do you have'],
    sections: ['features_core'],
  },
  {
    keywords: ['addon', 'add-on', 'extra', 'premium', 'upgrade', 'payment', 'accounting', 'facial', 'recognition', 'growth track', 'kanban', 'multi-church', 'network', 'status automation', 'meetup'],
    sections: ['features_addons'],
  },
  {
    keywords: ['member', 'members', 'how many', '100', '500', '1000', 'unlimited'],
    sections: ['pricing'],
  },
  {
    keywords: ['start', 'get started', 'begin', 'setup', 'set up', 'onboard', 'sign up', 'register'],
    sections: ['gettingStarted', 'faq_getting_started'],
  },
  {
    keywords: ['migrate', 'import', 'spreadsheet', 'excel', 'csv', 'transfer'],
    sections: ['faq_migration'],
  },
  {
    keywords: ['compare', 'vs', 'versus', 'better', 'different', 'why'],
    sections: ['comparisons', 'about_usp'],
  },
  {
    keywords: ['facial', 'face', 'recognition', 'check-in', 'contactless', 'attendance'],
    sections: ['faq_facial', 'addon_facial'],
  },
  {
    keywords: ['multi', 'campus', 'location', 'branch', 'network'],
    sections: ['faq_multicampus', 'addon_network'],
  },
  {
    keywords: ['pay', 'payment', 'gcash', 'maya', 'paymongo', 'xendit', 'credit', 'card'],
    sections: ['faq_payment', 'addon_payment'],
  },
  {
    keywords: ['support', 'help', 'training', 'onboarding', 'contact'],
    sections: ['faq_support', 'contact'],
  },
  {
    keywords: ['secure', 'security', 'data', 'privacy', 'safe'],
    sections: ['faq_security'],
  },
  {
    keywords: ['export', 'download', 'backup'],
    sections: ['faq_export'],
  },
  {
    keywords: ['philippine', 'filipino', 'tagalog', 'peso', 'php', 'local'],
    sections: ['faq_filipino', 'about_usp'],
  },
];

/**
 * Get relevant knowledge sections based on user message keywords
 */
export function getRelevantKnowledge(userMessage: string): string {
  const message = userMessage.toLowerCase();
  const matchedSections = new Set<string>();

  // Find all matching sections based on keywords
  for (const mapping of keywordMappings) {
    for (const keyword of mapping.keywords) {
      if (message.includes(keyword)) {
        mapping.sections.forEach((section) => matchedSections.add(section));
        break;
      }
    }
  }

  // If no specific matches, return general about info
  if (matchedSections.size === 0) {
    return '';
  }

  const parts: string[] = [];

  // Build knowledge string from matched sections
  for (const section of matchedSections) {
    const content = getSectionContent(section);
    if (content) {
      parts.push(content);
    }
  }

  if (parts.length === 0) {
    return '';
  }

  return `
---
RELEVANT KNOWLEDGE FOR THIS QUERY:
${parts.join('\n\n')}
---`;
}

function getSectionContent(section: string): string | null {
  switch (section) {
    case 'about':
      return formatAbout();
    case 'about_usp':
      return formatUSP();
    case 'pricing':
      return formatPricing();
    case 'features_core':
      return formatCoreFeatures();
    case 'features_addons':
      return formatAddons();
    case 'gettingStarted':
      return formatGettingStarted();
    case 'comparisons':
      return formatComparisons();
    case 'contact':
      return formatContact();
    case 'faq_getting_started':
      return formatFAQ(['How do I get started?', 'Is there a free trial?']);
    case 'faq_migration':
      return formatFAQ(['How do I migrate from spreadsheets?']);
    case 'faq_facial':
      return formatFAQ(['How does facial recognition work?']);
    case 'faq_multicampus':
      return formatFAQ(['Can I manage multiple church locations?']);
    case 'faq_payment':
      return formatFAQ(['What payment methods do you accept?']);
    case 'faq_support':
      return formatFAQ(['Do you offer training or support?']);
    case 'faq_security':
      return formatFAQ(['Is my data secure?']);
    case 'faq_export':
      return formatFAQ(['Can I export my data?']);
    case 'faq_filipino':
      return formatFAQ(['Do you support Filipino churches?']);
    case 'addon_facial':
      return formatAddon('Facial Recognition');
    case 'addon_network':
      return formatAddon('Multi-Church Network');
    case 'addon_payment':
      return formatAddon('Payment Processing');
    default:
      return null;
  }
}

function formatAbout(): string {
  const { about } = knowledge;
  return `ABOUT MINDNISTRY:
${about.description}
Mission: ${about.mission}

Target Audience:
${about.targetAudience.map((t) => `- ${t}`).join('\n')}`;
}

function formatUSP(): string {
  const { about } = knowledge;
  return `WHY CHOOSE MINDNISTRY:
${about.uniqueSellingPoints.map((p) => `- ${p}`).join('\n')}`;
}

function formatPricing(): string {
  const { pricing } = knowledge;
  return `PRICING (${pricing.currency}):
${pricing.tiers
  .map(
    (tier) =>
      `${tier.name}: ${tier.memberRange} members - ${tier.monthly === 0 ? 'FREE' : `${pricing.currency} ${tier.monthly}/mo`}${tier.annual > 0 ? ` or ${pricing.currency} ${tier.annual}/year (save ${tier.annualSavings})` : ''}`
  )
  .join('\n')}

All plans include: Member management, events, meetups, positions, ministries, analytics.
Add-ons are available for additional features.`;
}

function formatCoreFeatures(): string {
  const { features } = knowledge;
  return `CORE FEATURES (included in all plans):
${features.core
  .map(
    (f) =>
      `${f.name}: ${f.description}
  - ${f.highlights.slice(0, 3).join('\n  - ')}`
  )
  .join('\n\n')}`;
}

function formatAddons(): string {
  const { features } = knowledge;
  return `PREMIUM ADD-ONS:
${features.addons
  .map((a) => `${a.name}: PHP ${a.price}/mo - ${a.description}`)
  .join('\n')}`;
}

function formatAddon(name: string): string {
  const addon = knowledge.features.addons.find((a) => a.name === name);
  if (!addon) return '';
  return `${addon.name} (PHP ${addon.price}/mo):
${addon.description}
- ${addon.highlights.join('\n- ')}`;
}

function formatGettingStarted(): string {
  const { gettingStarted } = knowledge;
  return `HOW TO GET STARTED:
${gettingStarted.steps.map((s) => `${s.step}. ${s.title}: ${s.description}`).join('\n')}`;
}

function formatComparisons(): string {
  const { comparisons } = knowledge;
  return `WHY MINDNISTRY VS SPREADSHEETS:
${comparisons.vsSpreadsheets.points.map((p) => `- ${p.category}: ${p.mindnistry} (vs ${p.other})`).join('\n')}

VS OTHER CHURCH MANAGEMENT SYSTEMS:
${comparisons.vsOtherCMS.points.map((p) => `- ${p.category}: ${p.mindnistry}`).join('\n')}`;
}

function formatFAQ(questions: string[]): string {
  const matchedFAQs = knowledge.faq.filter((f) =>
    questions.some((q) => f.question.toLowerCase().includes(q.toLowerCase()))
  );
  if (matchedFAQs.length === 0) return '';
  return matchedFAQs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
}

function formatContact(): string {
  const { contact } = knowledge;
  return `CONTACT:
Email: ${contact.email}
Website: ${contact.website}
${contact.demo}`;
}

/**
 * Get full knowledge summary for general queries
 * Used when we need to provide comprehensive info
 */
export function getFullKnowledgeSummary(): string {
  return `
MINDNISTRY OVERVIEW:
${knowledge.about.description}

PRICING:
- FREE: Up to 100 members
- Starter: PHP 999/mo (101-500 members)
- Growth: PHP 1,999/mo (501-1,000 members)
- Enterprise: PHP 3,499/mo (unlimited)

CORE FEATURES: ${knowledge.features.core.map((f) => f.name).join(', ')}

ADD-ONS: ${knowledge.features.addons.map((a) => `${a.name} (PHP ${a.price}/mo)`).join(', ')}

UNIQUE BENEFITS: ${knowledge.about.uniqueSellingPoints.slice(0, 3).join('; ')}
`;
}
