FROM ollama/ollama:latest

RUN apt-get update && apt-get install -y nodejs npm curl
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000 11434
COPY start.sh /start.sh
RUN chmod +x /start.sh
CMD ["/start.sh"]