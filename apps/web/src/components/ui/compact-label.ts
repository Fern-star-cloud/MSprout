/** Bound display code points only; retain the complete source string. */
export function compactLabel(value: string, maximum = 50) {
  const characters = Array.from(value)
  return characters.length > maximum ? characters.slice(0, maximum - 1).join('') + '…' : value
}
