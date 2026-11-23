/**
 * Smoke: 缺「專案起始日」時工程排程顯示提示（textContent），不隱藏 #schedule-container。
 * 執行：node modules/projects/tools/test-schedule-missing-start-date.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCHEDULE_MISSING_START_DATE_MESSAGE,
  mountScheduleMissingStartDateHint,
} from '../js/scheduleRenderHints.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const scheduleActionsSrc = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'scheduleActions.js'),
  'utf8'
);

assert(
  scheduleActionsSrc.includes('mountScheduleMissingStartDateHint'),
  'scheduleActions uses missing-start hint helper'
);
assert(
  !scheduleActionsSrc.includes("if (!overview['專案起始日']) {\n        container.style.display = 'none';"),
  'must not hide schedule container when start date missing'
);
assert(
  scheduleActionsSrc.includes('progressWrapper'),
  'schedule with start date still renders progress UI'
);

const container = {
  innerHTML: '',
  style: { display: 'none' },
  _nodes: [],
  appendChild(node) {
    this._nodes.push(node);
    return node;
  },
};

globalThis.document = {
  createElement(tag) {
    const el = {
      tagName: tag.toUpperCase(),
      className: '',
      textContent: '',
      style: {},
      _children: [],
      appendChild(child) {
        this._children.push(child);
        return child;
      },
    };
    return el;
  },
};

mountScheduleMissingStartDateHint(container);

assert.equal(container.style.display, '', 'container stays visible for tab navigation');
assert.equal(container._nodes.length, 1, 'renders one card');
const paragraph = container._nodes[0]._children[0];
assert.equal(paragraph.textContent, SCHEDULE_MISSING_START_DATE_MESSAGE, 'hint uses textContent');
assert(SCHEDULE_MISSING_START_DATE_MESSAGE.includes('專案起始日'), 'message mentions missing start date');

console.log('ok: schedule missing start date hint smoke');
