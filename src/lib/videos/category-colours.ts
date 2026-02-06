/**
 * Category colour generator for video cards.
 * Produces deterministic HSL colours from category name strings for consistent visual distinction.
 */

/**
 * Generate a deterministic HSL colour string from a category name.
 * Uses a simple hash to produce consistent hue values (0-360) for the same name.
 * @param categoryName - The category name to hash
 * @returns HSL colour string (e.g., "hsl(240, 65%, 55%)")
 */
export function getCategoryColour(categoryName: string): string {
  // Simple string hash to generate hue (0-360)
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Map hash to hue range (0-360)
  const hue = Math.abs(hash % 360);

  // Fixed saturation and lightness for consistent appearance
  const saturation = 65;
  const lightness = 55;

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
