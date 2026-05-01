/**
 * cognitoService.js
 * Handles all AWS Cognito authentication via amazon-cognito-identity-js
 *
 * Required environment variables (set in .env or AWS Amplify console):
 *   REACT_APP_COGNITO_USER_POOL_ID   e.g. us-east-1_XXXXXXXXX
 *   REACT_APP_COGNITO_CLIENT_ID      e.g. xxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   REACT_APP_COGNITO_REGION         e.g. us-east-1
 */

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID,
  ClientId: process.env.REACT_APP_COGNITO_CLIENT_ID,
};

const userPool = new CognitoUserPool(poolData);

export const cognitoService = {
  /**
   * Sign in with email and password.
   * Resolves with { email, token } on success.
   * Rejects with a human-readable error string on failure.
   */
  signIn(email, password) {
    return new Promise((resolve, reject) => {
      const authDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess(session) {
          resolve({
            email,
            token: session.getIdToken().getJwtToken(),
            cognitoUser,
          });
        },
        onFailure(err) {
          if (
            err.code === 'UserNotFoundException' ||
            err.code === 'NotAuthorizedException'
          ) {
            reject('You are not authorized to use this application.');
          } else if (err.code === 'UserNotConfirmedException') {
            reject('Your account has not been confirmed. Please check your email.');
          } else {
            reject(err.message || 'Authentication failed. Please try again.');
          }
        },
        newPasswordRequired() {
          reject('A new password is required. Please contact your administrator.');
        },
      });
    });
  },

  /**
   * Retrieve the currently authenticated user from the local session.
   * Returns null if no active session exists.
   */
  getCurrentUser() {
    return new Promise((resolve) => {
      const cognitoUser = userPool.getCurrentUser();
      if (!cognitoUser) {
        resolve(null);
        return;
      }

      cognitoUser.getSession((err, session) => {
        if (err || !session.isValid()) {
          resolve(null);
          return;
        }
        resolve({
          email: cognitoUser.getUsername(),
          token: session.getIdToken().getJwtToken(),
          cognitoUser,
        });
      });
    });
  },

  /**
   * Sign out the current user and clear the local session.
   */
  signOut() {
    return new Promise((resolve) => {
      const cognitoUser = userPool.getCurrentUser();
      if (cognitoUser) {
        cognitoUser.signOut();
      }
      resolve();
    });
  },

  /**
   * Get a fresh ID token for API requests (auto-refreshes if needed).
   */
  getIdToken() {
    return new Promise((resolve, reject) => {
      const cognitoUser = userPool.getCurrentUser();
      if (!cognitoUser) {
        reject('No authenticated user');
        return;
      }
      cognitoUser.getSession((err, session) => {
        if (err) {
          reject(err.message);
          return;
        }
        resolve(session.getIdToken().getJwtToken());
      });
    });
  },
};
