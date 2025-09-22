import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ModelViewer from './components/ModelViewer';
import TextGenerator from './components/TextGenerator';
import ImageGenerator from './components/ImageGenerator';
import Dashboard from './components/Dashboard';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function App() {
  const [currentTab, setCurrentTab] = useState('text');
  const [generationHistory, setGenerationHistory] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Load statistics on app start
    loadStatistics();
    
    // Load generation history from localStorage
    const savedHistory = localStorage.getItem('generationHistory');
    if (savedHistory) {
      try {
        setGenerationHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Error loading generation history:', e);
      }
    }
  }, []);

  const loadStatistics = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const addToHistory = (item) => {
    const newHistory = [item, ...generationHistory.slice(0, 9)]; // Keep last 10 items
    setGenerationHistory(newHistory);
    localStorage.setItem('generationHistory', JSON.stringify(newHistory));
    
    // Refresh stats
    loadStatistics();
  };

  const TabButton = ({ id, label, active, onClick }) => (
    <button
      className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
      onClick={() => onClick(id)}
      style={{ 
        margin: '0 10px',
        minWidth: '120px'
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="container">
      {/* Header */}
      <div className="card" style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          marginBottom: '10px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          🎨 3D Model Generator
        </h1>
        <p style={{ 
          fontSize: '1.1rem', 
          color: '#6c757d', 
          marginBottom: '30px' 
        }}>
          AI-Powered 3D Model Generation from Text and Images
        </p>
        
        {/* Navigation Tabs */}
        <div style={{ marginBottom: '20px' }}>
          <TabButton 
            id="text" 
            label="📝 Text to 3D" 
            active={currentTab === 'text'} 
            onClick={setCurrentTab} 
          />
          <TabButton 
            id="image" 
            label="🖼️ Image to 3D" 
            active={currentTab === 'image'} 
            onClick={setCurrentTab} 
          />
          <TabButton 
            id="dashboard" 
            label="📊 Dashboard" 
            active={currentTab === 'dashboard'} 
            onClick={setCurrentTab} 
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-2">
        {/* Left Panel - Input */}
        <div>
          {currentTab === 'text' && (
            <TextGenerator 
              apiBaseUrl={API_BASE_URL}
              onGenerationComplete={addToHistory}
            />
          )}
          
          {currentTab === 'image' && (
            <ImageGenerator 
              apiBaseUrl={API_BASE_URL}
              onGenerationComplete={addToHistory}
            />
          )}
          
          {currentTab === 'dashboard' && (
            <Dashboard 
              apiBaseUrl={API_BASE_URL}
              stats={stats}
              onStatsUpdate={setStats}
            />
          )}
        </div>

        {/* Right Panel - History & Info */}
        {currentTab !== 'dashboard' && (
          <div>
            {/* Quick Stats */}
            {stats && (
              <div className="card">
                <h3 style={{ marginBottom: '20px' }}>📈 Quick Stats</h3>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-value">{stats.total_requests}</div>
                    <div className="stat-label">Total Requests</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{stats.cache_hit_rate}%</div>
                    <div className="stat-label">Cache Hit Rate</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{stats.avg_generation_time}s</div>
                    <div className="stat-label">Avg Time</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{stats.avg_quality_score}</div>
                    <div className="stat-label">Avg Quality</div>
                  </div>
                </div>
              </div>
            )}

            {/* Generation History */}
            <div className="card">
              <h3 style={{ marginBottom: '20px' }}>🕒 Recent Generations</h3>
              {generationHistory.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6c757d' }}>
                  No generations yet. Start by creating your first 3D model!
                </p>
              ) : (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {generationHistory.map((item, index) => (
                    <div 
                      key={index}
                      style={{
                        padding: '15px',
                        border: '1px solid #dee2e6',
                        borderRadius: '8px',
                        marginBottom: '10px',
                        background: '#f8f9fa'
                      }}
                    >
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px'
                      }}>
                        <span className={`status-indicator status-${item.status}`}>
                          {item.status === 'processing' && <div className="spinner"></div>}
                          {item.status}
                        </span>
                        <small style={{ color: '#6c757d' }}>
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </small>
                      </div>
                      <div style={{ fontSize: '14px', color: '#495057' }}>
                        <strong>{item.type === 'text' ? '📝' : '🖼️'}</strong> {item.input}
                      </div>
                      {item.status === 'completed' && (
                        <div style={{ marginTop: '10px' }}>
                          <a 
                            href={`${API_BASE_URL}/models/${item.request_id}`}
                            className="btn btn-secondary"
                            style={{ fontSize: '12px', padding: '6px 12px' }}
                            download
                          >
                            Download Model
                          </a>
                          {item.cache_hit && (
                            <span style={{ 
                              marginLeft: '10px', 
                              fontSize: '12px', 
                              color: '#28a745',
                              fontWeight: '600'
                            }}>
                              ⚡ Cache Hit
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: '50px', 
        paddingTop: '30px',
        borderTop: '1px solid rgba(255, 255, 255, 0.2)',
        color: 'rgba(255, 255, 255, 0.8)'
      }}>
        <p>
          Built with ❤️ for Qiniu Cloud | 
          <a 
            href="https://github.com/ramondsq/three-dimensional-model-generation" 
            style={{ color: 'rgba(255, 255, 255, 0.9)', marginLeft: '10px' }}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </p>
      </div>
    </div>
  );
}

export default App;