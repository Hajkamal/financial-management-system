import { INITIAL_CUSTOM_CATEGORIES } from '../data/initialData';
import type { CustomCategoryDefinition } from '../types';
/** Empty/missing configuration uses official defaults. Existing custom lists are authoritative. */
export function resolveTransactionCategories(list: CustomCategoryDefinition[] | null | undefined): CustomCategoryDefinition[] {
  return Array.isArray(list) && list.length > 0 ? list : INITIAL_CUSTOM_CATEGORIES;
}
