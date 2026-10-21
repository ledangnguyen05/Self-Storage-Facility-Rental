// Run with: node --test src/context/i18n/translator.test.mjs   (Node 22.18+ strips the TypeScript types itself)
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createTranslator, localizeNumber } from './translator.ts'
import { ADMIN_ENTRIES } from './entries/admin.ts'
import { BACKEND_ENTRIES } from './entries/backend.ts'
import { COMPOSED_ENTRIES } from './entries/composed.ts'
import { CORE_ENTRIES } from './entries/core.ts'
import { CUSTOMER_ENTRIES } from './entries/customer.ts'
import { MANAGER_ENTRIES } from './entries/manager.ts'
import { MODALS_ENTRIES } from './entries/modals.ts'
import { OPERATIONS_ENTRIES } from './entries/operations.ts'
import { PUBLIC_ENTRIES } from './entries/public.ts'
import { SHELL_ENTRIES } from './entries/shell.ts'
import { STAFF_ENTRIES } from './entries/staff.ts'

const VIETNAMESE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i

const ALL = {
  ...COMPOSED_ENTRIES,
  ...SHELL_ENTRIES,
  ...BACKEND_ENTRIES,
  ...PUBLIC_ENTRIES,
  ...CUSTOMER_ENTRIES,
  ...MODALS_ENTRIES,
  ...STAFF_ENTRIES,
  ...MANAGER_ENTRIES,
  ...OPERATIONS_ENTRIES,
  ...ADMIN_ENTRIES,
  ...CORE_ENTRIES,
}

describe('translator: whole-text matching only', () => {
  const t = createTranslator({
    'Thuê kho ngay': 'Rent a unit now',
    'Tìm kho': 'Find units',
    'Còn {} phòng': '{1} {1:unit|units} left',
    'Chữ ký của {}': 'Signature of {1}',
    'Xem {t}': 'View {1}',
    'hợp đồng thuê': 'rental contracts',
    '{} của {}': '{1} of {2}',
    'Từ chối': 'Rejected',
    'Từ chối@action': 'Reject',
    'Sẵn sàng': 'Available',
    'Kho {}': 'Unit {1}',
    'chờ bàn giao': 'awaiting handover',
  })

  it('translates exact phrases, keeping surrounding whitespace', () => {
    assert.equal(t.translate('Thuê kho ngay'), 'Rent a unit now')
    assert.equal(t.translate('  Thuê kho ngay\n'), '  Rent a unit now\n')
    assert.equal(t.translate('THUÊ KHO NGAY'), 'RENT A UNIT NOW')
  })

  it('never substitutes inside a longer sentence', () => {
    assert.equal(t.translate('Tìm kho gần nhà bạn nhất'), null)
    assert.equal(t.translate('Khoảng cách tới kho'), null)
    assert.equal(t.translate('Các con số là mức mặc định của hệ thống và của bạn'), null)
    assert.equal(t.translate('Thuê kho ngay hôm nay'), null)
  })

  it('fills parameterised patterns and pluralises', () => {
    assert.equal(t.translate('Còn 1 phòng'), '1 unit left')
    assert.equal(t.translate('Còn 5 phòng'), '5 units left')
    assert.equal(t.translate('Chữ ký của Nguyễn Văn A'), 'Signature of Nguyễn Văn A')
  })

  it('rejects parameters that are sentences, not data', () => {
    assert.equal(t.translate('Chữ ký của người dùng đã đăng nhập vào hệ thống'), null)
    assert.equal(t.translate('Còn rất nhiều phòng'), null)
  })

  it('requires a {t} parameter to be a known phrase', () => {
    assert.equal(t.translate('Xem hợp đồng thuê'), 'View rental contracts')
    assert.equal(t.translate('Xem một thứ khác'), null)
  })

  it('does not trust patterns with almost no fixed text unless the values are numbers', () => {
    assert.equal(t.translate('5 của 10'), '5 of 10')
    assert.equal(t.translate('Khách hàng của chúng tôi'), null)
  })

  it('picks the button meaning inside buttons and links only', () => {
    assert.equal(t.translate('Từ chối'), 'Rejected')
    assert.equal(t.translate('Từ chối', 'action'), 'Reject')
  })

  it('translates comma and dot separated fields only when each field is known or plain data', () => {
    assert.equal(t.translate('Kho D1-A101, Sẵn sàng, chờ bàn giao'), 'Unit D1-A101, Available, awaiting handover')
    assert.equal(t.translate('Sẵn sàng · A-101'), 'Available · A-101')
    assert.equal(t.translate('Sẵn sàng, hãy gọi cho chúng tôi ngay'), null)
  })

  it('keeps free text exactly as written inside a {*} capture', () => {
    const free = createTranslator({
      'Cơ sở từ chối yêu cầu: {*}': 'The facility rejected the request: {1}',
      'Sẵn sàng': 'Available',
    })
    assert.equal(free.translate('Cơ sở từ chối yêu cầu: Hết kho trống ở tầng 2'), 'The facility rejected the request: Hết kho trống ở tầng 2')
    assert.equal(free.translate('Cơ sở đã từ chối'), null)
  })

  it('translates several sentences only when every sentence is known', () => {
    const sentences = createTranslator({
      'Đã hủy đơn đặt kho.': 'Booking cancelled.',
      'Tiền thuê đã trả trước {} được hoàn 100%.': 'The prepaid rent of {1} is refunded in full.',
    })
    assert.equal(
      sentences.translate('Đã hủy đơn đặt kho. Tiền thuê đã trả trước 465.000 ₫ được hoàn 100%.'),
      'Booking cancelled. The prepaid rent of 465,000 ₫ is refunded in full.',
    )
    assert.equal(sentences.translate('Đã hủy đơn đặt kho. Quý khách vui lòng kiểm tra lại email.'), null)
  })

  it('leaves data untouched', () => {
    for (const data of ['A-101', 'Nguyễn Văn A', '0912345678', 'customer@gmail.com', '21/10/2026', '08:30', '—']) {
      assert.equal(t.translate(data), null, data)
    }
  })
})

describe('localizeNumber', () => {
  it('converts Vietnamese number formatting only for bare numbers', () => {
    assert.equal(localizeNumber('1.250.000'), '1,250,000')
    assert.equal(localizeNumber('1.250.000 ₫'), '1,250,000 ₫')
    assert.equal(localizeNumber('3,5'), '3.5')
    assert.equal(localizeNumber('85,5%'), '85.5%')
    assert.equal(localizeNumber('450'), null)
    assert.equal(localizeNumber('12.5'), null)
    assert.equal(localizeNumber('Giá 1.250.000'), null)
  })
})

describe('English dictionary', () => {
  const t = createTranslator(ALL)

  it('is large enough to cover the UI', () => {
    assert.ok(t.size.exact > 3000, `exact entries: ${t.size.exact}`)
    assert.ok(t.size.patterns > 300, `patterns: ${t.size.patterns}`)
  })

  it('translates every exact key to its own value (no entry is shadowed by a pattern or case folding)', () => {
    const shadowed = []
    for (const [key, value] of Object.entries(ALL)) {
      if (/\{[t*]?\}/.test(key) || key.endsWith('@action') || /^[\d.,\s₫%-]+$/.test(key)) continue
      if (t.translate(key) !== value) shadowed.push(key)
    }
    assert.deepEqual(shadowed.slice(0, 10), [])
  })

  it('matches every pattern against its own sample', () => {
    const misses = []
    for (const key of Object.keys(ALL)) {
      if (!/\{[t*]?\}/.test(key)) continue
      const sample = key
        .replace(/\{t\}/g, 'hợp đồng thuê')
        .replace(/\{\*\}/g, 'lý do do khách nhập')
        .replace(/\{\}/g, 'A-101 20/10/2026')
      if (t.translate(sample) === null) misses.push(key)
    }
    assert.deepEqual(misses.slice(0, 10), [])
  })

  it('keeps placeholders consistent between Vietnamese and English', () => {
    const problems = []
    for (const [key, value] of Object.entries(ALL)) {
      const holes = (key.match(/\{[t*]?\}/g) ?? []).length
      const refs = [...value.matchAll(/\{(\d+)(?::[^|{}]*\|[^{}]*)?\}/g)].map(match => Number(match[1]))
      if (refs.some(n => n < 1 || n > holes)) problems.push(`${key} => ${value}`)
    }
    assert.deepEqual(problems.slice(0, 10), [])
  })

  it('has no Vietnamese words left in English values', () => {
    const allowed = new Set(['Tiếng Việt'])
    const left = Object.entries(ALL).filter(([, value]) => VIETNAMESE.test(value) && !allowed.has(value))
    // Names such as "Nguyễn Văn A" are examples inside English sentences; everything else is a mistake.
    const real = left.filter(([, value]) => !/Nguyễn|Việt|₫/.test(value))
    assert.deepEqual(real.slice(0, 10), [])
  })

  it('does not produce half-translated text for mangled copies of real phrases', () => {
    const keys = Object.keys(ALL).filter(key => !/\{[t*]?\}/.test(key) && !key.endsWith('@action') && key.length > 12)
    const mixed = []
    for (const key of keys) {
      for (const text of [`${key} và rất nhiều thứ khác nữa`, `Rất nhiều khách hàng cho biết ${key}`]) {
        const out = t.translate(text)
        if (out !== null && VIETNAMESE.test(out)) mixed.push(`${text} => ${out}`)
      }
    }
    assert.deepEqual(mixed.slice(0, 10), [])
  })

  it('handles real composed strings', () => {
    assert.equal(t.translate('5 phút trước'), '5 min ago')
    assert.equal(t.translate('1 ngày trước'), '1 day ago')
    assert.equal(t.translate('3 ngày trước'), '3 days ago')
    assert.equal(t.translate('1.250.000 ₫'), '1,250,000 ₫')
    assert.equal(t.translate('1. Ân hạn'), '1. Grace period')
    assert.equal(
      t.translate('Boxora District 1 · Ca sáng 06:00–14:00 · Vu Thi Lan'),
      'Boxora District 1 · Morning shift 06:00–14:00 · Vu Thi Lan',
    )
    assert.equal(t.translate('Thuê kho'), 'Rent a unit')
  })
})
