import male from '../../assets/avatars/male.svg'
import female from '../../assets/avatars/female.svg'
import neutral from '../../assets/avatars/neutral.svg'

export function avatarForGender(gender: string | null | undefined): string {
  if (gender === 'male') return male
  if (gender === 'female') return female
  return neutral
}
