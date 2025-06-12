from flask import Flask, request, jsonify #
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime, timezone
import os
import requests
import json
from dotenv import load_dotenv
import socket
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import re

def extract_json_from_ai(ai_response):
    """
    Extracts JSON object from a string that may contain markdown/code blocks or explanatory text.
    """
    if not ai_response:
        return None
    # Remove triple backtick code block (```json ... ```) and regular code block (```)
    ai_response = re.sub(r'```(?:json)?', '', ai_response)
    ai_response = ai_response.replace('```', '').strip()
    # Find the first {...} block
    match = re.search(r'(\{[\s\S]+\})', ai_response)
    if match:
        json_str = match.group(1)
    else:
        json_str = ai_response
    try:
        return json.loads(json_str)
    except Exception as e:
        print("Failed to parse AI response as JSON:", e)
        print("RAW OUTPUT:", ai_response)
        return None

# --- Robust HTTP Session ---
session = requests.Session()
retry = Retry(total=3, backoff_factor=0.3)
adapter = HTTPAdapter(max_retries=retry)
session.mount('http://', adapter)
session.mount('https://', adapter)

# --- Environment Variables ---
load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# --- Flask App and DB Setup ---
app = Flask(__name__)
CORS(app)
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(basedir, "crm.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- Models ---
class Customer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    account_type = db.Column(db.String(50), nullable=False)
    balance = db.Column(db.Float, default=0.0)
    risk_score = db.Column(db.Float, default=0.0)
    created_date = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'account_type': self.account_type,
            'balance': self.balance,
            'risk_score': self.risk_score,
            'created_date': self.created_date.isoformat()
        }

class Interaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    interaction_type = db.Column(db.String(50), nullable=False)
    summary = db.Column(db.Text, nullable=False)
    sentiment_score = db.Column(db.Float, default=0.0)
    date = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    def to_dict(self):
        return {
            'id': self.id,
            'customer_id': self.customer_id,
            'interaction_type': self.interaction_type,
            'summary': self.summary,
            'sentiment_score': self.sentiment_score,
            'date': self.date.isoformat()
        }

class Recommendation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    recommendation = db.Column(db.Text, nullable=False)
    reasoning = db.Column(db.Text, nullable=False)
    priority = db.Column(db.String(20), default='Medium')
    status = db.Column(db.String(20), default='Pending')
    created_date = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    def to_dict(self):
        return {
            'id': self.id,
            'customer_id': self.customer_id,
            'recommendation': self.recommendation,
            'reasoning': self.reasoning,
            'priority': self.priority,
            'status': self.status,
            'created_date': self.created_date.isoformat()
        }

# --- AI Integration ---
def call_groq_ai(prompt):
    headers = {
        'Authorization': f'Bearer {GROQ_API_KEY}',
        'Content-Type': 'application/json'
    }
    data = {
        'model': 'llama3-8b-8192',
        'messages': [{'role': 'user', 'content': prompt}],
        'max_tokens': 500
    }
    try:
        response = session.post(GROQ_API_URL, headers=headers, json=data, timeout=15)
        print("Groq status:", response.status_code)
        print("Groq response text:", response.text[:200], '…')
        if response.status_code == 200:
            return response.json()['choices'][0]['message']['content']
        else:
            return f"AI analysis unavailable (status {response.status_code})"
    except Exception as e:
        print(f"Error calling Groq AI: {e}")
        return "AI analysis unavailable (connection error)"

def analyze_sentiment(text):
    prompt = f'''
    Analyze this customer interaction sentiment for a bank CRM.

    Text: "{text}"

    Reply ONLY with a number between -1.0 (very negative) and 1.0 (very positive).
    Format: [number]
    '''
    try:
        ai_response = call_groq_ai(prompt)
        print("Prompt:", prompt)
        print("AI raw response:", ai_response)
        numbers = re.findall(r'-?\d+\.?\d*', ai_response)
        print("Extracted numbers:", numbers)
        if numbers:
            sentiment_score = float(numbers[0])
            return max(-1.0, min(1.0, sentiment_score))
        else:
            print("No number found in AI response, using fallback...")
            return analyze_sentiment_fallback(text)
    except Exception as e:
        print(f"AI sentiment analysis failed: {e}")
        return analyze_sentiment_fallback(text)

# --- Routes ---
@app.route('/')
def home():
    return "AI-Powered CRM System - Backend Running Successfully!"

# --- Customer CRUD ---
@app.route('/api/customers', methods=['GET'])
def get_customers():
    customers = Customer.query.all()
    return jsonify([customer.to_dict() for customer in customers])

@app.route('/api/customers/<int:customer_id>', methods=['GET'])
def get_customer(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    return jsonify(customer.to_dict())

@app.route('/api/customers', methods=['POST'])
def create_customer():
    data = request.get_json()
    new_customer = Customer(
        name=data['name'],
        email=data['email'],
        phone=data['phone'],
        account_type=data['account_type'],
        balance=data.get('balance', 0.0)
    )
    db.session.add(new_customer)
    db.session.commit()
    return jsonify(new_customer.to_dict()), 201

@app.route('/api/customers/<int:customer_id>', methods=['PUT', 'PATCH'])
def update_customer(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    data = request.get_json()
    customer.name = data.get('name', customer.name)
    customer.email = data.get('email', customer.email)
    customer.phone = data.get('phone', customer.phone)
    customer.account_type = data.get('account_type', customer.account_type)
    customer.balance = data.get('balance', customer.balance)
    customer.risk_score = data.get('risk_score', customer.risk_score)
    db.session.commit()
    return jsonify(customer.to_dict())

@app.route('/api/customers/<int:customer_id>', methods=['DELETE'])
def delete_customer(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    db.session.delete(customer)
    db.session.commit()
    return jsonify({'message': 'Customer deleted successfully!'})

# --- Interactions ---
@app.route('/api/customers/<int:customer_id>/interactions', methods=['GET'])
def get_customer_interactions(customer_id):
    interactions = Interaction.query.filter_by(customer_id=customer_id).all()
    return jsonify([interaction.to_dict() for interaction in interactions])

@app.route('/api/customers/<int:customer_id>/interactions', methods=['POST'])
def add_interaction(customer_id):
    data = request.get_json()
    sentiment = analyze_sentiment(data['summary'])
    new_interaction = Interaction(
        customer_id=customer_id,
        interaction_type=data['interaction_type'],
        summary=data['summary'],
        sentiment_score=sentiment
    )
    db.session.add(new_interaction)
    db.session.commit()
    return jsonify(new_interaction.to_dict()), 201

@app.route('/api/customers/<int:customer_id>/analyze', methods=['POST'])
def analyze_customer(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    interactions = Interaction.query.filter_by(customer_id=customer_id).all()
    interaction_summary = "\n".join([f"{i.interaction_type}: {i.summary}" for i in interactions])
    prompt = f"""
    Analyze this bank customer profile and interactions:

    Customer: {customer.name}
    Account Type: {customer.account_type}
    Balance: ${customer.balance}

    Recent Interactions:
    {interaction_summary}

    Provide:
    1. Customer behavior analysis
    2. Risk assessment (0-10 scale)
    3. Customer needs identification
    4. Key insights

    Format as JSON with keys: behavior_analysis, risk_score, customer_needs, insights
    """
    ai_response = call_groq_ai(prompt)
    analysis_json = extract_json_from_ai(ai_response)
    return jsonify({
        'customer_id': customer_id,
        'ai_analysis': analysis_json,
        'raw_text': ai_response if not analysis_json else "",
        'analysis_date': datetime.now(timezone.utc).isoformat()
    })

# --- Recommendations ---
@app.route('/api/customers/<int:customer_id>/recommendations', methods=['GET'])
def get_recommendations(customer_id):
    recommendations = Recommendation.query.filter_by(customer_id=customer_id).all()
    return jsonify([rec.to_dict() for rec in recommendations])

@app.route('/api/customers/<int:customer_id>/recommendations', methods=['POST'])
def generate_recommendations(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    interactions = Interaction.query.filter_by(customer_id=customer_id).all()
    interaction_summary = "\n".join([f"{i.interaction_type}: {i.summary}" for i in interactions])
    prompt = f"""
    Generate next-best-action recommendations for this bank customer:
    
    Customer: {customer.name}
    Account Type: {customer.account_type}
    Balance: ${customer.balance}
    
    Recent Interactions:
    {interaction_summary}
    
    Provide 3 specific actionable recommendations with reasoning.
    Format: "Recommendation: [action] | Reasoning: [why] | Priority: [High/Medium/Low]"
    """
    ai_response = call_groq_ai(prompt)
    new_recommendation = Recommendation(
        customer_id=customer_id,
        recommendation=ai_response,
        reasoning="AI-generated based on customer profile and interaction history",
        priority="Medium"
    )
    db.session.add(new_recommendation)
    db.session.commit()
    return jsonify(new_recommendation.to_dict()), 201

# --- Analytics ---
@app.route('/api/analytics/customers', methods=['GET'])
def customer_analytics():
    total_customers = Customer.query.count()
    total_interactions = Interaction.query.count()
    avg_balance = db.session.query(db.func.avg(Customer.balance)).scalar() or 0
    return jsonify({
        'total_customers': total_customers,
        'total_interactions': total_interactions,
        'average_balance': round(avg_balance, 2),
        'generated_at': datetime.now(timezone.utc).isoformat()
    })

@app.route('/api/analytics/performance', methods=['GET'])
def performance_analytics():
    total_recommendations = Recommendation.query.count()
    pending_recommendations = Recommendation.query.filter_by(status='Pending').count()
    return jsonify({
        'total_recommendations': total_recommendations,
        'pending_recommendations': pending_recommendations,
        'completion_rate': round((total_recommendations - pending_recommendations) / max(total_recommendations, 1) * 100, 2),
        'generated_at': datetime.now(timezone.utc).isoformat()
    })

# --- Sentiment Test Endpoint ---
@app.route('/api/test/sentiment', methods=['POST'])
def test_sentiment_endpoint():
    data = request.get_json()
    text = data.get('text', '')
    if not text:
        return jsonify({'error': 'Text is required'}), 400
    sentiment_score = analyze_sentiment(text)
    return jsonify({
        'text': text,
        'sentiment_score': sentiment_score,
        'sentiment_label': 'Positive' if sentiment_score > 0.1 else 'Negative' if sentiment_score < -0.1 else 'Neutral',
        'analysis_timestamp': datetime.now(timezone.utc).isoformat()
    })

# --- DB Initialization with Sample Data ---
def init_db():
    with app.app_context():
        db.create_all()
        if Customer.query.count() == 0:
            sample_customers = [
                Customer(name="John Smith", email="john@email.com", phone="123-456-7890", account_type="Savings", balance=5000.0, risk_score=2.5),
                Customer(name="Sarah Johnson", email="sarah@email.com", phone="234-567-8901", account_type="Checking", balance=2500.0, risk_score=3.0),
                Customer(name="Mike Wilson", email="mike@email.com", phone="345-678-9012", account_type="Premium", balance=15000.0, risk_score=1.5),
                Customer(name="Emma Davis", email="emma@email.com", phone="456-789-0123", account_type="Business", balance=8500.0, risk_score=4.0)
            ]
            for customer in sample_customers:
                db.session.add(customer)
            sample_interactions = [
                Interaction(customer_id=1, interaction_type="Phone Call", summary="Customer inquired about loan options. Seemed interested in home loan.", sentiment_score=0.5),
                Interaction(customer_id=1, interaction_type="Email", summary="Sent loan application documents. Customer responded positively.", sentiment_score=1.0),
                Interaction(customer_id=2, interaction_type="Branch Visit", summary="Customer complained about monthly fees. Expressed frustration.", sentiment_score=-1.0),
                Interaction(customer_id=3, interaction_type="Phone Call", summary="Routine account review. Customer satisfied with current services.", sentiment_score=1.0)
            ]
            for interaction in sample_interactions:
                db.session.add(interaction)
            db.session.commit()

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
