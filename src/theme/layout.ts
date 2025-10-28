import { StyleSheet } from 'react-native';
import { spacing, layout, borderRadius, shadows } from './spacing';

/**
 * Common layout patterns and utilities for consistent spacing across screens
 */

export const commonStyles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  
  // Section styles
  section: {
    marginHorizontal: layout.sectionMarginHorizontal,
    marginBottom: layout.sectionMarginBottom,
  },
  
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: layout.itemMarginBottom,
  },
  
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: spacing.sm,
  },
  
  // Card/Item styles
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: borderRadius.lg,
    padding: layout.itemPadding,
    marginBottom: layout.itemMarginBottom,
    borderWidth: 1,
    borderColor: '#333333',
  },
  
  // Form styles
  formContainer: {
    padding: layout.formPadding,
  },
  
  inputGroup: {
    marginBottom: layout.inputMarginBottom,
  },
  
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: layout.labelMarginBottom,
  },
  
  // Button container styles
  buttonContainer: {
    gap: spacing.md,
  },
  
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: layout.modalHeaderPadding,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  
  modalContent: {
    flex: 1,
    padding: layout.modalPadding,
  },
  
  // Loading and error states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: layout.containerPadding,
  },
  
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: layout.containerPadding,
  },
  
  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: layout.containerPadding,
  },
  
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  
  emptySubtitle: {
    fontSize: 16,
    color: '#BBBBBB',
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
});

export const spacingStyles = {
  // Margin utilities
  marginTop: {
    xs: { marginTop: spacing.xs },
    sm: { marginTop: spacing.sm },
    md: { marginTop: spacing.md },
    lg: { marginTop: spacing.lg },
    xl: { marginTop: spacing.xl },
    xxl: { marginTop: spacing.xxl },
    xxxl: { marginTop: spacing.xxxl },
  },
  
  marginBottom: {
    xs: { marginBottom: spacing.xs },
    sm: { marginBottom: spacing.sm },
    md: { marginBottom: spacing.md },
    lg: { marginBottom: spacing.lg },
    xl: { marginBottom: spacing.xl },
    xxl: { marginBottom: spacing.xxl },
    xxxl: { marginBottom: spacing.xxxl },
  },
  
  marginHorizontal: {
    xs: { marginHorizontal: spacing.xs },
    sm: { marginHorizontal: spacing.sm },
    md: { marginHorizontal: spacing.md },
    lg: { marginHorizontal: spacing.lg },
    xl: { marginHorizontal: spacing.xl },
    xxl: { marginHorizontal: spacing.xxl },
    xxxl: { marginHorizontal: spacing.xxxl },
  },
  
  // Padding utilities
  padding: {
    xs: { padding: spacing.xs },
    sm: { padding: spacing.sm },
    md: { padding: spacing.md },
    lg: { padding: spacing.lg },
    xl: { padding: spacing.xl },
    xxl: { padding: spacing.xxl },
    xxxl: { padding: spacing.xxxl },
  },
  
  paddingHorizontal: {
    xs: { paddingHorizontal: spacing.xs },
    sm: { paddingHorizontal: spacing.sm },
    md: { paddingHorizontal: spacing.md },
    lg: { paddingHorizontal: spacing.lg },
    xl: { paddingHorizontal: spacing.xl },
    xxl: { paddingHorizontal: spacing.xxl },
    xxxl: { paddingHorizontal: spacing.xxxl },
  },
  
  paddingVertical: {
    xs: { paddingVertical: spacing.xs },
    sm: { paddingVertical: spacing.sm },
    md: { paddingVertical: spacing.md },
    lg: { paddingVertical: spacing.lg },
    xl: { paddingVertical: spacing.xl },
    xxl: { paddingVertical: spacing.xxl },
    xxxl: { paddingVertical: spacing.xxxl },
  },
};
