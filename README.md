# Content Moderator Application

A full-stack content moderation platform powered by AI, featuring a React frontend with AWS Cognito authentication and a FastAPI backend with LangGraph-based intelligent moderation agents.

## 📋 Overview

The Content Moderator Application is a web-based platform designed to streamline content moderation workflows. It leverages AI agents built with LangGraph and AWS Bedrock to provide intelligent, context-aware content analysis and verdicts. The application supports two deployment architectures:

- **Amplify Version**: AWS Amplify hosting + API Gateway + ECS Fargate
- **ECS Version**: Containerized deployment with Docker + ECS Fargate + Application Load Balancer

The ECS version also includes a self-service Cognito sign-up workflow for account creation and onboarding.

## ✨ Features

- **User Authentication**: Secure login via AWS Cognito
- **User Registration**: Self-service sign-up flow for ECS version with email/password onboarding
- **AI-Powered Moderation**: LangGraph agents for intelligent content analysis
- **Content Category Moderation**: Select moderation rules for General Community, Kids Platform, Marketplace, or News Comments
- **Verdict Panel**: Display and manage moderation verdicts
- **RESTful API**: FastAPI backend with JWT authentication
- **Persistent Storage**: DynamoDB for scalable data persistence
- **Responsive UI**: React-based frontend with comprehensive styling
- **CORS Support**: Cross-origin resource sharing for frontend-backend communication
- **Health Checks**: ALB-compatible health endpoints for containerized deployments

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
│              AWS Amplify / Docker Nginx                     │
│  - LoginPage (Cognito authentication)                       │
│  - ModeratorApp (content review interface)                  │
│  - VerdictPanel (decision display)                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
              ┌───────▼────────┐
              │ API Gateway /  │
              │ ALB            │
              └───────┬────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              Backend (FastAPI)                              │
│         AWS ECS Fargate / Docker Container                  │
│  - main.py (FastAPI app, routes)                            │
│  - agent.py (LangGraph moderation agents)                   │
│  - auth.py (JWT verification)                               │
│  - dynamodb_client.py (DynamoDB integration)                │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
    ┌───▼────┐               ┌─────▼────┐
    │DynamoDB│               │AWS Bedrock│
    │ Tables │               │ (LLMs)    │
    └────────┘               └───────────┘
```

## 🚀 Quick Start

### Prerequisites

- Python 3.9+
- Node.js 16+ and npm
- AWS Account with:
  - Cognito User Pool configured
  - DynamoDB tables
  - Bedrock models enabled
- Docker (for containerized deployment)

### Local Development Setup

#### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd amplify_version/backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your AWS credentials and Cognito details
   ```

5. Run the FastAPI server:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

   The API will be available at `http://localhost:8000`
   - API docs: `http://localhost:8000/docs`
   - ReDoc: `http://localhost:8000/redoc`

#### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd amplify_version/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your Cognito User Pool details
   ```

4. Start the development server:
   ```bash
   npm start
   ```

   The app will open at `http://localhost:3000`

## 📦 Deployment

The repository includes two deployment architectures with detailed guides:

### AWS Amplify Deployment (`amplify_version/`)

Best for: Quick setup, serverless backend, managed hosting

See [amplify_version/DEPLOYMENT.md](amplify_version/DEPLOYMENT.md) for step-by-step instructions covering:
- AWS Cognito configuration
- DynamoDB setup
- Amplify hosting
- ECS Fargate backend deployment
- Environment configuration

### ECS Fargate Deployment (`ecs_version/`)

Best for: Production-grade containerized workloads, custom infrastructure control

See [ecs_version/DEPLOYMENT.md](ecs_version/DEPLOYMENT.md) for step-by-step instructions covering:
- Docker image building and tagging
- ECR (Elastic Container Registry) push
- ECS cluster and service setup
- Application Load Balancer configuration
- Health checks and scaling

## 📁 Project Structure

```
content-moderator-application/
├── amplify_version/
│   ├── DEPLOYMENT.md
│   ├── backend/
│   │   ├── main.py              # FastAPI application entry point
│   │   ├── agent.py             # LangGraph moderation agents
│   │   ├── auth.py              # JWT authentication
│   │   ├── config.py            # Configuration management
│   │   ├── dynamodb_client.py   # DynamoDB integration
│   │   ├── requirements.txt     # Python dependencies
│   │   ├── Dockerfile           # Backend container image
│   │   └── .env.example         # Environment variables template
│   └── frontend/
│       ├── package.json         # Node.js dependencies
│       ├── public/              # Static files
│       ├── src/
│       │   ├── App.js           # React root component
│       │   ├── index.js         # React entry point
│       │   ├── components/      # React components
│       │   │   ├── LoginPage.js
│       │   │   ├── ModeratorApp.js
│       │   │   ├── VerdictPanel.js
│       │   │   └── SignUpPage.js  # ECS version self-service user registration
│       │   ├── services/        # API and Cognito services
│       │   │   ├── apiService.js
│       │   │   └── cognitoService.js
│       │   └── styles/          # CSS stylesheets
│       ├── build/               # Production build output
│       └── .env.example         # Environment variables template
├── ecs_version/
│   ├── DEPLOYMENT.md
│   ├── backend/                 # Same structure as amplify_version
│   ├── frontend/                # Same structure as amplify_version
│   └── [Deployment guides and Docker build scripts]
└── README.md                    # This file
```

## 🔐 Environment Configuration

### Backend (.env)

```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key_id
AWS_SECRET_ACCESS_KEY=your_secret_key

# Cognito
COGNITO_USER_POOL_ID=us-east-1_xxxxx
COGNITO_CLIENT_ID=your_client_id

# DynamoDB
DYNAMODB_TABLE_NAME=moderation_verdicts

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Logging
LOG_LEVEL=INFO
```

### Frontend (.env)

```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_COGNITO_REGION=us-east-1
REACT_APP_COGNITO_USER_POOL_ID=us-east-1_xxxxx
REACT_APP_COGNITO_CLIENT_ID=your_client_id
```

## 🔌 API Endpoints

### Authentication
- **POST** `/api/v1/moderate` - Submit content for moderation (requires JWT)
  - Headers: `Authorization: Bearer <cognito_jwt_token>`
  - Body: `{ "content": "text to moderate", "content_type": "general_community" }`
  - Supported `content_type` values: `general_community`, `kids_platform`, `marketplace`, `news_comments`

### Health & Monitoring
- **GET** `/health` - Health check (no auth required, ALB compatible)
- **GET** `/docs` - Interactive API documentation (Swagger)
- **GET** `/redoc` - ReDoc documentation

## 🛠️ Technology Stack

### Frontend
- **React** 18.2.0 - UI framework
- **Amazon Cognito Identity JS** 6.3.12 - Authentication
- **CSS3** - Styling

### Backend
- **FastAPI** 0.111.0 - Web framework
- **Uvicorn** 0.30.1 - ASGI server
- **Pydantic** 2.9.2 - Data validation
- **LangGraph** - Agentic orchestration
- **Boto3** 1.37.0 - AWS SDK
- **Python-Jose** - JWT handling

### Infrastructure
- **AWS Cognito** - Authentication & authorization
- **AWS DynamoDB** - NoSQL database
- **AWS Bedrock** - LLM inference
- **AWS ECS Fargate** - Container orchestration
- **AWS Amplify** - Frontend hosting (Amplify version)
- **AWS API Gateway** / **ALB** - API routing

## 📝 Development

### Running Tests

```bash
# Frontend tests
cd amplify_version/frontend
npm test

# Backend tests (if test files exist)
cd amplify_version/backend
pytest
```

### Code Structure Guidelines

- **Backend**: FastAPI routes in `main.py`, business logic in `agent.py`
- **Frontend**: React components in `components/`, services in `services/`
- **Configuration**: Environment-specific settings in `.env` files
- **Authentication**: Cognito JWT tokens validated on backend

## 🚢 Docker Deployment

Both versions include Dockerfiles for containerization:

### Backend Docker Build
```bash
cd amplify_version/backend
docker build -t content-moderator-api:latest .
docker run -p 8000:8000 --env-file .env content-moderator-api:latest
```

### Frontend Docker Build (ECS Version)
```bash
cd ecs_version/frontend
docker build -t content-moderator-frontend:latest .
docker run -p 80:80 content-moderator-frontend:latest
```

## 📊 Moderation Workflow

1. **User authenticates** via Cognito login
2. **Content submitted** through ModeratorApp component
3. **Backend receives** moderation request with JWT token
4. **LangGraph agent** analyzes content using AWS Bedrock LLMs
5. **Verdict generated** with classification and reasoning
6. **Result stored** in DynamoDB
7. **UI displays** verdict in VerdictPanel component

## 🐛 Troubleshooting

### CORS Errors
- Ensure `ALLOWED_ORIGINS` in backend `.env` includes your frontend URL
- Check that frontend `.env` has correct backend API URL

### Cognito Authentication Issues
- Verify User Pool and Client IDs in both `.env` files
- Check that user exists in Cognito User Pool
- Confirm Cognito region matches AWS region

### DynamoDB Errors
- Ensure DynamoDB table exists in the correct AWS region
- Verify IAM permissions for the AWS credentials used

### Bedrock Model Access
- Confirm Bedrock models are enabled in your AWS region
- Check IAM permissions for Bedrock API calls

## 📚 Additional Resources

- [AWS Amplify Documentation](https://docs.aws.amazon.com/amplify/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)

## 📄 License

This project is provided as-is. Please check individual files for any license information.

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Create a feature branch (`git checkout -b feature/your-feature`)
2. Make your changes with clear commit messages
3. Test your changes locally (both frontend and backend)
4. Submit a pull request with a description of your changes

## 📞 Support

For deployment issues, refer to the DEPLOYMENT.md files in each version directory:
- [amplify_version/DEPLOYMENT.md](amplify_version/DEPLOYMENT.md)
- [ecs_version/DEPLOYMENT.md](ecs_version/DEPLOYMENT.md)
