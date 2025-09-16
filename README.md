# RFID Asset Tracking System

A modern, scalable web application for managing and tracking assets via RFID technology with real-time monitoring, interactive floor plans, and comprehensive reporting.

## Features

### Core Functionality
- **Asset Management**: Create, edit, and remove assets with RFID tag association
- **Interactive Floor Plans**: Upload building layouts with clickable zones
- **Real-time RFID Tracking**: Integration with fixed and portable RFID readers
- **Alerts & Security**: Automated notifications for unauthorized movements
- **Check-in/Check-out System**: Asset requisition and return tracking
- **Comprehensive Reports**: Inventory, movement history, and audit logs

### Technical Features
- **Modern Architecture**: React frontend with Node.js backend
- **Real-time Updates**: WebSocket integration for live tracking
- **Responsive Design**: Mobile-friendly interface using Tailwind CSS
- **Secure Authentication**: JWT-based user authentication and authorization
- **Role-based Access**: Admin, user, and auditor permission levels
- **RESTful API**: Well-documented API endpoints
- **Database**: PostgreSQL with optimized indexing

## Tech Stack

### Backend
- **Runtime**: Node.js with Express framework
- **Database**: PostgreSQL with connection pooling
- **Authentication**: JWT tokens with bcrypt password hashing
- **Real-time**: Socket.IO for live updates
- **Validation**: Joi for request validation
- **Logging**: Winston for comprehensive logging
- **File Upload**: Multer for floor plan images

### Frontend
- **Framework**: React 18 with functional components and hooks
- **Styling**: Tailwind CSS with custom component classes
- **Routing**: React Router v6 for navigation
- **State Management**: Context API with useReducer
- **HTTP Client**: Axios with interceptors
- **Icons**: Lucide React icon library
- **Notifications**: React Hot Toast
- **Charts**: Recharts for data visualization

## Project Structure

```
rfid-tracking/
├── backend/
│   ├── src/
│   │   ├── config/          # Database and app configuration
│   │   ├── controllers/     # Route handlers (future expansion)
│   │   ├── middleware/      # Authentication and error handling
│   │   ├── models/          # Database models (future expansion)
│   │   ├── routes/          # API route definitions
│   │   ├── scripts/         # Database migrations and seeds
│   │   └── utils/           # Helper functions and utilities
│   ├── logs/                # Application logs
│   └── uploads/             # File upload storage
├── frontend/
│   ├── public/              # Static assets
│   └── src/
│       ├── components/      # Reusable UI components
│       ├── contexts/        # React context providers
│       ├── hooks/           # Custom React hooks
│       ├── pages/           # Page components
│       ├── services/        # API service functions
│       └── utils/           # Frontend utilities
└── docs/                    # Documentation
```

## Database Schema

### Core Tables
- **users**: User accounts with roles and permissions
- **assets**: Asset information with RFID tags
- **floor_plans**: Building layouts and floor plan data
- **zones**: Defined areas within floor plans
- **rfid_readers**: Fixed and portable RFID reader devices
- **rfid_readings**: Raw RFID scan data
- **asset_movements**: Tracked asset location changes
- **asset_checkouts**: Check-in/check-out records
- **alerts**: System-generated notifications
- **audit_logs**: Complete audit trail

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - User logout

### Assets
- `GET /api/assets` - List assets with filtering
- `GET /api/assets/:id` - Get asset details
- `POST /api/assets` - Create new asset
- `PUT /api/assets/:id` - Update asset
- `DELETE /api/assets/:id` - Delete asset
- `GET /api/assets/stats/overview` - Asset statistics

### RFID
- `POST /api/rfid/reading` - Process RFID reading
- `GET /api/rfid/readers` - List RFID readers
- `POST /api/rfid/readers` - Create RFID reader
- `PUT /api/rfid/readers/:id` - Update RFID reader
- `GET /api/rfid/readings` - Get reading history
- `POST /api/rfid/simulate` - Simulate RFID reading

### Floor Plans
- `GET /api/floor-plan` - List floor plans
- `GET /api/floor-plan/:id` - Get floor plan with zones
- `POST /api/floor-plan` - Create floor plan
- `POST /api/floor-plan/:id/zones` - Create zone
- `PUT /api/floor-plan/zones/:id` - Update zone
- `DELETE /api/floor-plan/zones/:id` - Delete zone

### Reports
- `GET /api/reports/dashboard` - Dashboard statistics
- `GET /api/reports/inventory` - Inventory report
- `GET /api/reports/movements` - Movement history
- `GET /api/reports/alerts` - Alerts report
- `POST /api/reports/alerts/:id/acknowledge` - Acknowledge alert

## Installation

### Prerequisites
- Node.js 16+ and npm
- PostgreSQL 12+
- Git

### Backend Setup
1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Configure environment variables in `.env`:
   - Database connection details
   - JWT secret key
   - Email configuration (optional)
   - RFID reader settings

5. Create database and run migrations:
   ```bash
   npm run migrate
   ```

6. Start development server:
   ```bash
   npm run dev
   ```

### Frontend Setup
1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file for API URL:
   ```bash
   echo "REACT_APP_API_URL=http://localhost:5000/api" > .env
   ```

4. Start development server:
   ```bash
   npm start
   ```

## Usage

### Initial Setup
1. Register a new admin account at `/register`
2. Create floor plans by uploading building layouts
3. Define zones within floor plans
4. Add RFID readers and associate them with zones
5. Register assets with RFID tags

### Daily Operations
1. Monitor real-time asset locations on the dashboard
2. Track asset movements via the interactive floor plan
3. Respond to security alerts for unauthorized movements
4. Generate reports for inventory and audit purposes
5. Manage asset check-ins and check-outs

### RFID Integration
The system accepts RFID readings via HTTP POST to `/api/rfid/reading`:
```json
{
  "rfidTag": "TAG123456",
  "readerId": "reader-uuid",
  "signalStrength": -65,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Security Features

- **Authentication**: JWT tokens with configurable expiration
- **Authorization**: Role-based access control (admin/user/auditor)
- **Input Validation**: Comprehensive request validation with Joi
- **Rate Limiting**: Protection against API abuse
- **SQL Injection Protection**: Parameterized queries
- **Password Security**: Bcrypt hashing with salt rounds
- **Audit Trail**: Complete logging of all system actions

## Performance Optimizations

- **Database Indexing**: Optimized queries for large datasets
- **Connection Pooling**: Efficient database connection management
- **Caching**: Strategic caching of frequently accessed data
- **Pagination**: Efficient data loading for large result sets
- **Real-time Updates**: WebSocket for immediate notifications
- **Lazy Loading**: On-demand component and data loading

## Monitoring & Alerts

### Alert Types
- **Unauthorized Movement**: Assets leaving restricted zones
- **Missing Assets**: Assets not seen within threshold time
- **Unknown RFID**: Unregistered tags detected
- **Reader Offline**: RFID readers not responding

### Logging
- **Application Logs**: Comprehensive logging with Winston
- **Audit Logs**: Database-stored user action tracking
- **Error Tracking**: Detailed error logging and monitoring

## Deployment

### Production Considerations
- Set `NODE_ENV=production`
- Use environment variables for all configuration
- Set up SSL/TLS certificates
- Configure reverse proxy (nginx recommended)
- Set up database backups
- Implement log rotation
- Configure monitoring and alerting

### Docker Deployment (Future)
- Containerized backend and frontend
- Docker Compose for local development
- Kubernetes manifests for production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in the `/docs` directory
- Review the API documentation at `/api/docs` (when running)

---

Built with ❤️ for modern asset tracking and management.
