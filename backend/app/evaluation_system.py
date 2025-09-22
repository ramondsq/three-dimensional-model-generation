"""
3D Model Quality Evaluation System
"""

import os
import logging
import json
import time
import sqlite3
from typing import Dict, Any, List, Optional
import numpy as np
import trimesh
from datetime import datetime

logger = logging.getLogger(__name__)

class EvaluationSystem:
    """Evaluates 3D model quality and collects user feedback"""
    
    def __init__(self, db_path: str = 'evaluation.db'):
        self.db_path = db_path
        self.quality_weights = {
            'geometry': 0.3,
            'texture': 0.2,
            'fidelity': 0.3,
            'performance': 0.2
        }
        
        # Initialize database
        self._init_database()
        
        logger.info("Evaluation system initialized")
    
    def _init_database(self):
        """Initialize evaluation database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create evaluation results table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS evaluation_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_id TEXT,
                    model_path TEXT,
                    input_data TEXT,
                    input_type TEXT,
                    geometry_score REAL,
                    texture_score REAL,
                    fidelity_score REAL,
                    performance_score REAL,
                    overall_score REAL,
                    vertex_count INTEGER,
                    face_count INTEGER,
                    generation_time REAL,
                    evaluation_time REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Create user feedback table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_feedback (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_id TEXT,
                    user_rating INTEGER,
                    feedback_text TEXT,
                    feedback_categories TEXT,  -- JSON array of categories
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Create quality trends table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS quality_trends (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT,
                    avg_overall_score REAL,
                    avg_geometry_score REAL,
                    avg_texture_score REAL,
                    avg_fidelity_score REAL,
                    avg_performance_score REAL,
                    avg_user_rating REAL,
                    total_evaluations INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            logger.error(f"Failed to initialize evaluation database: {e}")
            raise
    
    def evaluate_model(self, model_path: str, input_data: str, input_type: str) -> float:
        """
        Evaluate 3D model quality
        
        Args:
            model_path: Path to the 3D model file
            input_data: Original input (text or image path)
            input_type: 'text' or 'image'
            
        Returns:
            Overall quality score (0-1)
        """
        try:
            start_time = time.time()
            
            if not os.path.exists(model_path):
                logger.error(f"Model file not found: {model_path}")
                return 0.0
            
            # Load model
            try:
                mesh = trimesh.load(model_path)
                if not isinstance(mesh, trimesh.Trimesh):
                    # If it's a scene, get the first mesh
                    if hasattr(mesh, 'geometry') and mesh.geometry:
                        mesh = list(mesh.geometry.values())[0]
                    else:
                        logger.warning(f"Could not load mesh from {model_path}")
                        return 0.0
            except Exception as e:
                logger.error(f"Error loading mesh: {e}")
                return 0.0
            
            # Calculate individual scores
            geometry_score = self._evaluate_geometry(mesh)
            texture_score = self._evaluate_texture(mesh, model_path)
            fidelity_score = self._evaluate_fidelity(mesh, input_data, input_type)
            performance_score = self._evaluate_performance(mesh)
            
            # Calculate weighted overall score
            overall_score = (
                geometry_score * self.quality_weights['geometry'] +
                texture_score * self.quality_weights['texture'] +
                fidelity_score * self.quality_weights['fidelity'] +
                performance_score * self.quality_weights['performance']
            )
            
            evaluation_time = time.time() - start_time
            
            # Store evaluation results
            self._store_evaluation(
                model_path=model_path,
                input_data=input_data,
                input_type=input_type,
                geometry_score=geometry_score,
                texture_score=texture_score,
                fidelity_score=fidelity_score,
                performance_score=performance_score,
                overall_score=overall_score,
                vertex_count=len(mesh.vertices),
                face_count=len(mesh.faces),
                evaluation_time=evaluation_time
            )
            
            logger.info(f"Model evaluation completed. Overall score: {overall_score:.3f}")
            return overall_score
            
        except Exception as e:
            logger.error(f"Error evaluating model: {e}")
            return 0.0
    
    def _evaluate_geometry(self, mesh: trimesh.Trimesh) -> float:
        """Evaluate geometric quality of the mesh"""
        try:
            score = 1.0
            
            # Check for watertight mesh
            if not mesh.is_watertight:
                score -= 0.2
                logger.debug("Mesh is not watertight")
            
            # Check for self-intersections
            if mesh.is_self_intersecting:
                score -= 0.3
                logger.debug("Mesh has self-intersections")
            
            # Check vertex/face ratio (should be reasonable)
            if len(mesh.vertices) > 0:
                face_vertex_ratio = len(mesh.faces) / len(mesh.vertices)
                if face_vertex_ratio < 1.5 or face_vertex_ratio > 3.0:
                    score -= 0.1
                    logger.debug(f"Unusual face/vertex ratio: {face_vertex_ratio:.2f}")
            
            # Check for degenerate faces
            face_areas = mesh.area_faces
            zero_area_faces = np.sum(face_areas < 1e-10)
            if zero_area_faces > 0:
                penalty = min(0.2, zero_area_faces / len(mesh.faces) * 0.5)
                score -= penalty
                logger.debug(f"Found {zero_area_faces} degenerate faces")
            
            # Check mesh density (reasonable number of vertices)
            vertex_count = len(mesh.vertices)
            if vertex_count < 10:
                score -= 0.3  # Too simple
            elif vertex_count > 100000:
                score -= 0.1  # Possibly too complex
            
            return max(0.0, score)
            
        except Exception as e:
            logger.error(f"Error in geometry evaluation: {e}")
            return 0.5  # Default score on error
    
    def _evaluate_texture(self, mesh: trimesh.Trimesh, model_path: str) -> float:
        """Evaluate texture quality"""
        try:
            score = 0.5  # Base score for models without texture
            
            # Check if model has UV coordinates
            if hasattr(mesh.visual, 'uv') and mesh.visual.uv is not None:
                score += 0.2
                logger.debug("Model has UV coordinates")
            
            # Check if model has vertex colors
            if hasattr(mesh.visual, 'vertex_colors') and mesh.visual.vertex_colors is not None:
                score += 0.2
                logger.debug("Model has vertex colors")
                
            # Check if model has material information
            if hasattr(mesh.visual, 'material') and mesh.visual.material is not None:
                score += 0.1
                logger.debug("Model has material information")
            
            # For OBJ files, check if there's an associated MTL file
            if model_path.endswith('.obj'):
                mtl_path = model_path.replace('.obj', '.mtl')
                if os.path.exists(mtl_path):
                    score += 0.2
                    logger.debug("Found associated MTL file")
            
            return min(1.0, score)
            
        except Exception as e:
            logger.error(f"Error in texture evaluation: {e}")
            return 0.5
    
    def _evaluate_fidelity(self, mesh: trimesh.Trimesh, input_data: str, input_type: str) -> float:
        """Evaluate how well the model matches the input"""
        try:
            # This is a simplified fidelity check
            # In a production system, this would use more sophisticated methods
            
            score = 0.7  # Base score
            
            if input_type == 'text':
                # Basic text-to-model fidelity check
                # Check if the model has reasonable complexity for the description
                text_lower = input_data.lower()
                vertex_count = len(mesh.vertices)
                
                # Simple heuristics based on text complexity
                if any(word in text_lower for word in ['simple', 'basic', 'cube', 'sphere']):
                    if vertex_count < 1000:
                        score += 0.2
                    else:
                        score -= 0.1  # Too complex for simple object
                elif any(word in text_lower for word in ['detailed', 'complex', 'intricate']):
                    if vertex_count > 500:
                        score += 0.2
                    else:
                        score -= 0.1  # Too simple for complex object
                
                # Check bounding box proportions
                bounds = mesh.bounds
                if bounds.shape[0] >= 2:
                    size = bounds[1] - bounds[0]
                    if np.all(size > 0):
                        # Reasonable proportions
                        aspect_ratios = size / np.min(size)
                        if np.max(aspect_ratios) < 10:  # Not too elongated
                            score += 0.1
            
            elif input_type == 'image':
                # Basic image-to-model fidelity check
                # This would typically involve comparing image features with model features
                score += 0.1  # Placeholder
            
            return min(1.0, max(0.0, score))
            
        except Exception as e:
            logger.error(f"Error in fidelity evaluation: {e}")
            return 0.5
    
    def _evaluate_performance(self, mesh: trimesh.Trimesh) -> float:
        """Evaluate model performance characteristics"""
        try:
            score = 1.0
            
            vertex_count = len(mesh.vertices)
            face_count = len(mesh.faces)
            
            # Penalty for excessive complexity
            if vertex_count > 50000:
                score -= 0.2
            elif vertex_count > 20000:
                score -= 0.1
            
            if face_count > 100000:
                score -= 0.2
            elif face_count > 40000:
                score -= 0.1
            
            # Bonus for reasonable complexity
            if 100 <= vertex_count <= 10000 and 100 <= face_count <= 20000:
                score += 0.1
            
            # Check mesh volume (should be reasonable)
            if mesh.is_watertight:
                try:
                    volume = mesh.volume
                    if volume > 0:
                        score += 0.1
                except:
                    pass
            
            return max(0.0, score)
            
        except Exception as e:
            logger.error(f"Error in performance evaluation: {e}")
            return 0.5
    
    def _store_evaluation(self, **kwargs):
        """Store evaluation results in database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO evaluation_results 
                (model_path, input_data, input_type, geometry_score, texture_score, 
                 fidelity_score, performance_score, overall_score, vertex_count, 
                 face_count, evaluation_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                kwargs.get('model_path'),
                kwargs.get('input_data'),
                kwargs.get('input_type'),
                kwargs.get('geometry_score'),
                kwargs.get('texture_score'),
                kwargs.get('fidelity_score'),
                kwargs.get('performance_score'),
                kwargs.get('overall_score'),
                kwargs.get('vertex_count'),
                kwargs.get('face_count'),
                kwargs.get('evaluation_time')
            ))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            logger.error(f"Error storing evaluation results: {e}")
    
    def record_user_feedback(self, request_id: str, rating: int, feedback_text: str = "", 
                           categories: List[str] = None):
        """Record user feedback for a model"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            categories_json = json.dumps(categories or [])
            
            cursor.execute('''
                INSERT INTO user_feedback 
                (request_id, user_rating, feedback_text, feedback_categories)
                VALUES (?, ?, ?, ?)
            ''', (request_id, rating, feedback_text, categories_json))
            
            conn.commit()
            conn.close()
            
            logger.info(f"User feedback recorded for request {request_id}: {rating}/5")
            
        except Exception as e:
            logger.error(f"Error recording user feedback: {e}")
    
    def get_evaluation_statistics(self) -> Dict[str, Any]:
        """Get evaluation statistics and trends"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Overall statistics
            cursor.execute('''
                SELECT 
                    COUNT(*) as total_evaluations,
                    AVG(overall_score) as avg_overall_score,
                    AVG(geometry_score) as avg_geometry_score,
                    AVG(texture_score) as avg_texture_score,
                    AVG(fidelity_score) as avg_fidelity_score,
                    AVG(performance_score) as avg_performance_score,
                    AVG(vertex_count) as avg_vertex_count,
                    AVG(face_count) as avg_face_count
                FROM evaluation_results
            ''')
            
            stats = cursor.fetchone()
            
            # User feedback statistics
            cursor.execute('''
                SELECT 
                    COUNT(*) as total_feedback,
                    AVG(user_rating) as avg_user_rating
                FROM user_feedback
            ''')
            
            feedback_stats = cursor.fetchone()
            
            # Recent trends (last 7 days)
            cursor.execute('''
                SELECT 
                    DATE(created_at) as date,
                    AVG(overall_score) as daily_avg_score,
                    COUNT(*) as daily_count
                FROM evaluation_results
                WHERE created_at >= datetime('now', '-7 days')
                GROUP BY DATE(created_at)
                ORDER BY date
            ''')
            
            daily_trends = cursor.fetchall()
            
            conn.close()
            
            return {
                'total_evaluations': stats[0] or 0,
                'avg_overall_score': round(stats[1] or 0, 3),
                'avg_geometry_score': round(stats[2] or 0, 3),
                'avg_texture_score': round(stats[3] or 0, 3),
                'avg_fidelity_score': round(stats[4] or 0, 3),
                'avg_performance_score': round(stats[5] or 0, 3),
                'avg_vertex_count': int(stats[6] or 0),
                'avg_face_count': int(stats[7] or 0),
                'total_user_feedback': feedback_stats[0] or 0,
                'avg_user_rating': round(feedback_stats[1] or 0, 2),
                'daily_trends': [
                    {
                        'date': row[0],
                        'avg_score': round(row[1], 3),
                        'count': row[2]
                    } for row in daily_trends
                ]
            }
            
        except Exception as e:
            logger.error(f"Error getting evaluation statistics: {e}")
            return {}
    
    def generate_quality_report(self) -> Dict[str, Any]:
        """Generate a comprehensive quality report"""
        try:
            stats = self.get_evaluation_statistics()
            
            # Quality assessment
            overall_score = stats.get('avg_overall_score', 0)
            quality_level = 'Poor'
            if overall_score >= 0.8:
                quality_level = 'Excellent'
            elif overall_score >= 0.7:
                quality_level = 'Good'
            elif overall_score >= 0.6:
                quality_level = 'Fair'
            
            # Recommendations
            recommendations = []
            
            if stats.get('avg_geometry_score', 0) < 0.7:
                recommendations.append("Improve mesh topology and reduce geometric artifacts")
            
            if stats.get('avg_texture_score', 0) < 0.6:
                recommendations.append("Enhance texture quality and UV mapping")
            
            if stats.get('avg_fidelity_score', 0) < 0.7:
                recommendations.append("Improve input-to-output fidelity matching")
            
            if stats.get('avg_performance_score', 0) < 0.7:
                recommendations.append("Optimize model complexity for better performance")
            
            user_rating = stats.get('avg_user_rating', 0)
            if user_rating < 3.5:
                recommendations.append("Focus on user experience improvements")
            
            return {
                'report_generated_at': datetime.utcnow().isoformat(),
                'quality_level': quality_level,
                'overall_score': overall_score,
                'statistics': stats,
                'recommendations': recommendations,
                'quality_trend': 'stable'  # Would be calculated from trends
            }
            
        except Exception as e:
            logger.error(f"Error generating quality report: {e}")
            return {'error': 'Failed to generate report'}