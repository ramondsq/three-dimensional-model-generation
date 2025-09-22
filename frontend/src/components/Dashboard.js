import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Dashboard({ apiBaseUrl, stats, onStatsUpdate }) {
  const [evaluationStats, setEvaluationStats] = useState(null);
  const [cacheStats, setCacheStats] = useState(null);
  const [qualityReport, setQualityReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load stats if not provided
      if (!stats) {
        const statsResponse = await axios.get(`${apiBaseUrl}/stats`);
        onStatsUpdate(statsResponse.data);
      }

      // In a real implementation, these endpoints would exist
      // For now, we'll simulate the data
      setEvaluationStats({
        total_evaluations: 156,
        avg_overall_score: 0.78,
        avg_geometry_score: 0.82,
        avg_texture_score: 0.68,
        avg_fidelity_score: 0.75,
        avg_performance_score: 0.89,
        avg_vertex_count: 2840,
        avg_face_count: 5680,
        total_user_feedback: 89,
        avg_user_rating: 4.2,
        daily_trends: [
          { date: '2023-09-15', avg_score: 0.75, count: 12 },
          { date: '2023-09-16', avg_score: 0.78, count: 18 },
          { date: '2023-09-17', avg_score: 0.81, count: 15 },
          { date: '2023-09-18', avg_score: 0.76, count: 22 },
          { date: '2023-09-19', avg_score: 0.79, count: 19 },
          { date: '2023-09-20', avg_score: 0.83, count: 24 },
          { date: '2023-09-21', avg_score: 0.80, count: 21 }
        ]
      });

      setCacheStats({
        text_cache_entries: 234,
        image_cache_entries: 89,
        avg_text_access_count: 2.3,
        avg_image_access_count: 1.8,
        total_cache_size_mb: 847.2,
        similarity_threshold: 0.85
      });

      setQualityReport({
        report_generated_at: new Date().toISOString(),
        quality_level: 'Good',
        overall_score: 0.78,
        recommendations: [
          'Improve texture quality and UV mapping',
          'Optimize model complexity for better performance'
        ],
        quality_trend: 'improving'
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, subtitle, icon, color = '#667eea' }) => (
    <div className="stat-card" style={{ borderTop: `4px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <div className="stat-value" style={{ color }}>{value}</div>
          <div className="stat-label">{title}</div>
          {subtitle && (
            <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
              {subtitle}
            </div>
          )}
        </div>
        <div style={{ fontSize: '24px', opacity: 0.7 }}>{icon}</div>
      </div>
    </div>
  );

  const QualityMeter = ({ score, label }) => {
    const percentage = Math.round(score * 100);
    const getColor = (score) => {
      if (score >= 0.8) return '#28a745';
      if (score >= 0.6) return '#ffc107';
      return '#dc3545';
    };

    return (
      <div style={{ marginBottom: '15px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginBottom: '5px',
          fontSize: '14px',
          fontWeight: '600'
        }}>
          <span>{label}</span>
          <span style={{ color: getColor(score) }}>{percentage}%</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ 
              width: `${percentage}%`,
              background: getColor(score)
            }}
          ></div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
        <div className="spinner" style={{ margin: '0 auto 20px' }}></div>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Overview Stats */}
      <div className="card">
        <h2 style={{ marginBottom: '20px' }}>📊 System Overview</h2>
        
        <div className="stats-grid">
          <StatCard
            title="Total Requests"
            value={stats?.total_requests || 0}
            subtitle="All time"
            icon="📝"
            color="#667eea"
          />
          <StatCard
            title="Cache Hit Rate"
            value={`${stats?.cache_hit_rate || 0}%`}
            subtitle="API call savings"
            icon="⚡"
            color="#28a745"
          />
          <StatCard
            title="Avg Generation Time"
            value={`${stats?.avg_generation_time || 0}s`}
            subtitle="Including cache hits"
            icon="⏱️"
            color="#17a2b8"
          />
          <StatCard
            title="User Satisfaction"
            value={evaluationStats?.avg_user_rating || 0}
            subtitle="Out of 5 stars"
            icon="⭐"
            color="#ffc107"
          />
        </div>
      </div>

      {/* Quality Metrics */}
      <div className="card">
        <h3 style={{ marginBottom: '20px' }}>🎯 Quality Metrics</h3>
        
        <div className="grid grid-2">
          <div>
            <h5 style={{ marginBottom: '15px', color: '#495057' }}>Model Quality Scores</h5>
            {evaluationStats && (
              <>
                <QualityMeter 
                  score={evaluationStats.avg_overall_score} 
                  label="Overall Quality" 
                />
                <QualityMeter 
                  score={evaluationStats.avg_geometry_score} 
                  label="Geometry Quality" 
                />
                <QualityMeter 
                  score={evaluationStats.avg_texture_score} 
                  label="Texture Quality" 
                />
                <QualityMeter 
                  score={evaluationStats.avg_fidelity_score} 
                  label="Input Fidelity" 
                />
                <QualityMeter 
                  score={evaluationStats.avg_performance_score} 
                  label="Performance" 
                />
              </>
            )}
          </div>
          
          <div>
            <h5 style={{ marginBottom: '15px', color: '#495057' }}>Model Statistics</h5>
            <div className="stats-grid">
              <StatCard
                title="Avg Vertices"
                value={evaluationStats?.avg_vertex_count || 0}
                icon="🔺"
                color="#6f42c1"
              />
              <StatCard
                title="Avg Faces"
                value={evaluationStats?.avg_face_count || 0}
                icon="🔷"
                color="#e83e8c"
              />
              <StatCard
                title="Total Evaluations"
                value={evaluationStats?.total_evaluations || 0}
                icon="📋"
                color="#fd7e14"
              />
              <StatCard
                title="User Feedback"
                value={evaluationStats?.total_user_feedback || 0}
                icon="💬"
                color="#20c997"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Cache Performance */}
      <div className="card">
        <h3 style={{ marginBottom: '20px' }}>🚀 Cache Performance</h3>
        
        <div className="grid grid-2">
          <div>
            <h5 style={{ marginBottom: '15px', color: '#495057' }}>Cache Statistics</h5>
            <div className="stats-grid">
              <StatCard
                title="Text Cache"
                value={cacheStats?.text_cache_entries || 0}
                subtitle="Cached entries"
                icon="📝"
                color="#667eea"
              />
              <StatCard
                title="Image Cache"
                value={cacheStats?.image_cache_entries || 0}
                subtitle="Cached entries"
                icon="🖼️"
                color="#764ba2"
              />
              <StatCard
                title="Cache Size"
                value={`${cacheStats?.total_cache_size_mb || 0} MB`}
                subtitle="Total storage"
                icon="💾"
                color="#17a2b8"
              />
              <StatCard
                title="Hit Threshold"
                value={`${(cacheStats?.similarity_threshold || 0) * 100}%`}
                subtitle="Similarity required"
                icon="🎯"
                color="#28a745"
              />
            </div>
          </div>
          
          <div>
            <h5 style={{ marginBottom: '15px', color: '#495057' }}>Usage Patterns</h5>
            <div style={{ 
              padding: '20px', 
              background: '#f8f9fa', 
              borderRadius: '8px',
              border: '1px solid #dee2e6'
            }}>
              <div style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span>Text Cache Access Rate</span>
                  <span>{cacheStats?.avg_text_access_count || 0}x</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ 
                      width: `${Math.min((cacheStats?.avg_text_access_count || 0) * 20, 100)}%`
                    }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span>Image Cache Access Rate</span>
                  <span>{cacheStats?.avg_image_access_count || 0}x</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ 
                      width: `${Math.min((cacheStats?.avg_image_access_count || 0) * 20, 100)}%`
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quality Report */}
      {qualityReport && (
        <div className="card">
          <h3 style={{ marginBottom: '20px' }}>📋 Quality Report</h3>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            marginBottom: '20px',
            padding: '15px',
            background: '#e7f3ff',
            borderRadius: '8px',
            border: '1px solid #b3d9ff'
          }}>
            <div style={{ fontSize: '32px', marginRight: '15px' }}>
              {qualityReport.quality_level === 'Excellent' ? '🌟' : 
               qualityReport.quality_level === 'Good' ? '👍' : 
               qualityReport.quality_level === 'Fair' ? '👌' : '⚠️'}
            </div>
            <div>
              <h4 style={{ margin: 0, color: '#0c5aa6' }}>
                System Quality: {qualityReport.quality_level}
              </h4>
              <p style={{ margin: '5px 0 0', color: '#495057' }}>
                Average Score: {Math.round(qualityReport.overall_score * 100)}%
              </p>
            </div>
          </div>

          {qualityReport.recommendations.length > 0 && (
            <div>
              <h5 style={{ marginBottom: '10px', color: '#495057' }}>🎯 Recommendations:</h5>
              <ul style={{ color: '#6c757d', paddingLeft: '20px' }}>
                {qualityReport.recommendations.map((rec, index) => (
                  <li key={index} style={{ marginBottom: '5px' }}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* System Health */}
      <div className="card">
        <h3 style={{ marginBottom: '20px' }}>💚 System Health</h3>
        
        <div className="grid grid-2">
          <div>
            <h5 style={{ marginBottom: '15px', color: '#495057' }}>Service Status</h5>
            <div style={{ marginBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%', 
                  background: '#28a745',
                  marginRight: '10px'
                }}></div>
                <span>API Service</span>
                <span style={{ marginLeft: 'auto', color: '#28a745', fontWeight: '600' }}>
                  Healthy
                </span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%', 
                  background: '#28a745',
                  marginRight: '10px'
                }}></div>
                <span>Cache System</span>
                <span style={{ marginLeft: 'auto', color: '#28a745', fontWeight: '600' }}>
                  Operational
                </span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%', 
                  background: '#28a745',
                  marginRight: '10px'
                }}></div>
                <span>Evaluation System</span>
                <span style={{ marginLeft: 'auto', color: '#28a745', fontWeight: '600' }}>
                  Active
                </span>
              </div>
            </div>
          </div>
          
          <div>
            <h5 style={{ marginBottom: '15px', color: '#495057' }}>Quick Actions</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                className="btn btn-secondary"
                onClick={() => loadDashboardData()}
                style={{ justifyContent: 'flex-start' }}
              >
                🔄 Refresh Data
              </button>
              <button 
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start' }}
                disabled
              >
                🧹 Clear Cache (Coming Soon)
              </button>
              <button 
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start' }}
                disabled
              >
                📊 Export Report (Coming Soon)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;