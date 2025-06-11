
import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE = "http://localhost:5000/api";

function App() {
  const [currentView, setCurrentView] = useState('customers');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/customers`);
      const data = await res.json();
      setCustomers(data);
    } catch (err) {
      setCustomers([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const renderNavigation = () => (
    <div className="nav">
      <button className={`nav-btn ${currentView === 'customers' ? 'active' : ''}`}
        onClick={() => setCurrentView('customers')}>Customers</button>
      <button className={`nav-btn ${currentView === 'add-customer' ? 'active' : ''}`}
        onClick={() => setCurrentView('add-customer')}>Add Customer</button>
      <button className={`nav-btn ${currentView === 'analytics' ? 'active' : ''}`}
        onClick={() => setCurrentView('analytics')}>Analytics</button>
    </div>
  );

  const renderContent = () => {
    if (selectedCustomer) {
      return (
        <CustomerDetail
          customer={selectedCustomer}
          onBack={() => setSelectedCustomer(null)}
        />
      );
    }
    switch (currentView) {
      case 'customers':
        return <CustomerList customers={customers} onSelectCustomer={setSelectedCustomer} loading={loading} />;
      case 'add-customer':
        return <AddCustomerForm onSuccess={() => {
          setCurrentView('customers');
          fetchCustomers();
        }} />;
      case 'analytics':
        return <Analytics customers={customers} />;
      default:
        return <CustomerList customers={customers} onSelectCustomer={setSelectedCustomer} loading={loading} />;
    }
  };

  return (
    <div className="app">
      <div className="header">
        <h1>AI-Powered CRM System</h1>
        <p>Intelligent Customer Relationship Management for Bank Employees</p>
      </div>
      {!selectedCustomer && renderNavigation()}
      <div className="content">
        {renderContent()}
      </div>
    </div>
  );
}

function CustomerList({ customers, onSelectCustomer, loading }) {
  const getRiskClass = (score) => {
    if (score <= 2) return { className: "risk-low", label: 'Low Risk' };
    if (score <= 3) return { className: "risk-medium", label: 'Medium Risk' };
    return { className: "risk-high", label: 'High Risk' };
  };

  if (loading) {
    return (<div className="loading"><div>Loading customers...</div></div>);
  }

  return (
    <div>
      <div className="customer-list-header">
        <h2>Customer Overview</h2>
        <div className="customer-list-count">
          Total Customers: {customers.length}
        </div>
      </div>
      <div className="customer-grid">
        {customers.map(customer => {
          const risk = getRiskClass(customer.risk_score);
          return (
            <div key={customer.id} className="customer-card" onClick={() => onSelectCustomer(customer)}>
              <div className="customer-card-left">
                <div className="customer-name">{customer.name}</div>
                <div className="customer-info-row">
                  <div className="customer-info-item">
                    <span className="customer-info-label">Email:</span>
                    <span>{customer.email}</span>
                  </div>
                  <div className="customer-info-item">
                    <span className="customer-info-label">Phone:</span>
                    <span>{customer.phone}</span>
                  </div>
                  <div className="customer-info-item">
                    <span className="customer-info-label">Account:</span>
                    <span>{customer.account_type}</span>
                  </div>
                </div>
              </div>
              <div className="customer-card-right">
                <span className="balance">${customer.balance?.toLocaleString()}</span>
                <span className={`risk-score ${risk.className}`}>{risk.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CustomerDetail({ customer, onBack }) {
  const [interactions, setInteractions] = useState([]);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiAnalysisError, setAiAnalysisError] = useState('');
  const [recommendation, setRecommendation] = useState(null);
  const [recommendationError, setRecommendationError] = useState('');
  const [showAddInteraction, setShowAddInteraction] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [loadingInteractions, setLoadingInteractions] = useState(false);
  const [showAllInteractions, setShowAllInteractions] = useState(false);

  useEffect(() => {
    fetchInteractions();
    // Reset AI states when customer changes
    setRecommendation(null);
    setAiAnalysis(null);
    setAiAnalysisError('');
    setRecommendationError('');
    // eslint-disable-next-line
  }, [customer.id]);

  const fetchInteractions = async () => {
    setLoadingInteractions(true);
    try {
      const res = await fetch(`http://localhost:5000/api/customers/${customer.id}/interactions`);
      if (res.ok) {
        const data = await res.json();
        setInteractions(Array.isArray(data) ? data : []);
      } else {
        setInteractions([]);
      }
    } catch (error) {
      console.error('Error fetching interactions:', error);
      setInteractions([]);
    }
    setLoadingInteractions(false);
  };

  const analyzeCustomer = async () => {
    setLoadingAnalysis(true);
    setAiAnalysisError('');
    setAiAnalysis(null);
    
    try {
      const res = await fetch(`http://localhost:5000/api/customers/${customer.id}/analyze`, { 
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('AI Analysis Response:', data); // Debug log
      
      // Handle different response formats from backend
      if (data.ai_analysis) {
        setAiAnalysis(data.ai_analysis);
      } else if (data.analysis) {
        setAiAnalysis(data.analysis);
      } else if (data.raw_text) {
        // If only raw text is provided, try to parse it or display it cleanly
        try {
          const parsed = JSON.parse(data.raw_text);
          setAiAnalysis(parsed);
        } catch {
          // If it's not JSON, format it as plain text analysis
          setAiAnalysis({
            raw_analysis: data.raw_text,
            insights: [data.raw_text]
          });
        }
      } else {
        // If response has direct analysis fields
        setAiAnalysis(data);
      }
    } catch (error) {
      console.error('Error analyzing customer:', error);
      setAiAnalysisError('Failed to generate AI analysis. Please try again.');
    }
    setLoadingAnalysis(false);
  };

  const generateRecommendation = async () => {
    setLoadingRecommendation(true);
    setRecommendationError('');
    setRecommendation(null);
    
    try {
      const res = await fetch(`http://localhost:5000/api/customers/${customer.id}/recommendations`, { 
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('Recommendation Response:', data); // Debug log
      setRecommendation(data);
    } catch (error) {
      console.error('Error generating recommendation:', error);
      setRecommendationError('Failed to generate recommendation. Please try again.');
    }
    setLoadingRecommendation(false);
  };

  const shownInteractions = showAllInteractions ? interactions : interactions.slice(0, 5);

  // Enhanced AI Analysis Rendering
  function renderAiAnalysis() {
    if (!aiAnalysis) return null;

    // Handle string responses (raw text)
    if (typeof aiAnalysis === 'string') {
      return (
        <div className="ai-analysis-content">
          <div className="ai-insight-section">
            <h4>AI Analysis</h4>
            <p>{aiAnalysis}</p>
          </div>
        </div>
      );
    }

    // Handle object responses
    if (typeof aiAnalysis === 'object') {
      return (
        <div className="ai-analysis-content">
          {/* Behavior Analysis */}
          {aiAnalysis.behavior_analysis && (
            <div className="ai-insight-section">
              <h4>Behavior Analysis</h4>
              <div className="behavior-grid">
                {Object.entries(aiAnalysis.behavior_analysis).map(([key, value]) => (
                  <div key={key} className="behavior-item">
                    <span className="behavior-label">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                    </span>
                    <span className="behavior-value">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Assessment */}
          {(aiAnalysis.risk_score !== undefined || aiAnalysis.risk_assessment) && (
            <div className="ai-insight-section">
              <h4>Risk Assessment</h4>
              {aiAnalysis.risk_score !== undefined && (
                <div className="risk-display">
                  <span className="risk-number">{aiAnalysis.risk_score}/10</span>
                  <span className="risk-description">Risk Level</span>
                </div>
              )}
              {aiAnalysis.risk_assessment && (
                <p className="risk-explanation">{aiAnalysis.risk_assessment}</p>
              )}
            </div>
          )}

          {/* Customer Needs */}
          {(Array.isArray(aiAnalysis.customer_needs) && aiAnalysis.customer_needs.length > 0) && (
            <div className="ai-insight-section">
              <h4>Identified Customer Needs</h4>
              <ul className="needs-list">
                {aiAnalysis.customer_needs.map((need, index) => (
                  <li key={index}>{need}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Key Insights */}
          {(Array.isArray(aiAnalysis.insights) && aiAnalysis.insights.length > 0) && (
            <div className="ai-insight-section">
              <h4>Key Insights</h4>
              <ul className="insights-list">
                {aiAnalysis.insights.map((insight, index) => (
                  <li key={index}>{insight}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations from Analysis */}
          {(Array.isArray(aiAnalysis.recommendations) && aiAnalysis.recommendations.length > 0) && (
            <div className="ai-insight-section">
              <h4>Analysis Recommendations</h4>
              <ul className="recommendations-list">
                {aiAnalysis.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Raw Analysis Text (fallback) */}
          {aiAnalysis.raw_analysis && (
            <div className="ai-insight-section">
              <h4>Detailed Analysis</h4>
              <p className="raw-analysis">{aiAnalysis.raw_analysis}</p>
            </div>
          )}

          {/* Summary */}
          {aiAnalysis.summary && (
            <div className="ai-insight-section">
              <h4>Summary</h4>
              <p className="analysis-summary">{aiAnalysis.summary}</p>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="ai-analysis-content">
        <div className="ai-insight-section">
          <h4>Analysis Result</h4>
          <pre>{JSON.stringify(aiAnalysis, null, 2)}</pre>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack} className="back-btn">← Back to Customers</button>
      <h2 className="customer-detail-title">Customer 360° View - {customer.name}</h2>
      
      {/* Customer Profile and Metrics Row */}
      <div className="customer-profile-metrics-row">
        <div className="customer-profile-section">
          <h3 className="section-title">Customer Profile</h3>
          <div className="detail-profile-grid">
            <div className="detail-profile-item">
              <span className="detail-profile-label">Email:</span>
              <span className="detail-profile-value">{customer.email}</span>
            </div>
            <div className="detail-profile-item">
              <span className="detail-profile-label">Phone:</span>
              <span className="detail-profile-value">{customer.phone}</span>
            </div>
            <div className="detail-profile-item">
              <span className="detail-profile-label">Account Type:</span>
              <span className="detail-profile-value">{customer.account_type}</span>
            </div>
            <div className="detail-profile-item">
              <span className="detail-profile-label">Balance:</span>
              <span className="detail-profile-value">${customer.balance?.toLocaleString()}</span>
            </div>
            <div className="detail-profile-item">
              <span className="detail-profile-label">Risk Score:</span>
              <span className="detail-profile-value">{customer.risk_score}/5</span>
            </div>
            <div className="detail-profile-item">
              <span className="detail-profile-label">Member Since:</span>
              <span className="detail-profile-value">
                {new Date(customer.created_date || '2020-01-01').toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        
        <div className="customer-metrics-section">
          <h3 className="section-title">Customer Metrics</h3>
          <div className="metrics-grid">
            <div className="metrics-card">
              <div className="metrics-number">{interactions.length}</div>
              <div className="metrics-label">Total Interactions</div>
            </div>
            <div className="metrics-card">
              <div className="metrics-number">
                {interactions.length > 0 
                  ? Math.round((interactions.filter(i => i.sentiment_score > 0).length / interactions.length) * 100)
                  : 0}%
              </div>
              <div className="metrics-label">Positive Sentiment</div>
            </div>
            <div className="metrics-card">
              <div className="metrics-number">{customer.risk_score}/5</div>
              <div className="metrics-label">Risk Score</div>
            </div>
            <div className="metrics-card">
              <div className="metrics-number">${Math.round((customer.balance || 0) / 1000)}K</div>
              <div className="metrics-label">Account Value</div>
            </div>
          </div>
        </div>
      </div>

      <div className="customer-detail-grid">
        <div className="customer-detail-main">
          {/* Interactions */}
          <div className="detail-section">
            <div className="interaction-header">
              <h3 className="section-title">Recent Interactions</h3>
              <button
                onClick={() => setShowAddInteraction(!showAddInteraction)}
                className="btn btn-secondary"
              >
                {showAddInteraction ? 'Hide Form' : 'Add Interaction'}
              </button>
            </div>
            
            {showAddInteraction && (
              <AddInteractionForm 
                customerId={customer.id} 
                onSuccess={() => {
                  setShowAddInteraction(false);
                  fetchInteractions();
                }} 
              />
            )}
            
            <div className="interactions-list">
              {loadingInteractions ? (
                <div className="loading">Loading interactions...</div>
              ) : (
                <>
                  {shownInteractions.map(interaction => (
                    <div key={interaction.id} className="interaction-item">
                      <div className="interaction-type">{interaction.interaction_type}</div>
                      <div className="interaction-summary">{interaction.summary}</div>
                      <div className="interaction-footer">
                        <span className="interaction-date">
                          {new Date(interaction.date).toLocaleDateString()}
                        </span>
                        <span className={
                          interaction.sentiment_score > 0 ? 'sentiment-positive' :
                          interaction.sentiment_score < 0 ? 'sentiment-negative' : 'sentiment-neutral'
                        }>
                          {interaction.sentiment_score > 0 ? 'Positive' : 
                           interaction.sentiment_score < 0 ? 'Negative' : 'Neutral'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {interactions.length > 5 && (
                    <button
                      onClick={() => setShowAllInteractions(!showAllInteractions)}
                      className="btn btn-secondary show-more-btn"
                    >
                      {showAllInteractions ? 'Show Less' : `Show All ${interactions.length} Interactions`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* AI Section */}
        <div className="customer-detail-side">
          <div className="ai-section">
            <h3 className="ai-section-title">AI Insights</h3>
            
            {/* AI Analysis Subsection */}
            <div className="ai-subsection">
              <h4 className="ai-subsection-title">🧠 Generate AI Analysis</h4>
              <button 
                onClick={analyzeCustomer} 
                disabled={loadingAnalysis} 
                className="btn"
              >
                {loadingAnalysis ? 'Analyzing...' : 'Generate AI Analysis'}
              </button>
              
              {aiAnalysisError && (
                <div className="error-message" style={{color: 'red', marginTop: '10px'}}>
                  {aiAnalysisError}
                </div>
              )}
              
              {aiAnalysis && (
                <div className="ai-analysis-box">
                  {renderAiAnalysis()}
                </div>
              )}
            </div>

            {/* AI Recommendation Subsection */}
            <div className="ai-subsection">
              <h4 className="ai-subsection-title">💡 Generate Recommendation</h4>
              <button 
                onClick={generateRecommendation} 
                disabled={loadingRecommendation} 
                className="btn btn-green"
              >
                {loadingRecommendation ? 'Generating...' : 'Generate Recommendation'}
              </button>
              
              {recommendationError && (
                <div className="error-message" style={{color: 'red', marginTop: '10px'}}>
                  {recommendationError}
                </div>
              )}
              
              {recommendation && (
                <div className="ai-analysis-box">
                  <div className="recommendation-content">
                    <div className="recommendation-text">
                      <strong>Recommendation:</strong>
                      <p>{recommendation.recommendation || 'No recommendation provided'}</p>
                    </div>
                    {recommendation.reasoning && (
                      <div className="recommendation-reasoning">
                        <strong>Reasoning:</strong>
                        <p>{recommendation.reasoning}</p>
                      </div>
                    )}
                    <div className="recommendation-priority">
                      <span className={`priority ${
                        recommendation.priority === 'High' ? 'priority-high' :
                        recommendation.priority === 'Medium' ? 'priority-medium' :
                        'priority-low'
                      }`}>
                        {(recommendation.priority || 'Medium').toUpperCase()} PRIORITY
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add Customer Form Component
function AddCustomerForm({ onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    account_type: 'Standard',
    balance: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`http://localhost:5000/api/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setSuccessMsg('Customer added successfully!');
        setFormData({
          name: '',
          email: '',
          phone: '',
          account_type: 'Standard',
          balance: ''
        });
        if (onSuccess) onSuccess();
      } else {
        const data = await res.json();
        setError(data.message || 'Failed to add customer');
      }
    } catch {
      setError('Failed to add customer');
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 className="form-title">Add New Customer</h2>
      <form onSubmit={handleSubmit} className="customer-form">
        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            required
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Phone Number</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            required
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Account Type</label>
          <select
            value={formData.account_type}
            onChange={(e) => setFormData({...formData, account_type: e.target.value})}
            className="form-select"
          >
            <option value="Standard">Standard</option>
            <option value="Premium">Premium</option>
            <option value="VIP">VIP</option>
            <option value="Business">Business</option>
            <option value="Checking">Checking</option>
            <option value="Savings">Savings</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Initial Balance</label>
          <input
            type="number"
            value={formData.balance}
            onChange={(e) => setFormData({...formData, balance: e.target.value})}
            min="0"
            step="0.01"
            className="form-input"
          />
        </div>
        {error && <div style={{color: "red", marginBottom: "10px"}}>{error}</div>}
        {successMsg && <div style={{color: "green", marginBottom: "10px"}}>{successMsg}</div>}
        <button
          type="submit"
          disabled={loading}
          className="btn"
        >
          {loading ? 'Adding Customer...' : 'Add Customer'}
        </button>
      </form>
    </div>
  );
}

function AddInteractionForm({ customerId, onSuccess }) {
  const [formData, setFormData] = useState({
    interaction_type: 'Phone Call',
    summary: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`http://localhost:5000/api/customers/${customerId}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      onSuccess();
      setFormData({
        interaction_type: 'Phone Call',
        summary: ''
      });
    } catch { }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <div className="form-group">
        <label className="form-label">Interaction Type</label>
        <select
          value={formData.interaction_type}
          onChange={(e) => setFormData({ ...formData, interaction_type: e.target.value })}
          className="form-select"
        >
          <option value="Phone Call">Phone Call</option>
          <option value="Email">Email</option>
          <option value="Branch Visit">Branch Visit</option>
          <option value="Chat">Chat</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Summary</label>
        <textarea
          value={formData.summary}
          onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
          placeholder="Brief summary of the interaction..."
          required
          className="form-textarea"
        />
      </div>
      <button type="submit" className="btn" disabled={loading}>
        {loading ? 'Adding...' : 'Add Interaction'}
      </button>
    </form>
  );
}

function Analytics({ customers }) {
  if (!customers || customers.length === 0) {
    return <div className="analytics-empty">No customer data available for analytics.</div>;
  }
  const totalCustomers = customers.length;
  const totalBalance = customers.reduce((sum, c) => sum + Number(c.balance || 0), 0);
  const avgBalance = totalBalance / totalCustomers;
  const riskCounts = customers.reduce((acc, c) => {
    if (c.risk_score <= 2) acc.low++;
    else if (c.risk_score <= 3) acc.medium++;
    else acc.high++;
    return acc;
  }, { low: 0, medium: 0, high: 0 });

  return (
    <div>
      <h2 className="analytics-title">CRM Analytics Dashboard</h2>
      <div className="analytics-grid">
        <div className="analytics-card">
          <div className="analytics-number">{totalCustomers}</div>
          <div className="analytics-label">Total Customers</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-number">${Math.round(avgBalance).toLocaleString()}</div>
          <div className="analytics-label">Average Balance</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-number">{riskCounts.low}</div>
          <div className="analytics-label">Low Risk</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-number">{riskCounts.medium}</div>
          <div className="analytics-label">Medium Risk</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-number">{riskCounts.high}</div>
          <div className="analytics-label">High Risk</div>
        </div>
      </div>
    </div>
  );
}

export default App;