const CATEGORY_TYPES: Record<string, Array<string>> = {
  checking: ['checking', 'card'],
  savings: ['savings', 'livret_a', 'ldds'],
  investments: ['market', 'pea', 'pee'],
  insurance: ['lifeinsurance'],
}

const typeToCategory = new Map<string, string>()
for (const [key, types] of Object.entries(CATEGORY_TYPES)) {
  for (const t of types) {
    typeToCategory.set(t, key)
  }
}

export function getCategoryKey(accountType: string | undefined): string {
  return typeToCategory.get(accountType ?? '') ?? 'checking'
}
