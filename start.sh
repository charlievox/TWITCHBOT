#!/bin/bash
ollama serve &
sleep 10
ollama pull llama3.2:1b
sleep 30
npm start