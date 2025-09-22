"""
3D Model Generation Application - Main Flask App
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os
import logging
from datetime import datetime
import uuid
import threading

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.model_generator import ModelGenerator
from app.cache_manager import CacheManager
from app.evaluation_system import EvaluationSystem
from config.settings import Config

# Initialize Flask app
app = Flask(__name__)
app.config.from_object(Config)

# Initialize extensions
CORS(app)
db = SQLAlchemy(app)

# Initialize components
model_generator = ModelGenerator()
cache_manager = CacheManager()
evaluation_system = EvaluationSystem()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database Models
class GenerationRequest(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_type = db.Column(db.String(20), nullable=False)  # 'text' or 'image'
    input_data = db.Column(db.Text, nullable=False)
    input_image_path = db.Column(db.String(255))
    output_model_path = db.Column(db.String(255))
    generation_time = db.Column(db.Float)
    cache_hit = db.Column(db.Boolean, default=False)
    quality_score = db.Column(db.Float)
    user_rating = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='pending')  # pending, processing, completed, failed

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0.0'
    })

@app.route('/api/generate/text', methods=['POST'])
def generate_from_text():
    """Generate 3D model from text description"""
    try:
        data = request.get_json()
        text_prompt = data.get('prompt', '').strip()
        
        if not text_prompt:
            return jsonify({'error': 'Text prompt is required'}), 400
        
        # Create request record
        request_id = str(uuid.uuid4())
        generation_request = GenerationRequest(
            id=request_id,
            request_type='text',
            input_data=text_prompt,
            status='processing'
        )
        db.session.add(generation_request)
        db.session.commit()
        
        # Check cache first
        cached_result = cache_manager.get_cached_model(text_prompt, 'text')
        
        if cached_result:
            logger.info(f"Cache hit for text prompt: {text_prompt[:50]}...")
            generation_request.cache_hit = True
            generation_request.output_model_path = cached_result['model_path']
            generation_request.status = 'completed'
            generation_request.generation_time = 0.5  # Fast cache retrieval
            db.session.commit()
            
            return jsonify({
                'request_id': request_id,
                'status': 'completed',
                'model_url': f'/api/models/{request_id}',
                'cache_hit': True,
                'generation_time': 0.5
            })
        
        # Generate new model in background
        def generate_model():
            try:
                start_time = datetime.utcnow()
                result = model_generator.generate_from_text(text_prompt)
                generation_time = (datetime.utcnow() - start_time).total_seconds()
                
                # Save model file
                model_filename = f"{request_id}.obj"
                model_path = os.path.join(app.config['MODELS_DIR'], model_filename)
                
                with open(model_path, 'w') as f:
                    f.write(result['model_data'])
                
                # Update database
                generation_request.output_model_path = model_path
                generation_request.generation_time = generation_time
                generation_request.status = 'completed'
                
                # Evaluate quality
                quality_score = evaluation_system.evaluate_model(model_path, text_prompt, 'text')
                generation_request.quality_score = quality_score
                
                db.session.commit()
                
                # Cache the result
                cache_manager.cache_model(text_prompt, 'text', {
                    'model_path': model_path,
                    'quality_score': quality_score,
                    'generation_time': generation_time
                })
                
                logger.info(f"Model generated successfully for request {request_id}")
                
            except Exception as e:
                logger.error(f"Error generating model for request {request_id}: {str(e)}")
                generation_request.status = 'failed'
                db.session.commit()
        
        # Start generation in background thread
        thread = threading.Thread(target=generate_model)
        thread.start()
        
        return jsonify({
            'request_id': request_id,
            'status': 'processing',
            'message': 'Model generation started'
        })
        
    except Exception as e:
        logger.error(f"Error in generate_from_text: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/generate/image', methods=['POST'])
def generate_from_image():
    """Generate 3D model from uploaded image"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        image_file = request.files['image']
        if image_file.filename == '':
            return jsonify({'error': 'No image file selected'}), 400
        
        # Save uploaded image
        request_id = str(uuid.uuid4())
        image_filename = f"{request_id}_{image_file.filename}"
        image_path = os.path.join(app.config['UPLOAD_DIR'], image_filename)
        image_file.save(image_path)
        
        # Create request record
        generation_request = GenerationRequest(
            id=request_id,
            request_type='image',
            input_data=image_filename,
            input_image_path=image_path,
            status='processing'
        )
        db.session.add(generation_request)
        db.session.commit()
        
        # Check cache
        cached_result = cache_manager.get_cached_model(image_path, 'image')
        
        if cached_result:
            logger.info(f"Cache hit for image: {image_filename}")
            generation_request.cache_hit = True
            generation_request.output_model_path = cached_result['model_path']
            generation_request.status = 'completed'
            generation_request.generation_time = 0.5
            db.session.commit()
            
            return jsonify({
                'request_id': request_id,
                'status': 'completed',
                'model_url': f'/api/models/{request_id}',
                'cache_hit': True,
                'generation_time': 0.5
            })
        
        # Generate new model in background
        def generate_model():
            try:
                start_time = datetime.utcnow()
                result = model_generator.generate_from_image(image_path)
                generation_time = (datetime.utcnow() - start_time).total_seconds()
                
                # Save model file
                model_filename = f"{request_id}.obj"
                model_path = os.path.join(app.config['MODELS_DIR'], model_filename)
                
                with open(model_path, 'w') as f:
                    f.write(result['model_data'])
                
                # Update database
                generation_request.output_model_path = model_path
                generation_request.generation_time = generation_time
                generation_request.status = 'completed'
                
                # Evaluate quality
                quality_score = evaluation_system.evaluate_model(model_path, image_path, 'image')
                generation_request.quality_score = quality_score
                
                db.session.commit()
                
                # Cache the result
                cache_manager.cache_model(image_path, 'image', {
                    'model_path': model_path,
                    'quality_score': quality_score,
                    'generation_time': generation_time
                })
                
                logger.info(f"Model generated successfully for request {request_id}")
                
            except Exception as e:
                logger.error(f"Error generating model for request {request_id}: {str(e)}")
                generation_request.status = 'failed'
                db.session.commit()
        
        # Start generation in background thread
        thread = threading.Thread(target=generate_model)
        thread.start()
        
        return jsonify({
            'request_id': request_id,
            'status': 'processing',
            'message': 'Model generation started'
        })
        
    except Exception as e:
        logger.error(f"Error in generate_from_image: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/status/<request_id>', methods=['GET'])
def get_generation_status(request_id):
    """Get the status of a generation request"""
    try:
        generation_request = GenerationRequest.query.get(request_id)
        
        if not generation_request:
            return jsonify({'error': 'Request not found'}), 404
        
        response_data = {
            'request_id': request_id,
            'status': generation_request.status,
            'request_type': generation_request.request_type,
            'created_at': generation_request.created_at.isoformat(),
            'cache_hit': generation_request.cache_hit
        }
        
        if generation_request.status == 'completed':
            response_data.update({
                'model_url': f'/api/models/{request_id}',
                'generation_time': generation_request.generation_time,
                'quality_score': generation_request.quality_score
            })
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error getting status for request {request_id}: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/models/<request_id>', methods=['GET'])
def download_model(request_id):
    """Download generated 3D model"""
    try:
        generation_request = GenerationRequest.query.get(request_id)
        
        if not generation_request or generation_request.status != 'completed':
            return jsonify({'error': 'Model not found or not ready'}), 404
        
        if not os.path.exists(generation_request.output_model_path):
            return jsonify({'error': 'Model file not found'}), 404
        
        return send_file(
            generation_request.output_model_path,
            as_attachment=True,
            download_name=f'model_{request_id}.obj'
        )
        
    except Exception as e:
        logger.error(f"Error downloading model {request_id}: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/rate/<request_id>', methods=['POST'])
def rate_model(request_id):
    """Rate a generated model"""
    try:
        data = request.get_json()
        rating = data.get('rating', 0)
        
        if not 1 <= rating <= 5:
            return jsonify({'error': 'Rating must be between 1 and 5'}), 400
        
        generation_request = GenerationRequest.query.get(request_id)
        
        if not generation_request:
            return jsonify({'error': 'Request not found'}), 404
        
        generation_request.user_rating = rating
        db.session.commit()
        
        # Update evaluation system with user feedback
        evaluation_system.record_user_feedback(request_id, rating)
        
        return jsonify({'message': 'Rating recorded successfully'})
        
    except Exception as e:
        logger.error(f"Error rating model {request_id}: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/stats', methods=['GET'])
def get_statistics():
    """Get generation statistics"""
    try:
        total_requests = GenerationRequest.query.count()
        completed_requests = GenerationRequest.query.filter_by(status='completed').count()
        cache_hits = GenerationRequest.query.filter_by(cache_hit=True).count()
        
        avg_generation_time = db.session.query(db.func.avg(GenerationRequest.generation_time))\
            .filter(GenerationRequest.status == 'completed').scalar() or 0
        avg_quality_score = db.session.query(db.func.avg(GenerationRequest.quality_score))\
            .filter(GenerationRequest.quality_score.isnot(None)).scalar() or 0
        avg_user_rating = db.session.query(db.func.avg(GenerationRequest.user_rating))\
            .filter(GenerationRequest.user_rating.isnot(None)).scalar() or 0
        
        cache_hit_rate = (cache_hits / total_requests * 100) if total_requests > 0 else 0
        completion_rate = (completed_requests / total_requests * 100) if total_requests > 0 else 0
        
        return jsonify({
            'total_requests': total_requests,
            'completed_requests': completed_requests,
            'cache_hits': cache_hits,
            'cache_hit_rate': round(cache_hit_rate, 2),
            'completion_rate': round(completion_rate, 2),
            'avg_generation_time': round(avg_generation_time, 2),
            'avg_quality_score': round(avg_quality_score, 2),
            'avg_user_rating': round(avg_user_rating, 2)
        })
        
    except Exception as e:
        logger.error(f"Error getting statistics: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# Initialize database
with app.app_context():
    db.create_all()
    
    # Create directories
    os.makedirs(app.config['UPLOAD_DIR'], exist_ok=True)
    os.makedirs(app.config['MODELS_DIR'], exist_ok=True)
    os.makedirs(app.config['CACHE_DIR'], exist_ok=True)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)