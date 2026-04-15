/**
 * Template engine — Handlebars-based code renderer.
 *
 * Compiles and caches Handlebars templates, then renders ViewModels into
 * final file content.  Custom helpers:
 *
 *   {{eq a b}}   — strict equality
 *   {{ne a b}}   — strict inequality
 *   {{not a}}    — boolean negation
 */

import Handlebars from 'handlebars';
import type { TemplateDelegate } from 'handlebars';
import { RN_COMPONENT_TEMPLATE, FLUTTER_COMPONENT_TEMPLATE } from './templates.js';

// ─── Register custom helpers ──────────────────────────────────────────────────

Handlebars.registerHelper('eq',  (a: unknown, b: unknown) => a === b);
Handlebars.registerHelper('ne',  (a: unknown, b: unknown) => a !== b);
Handlebars.registerHelper('not', (a: unknown) => !a);

// ─── Template registry ────────────────────────────────────────────────────────

type TemplateName = 'react-native/component' | 'flutter/component';

const SOURCE_MAP: Record<TemplateName, string> = {
  'react-native/component': RN_COMPONENT_TEMPLATE,
  'flutter/component':      FLUTTER_COMPONENT_TEMPLATE,
};

/** Compiled template cache — populated lazily on first use. */
const compiled: Partial<Record<TemplateName, TemplateDelegate>> = {};

function getTemplate(name: TemplateName): TemplateDelegate {
  if (!compiled[name]) {
    const source = SOURCE_MAP[name];
    compiled[name] = Handlebars.compile(source, { noEscape: true });
  }
  return compiled[name]!;
}

// ─── Public render function ───────────────────────────────────────────────────

/**
 * Render a named template with the given data.
 *
 * @param name  Template identifier (e.g. 'react-native/component')
 * @param data  ViewModel data object
 * @returns     Rendered file content string
 */
export function renderTemplate(name: TemplateName, data: object): string {
  return getTemplate(name)(data);
}
