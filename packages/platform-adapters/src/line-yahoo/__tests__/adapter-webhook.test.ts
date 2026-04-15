import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Platform } from '@omni-ad/shared';
import { LineYahooAdapter } from '../adapter.js';

const adapter = new LineYahooAdapter('test-client-id', 'test-client-secret');

test('parseWebhook classifies a widget click as cv1', () => {
  const event = adapter.parseWebhook({}, { event_type: 'widget_click', tag_id: 'xyz' });
  assert.equal(event.platform, Platform.LINE_YAHOO);
  assert.equal(event.eventType, 'conversion');
  assert.equal(event.stage, 'cv1');
  assert.equal(event.eventName, 'LINE_CLICK');
});

test('parseWebhook classifies a friend-add as cv2', () => {
  const event = adapter.parseWebhook({}, { event_type: 'friend_add' });
  assert.equal(event.stage, 'cv2');
  assert.equal(event.eventName, 'LINE_REGISTER');
});

test('parseWebhook classifies a form submit as cv3', () => {
  const event = adapter.parseWebhook({}, { action: 'form_submit' });
  assert.equal(event.stage, 'cv3');
  assert.equal(event.eventName, 'FORM_SUBMIT');
});

test('parseWebhook falls through to other for unknown tags', () => {
  const event = adapter.parseWebhook({}, { type: 'bounce' });
  assert.equal(event.stage, 'other');
  assert.equal(event.eventName, 'LINE_OTHER');
});

test('parseWebhook tolerates missing fields', () => {
  const event = adapter.parseWebhook({}, {});
  assert.equal(event.stage, 'other');
});
