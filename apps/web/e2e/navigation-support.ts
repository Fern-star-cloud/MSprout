import { expect, type Page } from '@playwright/test'

export async function openChurchDestination(page: Page, label: string, role: 'owner' | 'teacher') {
  const teacherLabels: Record<string, string> = { Ministries: 'My ministries', Students: 'Assigned roster', Reports: 'Recent sessions' }
  const target = role === 'teacher' ? teacherLabels[label] ?? label : label
  const desktop = page.getByRole('navigation', { name: 'Main navigation', exact: true })
  if (await desktop.isVisible()) { await desktop.getByRole('link', { name: target, exact: true }).click(); return }
  const menu = page.getByRole('button', { name: 'Menu', exact: true })
  if (await menu.isVisible()) {
    await menu.click()
    await page.getByRole('navigation', { name: 'Tablet navigation', exact: true }).getByRole('link', { name: target, exact: true }).click()
    return
  }
  const phone = page.getByRole('navigation', { name: 'Phone navigation', exact: true })
  const direct = phone.getByRole('link', { name: target, exact: true })
  if (await direct.count()) { await direct.click(); return }
  const people = role === 'owner' && ['Students', 'Ministries', 'Teachers', 'Import'].includes(label)
  await phone.getByRole('link', { name: people ? 'People' : 'More', exact: true }).click()
  const destinations = page.getByRole('navigation', { name: people ? 'People destinations' : 'More destinations', exact: true })
  await expect(destinations).toBeVisible()
  await destinations.getByRole('link', { name: target, exact: true }).click()
}
