import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { BunkrAvatar } from '../bunkr-avatar'

describe('BunkrAvatar', () => {
  it('renders an img element with the correct src', () => {
    const element = createElement(BunkrAvatar)
    expect(element.type).toBe(BunkrAvatar)
  })

  it('accepts a className prop', () => {
    const element = createElement(BunkrAvatar, { className: 'size-12' })
    expect(element.props.className).toBe('size-12')
  })
})
