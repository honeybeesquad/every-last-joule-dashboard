/**
 * Vercel Web Analytics integration for Observable Framework.
 * This module initializes the @vercel/analytics package for tracking page views.
 */
import { inject } from '@vercel/analytics';

/**
 * Initialize Vercel Web Analytics.
 * Call this function once when the application starts.
 */
export function initAnalytics() {
  // Inject Vercel Analytics tracking
  inject();
}
