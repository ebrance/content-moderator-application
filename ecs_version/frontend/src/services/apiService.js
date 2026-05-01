/**
 * apiService.js
 * Sends moderation requests to the FastAPI backend.
 *
 * Requests go to /api/* on the same origin — Nginx inside the frontend
 * container reverse-proxies them to the internal ALB, avoiding
 * mixed-content (HTTPS → HTTP) errors in the browser.
 *
 * No environment variable needed — BASE_URL is intentionally empty
 * so all fetch() calls use the current page origin.
 */

import { cognitoService } from './cognitoService';

const BASE_URL = '';

export const apiService = {
  /**
   * Analyze content for moderation.
   *
   * @param {string} content        - The text content to analyze
   * @param {string} contentType    - One of: general_community | kids_platform | marketplace | news_comments
   * @returns {Promise<object>}     - The moderation result from the super agent
   */
  async analyzeContent(content, contentType) {
    let token;
    try {
      token = await cognitoService.getIdToken();
    } catch {
      throw new Error('Session expired. Please log in again.');
    }

    const response = await fetch(`${BASE_URL}/api/v1/moderate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        content,
        content_type: contentType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Server error: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Health check — useful to verify backend connectivity on load.
   */
  async healthCheck() {
    const response = await fetch(`${BASE_URL}/health`);
    return response.json();
  },
};
