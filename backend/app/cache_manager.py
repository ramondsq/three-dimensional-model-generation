"""
Cache Manager - Handles intelligent caching of 3D models to reduce API calls
"""

import os
import json
import sqlite3
import hashlib
import pickle
import time
import logging
from typing import Dict, Optional, Any, List
import numpy as np
from sentence_transformers import SentenceTransformer
import cv2
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

class CacheManager:
    """Manages intelligent caching of 3D models with similarity detection"""
    
    def __init__(self, cache_dir: str = 'cache', similarity_threshold: float = 0.85):
        self.cache_dir = cache_dir
        self.similarity_threshold = similarity_threshold
        self.db_path = os.path.join(cache_dir, 'cache.db')
        
        # Initialize sentence transformer for text similarity
        try:
            self.text_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("Text similarity model loaded successfully")
        except Exception as e:
            logger.warning(f"Failed to load text similarity model: {e}")
            self.text_model = None
        
        # Ensure cache directory exists
        os.makedirs(cache_dir, exist_ok=True)
        
        # Initialize database
        self._init_database()
        
        logger.info(f"Cache manager initialized with threshold: {similarity_threshold}")
    
    def _init_database(self):
        """Initialize SQLite database for cache metadata"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create tables
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS text_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    input_hash TEXT UNIQUE,
                    input_text TEXT,
                    embedding BLOB,
                    model_path TEXT,
                    quality_score REAL,
                    generation_time REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    access_count INTEGER DEFAULT 1
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS image_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    input_hash TEXT UNIQUE,
                    image_path TEXT,
                    features BLOB,
                    model_path TEXT,
                    quality_score REAL,
                    generation_time REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    access_count INTEGER DEFAULT 1
                )
            ''')
            
            # Create indexes for better performance
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_text_hash ON text_cache(input_hash)')\n            cursor.execute('CREATE INDEX IF NOT EXISTS idx_image_hash ON image_cache(input_hash)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_text_accessed ON text_cache(last_accessed)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_image_accessed ON image_cache(last_accessed)')
            
            conn.commit()
            conn.close()
            
            logger.info("Cache database initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize cache database: {e}")
            raise
    
    def get_cached_model(self, input_data: str, input_type: str) -> Optional[Dict[str, Any]]:
        """
        Get cached model if similar input exists
        
        Args:
            input_data: Input text or image path
            input_type: 'text' or 'image'
            
        Returns:
            Cached model data or None if no similar match found
        """
        try:
            if input_type == 'text':
                return self._get_cached_text_model(input_data)
            elif input_type == 'image':
                return self._get_cached_image_model(input_data)
            else:
                logger.warning(f"Unknown input type: {input_type}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting cached model: {e}")
            return None
    
    def cache_model(self, input_data: str, input_type: str, model_data: Dict[str, Any]):
        """
        Cache a generated model
        
        Args:
            input_data: Input text or image path
            input_type: 'text' or 'image'
            model_data: Generated model data to cache
        """
        try:
            if input_type == 'text':
                self._cache_text_model(input_data, model_data)
            elif input_type == 'image':
                self._cache_image_model(input_data, model_data)
            else:
                logger.warning(f"Unknown input type: {input_type}")
                
        except Exception as e:
            logger.error(f"Error caching model: {e}")
    
    def _get_cached_text_model(self, text: str) -> Optional[Dict[str, Any]]:
        """Get cached model for text input"""
        if not self.text_model:
            return None
        
        # Generate hash for exact match first
        text_hash = hashlib.md5(text.encode()).hexdigest()
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Check for exact match first
        cursor.execute('''
            SELECT model_path, quality_score, generation_time 
            FROM text_cache 
            WHERE input_hash = ?
        ''', (text_hash,))
        
        exact_match = cursor.fetchone()
        if exact_match:
            # Update access statistics
            cursor.execute('''
                UPDATE text_cache 
                SET last_accessed = CURRENT_TIMESTAMP, access_count = access_count + 1
                WHERE input_hash = ?
            ''', (text_hash,))
            conn.commit()
            conn.close()
            
            logger.info(f"Exact cache hit for text: {text[:50]}...")
            return {
                'model_path': exact_match[0],
                'quality_score': exact_match[1],
                'generation_time': exact_match[2],
                'cache_type': 'exact'
            }
        
        # Check for similar matches
        try:
            # Get current text embedding
            current_embedding = self.text_model.encode([text])[0]
            
            # Get all cached embeddings
            cursor.execute('SELECT id, embedding, model_path, quality_score, generation_time FROM text_cache')
            cached_items = cursor.fetchall()
            
            best_similarity = 0
            best_match = None
            
            for item_id, embedding_blob, model_path, quality_score, generation_time in cached_items:
                try:
                    cached_embedding = pickle.loads(embedding_blob)
                    similarity = cosine_similarity([current_embedding], [cached_embedding])[0][0]
                    
                    if similarity > best_similarity and similarity >= self.similarity_threshold:
                        best_similarity = similarity
                        best_match = {
                            'id': item_id,
                            'model_path': model_path,
                            'quality_score': quality_score,
                            'generation_time': generation_time,
                            'similarity': similarity
                        }
                except Exception as e:
                    logger.warning(f"Error processing cached embedding: {e}")
                    continue
            
            if best_match:
                # Update access statistics
                cursor.execute('''
                    UPDATE text_cache 
                    SET last_accessed = CURRENT_TIMESTAMP, access_count = access_count + 1
                    WHERE id = ?
                ''', (best_match['id'],))
                conn.commit()
                
                logger.info(f"Similar cache hit for text with similarity {best_similarity:.3f}")
                best_match['cache_type'] = 'similar'
                return best_match
            
        except Exception as e:
            logger.error(f"Error in similarity search: {e}")
        
        conn.close()
        return None
    
    def _cache_text_model(self, text: str, model_data: Dict[str, Any]):
        """Cache model for text input"""
        if not self.text_model:
            logger.warning("Text model not available, skipping cache")
            return
        
        try:
            text_hash = hashlib.md5(text.encode()).hexdigest()
            embedding = self.text_model.encode([text])[0]
            embedding_blob = pickle.dumps(embedding)
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR REPLACE INTO text_cache 
                (input_hash, input_text, embedding, model_path, quality_score, generation_time)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                text_hash,
                text,
                embedding_blob,
                model_data['model_path'],
                model_data.get('quality_score', 0),
                model_data.get('generation_time', 0)
            ))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Cached text model for: {text[:50]}...")
            
        except Exception as e:
            logger.error(f"Error caching text model: {e}")
    
    def _get_cached_image_model(self, image_path: str) -> Optional[Dict[str, Any]]:
        """Get cached model for image input"""
        if not os.path.exists(image_path):
            return None
        
        # Generate hash for exact match
        with open(image_path, 'rb') as f:
            image_hash = hashlib.md5(f.read()).hexdigest()
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Check for exact match first
        cursor.execute('''
            SELECT model_path, quality_score, generation_time 
            FROM image_cache 
            WHERE input_hash = ?
        ''', (image_hash,))
        
        exact_match = cursor.fetchone()
        if exact_match:
            # Update access statistics
            cursor.execute('''
                UPDATE image_cache 
                SET last_accessed = CURRENT_TIMESTAMP, access_count = access_count + 1
                WHERE input_hash = ?
            ''', (image_hash,))
            conn.commit()
            conn.close()
            
            logger.info(f"Exact cache hit for image: {os.path.basename(image_path)}")
            return {
                'model_path': exact_match[0],
                'quality_score': exact_match[1],
                'generation_time': exact_match[2],
                'cache_type': 'exact'
            }
        
        # Check for similar images
        try:
            current_features = self._extract_image_features(image_path)
            if current_features is None:
                conn.close()
                return None
            
            # Get all cached image features
            cursor.execute('SELECT id, features, model_path, quality_score, generation_time FROM image_cache')
            cached_items = cursor.fetchall()
            
            best_similarity = 0
            best_match = None
            
            for item_id, features_blob, model_path, quality_score, generation_time in cached_items:
                try:
                    cached_features = pickle.loads(features_blob)
                    similarity = cosine_similarity([current_features], [cached_features])[0][0]
                    
                    if similarity > best_similarity and similarity >= self.similarity_threshold:
                        best_similarity = similarity
                        best_match = {
                            'id': item_id,
                            'model_path': model_path,
                            'quality_score': quality_score,
                            'generation_time': generation_time,
                            'similarity': similarity
                        }
                except Exception as e:
                    logger.warning(f"Error processing cached image features: {e}")
                    continue
            
            if best_match:
                # Update access statistics
                cursor.execute('''
                    UPDATE image_cache 
                    SET last_accessed = CURRENT_TIMESTAMP, access_count = access_count + 1
                    WHERE id = ?
                ''', (best_match['id'],))
                conn.commit()
                
                logger.info(f"Similar cache hit for image with similarity {best_similarity:.3f}")
                best_match['cache_type'] = 'similar'
                return best_match
            
        except Exception as e:
            logger.error(f"Error in image similarity search: {e}")
        
        conn.close()
        return None
    
    def _cache_image_model(self, image_path: str, model_data: Dict[str, Any]):
        """Cache model for image input"""
        if not os.path.exists(image_path):
            logger.warning(f"Image path does not exist: {image_path}")
            return
        
        try:
            # Generate hash
            with open(image_path, 'rb') as f:
                image_hash = hashlib.md5(f.read()).hexdigest()
            
            # Extract features
            features = self._extract_image_features(image_path)
            if features is None:
                logger.warning(f"Could not extract features from image: {image_path}")
                return
            
            features_blob = pickle.dumps(features)
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR REPLACE INTO image_cache 
                (input_hash, image_path, features, model_path, quality_score, generation_time)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                image_hash,
                image_path,
                features_blob,
                model_data['model_path'],
                model_data.get('quality_score', 0),
                model_data.get('generation_time', 0)
            ))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Cached image model for: {os.path.basename(image_path)}")
            
        except Exception as e:
            logger.error(f"Error caching image model: {e}")
    
    def _extract_image_features(self, image_path: str) -> Optional[np.ndarray]:
        """Extract features from image for similarity comparison"""
        try:
            # Read image
            img = cv2.imread(image_path)
            if img is None:
                return None
            
            # Resize for consistency
            img = cv2.resize(img, (224, 224))
            
            # Convert to HSV for color features
            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            
            # Extract color histogram
            hist_h = cv2.calcHist([hsv], [0], None, [50], [0, 180])
            hist_s = cv2.calcHist([hsv], [1], None, [60], [0, 256])
            hist_v = cv2.calcHist([hsv], [2], None, [60], [0, 256])
            
            # Extract edge features
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 50, 150)
            edge_hist = cv2.calcHist([edges], [0], None, [256], [0, 256])
            
            # Combine features
            features = np.concatenate([
                hist_h.flatten(),
                hist_s.flatten(),
                hist_v.flatten(),
                edge_hist.flatten()
            ])
            
            # Normalize features
            features = features / (np.linalg.norm(features) + 1e-8)
            
            return features
            
        except Exception as e:
            logger.error(f"Error extracting image features: {e}")
            return None
    
    def get_cache_statistics(self) -> Dict[str, Any]:
        """Get cache usage statistics"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Text cache stats
            cursor.execute('SELECT COUNT(*), AVG(access_count) FROM text_cache')
            text_stats = cursor.fetchone()
            
            # Image cache stats
            cursor.execute('SELECT COUNT(*), AVG(access_count) FROM image_cache')
            image_stats = cursor.fetchone()
            
            # Total cache size
            cache_size = 0
            for root, dirs, files in os.walk(self.cache_dir):
                for file in files:
                    cache_size += os.path.getsize(os.path.join(root, file))
            
            conn.close()
            
            return {
                'text_cache_entries': text_stats[0] or 0,
                'image_cache_entries': image_stats[0] or 0,
                'avg_text_access_count': text_stats[1] or 0,
                'avg_image_access_count': image_stats[1] or 0,
                'total_cache_size_mb': cache_size / (1024 * 1024),
                'similarity_threshold': self.similarity_threshold
            }
            
        except Exception as e:
            logger.error(f"Error getting cache statistics: {e}")
            return {}
    
    def cleanup_cache(self, max_age_days: int = 30, max_size_gb: int = 10):
        """Clean up old cache entries"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Remove old entries
            cursor.execute('''
                DELETE FROM text_cache 
                WHERE last_accessed < datetime('now', '-{} days')
            '''.format(max_age_days))
            
            cursor.execute('''
                DELETE FROM image_cache 
                WHERE last_accessed < datetime('now', '-{} days')
            '''.format(max_age_days))
            
            # TODO: Implement size-based cleanup
            # This would remove least recently used items if cache exceeds max_size_gb
            
            conn.commit()
            conn.close()
            
            logger.info(f"Cache cleanup completed")
            
        except Exception as e:
            logger.error(f"Error during cache cleanup: {e}")