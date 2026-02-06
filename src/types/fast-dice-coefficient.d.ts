declare module 'fast-dice-coefficient' {
  /**
   * Compute the Dice coefficient (Sorensen-Dice) between two strings.
   * Returns a value between 0 (no similarity) and 1 (identical).
   */
  function diceCoefficient(string1: string, string2: string): number;
  export default diceCoefficient;
}
