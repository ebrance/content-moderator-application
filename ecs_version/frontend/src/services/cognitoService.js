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
  CognitoUserAttribute,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID,
  ClientId: process.env.REACT_APP_COGNITO_CLIENT_ID,
};

const userPool = new CognitoUserPool(poolData);

export const cognitoService = {
  /**
   * Sign up a new user with email and password.
   * Auto-confirms the user immediately (no email verification).
   * Resolves on success, rejects with a human-readable error string.
   */
  signUp(email, password) {
    return new Promise((resolve, reject) => {
      const emailAttribute = new CognitoUserAttribute({
        Name: 'email',
        Value: email,
      });

      userPool.signUp(email, password, [emailAttribute], null, (err, result) => {
        if (err) {
          if (err.code === 'UsernameExistsException') {
            reject('An account with this email address already exists.');
          } else if (err.code === 'InvalidPasswordException') {
            reject(
              'Password does not meet requirements. It must be at least 8 characters ' +
              'and include uppercase, lowercase, and a number.'
            );
          } else if (err.code === 'InvalidParameterException') {
            reject('Please enter a valid email address.');
          } else {
            reject(err.message || 'Sign-up failed. Please try again.');
          }
          return;
        }
        resolve(result);
      });
    });
  },

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
   * Confirm sign-up with the verification code sent to the user's email.
   */
  confirmSignUp(email, code) {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) {
          if (err.code === 'CodeMismatchException') {
            reject('The verification code you entered is incorrect. Please try again.');
          } else if (err.code === 'ExpiredCodeException') {
            reject('The verification code has expired. Please request a new one.');
          } else if (err.code === 'NotAuthorizedException') {
            reject('This account has already been confirmed. Please sign in.');
          } else {
            reject(err.message || 'Verification failed. Please try again.');
          }
          return;
        }
        resolve(result);
      });
    });
  },

  /**
   * Resend the confirmation code to the user's email.
   */
  resendConfirmationCode(email) {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.resendConfirmationCode((err, result) => {
        if (err) {
          if (err.code === 'LimitExceededException') {
            reject('Too many attempts. Please wait a few minutes before requesting a new code.');
          } else {
            reject(err.message || 'Failed to resend the code. Please try again.');
          }
          return;
        }
        resolve(result);
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
