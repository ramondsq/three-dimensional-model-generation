"""
3D Model Generator - Handles API calls to external 3D generation services
"""

import requests
import json
import time
import logging
import base64
from typing import Dict, Optional, Any

logger = logging.getLogger(__name__)

class ModelGenerator:
    """Handles 3D model generation from text and images"""
    
    def __init__(self):
        self.api_key = None  # Will be set from config
        self.base_url = "https://api.meshy.ai/v1"
        self.timeout = 300  # 5 minutes timeout
        
    def set_api_key(self, api_key: str):
        """Set the API key for the service"""
        self.api_key = api_key
    
    def generate_from_text(self, text_prompt: str, **kwargs) -> Dict[str, Any]:
        """
        Generate 3D model from text description
        
        Args:
            text_prompt: Text description of the object to generate
            **kwargs: Additional parameters for generation
            
        Returns:
            Dictionary containing model data and metadata
        """
        try:
            logger.info(f"Generating 3D model from text: {text_prompt[:100]}...")
            
            # For demonstration, we'll create a mock model based on the text
            # In production, this would call the actual Meshy AI API
            
            # Simulate API call delay
            time.sleep(2)
            
            # Generate mock OBJ file content based on text prompt
            model_data = self._generate_mock_obj_from_text(text_prompt)
            
            result = {
                'model_data': model_data,
                'format': 'obj',
                'generation_method': 'text-to-3d',
                'input_prompt': text_prompt,
                'vertex_count': self._count_vertices(model_data),
                'face_count': self._count_faces(model_data),
                'metadata': {
                    'generator': 'MockMeshyAI',
                    'version': '1.0',
                    'timestamp': time.time()
                }
            }
            
            logger.info(f"Successfully generated 3D model from text. Vertices: {result['vertex_count']}, Faces: {result['face_count']}")
            return result
            
        except Exception as e:
            logger.error(f"Error generating 3D model from text: {str(e)}")
            raise Exception(f"Failed to generate 3D model: {str(e)}")
    
    def generate_from_image(self, image_path: str, **kwargs) -> Dict[str, Any]:
        """
        Generate 3D model from image
        
        Args:
            image_path: Path to the input image file
            **kwargs: Additional parameters for generation
            
        Returns:
            Dictionary containing model data and metadata
        """
        try:
            logger.info(f"Generating 3D model from image: {image_path}")
            
            # For demonstration, we'll create a mock model based on the image
            # In production, this would call the actual Meshy AI API
            
            # Simulate API call delay
            time.sleep(3)
            
            # Generate mock OBJ file content based on image analysis
            model_data = self._generate_mock_obj_from_image(image_path)
            
            result = {
                'model_data': model_data,
                'format': 'obj',
                'generation_method': 'image-to-3d',
                'input_image': image_path,
                'vertex_count': self._count_vertices(model_data),
                'face_count': self._count_faces(model_data),
                'metadata': {
                    'generator': 'MockMeshyAI',
                    'version': '1.0',
                    'timestamp': time.time()
                }
            }
            
            logger.info(f"Successfully generated 3D model from image. Vertices: {result['vertex_count']}, Faces: {result['face_count']}")
            return result
            
        except Exception as e:
            logger.error(f"Error generating 3D model from image: {str(e)}")
            raise Exception(f"Failed to generate 3D model: {str(e)}")
    
    def _generate_mock_obj_from_text(self, text_prompt: str) -> str:
        """Generate a mock OBJ file based on text prompt"""
        
        # Simple heuristics to generate different basic shapes based on text
        prompt_lower = text_prompt.lower()
        
        if any(word in prompt_lower for word in ['cube', 'box', 'square']):
            return self._generate_cube_obj()
        elif any(word in prompt_lower for word in ['sphere', 'ball', 'round']):
            return self._generate_sphere_obj()
        elif any(word in prompt_lower for word in ['cylinder', 'tube', 'pipe']):
            return self._generate_cylinder_obj()
        elif any(word in prompt_lower for word in ['pyramid', 'triangle']):
            return self._generate_pyramid_obj()
        else:
            # Default to a more complex shape
            return self._generate_complex_obj()
    
    def _generate_mock_obj_from_image(self, image_path: str) -> str:
        """Generate a mock OBJ file based on image analysis"""
        
        # For demo, we'll just generate a complex shape
        # In production, this would analyze the image and create appropriate geometry
        return self._generate_complex_obj()
    
    def _generate_cube_obj(self) -> str:
        """Generate a simple cube OBJ file"""
        return """# Cube generated by 3D Model Generator
v -1.0 -1.0  1.0
v  1.0 -1.0  1.0
v  1.0  1.0  1.0
v -1.0  1.0  1.0
v -1.0 -1.0 -1.0
v  1.0 -1.0 -1.0
v  1.0  1.0 -1.0
v -1.0  1.0 -1.0

f 1 2 3 4
f 2 6 7 3
f 6 5 8 7
f 5 1 4 8
f 4 3 7 8
f 1 5 6 2
"""
    
    def _generate_sphere_obj(self) -> str:
        """Generate a simple sphere OBJ file"""
        obj_content = "# Sphere generated by 3D Model Generator\n"
        
        # Generate vertices for a simple sphere (icosahedron-based)
        import math
        
        vertices = []
        faces = []
        
        # Simple sphere approximation with 8 vertices
        for i in range(8):
            theta = i * math.pi / 4
            x = math.cos(theta)
            y = math.sin(theta)
            z = 0
            vertices.append((x, y, z))
            
        for i in range(8):
            theta = i * math.pi / 4
            x = math.cos(theta) * 0.5
            y = math.sin(theta) * 0.5
            z = 0.8
            vertices.append((x, y, z))
            
        for i in range(8):
            theta = i * math.pi / 4
            x = math.cos(theta) * 0.5
            y = math.sin(theta) * 0.5
            z = -0.8
            vertices.append((x, y, z))
        
        # Add vertices to OBJ
        for v in vertices:
            obj_content += f"v {v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n"
        
        # Add some faces
        for i in range(8):
            next_i = (i + 1) % 8
            obj_content += f"f {i+1} {next_i+1} {i+9}\n"
            obj_content += f"f {i+1} {i+17} {next_i+17}\n"
        
        return obj_content
    
    def _generate_cylinder_obj(self) -> str:
        """Generate a simple cylinder OBJ file"""
        obj_content = "# Cylinder generated by 3D Model Generator\n"
        
        import math
        
        # Generate vertices for top and bottom circles
        segments = 8
        for level in [1, -1]:  # Top and bottom
            for i in range(segments):
                angle = 2 * math.pi * i / segments
                x = math.cos(angle)
                y = math.sin(angle)
                z = level
                obj_content += f"v {x:.6f} {y:.6f} {z:.6f}\n"
        
        # Add center vertices
        obj_content += "v 0.0 0.0 1.0\n"  # Top center
        obj_content += "v 0.0 0.0 -1.0\n"  # Bottom center
        
        # Add faces
        for i in range(segments):
            next_i = (i + 1) % segments
            # Side faces
            obj_content += f"f {i+1} {i+segments+1} {next_i+segments+1} {next_i+1}\n"
            # Top face
            obj_content += f"f {segments*2+1} {i+1} {next_i+1}\n"
            # Bottom face
            obj_content += f"f {segments*2+2} {next_i+segments+1} {i+segments+1}\n"
        
        return obj_content
    
    def _generate_pyramid_obj(self) -> str:
        """Generate a simple pyramid OBJ file"""
        return """# Pyramid generated by 3D Model Generator
v -1.0 -1.0 -1.0
v  1.0 -1.0 -1.0
v  1.0  1.0 -1.0
v -1.0  1.0 -1.0
v  0.0  0.0  1.0

f 1 2 5
f 2 3 5
f 3 4 5
f 4 1 5
f 1 4 3 2
"""
    
    def _generate_complex_obj(self) -> str:
        """Generate a more complex shape for general prompts"""
        obj_content = "# Complex shape generated by 3D Model Generator\n"
        
        import math
        
        # Generate a twisted shape
        for layer in range(10):
            z = layer * 0.2 - 1.0
            twist = layer * 0.3
            for i in range(6):
                angle = 2 * math.pi * i / 6 + twist
                radius = 1.0 - layer * 0.05
                x = radius * math.cos(angle)
                y = radius * math.sin(angle)
                obj_content += f"v {x:.6f} {y:.6f} {z:.6f}\n"
        
        # Add faces connecting layers
        for layer in range(9):
            for i in range(6):
                next_i = (i + 1) % 6
                v1 = layer * 6 + i + 1
                v2 = layer * 6 + next_i + 1
                v3 = (layer + 1) * 6 + i + 1
                v4 = (layer + 1) * 6 + next_i + 1
                
                obj_content += f"f {v1} {v2} {v4} {v3}\n"
        
        return obj_content
    
    def _count_vertices(self, obj_data: str) -> int:
        """Count vertices in OBJ file"""
        return len([line for line in obj_data.split('\n') if line.strip().startswith('v ')])
    
    def _count_faces(self, obj_data: str) -> int:
        """Count faces in OBJ file"""
        return len([line for line in obj_data.split('\n') if line.strip().startswith('f ')])
    
    def _call_meshy_api(self, endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Call Meshy AI API (for production use)
        
        This method would be used in production to make actual API calls
        """
        if not self.api_key:
            raise ValueError("API key not set")
        
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
        
        url = f"{self.base_url}/{endpoint}"
        
        try:
            response = requests.post(url, json=data, headers=headers, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"API call failed: {str(e)}")
            raise Exception(f"API call failed: {str(e)}")