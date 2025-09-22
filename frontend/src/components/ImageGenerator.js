import React, { useState, useRef } from 'react';
import axios from 'axios';

function ImageGenerator({ apiBaseUrl, onGenerationComplete }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState(null);
  const [currentRequestId, setCurrentRequestId] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const fileInputRef = useRef(null);

  const handleFileSelect = (file) => {
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/tiff'];
    if (!validTypes.includes(file.type)) {
      alert('Please select a valid image file (JPEG, PNG, BMP, or TIFF)');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      alert('Please select an image smaller than 10MB');
      return;
    }

    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile || isGenerating) return;

    setIsGenerating(true);
    setGenerationStatus('Uploading image...');

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const response = await axios.post(`${apiBaseUrl}/generate/image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const requestId = response.data.request_id;
      setCurrentRequestId(requestId);

      // Add to history immediately with processing status
      const historyItem = {
        request_id: requestId,
        type: 'image',
        input: selectedFile.name,
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
            type: 'image',
            input: selectedFile.name,
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
          setGenerationStatus('Analyzing image and generating 3D model...');
        }

      } catch (error) {
        console.error('Status polling error:', error);
        setGenerationStatus('Error checking status. Please refresh the page.');
        setIsGenerating(false);
        clearInterval(pollInterval);
      }
    }, 3000); // Poll every 3 seconds
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="card">
      <h2 style={{ marginBottom: '20px' }}>🖼️ Image to 3D Model</h2>
      
      <form onSubmit={handleSubmit}>
        {/* File Upload Area */}
        <div className="input-group">
          <label>Upload an image to convert to 3D:</label>
          
          <div 
            className={`file-upload ${isDragOver ? 'dragover' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
              disabled={isGenerating}
            />
            
            {!selectedFile ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>📷</div>
                <p style={{ fontSize: '16px', marginBottom: '5px', fontWeight: '600' }}>
                  Drop an image here or click to browse
                </p>
                <p style={{ fontSize: '14px', color: '#6c757d' }}>
                  Supports JPEG, PNG, BMP, TIFF (Max 10MB)
                </p>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', color: '#28a745', marginBottom: '10px' }}>✅</div>
                <p style={{ fontSize: '16px', fontWeight: '600' }}>
                  {selectedFile.name}
                </p>
                <p style={{ fontSize: '14px', color: '#6c757d' }}>
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSelection();
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '12px', padding: '6px 12px', marginTop: '10px' }}
                  disabled={isGenerating}
                >
                  Clear Selection
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Image Preview */}
        {previewUrl && (
          <div className="input-group">
            <label>Preview:</label>
            <div style={{
              maxWidth: '100%',
              maxHeight: '300px',
              overflow: 'hidden',
              borderRadius: '8px',
              border: '2px solid #dee2e6'
            }}>
              <img 
                src={previewUrl} 
                alt="Preview" 
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '300px',
                  objectFit: 'contain'
                }}
              />
            </div>
          </div>
        )}

        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={!selectedFile || isGenerating}
          style={{ width: '100%', marginBottom: '20px' }}
        >
          {isGenerating ? (
            <>
              <div className="spinner" style={{ marginRight: '10px' }}></div>
              Processing...
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
          <li>Use high-quality images with good lighting and clear details</li>
          <li>Single objects work better than complex scenes</li>
          <li>Images with clear edges and distinct shapes produce better models</li>
          <li>Avoid blurry, dark, or heavily compressed images</li>
          <li>Front-facing or slightly angled views typically work best</li>
          <li>Generation typically takes 3-7 minutes for image-based models</li>
        </ul>
      </div>

      {/* Supported Formats */}
      <div style={{ 
        marginTop: '20px', 
        padding: '15px', 
        background: '#e7f3ff', 
        borderRadius: '8px',
        border: '1px solid #b3d9ff'
      }}>
        <h6 style={{ marginBottom: '10px', color: '#0c5aa6' }}>📋 Supported Image Formats:</h6>
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '10px',
          fontSize: '14px',
          color: '#495057'
        }}>
          <span className="badge" style={{ 
            background: '#667eea', 
            color: 'white', 
            padding: '4px 8px', 
            borderRadius: '4px' 
          }}>JPEG</span>
          <span className="badge" style={{ 
            background: '#667eea', 
            color: 'white', 
            padding: '4px 8px', 
            borderRadius: '4px' 
          }}>PNG</span>
          <span className="badge" style={{ 
            background: '#667eea', 
            color: 'white', 
            padding: '4px 8px', 
            borderRadius: '4px' 
          }}>BMP</span>
          <span className="badge" style={{ 
            background: '#667eea', 
            color: 'white', 
            padding: '4px 8px', 
            borderRadius: '4px' 
          }}>TIFF</span>
        </div>
      </div>
    </div>
  );
}

export default ImageGenerator;