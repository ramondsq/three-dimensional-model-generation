"""
Configuration settings for the 3D Model Generation Application
"""

import os
from datetime import timedelta

class Config:
    """Base configuration class"""
    
    # Basic Flask config
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key-here'
    
    # Database configuration
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///model_generation.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # File storage directories
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')
    MODELS_DIR = os.path.join(BASE_DIR, 'generated_models')
    CACHE_DIR = os.path.join(BASE_DIR, 'cache')
    
    # API Configuration
    MESHY_AI_API_KEY = os.environ.get('MESHY_AI_API_KEY') or 'your-meshy-api-key'
    MESHY_AI_BASE_URL = 'https://api.meshy.ai/v1'
    
    # Cache settings
    CACHE_DEFAULT_TIMEOUT = 86400  # 24 hours
    CACHE_SIMILARITY_THRESHOLD = 0.85
    CACHE_MAX_SIZE_GB = 10
    
    # Generation settings
    MAX_GENERATION_TIME = 300  # 5 minutes
    SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']
    MAX_IMAGE_SIZE_MB = 10
    MAX_TEXT_LENGTH = 1000
    
    # Evaluation settings
    QUALITY_SCORE_WEIGHTS = {
        'geometry': 0.3,
        'texture': 0.2,
        'fidelity': 0.3,
        'performance': 0.2
    }
    
    # Rate limiting
    RATE_LIMIT_PER_MINUTE = 10
    RATE_LIMIT_PER_HOUR = 100
    
    # Logging
    LOG_LEVEL = os.environ.get('LOG_LEVEL') or 'INFO'
    LOG_FILE = os.path.join(BASE_DIR, 'logs', 'app.log')

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    TESTING = False

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    TESTING = False
    
    # Use environment variables for production
    SECRET_KEY = os.environ.get('SECRET_KEY')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    MESHY_AI_API_KEY = os.environ.get('MESHY_AI_API_KEY')

class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False

# Configuration mapping
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}