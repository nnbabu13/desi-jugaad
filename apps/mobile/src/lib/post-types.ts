/**
 * ============================================================================
 * Posting types (Prompt.md §12)
 * ============================================================================
 *
 * One declarative definition per Post action. The generic form renderer
 * (`app/post-form.tsx`) reads these, so adding a post type never means
 * writing a new screen.
 *
 * POLICY (Prompt.md §16): parcel assistance must never carry price,
 * compensation, payment or delivery-guarantee fields. That is enforced here
 * by construction - the parcel types simply have no such fields - and the
 * renderer additionally refuses to render a money-typed field for them.
 * Do not add `price`, `fee`, `payment`, `reward` or `guarantee` keys to the
 * parcel types.
 */

import type { CategoryId } from '@/components/categories';
import type { IoniconName } from './icons';

/* --------------------------------------------------------------------------- *
 * Field model
 * ------------------------------------------------------------------------ */

export type PostFieldType = 'text' | 'textarea' | 'select' | 'number' | 'switch' | 'date';

export interface PostFieldOption {
  value: string;
  label: string;
}

export interface PostField {
  key: string;
  label: string;
  type: PostFieldType;
  /** Rendered with the required marker and enforced by validation. */
  required?: boolean;
  placeholder?: string;
  /** Short helper shown under the control when there is no error. */
  hint?: string;
  /** Policy or safety note shown above the control. */
  help?: string;
  options?: PostFieldOption[];
  maxLength?: number;
  /** Digits-only keyboard for numeric fields. */
  numeric?: boolean;
}

/* --------------------------------------------------------------------------- *
 * Post type model
 * ------------------------------------------------------------------------ */

export type PostTypeId =
  | 'list-property'
  | 'find-room'
  | 'offer-service'
  | 'need-service'
  | 'parcel-help'
  | 'travel-help'
  | 'ask-community';

export interface PostTypeDef {
  id: PostTypeId;
  /** Label shown on the Post sheet. */
  label: string;
  /** Short label used on buttons and chips. */
  shortLabel: string;
  icon: IoniconName;
  tint: 'primary' | 'secondary' | 'accent' | 'neutral';
  category: CategoryId;
  /** One-line explanation on the sheet row. */
  description: string;
  /** Guidance rendered at the top of the form. */
  intro: string;
  /** Field used as the draft's display title. */
  titleField: string;
  /**
   * Parcel-only safety note. Rendered prominently by the form so nobody can
   * mistake the feature for a paid courier service.
   */
  safetyNotice?: string;
  fields: PostField[];
}

/* --------------------------------------------------------------------------- *
 * Shared option sets
 * ------------------------------------------------------------------------ */

const CURRENCIES: PostFieldOption[] = [
  { value: 'GBP', label: 'GBP £' },
  { value: 'EUR', label: 'EUR €' },
  { value: 'USD', label: 'USD $' },
  { value: 'CAD', label: 'CAD $' },
  { value: 'AUD', label: 'AUD $' },
  { value: 'AED', label: 'AED د.إ' },
  { value: 'INR', label: 'INR ₹' },
];

const ACCOMMODATION_TYPES: PostFieldOption[] = [
  { value: 'room_shared', label: 'Room in a shared home' },
  { value: 'room_private', label: 'Room with private bathroom' },
  { value: 'entire_flat', label: 'Entire flat' },
  { value: 'shared_house', label: 'Shared house' },
  { value: 'studio', label: 'Studio' },
];

const FURNISHED: PostFieldOption[] = [
  { value: 'furnished', label: 'Furnished' },
  { value: 'part_furnished', label: 'Part-furnished' },
  { value: 'unfurnished', label: 'Unfurnished' },
];

const SERVICE_CATEGORIES: PostFieldOption[] = [
  { value: 'beauty', label: 'Beauty and Personal Care' },
  { value: 'it', label: 'IT and Technical Support' },
  { value: 'education', label: 'Education and Tutoring' },
  { value: 'home', label: 'Home Services' },
  { value: 'professional', label: 'Professional Services' },
  { value: 'food', label: 'Food and Catering' },
  { value: 'transport', label: 'Transport' },
  { value: 'fitness', label: 'Fitness and Wellness' },
  { value: 'other', label: 'Other' },
];

const COMMUNITY_TOPICS: PostFieldOption[] = [
  { value: 'moving_abroad', label: 'Moving Abroad' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'student_life', label: 'Student Life' },
  { value: 'jobs', label: 'Jobs and Career' },
  { value: 'shopping', label: 'Shopping and Groceries' },
  { value: 'recommendations', label: 'Local Recommendations' },
  { value: 'travel', label: 'Travel' },
  { value: 'general', label: 'General Discussion' },
];

const YES_NO: PostFieldOption[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const ADDRESS_NOTICE =
  'Share only the area or neighbourhood. Exact residential addresses are never shown publicly.';

const PARCEL_SAFETY =
  'Desi Jugaad does not take payment, set prices or guarantee delivery for parcel assistance. ' +
  'Arrange the details directly with the other person, and never hand over valuables or documents.';

/* --------------------------------------------------------------------------- *
 * The seven Post actions
 * ------------------------------------------------------------------------ */

export const POST_TYPES: PostTypeDef[] = [
  {
    id: 'list-property',
    label: 'List a room or property',
    shortLabel: 'List property',
    icon: 'home-outline',
    tint: 'primary',
    category: 'rentals',
    description: 'Advertise a room, flat or entire property.',
    intro: 'Give enough detail for someone to decide before they message you.',
    titleField: 'title',
    fields: [
      {
        key: 'title',
        label: 'Listing title',
        type: 'text',
        required: true,
        maxLength: 80,
        placeholder: 'Sunny room near the station',
      },
      {
        key: 'location',
        label: 'City and neighbourhood',
        type: 'text',
        required: true,
        maxLength: 120,
        placeholder: 'London, Hammersmith',
        help: ADDRESS_NOTICE,
      },
      {
        key: 'accommodationType',
        label: 'Accommodation type',
        type: 'select',
        required: true,
        options: ACCOMMODATION_TYPES,
      },
      { key: 'rent', label: 'Monthly rent', type: 'number', required: true, numeric: true, placeholder: '850' },
      { key: 'currency', label: 'Currency', type: 'select', required: true, options: CURRENCIES },
      {
        key: 'furnished',
        label: 'Furnished',
        type: 'select',
        options: FURNISHED,
      },
      { key: 'availableFrom', label: 'Available from', type: 'date', placeholder: 'YYYY-MM-DD' },
      {
        key: 'billsIncluded',
        label: 'Bills included',
        type: 'select',
        options: YES_NO,
        hint: 'Utilities such as water, electricity and internet.',
      },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        required: true,
        maxLength: 1200,
        placeholder: 'Describe the room, the household and the area.',
      },
      {
        key: 'houseRules',
        label: 'House rules',
        type: 'textarea',
        maxLength: 600,
        placeholder: 'Quiet hours, pets, guests, smoking…',
      },
    ],
  },
  {
    id: 'find-room',
    label: 'Looking for a room',
    shortLabel: 'Find a room',
    icon: 'search-outline',
    tint: 'primary',
    category: 'rentals',
    description: 'Tell landlords and flatmates what you need.',
    intro: 'The clearer your budget and dates, the better the matches.',
    titleField: 'headline',
    fields: [
      {
        key: 'headline',
        label: 'What are you looking for?',
        type: 'text',
        required: true,
        maxLength: 80,
        placeholder: 'Quiet room for a working professional',
      },
      {
        key: 'location',
        label: 'City and area',
        type: 'text',
        required: true,
        maxLength: 120,
        placeholder: 'Manchester, City Centre',
        help: ADDRESS_NOTICE,
      },
      { key: 'budget', label: 'Monthly budget', type: 'number', numeric: true, placeholder: '700' },
      { key: 'currency', label: 'Currency', type: 'select', options: CURRENCIES },
      { key: 'moveIn', label: 'Move-in date', type: 'date', placeholder: 'YYYY-MM-DD' },
      {
        key: 'aboutYou',
        label: 'About you',
        type: 'textarea',
        required: true,
        maxLength: 800,
        placeholder: 'Your habits, work or study, and what you are like to live with.',
      },
      {
        key: 'preferences',
        label: 'Preferences',
        type: 'textarea',
        maxLength: 400,
        placeholder: 'Non-smoker, no pets, happy to share with students…',
      },
    ],
  },
  {
    id: 'offer-service',
    label: 'Offer a service',
    shortLabel: 'Offer service',
    icon: 'construct-outline',
    tint: 'secondary',
    category: 'services',
    description: 'Publish what you do, for your city.',
    intro: 'Businesses and freelancers both use the same form.',
    titleField: 'businessName',
    fields: [
      {
        key: 'businessName',
        label: 'Business or display name',
        type: 'text',
        required: true,
        maxLength: 80,
        placeholder: 'Meera’s Tax Services',
      },
      {
        key: 'category',
        label: 'Service category',
        type: 'select',
        required: true,
        options: SERVICE_CATEGORIES,
      },
      {
        key: 'location',
        label: 'City you serve',
        type: 'text',
        required: true,
        maxLength: 120,
        placeholder: 'Toronto',
      },
      {
        key: 'summary',
        label: 'Short description',
        type: 'textarea',
        required: true,
        maxLength: 600,
        placeholder: 'What you offer and who it is for.',
      },
      {
        key: 'qualifications',
        label: 'Qualifications',
        type: 'textarea',
        maxLength: 400,
        placeholder: 'Certifications, training or experience.',
        hint: 'Optional. Only add what you can evidence.',
      },
      {
        key: 'contactEmail',
        label: 'Contact email',
        type: 'text',
        maxLength: 120,
        placeholder: 'you@example.com',
        hint: 'Optional. Shown only to people who contact you.',
      },
    ],
  },
  {
    id: 'need-service',
    label: 'Need a service',
    shortLabel: 'Need service',
    icon: 'help-buoy-outline',
    tint: 'secondary',
    category: 'services',
    description: 'Ask a local professional for help.',
    intro: 'Describe the job so the right people can reply.',
    titleField: 'headline',
    fields: [
      {
        key: 'headline',
        label: 'What do you need?',
        type: 'text',
        required: true,
        maxLength: 80,
        placeholder: 'Boiler service before winter',
      },
      {
        key: 'category',
        label: 'Service category',
        type: 'select',
        required: true,
        options: SERVICE_CATEGORIES,
      },
      {
        key: 'location',
        label: 'City',
        type: 'text',
        required: true,
        maxLength: 120,
        placeholder: 'Birmingham',
      },
      { key: 'whenNeeded', label: 'When do you need it?', type: 'date', placeholder: 'YYYY-MM-DD' },
      {
        key: 'details',
        label: 'Details',
        type: 'textarea',
        required: true,
        maxLength: 800,
        placeholder: 'Scope, access, timing and anything unusual.',
      },
    ],
  },
  {
    id: 'parcel-help',
    label: 'Need parcel assistance',
    shortLabel: 'Parcel help',
    icon: 'airplane-outline',
    tint: 'accent',
    category: 'parcel',
    description: 'Ask a traveller heading your way.',
    intro: 'You are asking a fellow traveller for help, not booking a courier.',
    titleField: 'need',
    safetyNotice: PARCEL_SAFETY,
    fields: [
      {
        key: 'need',
        label: 'What do you need carried?',
        type: 'textarea',
        required: true,
        maxLength: 600,
        placeholder: 'A small box of books and clothes, about 4 kg.',
      },
      { key: 'from', label: 'Collected in', type: 'text', required: true, maxLength: 120, placeholder: 'Dubai' },
      { key: 'to', label: 'Delivered to', type: 'text', required: true, maxLength: 120, placeholder: 'Kochi' },
      { key: 'byDate', label: 'Needed by', type: 'date', placeholder: 'YYYY-MM-DD' },
      {
        key: 'notes',
        label: 'Notes',
        type: 'textarea',
        maxLength: 500,
        placeholder: 'Timing, pickup flexibility, anything fragile.',
      },
    ],
  },
  {
    id: 'travel-help',
    label: 'Travelling and willing to help',
    shortLabel: 'I’m travelling',
    icon: 'navigate-outline',
    tint: 'accent',
    category: 'parcel',
    description: 'Share your journey and what you can carry.',
    intro: 'Let people going your way know you have space.',
    titleField: 'route',
    safetyNotice: PARCEL_SAFETY,
    fields: [
      { key: 'from', label: 'Travelling from', type: 'text', required: true, maxLength: 120, placeholder: 'London' },
      { key: 'to', label: 'Travelling to', type: 'text', required: true, maxLength: 120, placeholder: 'Ahmedabad' },
      { key: 'departure', label: 'Departure date', type: 'date', required: true, placeholder: 'YYYY-MM-DD' },
      {
        key: 'capacity',
        label: 'What can you carry?',
        type: 'textarea',
        required: true,
        maxLength: 600,
        placeholder: 'One checked bag, around 8 kg, happy to carry sealed items.',
      },
      {
        key: 'notes',
        label: 'Notes',
        type: 'textarea',
        maxLength: 500,
        placeholder: 'Layovers, meeting points, what you will not carry.',
      },
    ],
  },
  {
    id: 'ask-community',
    label: 'Ask the community',
    shortLabel: 'Ask',
    icon: 'chatbubbles-outline',
    tint: 'neutral',
    category: 'community',
    description: 'Questions, tips and local recommendations.',
    intro: 'Specific questions get better answers.',
    titleField: 'question',
    fields: [
      {
        key: 'question',
        label: 'Question or topic',
        type: 'text',
        required: true,
        maxLength: 120,
        placeholder: 'Which areas are good for a first rental in Dublin?',
      },
      {
        key: 'topic',
        label: 'Topic',
        type: 'select',
        required: true,
        options: COMMUNITY_TOPICS,
      },
      {
        key: 'location',
        label: 'City and country',
        type: 'text',
        maxLength: 120,
        placeholder: 'Dublin, Ireland',
        hint: 'Optional. Helps people nearby see it first.',
      },
      {
        key: 'details',
        label: 'Details',
        type: 'textarea',
        required: true,
        maxLength: 1200,
        placeholder: 'Add context, what you have already tried, and your deadline.',
      },
    ],
  },
];

export function postTypeById(id: string | undefined | null): PostTypeDef | null {
  if (!id) return null;
  return POST_TYPES.find((t) => t.id === id) ?? null;
}

/** The Post type a Home/Explore category shortcut should open. */
export function postTypeForCategory(category: CategoryId): PostTypeDef {
  const map: Record<CategoryId, PostTypeId> = {
    rentals: 'list-property',
    services: 'offer-service',
    parcel: 'parcel-help',
    community: 'ask-community',
  };
  const found = postTypeById(map[category]);
  if (!found) throw new Error(`No post type for category ${category}`);
  return found;
}

/** Parcel types are subject to the no-money rule in Prompt.md §16. */
export function isParcelType(type: PostTypeDef): boolean {
  return type.category === 'parcel';
}

/**
 * Fields that are forbidden on parcel posts. The renderer refuses to draw
 * them even if a future edit adds them to a config by mistake.
 */
const FORBIDDEN_PARCEL_KEYS = ['price', 'fee', 'cost', 'payment', 'reward', 'compensation', 'guarantee'];

export function assertFieldsAllowed(type: PostTypeDef): PostField[] {
  if (!isParcelType(type)) return type.fields;
  return type.fields.filter((f) => !FORBIDDEN_PARCEL_KEYS.includes(f.key));
}
