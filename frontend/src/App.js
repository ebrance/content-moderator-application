import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import ModeratorApp from './components/ModeratorApp';
import { cognitoService } from './services/cognitoService';
import './styles/index.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated (persisted session)
    const checkSession = async () => {
      try {
        const currentUser = await cognitoService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        }
      } catch (err) {
        // No active session
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    await cognitoService.signOut();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="app-root">
      {user ? (
        <ModeratorApp user={user} onLogout={handleLogout} />
      ) : (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}

export default App;
