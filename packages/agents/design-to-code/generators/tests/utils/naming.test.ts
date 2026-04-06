import { describe, it, expect } from 'vitest';
import { toPascalCase, toSnakeCase, toFileName, toIdentifier } from '../../src/utils/naming.js';

describe('toPascalCase', () => {
  it('converts space-separated words', () => {
    expect(toPascalCase('home screen')).toBe('HomeScreen');
  });
  it('converts hyphen-separated words', () => {
    expect(toPascalCase('primary-button')).toBe('PrimaryButton');
  });
  it('converts camelCase by treating it as a single word', () => {
    expect(toPascalCase('myComponent')).toBe('MyComponent');
  });
  it('handles already PascalCase', () => {
    expect(toPascalCase('HomeScreen')).toBe('HomeScreen');
  });
  it('handles underscore-separated words', () => {
    expect(toPascalCase('home_screen')).toBe('HomeScreen');
  });
});

describe('toSnakeCase', () => {
  it('converts PascalCase', () => {
    expect(toSnakeCase('HomeScreen')).toBe('home_screen');
  });
  it('converts PrimaryButton', () => {
    expect(toSnakeCase('PrimaryButton')).toBe('primary_button');
  });
  it('converts space-separated', () => {
    expect(toSnakeCase('home screen')).toBe('home_screen');
  });
  it('converts hyphen-separated', () => {
    expect(toSnakeCase('home-screen')).toBe('home_screen');
  });
  it('lowercases everything', () => {
    expect(toSnakeCase('ABC')).toBe('abc');
  });
});

describe('toFileName', () => {
  it('returns .tsx for react-native', () => {
    expect(toFileName('HomeScreen', 'react-native')).toBe('HomeScreen.tsx');
  });
  it('returns .dart for flutter', () => {
    expect(toFileName('HomeScreen', 'flutter')).toBe('home_screen.dart');
  });
  it('converts to snake_case for flutter', () => {
    expect(toFileName('PrimaryButton', 'flutter')).toBe('primary_button.dart');
  });
});

describe('toIdentifier', () => {
  it('replaces dots with underscores', () => {
    expect(toIdentifier('colors.primary.500')).toBe('colors_primary_500');
  });
  it('collapses multiple underscores to single', () => {
    expect(toIdentifier('a--b')).toBe('a_b');
  });
  it('prefixes digit-starting names', () => {
    expect(toIdentifier('500px')).toBe('_500px');
  });
});
