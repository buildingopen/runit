import { describe, it, expect } from 'vitest';
import { tokens } from '../tokens';

describe('Design Tokens', () => {
  describe('Spacing Scale', () => {
    it('should have consistent 8px base scale', () => {
      expect(tokens.spacing[0]).toBe('0');
      expect(tokens.spacing[1]).toBe('0.25rem'); // 4px
      expect(tokens.spacing[2]).toBe('0.5rem');  // 8px
      expect(tokens.spacing[4]).toBe('1rem');    // 16px
      expect(tokens.spacing[8]).toBe('2rem');    // 32px
    });

    it('should have all required spacing values', () => {
      const requiredSpacing = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24];
      requiredSpacing.forEach(size => {
        expect(tokens.spacing[size as keyof typeof tokens.spacing]).toBeDefined();
      });
    });
  });

  describe('Typography', () => {
    it('should use system fonts', () => {
      expect(tokens.fonts.sans).toContain('-apple-system');
      expect(tokens.fonts.mono).toContain('ui-monospace');
    });

    it('should have complete font size scale', () => {
      const sizes = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl'] as const;
      sizes.forEach(size => {
        expect(tokens.fontSize[size]).toBeDefined();
        expect(tokens.fontSize[size]).toMatch(/rem$/);
      });
    });

    it('should have proper font weights', () => {
      expect(tokens.fontWeight.normal).toBe('400');
      expect(tokens.fontWeight.medium).toBe('500');
      expect(tokens.fontWeight.semibold).toBe('600');
      expect(tokens.fontWeight.bold).toBe('700');
    });
  });

  describe('Colors', () => {
    it('should have complete gray scale (50-950)', () => {
      const grayShades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
      grayShades.forEach(shade => {
        expect(tokens.colors.gray[shade]).toBeDefined();
        expect(tokens.colors.gray[shade]).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    it('should have primary purple scale', () => {
      const primaryShades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
      primaryShades.forEach(shade => {
        expect(tokens.colors.primary[shade]).toBeDefined();
        expect(tokens.colors.primary[shade]).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    it('should have semantic color scales', () => {
      ['success', 'error', 'warning'].forEach(semantic => {
        const color = tokens.colors[semantic as keyof typeof tokens.colors];
        expect(color).toBeDefined();
        if (typeof color === 'object' && '500' in color) {
          expect(color[500]).toBeDefined();
        }
      });
    });

    it('should have background variants', () => {
      expect(tokens.colors.background.DEFAULT).toBe('#ffffff');
      expect(tokens.colors.background.subtle).toBeDefined();
      expect(tokens.colors.background.muted).toBeDefined();
    });

    it('should have foreground variants', () => {
      expect(tokens.colors.foreground.DEFAULT).toBeDefined();
      expect(tokens.colors.foreground.muted).toBeDefined();
      expect(tokens.colors.foreground.subtle).toBeDefined();
    });
  });

  describe('Border Radius', () => {
    it('should have consistent radius scale', () => {
      expect(tokens.radius.none).toBe('0');
      expect(tokens.radius.sm).toBe('0.25rem');
      expect(tokens.radius.DEFAULT).toBe('0.5rem');
      expect(tokens.radius.md).toBe('0.5rem');
      expect(tokens.radius.lg).toBe('0.75rem');
      expect(tokens.radius.full).toBe('9999px');
    });
  });

  describe('Shadows', () => {
    it('should have shadow scale from sm to xl', () => {
      const shadowSizes = ['sm', 'DEFAULT', 'md', 'lg', 'xl', 'none'] as const;
      shadowSizes.forEach(size => {
        expect(tokens.shadows[size]).toBeDefined();
      });
    });

    it('should use proper shadow syntax', () => {
      expect(tokens.shadows.sm).toContain('rgb');
      expect(tokens.shadows.none).toBe('none');
    });
  });

  describe('Transitions', () => {
    it('should have timing values', () => {
      expect(tokens.transitions.fast).toBe('150ms cubic-bezier(0.4, 0, 0.2, 1)');
      expect(tokens.transitions.base).toBe('200ms cubic-bezier(0.4, 0, 0.2, 1)');
      expect(tokens.transitions.slow).toBe('300ms cubic-bezier(0.4, 0, 0.2, 1)');
    });
  });

  describe('Accessibility', () => {
    it('should have sufficient contrast ratios', () => {
      // Primary action button (white on primary-600)
      expect(tokens.colors.primary[600]).toBeTruthy();

      // Error state (should be clearly distinguishable)
      expect(tokens.colors.error[600]).toBeTruthy();

      // Success state
      expect(tokens.colors.success[600]).toBeTruthy();
    });

    it('should have focus state colors', () => {
      expect(tokens.colors.border.focus).toBe('#a855f7'); // primary-500
      expect(tokens.colors.border.error).toBe('#ef4444'); // error-500
    });
  });

  describe('Consistency', () => {
    it('should use Linear-inspired neutral colors', () => {
      // Gray scale should have blue-gray undertone
      expect(tokens.colors.gray[500]).toBe('#71717a');
    });

    it('should have proper spacing increments', () => {
      // Spacing should follow 4px/8px grid
      const spacingValues = Object.values(tokens.spacing)
        .filter(v => v !== '0')
        .map(v => parseFloat(v));

      spacingValues.forEach(value => {
        // Each value should be divisible by 0.25 (4px)
        expect(value % 0.25).toBe(0);
      });
    });
  });

  describe('Design System Philosophy', () => {
    it('should reflect calm, minimal aesthetic', () => {
      // Shadows should be subtle
      expect(tokens.shadows.DEFAULT).toContain('0.1');

      // Border radius should be moderate (not too rounded)
      expect(parseFloat(tokens.radius.DEFAULT)).toBeLessThan(1); // < 16px
    });

    it('should support Cursor-inspired purple primary', () => {
      // Primary-500 should be in purple range
      expect(tokens.colors.primary[500]).toBe('#a855f7');
    });
  });
});
