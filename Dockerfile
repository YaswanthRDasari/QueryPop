# Build Frontend
FROM node:20-alpine as frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Build Backend
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies for postgres/mysql
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install gunicorn

# Copy backend code
COPY backend/ .

# Copy built frontend static files
COPY --from=frontend-build /app/frontend/dist /app/static

# Env vars
ENV FLASK_APP=app.py
ENV FLASK_ENV=production
# We need to serve static files from Flask or Nginx. 
# For simple MVP single container: Flask serves static files or we use WhiteNoise.
# Let's add code to app.py to serve React static files if not found in API.

EXPOSE 5000

CMD ["gunicorn", "-b", "0.0.0.0:5000", "app:app"]
