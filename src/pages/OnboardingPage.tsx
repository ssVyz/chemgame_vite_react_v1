import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameClient } from '../api/gameClient';

export function OnboardingPage() {
  const [playerName, setPlayerName] = useState('');
  const [factoryName, setFactoryName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // If already submitted, wait 5 seconds then redirect
    if (submitted) {
      const timer = setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [submitted, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate inputs
    if (!playerName.trim()) {
      setError('Please enter your in-game name');
      setLoading(false);
      return;
    }

    if (!factoryName.trim()) {
      setError('Please enter your factory name');
      setLoading(false);
      return;
    }

    // Call the initialize_new_player function
    const result = await gameClient.initialize_new_player(
      playerName.trim(),
      factoryName.trim()
    );

    if (result.success) {
      setSubmitted(true);
    } else {
      setError(result.error || 'Failed to initialize player');
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>🎉 Welcome to the Game!</h1>
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{ fontSize: '1.1em', marginBottom: '20px' }}>
              Your player account has been initialized successfully!
            </p>
            <p style={{ color: '#666' }}>
              Redirecting to dashboard in a few seconds...
            </p>
            <div style={{ marginTop: '30px' }}>
              <div className="loading">⏳</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Welcome! Let's Get Started</h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>
          Please enter your in-game details to begin playing
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="playerName">In-Game Name:</label>
            <input
              type="text"
              id="playerName"
              placeholder="Enter your in-game name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              autoFocus
              disabled={loading}
              maxLength={100}
            />
          </div>
          <div className="form-group">
            <label htmlFor="factoryName">Factory Name:</label>
            <input
              type="text"
              id="factoryName"
              placeholder="Enter your factory name"
              value={factoryName}
              onChange={(e) => setFactoryName(e.target.value)}
              disabled={loading}
              maxLength={100}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Initializing...' : 'Start Playing'}
          </button>
          {error && <p className="error-message">{error}</p>}
        </form>
      </div>
    </div>
  );
}

