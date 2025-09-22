#!/usr/bin/env python3
"""
Simple test script for the 3D Model Generation backend
"""

import sys
import os
import requests
import time
import threading

# Add backend to path
backend_path = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_path)

def test_backend():
    """Test the backend functionality"""
    print("🧪 Testing 3D Model Generation Backend...")
    
    # Test 1: Health check
    print("\n1. Testing health check endpoint...")
    try:
        response = requests.get('http://localhost:5000/api/health', timeout=5)
        if response.status_code == 200:
            print("✅ Health check passed")
            print(f"   Response: {response.json()}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Health check failed: {e}")
        return False
    
    # Test 2: Statistics endpoint
    print("\n2. Testing statistics endpoint...")
    try:
        response = requests.get('http://localhost:5000/api/stats', timeout=5)
        if response.status_code == 200:
            print("✅ Statistics endpoint working")
            stats = response.json()
            print(f"   Total requests: {stats.get('total_requests', 0)}")
            print(f"   Cache hit rate: {stats.get('cache_hit_rate', 0)}%")
        else:
            print(f"❌ Statistics endpoint failed: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Statistics endpoint failed: {e}")
    
    # Test 3: Text generation
    print("\n3. Testing text-to-3D generation...")
    try:
        payload = {
            "prompt": "A simple red cube"
        }
        response = requests.post('http://localhost:5000/api/generate/text', 
                               json=payload, timeout=10)
        if response.status_code == 200:
            result = response.json()
            print("✅ Text generation request accepted")
            print(f"   Request ID: {result.get('request_id')}")
            print(f"   Status: {result.get('status')}")
            
            # Check status
            request_id = result.get('request_id')
            if request_id:
                print(f"   Checking status...")
                time.sleep(2)  # Wait a moment
                status_response = requests.get(f'http://localhost:5000/api/status/{request_id}')
                if status_response.status_code == 200:
                    status_data = status_response.json()
                    print(f"   Generation status: {status_data.get('status')}")
                    if status_data.get('status') == 'completed':
                        print("✅ Text generation completed successfully")
                    else:
                        print("⏳ Text generation in progress (this is normal)")
                
        else:
            print(f"❌ Text generation failed: {response.status_code}")
            print(f"   Response: {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Text generation failed: {e}")
    
    print("\n🎉 Backend test completed!")
    print("\nTo start the backend manually:")
    print("cd backend && source venv/bin/activate && python app.py")
    print("\nTo test the frontend:")
    print("cd frontend && npm install && npm start")
    
    return True

def start_backend():
    """Start the backend server for testing"""
    print("🚀 Starting backend server...")
    
    # Change to backend directory
    os.chdir(backend_path)
    
    # Import and run the app
    try:
        from app import app
        app.run(debug=False, host='0.0.0.0', port=5000, threaded=True)
    except Exception as e:
        print(f"❌ Failed to start backend: {e}")

if __name__ == "__main__":
    # Start backend in a separate thread
    backend_thread = threading.Thread(target=start_backend, daemon=True)
    backend_thread.start()
    
    # Wait for backend to start
    print("⏳ Waiting for backend to start...")
    time.sleep(5)
    
    # Run tests
    test_backend()