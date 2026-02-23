import React, { useState, useEffect, useCallback, useRef } from 'react';
import Cookies from 'js-cookie';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { getAnalytics, track, UnauthorizedError } from '../api';
import { useAuth } from '../AuthContext';
import { format, subDays } from 'date-fns';

const FEATURE_COLORS = {
  date_filter: '#6ee7b7',
  age_filter: '#93c5fd',
  gender_filter: '#f9a8d4',
  bar_chart_click: '#fcd34d',
  bar_chart_zoom: '#a5b4fc',
  line_chart_hover: '#fb923c',
  dashboard_refresh: '#34d399',
};

const COOKIE_KEY = 'analytics_filters';

function getColor(name) {
  return FEATURE_COLORS[name] || '#a78bfa';
}

function loadFiltersFromCookie() {
  try {
    const raw = Cookies.get(COOKIE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveFiltersToCookie(filters) {
  Cookies.set(COOKIE_KEY, JSON.stringify(filters), { expires: 30 });
}

const defaultFilters = {
  start_date: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
  end_date: format(new Date(), 'yyyy-MM-dd'),
  age: 'all',
  gender: 'all',
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const hoverTrackAtRef = useRef(0);

  const [filters, setFilters] = useState(() => {
    const saved = loadFiltersFromCookie();
    return saved || defaultFilters;
  });
  const [selectedFeature, setSelectedFeature] = useState('all');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAnalytics({ ...filters, feature: selectedFeature });
      setAnalyticsData(data);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        signOut();
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, selectedFeature, signOut]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (key, value) => {
    const updated = { ...filters, [key]: value };
    setFilters(updated);
    saveFiltersToCookie(updated);
    track(key === 'start_date' || key === 'end_date' ? 'date_filter' : `${key}_filter`);
  };

  const handleBarClick = (data) => {
    if (!data || !data.activePayload) return;
    const feature = data.activePayload[0]?.payload?.feature_name;
    if (feature) {
      setSelectedFeature(feature);
      track('bar_chart_click');
    }
  };

  const handleRefresh = () => {
    fetchData();
    track('dashboard_refresh');
  };

  const handleLineHover = () => {
    const now = Date.now();
    if (now - hoverTrackAtRef.current < 4000) return;
    hoverTrackAtRef.current = now;
    track('line_chart_hover');
  };

  const lineChartData = React.useMemo(() => {
    if (!analyticsData?.line_chart) return [];

    const byDate = {};
    analyticsData.line_chart.forEach(({ date, feature_name, clicks }) => {
      if (!byDate[date]) byDate[date] = { date };
      byDate[date][feature_name] = (byDate[date][feature_name] || 0) + clicks;
    });

    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [analyticsData]);

  const lineFeatures = React.useMemo(() => {
    if (!analyticsData?.line_chart) return [];
    return [...new Set(analyticsData.line_chart.map((d) => d.feature_name))];
  }, [analyticsData]);

  const CustomBarTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="custom-tooltip">
        <p className="tooltip-feature">{payload[0].payload.feature_name}</p>
        <p className="tooltip-value">{payload[0].value} clicks</p>
        <p className="tooltip-hint">Click bar to drill down -&gt;</p>
      </div>
    );
  };

  const CustomLineTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="custom-tooltip">
        <p className="tooltip-date">{label}</p>
        {payload.map((p) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.dataKey}: {p.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-header-left">
          <span className="logo-icon">[]</span>
          <div>
            <h1 className="dash-title">Analytics Dashboard</h1>
            <p className="dash-subtitle">Interact. Track. Visualize.</p>
          </div>
        </div>
        <div className="dash-header-right">
          <div className="user-badge">
            <span className="user-avatar">{user?.username?.[0]?.toUpperCase()}</span>
            <span className="user-name">{user?.username}</span>
            <span className="user-meta">{user?.gender} | {user?.age}y</span>
          </div>
          <button className="btn-ghost" onClick={signOut}>Sign Out</button>
        </div>
      </header>

      <section className="filters-bar">
        <div className="filter-group">
          <label>From</label>
          <input
            type="date"
            value={filters.start_date}
            max={filters.end_date}
            onChange={(e) => handleFilterChange('start_date', e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>To</label>
          <input
            type="date"
            value={filters.end_date}
            min={filters.start_date}
            max={format(new Date(), 'yyyy-MM-dd')}
            onChange={(e) => handleFilterChange('end_date', e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>Age Group</label>
          <select value={filters.age} onChange={(e) => handleFilterChange('age', e.target.value)}>
            <option value="all">All Ages</option>
            <option value="<18">Under 18</option>
            <option value="18-40">18-40</option>
            <option value=">40">Over 40</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Gender</label>
          <select value={filters.gender} onChange={(e) => handleFilterChange('gender', e.target.value)}>
            <option value="all">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <button className="btn-refresh" onClick={handleRefresh}>Refresh</button>

        {selectedFeature !== 'all' && (
          <button
            className="btn-clear-feature"
            onClick={() => {
              setSelectedFeature('all');
              track('bar_chart_zoom');
            }}
          >
            X Clear Feature Filter: <strong>{selectedFeature}</strong>
          </button>
        )}
      </section>

      {analyticsData && (
        <div className="stats-strip">
          <div className="stat-card">
            <span className="stat-value">{analyticsData.total_clicks.toLocaleString()}</span>
            <span className="stat-label">Total Events</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{analyticsData.bar_chart.length}</span>
            <span className="stat-label">Features Tracked</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{lineChartData.length}</span>
            <span className="stat-label">Days with Data</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{analyticsData.bar_chart[0]?.feature_name || '-'}</span>
            <span className="stat-label">Most Used Feature</span>
          </div>
        </div>
      )}

      {error && <div className="dash-error">Warning: {error}</div>}

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-header">
            <h2>Feature Usage</h2>
            <p className="chart-desc">Click a bar to filter the time trend below</p>
          </div>
          {loading ? (
            <div className="chart-skeleton" />
          ) : analyticsData?.bar_chart?.length === 0 ? (
            <div className="chart-empty">No data for selected filters</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={analyticsData?.bar_chart || []}
                layout="vertical"
                onClick={handleBarClick}
                style={{ cursor: 'pointer' }}
                margin={{ left: 20, right: 30, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="feature_name"
                  width={130}
                  tick={{ fill: '#cbd5e1', fontSize: 12 }}
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar
                  dataKey="total_clicks"
                  radius={[0, 6, 6, 0]}
                  fill="#6ee7b7"
                  isAnimationActive
                  label={{
                    position: 'right',
                    fill: '#94a3b8',
                    fontSize: 11,
                    formatter: (v) => v,
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <h2>
              Clicks Over Time
              {selectedFeature !== 'all' && <span className="feature-badge">- {selectedFeature}</span>}
            </h2>
            <p className="chart-desc">
              Daily click trend{selectedFeature !== 'all' ? ` for ${selectedFeature}` : ' for all features'}
            </p>
          </div>
          {loading ? (
            <div className="chart-skeleton" />
          ) : lineChartData.length === 0 ? (
            <div className="chart-empty">No time data for selected filters</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={lineChartData}
                margin={{ left: 0, right: 20, top: 10, bottom: 10 }}
                onMouseMove={handleLineHover}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(d) => d.slice(5)}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip content={<CustomLineTooltip />} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
                {lineFeatures.map((feat) => (
                  <Line
                    key={feat}
                    type="monotone"
                    dataKey={feat}
                    stroke={getColor(feat)}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <footer className="dash-footer">
        <p>All interactions on this dashboard are tracked in real-time and reflected in these charts.</p>
      </footer>
    </div>
  );
}
