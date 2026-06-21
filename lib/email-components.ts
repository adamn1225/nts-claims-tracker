/**
 * MJML Component Library for Freight TeamMember Email Templates
 * Pre-built components that can be inserted into email templates
 */

import {
  Type,
  AlignLeft,
  Phone,
  Mail,
  Truck,
  Calendar,
  MapPin,
  DollarSign,
  User,
  Building,
  Minus,
  Image,
} from "lucide-react";

export interface EmailComponent {
  id: string;  
  icon: any;
  label: string;
  category: "layout" | "content" | "freight";
  mjml: string;
  description: string;
}

/**
 * Get the base URL for the application
 * Uses NEXT_PUBLIC_APP_URL from environment or falls back to localhost
 */
export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Client-side: use window.location.origin
    return window.location.origin;
  }
  // Server-side: use environment variable
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

/**
 * Freight teamMember-specific email components
 * Uses NTS brand colors and freight industry terminology
 */
const BASE_URL = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || 'https://sales.ntsconnect.com');

export const EMAIL_COMPONENTS: EmailComponent[] = [
  // === LAYOUT COMPONENTS ===
  {
    id: "logo",
    icon: Image,
    label: "NTS Logo",
    category: "layout",
    description: "Company logo (centered)",
    mjml: `    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-image src="${BASE_URL}/NTS-logo.svg" alt="NTS Logo" width="200px" align="center" />
      </mj-column>
    </mj-section>`,
  },
  {
    id: "header-image",
    icon: Image,
    label: "Header Image",
    category: "layout",
    description: "NTS branded header",
    mjml: `    <mj-section padding="0">
      <mj-column>
        <mj-image src="${BASE_URL}/nts-header01.png" alt="NTS Header" width="600px" />
      </mj-column>
    </mj-section>`,
  },
  {
    id: "header",
    icon: Type,
    label: "Header Text",
    category: "layout",
    description: "Page header with title",
    mjml: `    <mj-section background-color="#E85D04" padding="30px 20px">
      <mj-column>
        <mj-text color="#ffffff" font-size="28px" font-weight="bold" align="center">
          {{company}} - Your Freight Solution
        </mj-text>
      </mj-column>
    </mj-section>`,
  },
  {
    id: "divider",
    icon: Minus,
    label: "Divider",
    category: "layout",
    description: "Horizontal line separator",
    mjml: `    <mj-section background-color="#ffffff" padding="10px 20px">
      <mj-column>
        <mj-divider border-color="#E85D04" border-width="2px" />
      </mj-column>
    </mj-section>`,
  },
  {
    id: "footer",
    icon: AlignLeft,
    label: "Footer Text",
    category: "layout",
    description: "Email footer with contact info",
    mjml: `    <mj-section background-color="#1A1A1A" padding="30px 20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="16px" font-weight="bold">
          {{team_member_name}}
        </mj-text>
        <mj-text align="center" color="#FFA726" font-size="14px">
          Nationwide Transport Services
        </mj-text>
        <mj-text align="center" color="#cccccc" font-size="12px" padding-top="10px">
          📞 {{broker_phone}} | ✉️ {{broker_email}}
        </mj-text>
      </mj-column>
    </mj-section>`,
  },
  {
    id: "footer-image",
    icon: Image,
    label: "Footer Image",
    category: "layout",
    description: "NTS branded footer",
    mjml: `    <mj-section padding="0" background-color="#1A1A1A">
      <mj-column>
        <mj-image src="${BASE_URL}/nts-footer%2001.png" alt="NTS Footer" width="600px" />
      </mj-column>
    </mj-section>`,
  },

  // === CONTENT COMPONENTS ===
  {
    id: "custom-image",
    icon: Image,
    label: "Custom Image",
    category: "content",
    description: "Add any image (edit URL)",
    mjml: `    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-image src="${BASE_URL}/your-image.png" alt="Image description" width="400px" align="center" />
      </mj-column>
    </mj-section>`,
  },
  {
    id: "greeting",
    icon: User,
    label: "Greeting",
    category: "content",
    description: "Personal greeting",
    mjml: `    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text color="#333333" font-size="16px" line-height="24px">
          Hi {{first_name}},
        </mj-text>
      </mj-column>
    </mj-section>`,
  },
  {
    id: "text-block",
    icon: AlignLeft,
    label: "Text Block",
    category: "content",
    description: "Paragraph of text",
    mjml: `    <mj-section background-color="#ffffff" padding="10px 20px">
      <mj-column>
        <mj-text color="#333333" font-size="15px" line-height="22px">
          Your text content goes here. This is a standard paragraph that you can customize with your message.
        </mj-text>
      </mj-column>
    </mj-section>`,
  },
  {
    id: "call-to-action",
    icon: Phone,
    label: "Call to Action",
    category: "content",
    description: "Button for action",
    mjml: `    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-button background-color="#E85D04" color="#ffffff" font-size="16px" font-weight="bold" href="tel:{{broker_phone}}" padding="15px 30px">
          📞 Call Me Now
        </mj-button>
      </mj-column>
    </mj-section>`,
  },

  // === FREIGHT-SPECIFIC COMPONENTS ===
  {
    id: "lane-info",
    icon: MapPin,
    label: "Lane Information",
    category: "freight",
    description: "Shipping route details",
    mjml: `    <mj-section background-color="#f8fafc" padding="20px">
      <mj-column>
        <mj-text color="#E85D04" font-size="14px" font-weight="bold" padding-bottom="10px">
          🚛 Shipping Lanes
        </mj-text>
        <mj-text color="#333333" font-size="14px" line-height="20px">
          <strong>Routes:</strong> {{lanes}}<br/>
          <strong>Frequency:</strong> {{frequency}}<br/>
          <strong>Equipment:</strong> Dry Van, Flatbed, or Reefer
        </mj-text>
      </mj-column>
    </mj-section>`,
  },
  {
    id: "quote-summary",
    icon: DollarSign,
    label: "Quote Summary",
    category: "freight",
    description: "Pricing information",
    mjml: `    <mj-section background-color="#fff7ed" border="2px solid #FFA726" padding="20px">
      <mj-column>
        <mj-text color="#E85D04" font-size="18px" font-weight="bold" align="center" padding-bottom="10px">
          💰 Your Quote
        </mj-text>
        <mj-text color="#333333" font-size="14px" line-height="22px">
          <strong>Rate:</strong> Competitive pricing based on current market<br/>
          <strong>Transit Time:</strong> 2-3 business days<br/>
          <strong>Insurance:</strong> Fully covered<br/>
          <strong>Tracking:</strong> Real-time updates
        </mj-text>
      </mj-column>
    </mj-section>`,
  },
  {
    id: "next-steps",
    icon: Calendar,
    label: "Next Steps",
    category: "freight",
    description: "Action items and follow-up",
    mjml: `    <mj-section background-color="#eff6ff" padding="20px">
      <mj-column>
        <mj-text color="#1e40af" font-size="16px" font-weight="bold" padding-bottom="10px">
          📋 Next Steps
        </mj-text>
        <mj-text color="#333333" font-size="14px" line-height="22px">
          {{next_steps}}
        </mj-text>
        <mj-text color="#64748b" font-size="12px" padding-top="10px" font-style="italic">
          I'll follow up with you soon to discuss further.
        </mj-text>
      </mj-column>
    </mj-section>`,
  },
  {
    id: "contact-teamMember",
    icon: Mail,
    label: "TeamMember Contact",
    category: "freight",
    description: "TeamMember contact card",
    mjml: `    <mj-section background-color="#ffffff" border="1px solid #e5e7eb" padding="20px">
      <mj-column>
        <mj-text color="#E85D04" font-size="16px" font-weight="bold" padding-bottom="10px">
          👤 Your Dedicated TeamMember
        </mj-text>
        <mj-text color="#333333" font-size="14px" line-height="22px">
          <strong>{{team_member_name}}</strong><br/>
          📞 {{broker_phone}}<br/>
          ✉️ {{broker_email}}<br/>
          🏢 Nationwide Transport Services
        </mj-text>
      </mj-column>
    </mj-section>`,
  },
  {
    id: "company-intro",
    icon: Building,
    label: "Company Intro",
    category: "freight",
    description: "About NTS",
    mjml: `    <mj-section background-color="#f0fdf4" padding="20px">
      <mj-column>
        <mj-text color="#065f46" font-size="16px" font-weight="bold" padding-bottom="10px">
          🚛 Why Choose NTS?
        </mj-text>
        <mj-text color="#333333" font-size="14px" line-height="22px">
          ✅ Reliable, on-time delivery<br/>
          ✅ Competitive rates<br/>
          ✅ Nationwide coverage<br/>
          ✅ 24/7 customer support<br/>
          ✅ Real-time tracking
        </mj-text>
      </mj-column>
    </mj-section>`,
  },
  {
    id: "urgency-note",
    icon: Truck,
    label: "Urgency Notice",
    category: "freight",
    description: "Time-sensitive message",
    mjml: `    <mj-section background-color="#fef3c7" border-left="4px solid #f59e0b" padding="20px">
      <mj-column>
        <mj-text color="#92400e" font-size="15px" font-weight="bold" padding-bottom="5px">
          ⚠️ Time-Sensitive Opportunity
        </mj-text>
        <mj-text color="#78350f" font-size="14px" line-height="20px">
          Current market rates are favorable. Let's discuss securing capacity for your upcoming shipments before rates increase.
        </mj-text>
      </mj-column>
    </mj-section>`,
  },
];

/**
 * Get a basic MJML template wrapper
 */
export function getMJMLWrapper(content: string): string {
  return `<mjml>
  <mj-head>
    <mj-title>{{subject}}</mj-title>
    <mj-preview>{{subject}}</mj-preview>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
      <mj-text color="#333333" font-size="14px" line-height="20px" />
      <mj-section padding="0px" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f1f5f9">
${content}
  </mj-body>
</mjml>`;
}

/**
 * Starter template for new emails
 */
export const STARTER_TEMPLATE = getMJMLWrapper(`    <mj-section background-color="#E85D04" padding="30px 20px">
      <mj-column>
        <mj-text color="#ffffff" font-size="28px" font-weight="bold" align="center">
          Hi {{first_name}}!
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="30px 20px">
      <mj-column>
        <mj-text color="#333333" font-size="16px" line-height="24px">
          Start building your email by adding components from the library on the left.
        </mj-text>
        <mj-text color="#64748b" font-size="14px" padding-top="10px">
          Click any component to insert it into your email template.
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#1A1A1A" padding="30px 20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="16px" font-weight="bold">
          {{team_member_name}}
        </mj-text>
        <mj-text align="center" color="#FFA726" font-size="14px">
          Nationwide Transport Services
        </mj-text>
        <mj-text align="center" color="#cccccc" font-size="12px" padding-top="10px">
          📞 {{broker_phone}} | ✉️ {{broker_email}}
        </mj-text>
      </mj-column>
    </mj-section>`);
