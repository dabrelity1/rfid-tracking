#!/bin/bash

# RFID Tracking System - Development Setup Script
# This script sets up the development environment for the RFID tracking application

echo "🚀 Setting up RFID Tracking System Development Environment"
echo "=========================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ and try again."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm and try again."
    exit 1
fi

echo "✅ Node.js $(node --version) detected"
echo "✅ npm $(npm --version) detected"

# Setup Backend
echo ""
echo "📦 Setting up Backend..."
cd backend

if [ ! -f ".env" ]; then
    echo "📝 Creating backend environment file..."
    cp .env.example .env
    echo "⚠️  Please configure your database settings in backend/.env"
fi

echo "📥 Installing backend dependencies..."
npm install

# Create required directories
mkdir -p logs uploads

echo "✅ Backend setup complete"

# Setup Frontend
echo ""
echo "🎨 Setting up Frontend..."
cd ../frontend

if [ ! -f ".env" ]; then
    echo "📝 Creating frontend environment file..."
    echo "REACT_APP_API_URL=http://localhost:5000/api" > .env
fi

echo "📥 Installing frontend dependencies..."
npm install

echo "✅ Frontend setup complete"

# Go back to root
cd ..

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "📚 Next Steps:"
echo "1. Configure your PostgreSQL database"
echo "2. Update backend/.env with your database credentials"
echo "3. Run database migrations: cd backend && npm run migrate"
echo "4. Start the backend: cd backend && npm run dev"
echo "5. Start the frontend: cd frontend && npm start"
echo ""
echo "🌐 The application will be available at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:5000/api"
echo ""
echo "📖 Check README.md for detailed documentation"
echo ""
echo "Happy tracking! 🏷️📊"