import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

vi.mock('/vite.svg', () => ({ default: 'vite.svg' }))
vi.mock('./assets/react.svg', () => ({ default: 'react.svg' }))

import App from './App'

it('renders the MinistrySprout product name and tagline', () => {
  const markup = renderToStaticMarkup(<App />)

  const renderedText = markup.replaceAll('&#x27;', "'")

  expect(renderedText).toContain('MinistrySprout')
  expect(renderedText).toContain("Children's ministry, ready anywhere.")
})
