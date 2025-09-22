import React, { useState } from 'react';
import axios from 'axios';

function TextGenerator({ apiBaseUrl, onGenerationComplete }) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState(null);
  const [currentRequestId, setCurrentRequestId] = useState(null);

  const examples = [
    "A red sports car",
    "A wooden chair with curved armrests",
    "A cute cartoon dog",
    "A medieval sword with ornate handle",
    "A simple coffee mug",
    "A modern smartphone",
    "A decorative vase with floral patterns",
    "A small house with a chimney"
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setGenerationStatus('Initializing...');

    try {
      const response = await axios.post(`${apiBaseUrl}/generate/text`, {
        prompt: prompt.trim()
      });

      const requestId = response.data.request_id;
      setCurrentRequestId(requestId);

      // Add to history immediately with processing status
      const historyItem = {
        request_id: requestId,
        type: 'text',
        input: prompt.trim(),
        status: 'processing',
        timestamp: new Date().toISOString(),
        cache_hit: false
      };
      onGenerationComplete(historyItem);

      if (response.data.status === 'completed') {
        // Immediate completion (cache hit)
        setGenerationStatus('Completed! Model ready for download.');
        historyItem.status = 'completed';
        historyItem.cache_hit = response.data.cache_hit;
        onGenerationComplete(historyItem);
        setIsGenerating(false);
      } else {
        // Start polling for status
        pollGenerationStatus(requestId);
      }

    } catch (error) {
      console.error('Generation error:', error);
      setGenerationStatus('Generation failed. Please try again.');
      setIsGenerating(false);
    }
  };

  const pollGenerationStatus = async (requestId) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await axios.get(`${apiBaseUrl}/status/${requestId}`);
        const status = response.data.status;

        if (status === 'completed') {
          setGenerationStatus('Completed! Model ready for download.');
          setIsGenerating(false);
          clearInterval(pollInterval);

          // Update history item
          const historyItem = {
            request_id: requestId,
            type: 'text',
            input: prompt.trim(),
            status: 'completed',
            timestamp: new Date().toISOString(),
            cache_hit: response.data.cache_hit || false,
            generation_time: response.data.generation_time,
            quality_score: response.data.quality_score
          };
          onGenerationComplete(historyItem);

        } else if (status === 'failed') {
          setGenerationStatus('Generation failed. Please try again.');
          setIsGenerating(false);
          clearInterval(pollInterval);
        } else if (status === 'processing') {
          setGenerationStatus('Generating 3D model... This may take a few minutes.');
        }

      } catch (error) {
        console.error('Status polling error:', error);
        setGenerationStatus('Error checking status. Please refresh the page.');
        setIsGenerating(false);
        clearInterval(pollInterval);
      }
    }, 3000); // Poll every 3 seconds
  };

  const fillExample = (example) => {
    setPrompt(example);
  };

  return (
    <div className="card">
      <h2 style={{ marginBottom: '20px' }}>📝 Text to 3D Model</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="prompt">
            Describe the 3D object you want to generate:
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a detailed description of the object you want to create..."
            rows={4}
            maxLength={1000}
            disabled={isGenerating}
          />
          <small style={{ color: '#6c757d', marginTop: '5px', display: 'block' }}>
            {prompt.length}/1000 characters
          </small>
        </div>

        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={!prompt.trim() || isGenerating}
          style={{ width: '100%', marginBottom: '20px' }}
        >
          {isGenerating ? (
            <>
              <div className="spinner" style={{ marginRight: '10px' }}></div>
              Generating...
            </>
          ) : (
            '🚀 Generate 3D Model'
          )}
        </button>
      </form>

      {/* Generation Status */}
      {generationStatus && (
        <div style={{
          padding: '15px',
          background: isGenerating ? '#cce7ff' : '#ccf5cc',
          border: `1px solid ${isGenerating ? '#0c5aa6' : '#0a5d0a'}`,
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isGenerating && <div className="spinner"></div>}
            <span>{generationStatus}</span>
          </div>
          
          {currentRequestId && !isGenerating && (
            <div style={{ marginTop: '10px' }}>
              <a 
                href={`${apiBaseUrl}/models/${currentRequestId}`}
                className="btn btn-secondary"
                download
              >
                📥 Download Model
              </a>
            </div>
          )}
        </div>
      )}

      {/* Example Prompts */}
      <div>
        <h4 style={{ marginBottom: '15px', color: '#495057' }}>💡 Try these examples:</h4>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '10px'
        }}>
          {examples.map((example, index) => (
            <button
              key={index}
              type="button"
              className="btn btn-secondary"
              onClick={() => fillExample(example)}
              disabled={isGenerating}
              style={{ 
                fontSize: '14px', 
                padding: '8px 12px',
                textAlign: 'left'
              }}
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div style={{ 
        marginTop: '30px', 
        padding: '20px', 
        background: '#f8f9fa', 
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <h5 style={{ marginBottom: '10px', color: '#495057' }}>💡 Tips for better results:</h5>
        <ul style={{ color: '#6c757d', fontSize: '14px', paddingLeft: '20px' }}>
          <li>Be specific about the object's shape, size, and key features</li>
          <li>Mention materials or textures (e.g., "wooden", "metallic", "smooth")</li>
          <li>Include style preferences (e.g., "modern", "vintage", "cartoon-style")</li>
          <li>Keep descriptions focused on a single object rather than complex scenes</li>
          <li>Generation typically takes 2-5 minutes for new models</li>
        </ul>
      </div>
    </div>
  );
}

export default TextGenerator;