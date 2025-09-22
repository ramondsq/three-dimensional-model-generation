#!/bin/bash

# 3D Model Generation Application Setup Script

echo "🎨 Setting up 3D Model Generation Application..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required. Please install Python 3.9 or higher."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Please install Node.js 18 or higher."
    exit 1
fi

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating environment file..."
    cp .env.example .env
    echo "✅ Please edit .env file with your API keys before running the application"
fi

# Setup backend
echo "🔧 Setting up backend..."
cd backend

# Create virtual environment
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Created Python virtual environment"
fi

# Activate virtual environment
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
echo "✅ Installed Python dependencies"

# Create necessary directories
mkdir -p uploads generated_models cache logs
echo "✅ Created application directories"

cd ..

# Setup frontend
echo "🎨 Setting up frontend..."
cd frontend

# Install Node.js dependencies
npm install
echo "✅ Installed Node.js dependencies"

cd ..

echo ""
echo "🎉 Setup complete!"
echo ""
echo "To start the application:"
echo "1. Edit .env file with your API keys"
echo "2. Run: docker-compose up -d"
echo "   OR"
echo "2a. Backend: cd backend && source venv/bin/activate && python app.py"
echo "2b. Frontend: cd frontend && npm start"
echo ""
echo "Access the application at:"
echo "- Frontend: http://localhost:3000"
echo "- Backend API: http://localhost:5000"
echo ""
echo "📚 See README.md for detailed documentation"