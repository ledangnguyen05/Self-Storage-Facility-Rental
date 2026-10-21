/**
 * Business facts shown in the UI. Nothing else may hard-code a hotline, email,
 * address, tax ID or social link.
 *
 * The backend (seed data, mail templates, properties) carries none of these
 * values, so they were consolidated from the frontend's most-used copy:
 * - hotline: `1900 269 672` ("1900-BOXORA") was used in 22 places; `1900 6868`,
 *   `1980 6868` and `1900 6828` were also present and are retired.
 * - tax ID: `0317892345` (contract document) vs `0317894562` (invoice block);
 *   the contract value is kept. Confirm both with the business owner.
 */
export const SITE_CONFIG = {
  brandName: 'Boxora',
  tagline: 'Kho tự quản thông minh',

  company: {
    legalName: 'Công ty Cổ phần Dịch vụ Lưu trữ Boxora',
    shortName: 'Công ty CP Boxora',
    taxId: '0317892345',
    taxIdIssuer: 'Sở Kế hoạch và Đầu tư TP. Hồ Chí Minh',
  },

  hotline: {
    /** Display form. */
    display: '1900 269 672',
    /** Vanity form printed on marketing pages. */
    vanity: '1900-BOXORA',
    /** `tel:` href. */
    href: 'tel:1900269672',
    hours: '24/7',
  },

  supportEmail: 'support@boxora.vn',
  supportEmailHref: 'mailto:support@boxora.vn',

  headquarters: {
    name: 'Boxora Quận 1',
    address: '123 Nguyễn Huệ, P. Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    mapUrl: 'https://maps.google.com/?q=123+Nguyen+Hue+Ben+Nghe+Quan+1+Ho+Chi+Minh',
  },

  social: {
    /** Zalo OA chat link (number from the existing contact widget; confirm before launch). */
    zalo: 'https://zalo.me/0901234567',
    facebook: '',
    youtube: '',
  },

  website: 'https://boxora.vn',
} as const

export type SiteConfig = typeof SITE_CONFIG
