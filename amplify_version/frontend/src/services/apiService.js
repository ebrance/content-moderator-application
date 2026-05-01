/**
 * apiService.js
 * Sends moderation requests to the FastAPI backend via the AWS ALB.
 *
 * Required environment variable:
 *   REACT_APP_ALB_BASE_URL   e.g. http://my-alb-123456.us-east-1.elb.amazonaws.com
 */

import { cognitoService } from './cognitoService';

const BASE_URL = process.env.REACT_APP_ALB_BASE_URL;

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
