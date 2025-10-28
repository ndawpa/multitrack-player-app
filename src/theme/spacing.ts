/**
 * Standardized spacing system for consistent layout across all screens
 * Based on 8px grid system for better alignment and visual harmony
 */

export const spacing = {
  // Base spacing units (8px grid)
  xs: 4,    // 4px
  sm: 8,    // 8px
  md: 12,   // 12px
  lg: 16,   // 16px
  xl: 20,   // 20px
  xxl: 24,  // 24px
  xxxl: 32, // 32px
  xxxxl: 40, // 40px
  xxxxxl: 48, // 48px
} as const;

export const layout = {
  // Container padding
  containerPadding: spacing.lg, // 16px
  containerPaddingHorizontal: spacing.lg, // 16px
  containerPaddingVertical: spacing.xxl, // 24px
  
  // Section spacing
  sectionMarginBottom: spacing.xxl, // 24px
  sectionMarginHorizontal: spacing.xl, // 20px
  
  // Item spacing
  itemMarginBottom: spacing.md, // 12px
  itemPadding: spacing.lg, // 16px
  
  // Header spacing
  headerPadding: spacing.lg, // 16px
  headerPaddingVertical: spacing.md, // 12px
  
  // Form spacing
  formPadding: spacing.xxl, // 24px
  inputMarginBottom: spacing.xl, // 20px
  labelMarginBottom: spacing.sm, // 8px
  
  // Button spacing
  buttonMarginTop: spacing.xl, // 20px
  buttonMarginBottom: spacing.md, // 12px
  
  // Modal spacing
  modalPadding: spacing.lg, // 16px
  modalHeaderPadding: spacing.lg, // 16px
  
  // Safe area spacing
  safeAreaBottom: spacing.xl, // 20px
} as const;

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  round: 50,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.5,
    elevation: 5,
  },
} as const;
