import { describe, expect, it } from 'vitest'
import { avatarForGender } from './avatar'

describe('avatarForGender', () => {
  it('selects gender defaults and falls back to neutral', () => {
    const male = avatarForGender('male')
    const female = avatarForGender('female')
    const neutral = avatarForGender('unspecified')
    expect(male).toMatch(/^data:image\/svg\+xml/)
    expect(female).not.toBe(male)
    expect(neutral).not.toBe(male)
    expect(avatarForGender(null)).toBe(neutral)
  })
})
