import { describe, it, expect } from 'vitest'
import { parseSseDataLine } from '../src/utils/api.js'

describe('parseSseDataLine', () => {
  it('解析标准 data 行', () => {
    const line = 'data: {"choices":[{"delta":{"content":"hi"}}]}'
    expect(parseSseDataLine(line)).toBe('{"choices":[{"delta":{"content":"hi"}}]}')
  })

  it('解析无空格 data 行', () => {
    expect(parseSseDataLine('data:{"a":1}')).toBe('{"a":1}')
  })

  it('保留 DONE 标记', () => {
    expect(parseSseDataLine('data: [DONE]')).toBe('[DONE]')
  })

  it('非 data 行返回 null', () => {
    expect(parseSseDataLine('event: message')).toBeNull()
    expect(parseSseDataLine('')).toBeNull()
  })

  it('空 data 行返回空字符串', () => {
    expect(parseSseDataLine('data:')).toBe('')
  })
})
