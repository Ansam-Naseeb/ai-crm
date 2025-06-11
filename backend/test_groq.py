#!/usr/bin/env python3
"""
Test script to verify Groq API connection
"""

import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

def test_groq_connection():
    """Test basic Groq API connection"""
    
    if not GROQ_API_KEY:
        print("❌ GROQ_API_KEY not found in environment variables")
        print("Make sure you have a .env file with GROQ_API_KEY=your_key_here")
        return False
    
    print(f"✅ GROQ_API_KEY found: {GROQ_API_KEY[:10]}...")
    
    headers = {
        'Authorization': f'Bearer {GROQ_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    # Simple test prompt
    data = {
        'model': 'llama3-8b-8192',
        'messages': [
            {'role': 'user', 'content': 'Say "Hello, Groq API is working!" and nothing else.'}
        ],
        'max_tokens': 50
    }
    
    try:
        print("🔄 Testing Groq API connection...")
        response = requests.post(GROQ_API_URL, headers=headers, json=data, timeout=30)
        
        print(f"📡 Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            message = result['choices'][0]['message']['content']
            print(f"✅ Success! API Response: {message}")
            return True
        else:
            print(f"❌ API Error: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Connection Error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        return False

def test_models():
    """Test available models"""
    
    if not GROQ_API_KEY:
        return
    
    headers = {
        'Authorization': f'Bearer {GROQ_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    try:
        print("\n🔄 Fetching available models...")
        response = requests.get("https://api.groq.com/openai/v1/models", headers=headers, timeout=30)
        
        if response.status_code == 200:
            models = response.json()
            print("✅ Available models:")
            for model in models.get('data', []):
                print(f"  - {model.get('id', 'Unknown')}")
        else:
            print(f"❌ Could not fetch models: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error fetching models: {e}")

if __name__ == "__main__":
    print("🧪 Groq API Connection Test")
    print("=" * 40)
    
    success = test_groq_connection()
    
    if success:
        test_models()
    
    print("\n" + "=" * 40)
    print("✅ Test complete!" if success else "❌ Test failed!")