import assert from 'node:assert/strict'
import test from 'node:test'
import { formatPriceInput, parsePriceInput } from './prices.js'

test('parses Indonesian thousands separators as grouped digits', () => {
  assert.equal(parsePriceInput('456.000'), 456000)
  assert.equal(parsePriceInput('1.234.567'), 1234567)
  assert.equal(parsePriceInput('456000'), 456000)
  assert.equal(parsePriceInput('Rp 456.000'), 456000)
})

test('rejects ambiguous or invalid price formats', () => {
  assert.equal(parsePriceInput(''), null)
  assert.equal(parsePriceInput('0'), null)
  assert.equal(parsePriceInput('456,000'), null)
  assert.equal(parsePriceInput('45.6000'), null)
  assert.equal(parsePriceInput('9007199254740992'), null)
})

test('formats prices for Indonesian input fields', () => {
  assert.equal(formatPriceInput(456000), '456.000')
  assert.equal(formatPriceInput(1234567), '1.234.567')
  assert.equal(formatPriceInput(0), '')
})
