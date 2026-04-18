export type Industry =
  | 'ecommerce_retail'
  | 'd2c_consumer'
  | 'saas_b2b'
  | 'saas_b2c'
  | 'finance_insurance'
  | 'health_wellness'
  | 'education'
  | 'travel_hospitality'
  | 'real_estate'
  | 'auto'
  | 'entertainment_media'
  | 'food_beverage'
  | 'other';

export const ALL_INDUSTRIES: readonly Industry[] = [
  'ecommerce_retail',
  'd2c_consumer',
  'saas_b2b',
  'saas_b2c',
  'finance_insurance',
  'health_wellness',
  'education',
  'travel_hospitality',
  'real_estate',
  'auto',
  'entertainment_media',
  'food_beverage',
  'other',
] as const;
