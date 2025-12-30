# Design System Quick Reference

## Color Palette

### Primary (Purple - Cursor-inspired)
```
primary-50:  #faf5ff
primary-100: #f3e8ff
primary-200: #e9d5ff
primary-300: #d8b4fe
primary-400: #c084fc
primary-500: #a855f7  ← Focus color
primary-600: #9333ea  ← Primary action
primary-700: #7e22ce  ← Hover
primary-800: #6b21a8  ← Active
primary-900: #581c87
```

### Neutrals (Blue-gray - Linear-inspired)
```
gray-50:  #fafafa
gray-100: #f4f4f5  ← Muted backgrounds
gray-200: #e4e4e7  ← Borders
gray-300: #d4d4d8
gray-400: #a1a1aa  ← Subtle text
gray-500: #71717a
gray-600: #52525b  ← Muted text
gray-700: #3f3f46
gray-800: #27272a
gray-900: #18181b  ← Primary text
```

### Semantic Colors
```
Success: #22c55e (green-500)
Error:   #ef4444 (red-500)
Warning: #f59e0b (amber-500)
```

---

## Typography Scale

```
text-xs:   12px (0.75rem)
text-sm:   14px (0.875rem)  ← Helper text, captions
text-base: 16px (1rem)      ← Body text
text-lg:   18px (1.125rem)
text-xl:   20px (1.25rem)   ← Card titles
text-2xl:  24px (1.5rem)    ← Page headings
text-3xl:  30px (1.875rem)
text-4xl:  36px (2.25rem)
```

**Font Weights:**
- `font-normal` (400): Body text
- `font-medium` (500): Labels
- `font-semibold` (600): Headings, buttons
- `font-bold` (700): Emphasis

---

## Spacing Scale (8px Grid)

```
0:  0
1:  4px   (0.25rem)
2:  8px   (0.5rem)   ← Tight spacing
3:  12px  (0.75rem)
4:  16px  (1rem)     ← Default spacing
5:  20px  (1.25rem)
6:  24px  (1.5rem)   ← Section spacing
8:  32px  (2rem)
10: 40px  (2.5rem)
12: 48px  (3rem)
16: 64px  (4rem)
20: 80px  (5rem)
24: 96px  (6rem)
```

**Common Patterns:**
- `gap-2`: Tight item spacing
- `gap-4`: Default item spacing
- `p-4`: Small padding
- `p-6`: Default card padding
- `p-8`: Large section padding

---

## Border Radius

```
rounded-none: 0
rounded-sm:   4px   (0.25rem)
rounded:      8px   (0.5rem)   ← Default
rounded-md:   8px   (0.5rem)
rounded-lg:   12px  (0.75rem)
rounded-xl:   16px  (1rem)
rounded-full: 9999px
```

---

## Shadows (Subtle, Linear-style)

```
shadow-sm: Subtle lift
shadow:    Default elevation
shadow-md: Card hover state
shadow-lg: Dropdown/modal
shadow-xl: Prominent elevation
```

---

## Component Patterns

### Primary Action (CTA)
```tsx
<Button variant="default" size="default">
  Run this endpoint
</Button>

// Styles: bg-primary-600 text-white hover:bg-primary-700
```

### Secondary Action
```tsx
<Button variant="secondary">
  View history
</Button>

// Styles: bg-gray-100 text-gray-900 hover:bg-gray-200
```

### Destructive Action
```tsx
<Button variant="destructive">
  Delete project
</Button>

// Styles: bg-error-600 text-white hover:bg-error-700
```

### Outline Button
```tsx
<Button variant="outline">
  Cancel
</Button>

// Styles: border border-gray-300 bg-white hover:bg-gray-50
```

### Card (Default)
```tsx
<Card variant="default" padding="default">
  <CardHeader>
    <CardTitle>Endpoint Name</CardTitle>
    <CardDescription>Description here</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Main content */}
  </CardContent>
  <CardFooter>
    <Button>Run</Button>
  </CardFooter>
</Card>

// Styles: border border-gray-200 shadow-sm hover:shadow-md p-6
```

### Form Input
```tsx
<Input
  label="API URL"
  placeholder="https://example.com"
  helperText="Enter the URL to extract data from"
/>

// Styles: border-gray-300 focus-visible:border-primary-500 focus-visible:ring-primary-500
```

### Input with Error
```tsx
<Input
  label="API Key"
  error="Invalid API key format"
/>

// Styles: border-error-500 focus-visible:border-error-600
```

---

## Layout Patterns

### Page Container
```tsx
<div className="max-w-7xl mx-auto px-4 py-8">
  {/* Page content */}
</div>
```

### Section Spacing
```tsx
<div className="space-y-6">
  <Card>...</Card>
  <Card>...</Card>
</div>
```

### Form Layout
```tsx
<div className="space-y-4">
  <Input label="Field 1" />
  <Input label="Field 2" />
  <Button>Submit</Button>
</div>
```

### Grid Layout
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Card>...</Card>
  <Card>...</Card>
  <Card>...</Card>
</div>
```

---

## Accessibility

### Focus States
All interactive elements have focus rings:
```
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-primary-500
focus-visible:ring-offset-2
```

### Form Accessibility
- Labels with proper `htmlFor`
- Error messages with `role="alert"`
- Helper text with `aria-describedby`
- Invalid state with `aria-invalid`

### Semantic HTML
- `<button>` for actions
- `<label>` for form labels
- `<h1-h6>` for headings
- `<p>` for body text

---

## Design Principles

### 1. Calm & Minimal
- Subtle shadows
- Moderate border radius
- Ample white space
- Muted colors for non-primary actions

### 2. Outcome-First
- Primary CTA stands out (purple)
- Clear visual hierarchy
- Results before complexity
- Minimal friction

### 3. Google Forms Feel
- Clean white backgrounds
- Sensible defaults
- Clear error states
- Progressive disclosure

---

## Don'ts

❌ Don't use harsh shadows
❌ Don't use fully rounded buttons (use rounded-md max)
❌ Don't use bright, saturated colors
❌ Don't create complex layouts
❌ Don't hide important actions

---

## Quick Combos

### Success Message
```tsx
<div className="text-sm text-success-600">
  Run completed in 2.3s
</div>
```

### Error Message
```tsx
<div className="text-sm text-error-600">
  Run timed out after 60s
</div>
```

### Muted Text
```tsx
<p className="text-sm text-gray-600">
  Last run: 2 hours ago
</p>
```

### Badge (Status)
```tsx
<span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-success-100 text-success-700">
  Ready
</span>
```

### Code Block
```tsx
<code className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
  POST /extract_company
</code>
```

---

## Responsive Breakpoints

```
sm:  640px
md:  768px
lg:  1024px
xl:  1280px
2xl: 1536px
```

**Mobile-first approach:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {/* 1 col on mobile, 2 on tablet, 3 on desktop */}
</div>
```

---

## Animation Timing

```
transition-fast:    150ms
transition:         200ms  ← Default
transition-slow:    300ms

All use: cubic-bezier(0.4, 0, 0.2, 1)
```

**Common Usage:**
```tsx
<button className="transition-all hover:shadow-md">
  Hover me
</button>
```

---

This reference is optimized for **Linear × Cursor × Colab** aesthetic.
