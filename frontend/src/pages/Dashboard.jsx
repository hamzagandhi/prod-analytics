import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import DatePicker from 'react-datepicker';
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
} from 'recharts';
import { format, subDays, startOfMonth, parseISO, isValid } from 'date-fns';
import { getAnalytics, track, UnauthorizedError } from '../api';
import { useAuth } from '../AuthContext';
import 'react-datepicker/dist/react-datepicker.css';

const COOKIE_KEY = 'analytics_filters';

const defaultFilters = {
  start_date: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
  end_date: format(new Date(), 'yyyy-MM-dd'),
  age: 'all',
  gender: 'all',
};

const AGE_OPTIONS = [
  { value: 'all', label: 'Age' },
  { value: '<18', label: 'Under 18' },
  { value: '18-40', label: '18-40' },
  { value: '>40', label: 'Over 40' },
];

const GENDER_OPTIONS = [
  { value: 'all', label: 'Gender' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];

const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 Days' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'custom', label: 'Custom Range' },
];

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

function toDate(value) {
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : new Date();
}

function getPresetRange(key) {
  const now = new Date();

  if (key === 'today') {
    return [now, now];
  }

  if (key === 'yesterday') {
    const yesterday = subDays(now, 1);
    return [yesterday, yesterday];
  }

  if (key === 'last7') {
    return [subDays(now, 6), now];
  }

  if (key === 'thisMonth') {
    return [startOfMonth(now), now];
  }

  return null;
}

function formatPickerLabel(startDate, endDate) {
  if (!startDate || !endDate) return 'Select date range';

  return `${format(startDate, 'yyyy-MM-dd')} 00:00:00 - ${format(endDate, 'yyyy-MM-dd')} 23:59:59`;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const hoverTrackAtRef = useRef(0);

  const [filters, setFilters] = useState(() => loadFiltersFromCookie() || defaultFilters);
  const [selectedFeature, setSelectedFeature] = useState('all');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePreset, setActivePreset] = useState('custom');

  const [draftRange, setDraftRange] = useState(() => [
    toDate((loadFiltersFromCookie() || defaultFilters).start_date),
    toDate((loadFiltersFromCookie() || defaultFilters).end_date),
  ]);

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

  const updateFilter = (key, value) => {
    const updated = { ...filters, [key]: value };
    setFilters(updated);
    saveFiltersToCookie(updated);
    track(`${key}_filter`);
  };

  const handlePresetClick = (key) => {
    setActivePreset(key);

    if (key === 'custom') return;

    const range = getPresetRange(key);
    if (!range) return;

    setDraftRange(range);
  };

  const applyDateRange = () => {
    const [startDate, endDate] = draftRange;
    if (!startDate || !endDate) return;

    const updated = {
      ...filters,
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
    };

    setFilters(updated);
    saveFiltersToCookie(updated);
    track('date_filter');
  };

  const cancelDateRange = () => {
    setDraftRange([toDate(filters.start_date), toDate(filters.end_date)]);
  };

  const handleBarClick = (event) => {
    if (!event?.activePayload?.length) return;

    const feature = event.activePayload[0]?.payload?.feature_name;
    if (!feature) return;

    setSelectedFeature(feature);
    track('bar_chart_click');
  };

  const clearFeatureFilter = () => {
    setSelectedFeature('all');
    track('bar_chart_zoom');
  };

  const handleLineHover = () => {
    const now = Date.now();
    if (now - hoverTrackAtRef.current < 4000) return;
    hoverTrackAtRef.current = now;
    track('line_chart_hover');
  };

  const handleRefresh = () => {
    fetchData();
    track('dashboard_refresh');
  };

  const barChartData = analyticsData?.bar_chart || [];

  const lineChartData = useMemo(() => {
    if (!analyticsData?.line_chart) return [];

    const byDate = {};
    analyticsData.line_chart.forEach(({ date, clicks }) => {
      byDate[date] = (byDate[date] || 0) + Number(clicks || 0);
    });

    return Object.entries(byDate)
      .map(([date, clicks]) => ({ date, clicks }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [analyticsData]);

  const totalClicks = analyticsData?.total_clicks || 0;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>Frontend</h1>
          <p>
            Signed in as <strong>{user?.username}</strong>
          </p>
        </div>
        <button className="outline-btn" onClick={signOut}>Sign Out</button>
      </header>

      <section className="control-area">
        <div className="range-picker-card">
          <div className="range-summary">{formatPickerLabel(draftRange[0], draftRange[1])}</div>

          <div className="range-picker-body">
            <div className="preset-list">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  className={`preset-btn ${activePreset === preset.key ? 'active' : ''}`}
                  onClick={() => handlePresetClick(preset.key)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="calendar-wrap">
              <DatePicker
                selected={draftRange[0]}
                onChange={(update) => {
                  setDraftRange(update);
                  setActivePreset('custom');
                }}
                startDate={draftRange[0]}
                endDate={draftRange[1]}
                selectsRange
                inline
                monthsShown={2}
                maxDate={new Date()}
              />
            </div>
          </div>

          <div className="range-footer">
            <div className="range-footer-text">{formatPickerLabel(draftRange[0], draftRange[1])}</div>
            <div className="range-footer-actions">
              <button className="soft-btn" onClick={cancelDateRange}>Cancel</button>
              <button className="apply-btn" onClick={applyDateRange}>Apply</button>
            </div>
          </div>
        </div>

        <div className="pill-group">
          {AGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`pill-btn ${filters.age === option.value ? 'active' : ''}`}
              onClick={() => updateFilter('age', option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="pill-group">
          {GENDER_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`pill-btn ${filters.gender === option.value ? 'active' : ''}`}
              onClick={() => updateFilter('gender', option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button className="outline-btn" onClick={handleRefresh}>Refresh</button>

        {selectedFeature !== 'all' && (
          <button className="outline-btn" onClick={clearFeatureFilter}>
            Clear Feature: {selectedFeature}
          </button>
        )}
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="stats-row">
        <div className="stat-box">
          <span>Total Events</span>
          <strong>{Number(totalClicks).toLocaleString()}</strong>
        </div>
        <div className="stat-box">
          <span>Features</span>
          <strong>{barChartData.length}</strong>
        </div>
        <div className="stat-box">
          <span>Days</span>
          <strong>{lineChartData.length}</strong>
        </div>
      </section>

      <section className="chart-grid">
        <article className="chart-panel">
          <h2>Total Clicks</h2>
          {loading ? (
            <div className="chart-loading">Loading...</div>
          ) : barChartData.length === 0 ? (
            <div className="chart-empty">No chart data</div>
          ) : (
            <ResponsiveContainer width="100%" height={290}>
              <BarChart
                data={barChartData}
                layout="vertical"
                margin={{ top: 8, right: 20, left: 20, bottom: 8 }}
                onClick={handleBarClick}
              >
                <CartesianGrid stroke="#dfe3e8" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#5b6470', fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="feature_name"
                  width={120}
                  tick={{ fill: '#5b6470', fontSize: 12 }}
                />
                <Tooltip />
                <Bar dataKey="total_clicks" fill="#1f5f88" barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </article>

        <article className="chart-panel">
          <h2>Clicks Daily</h2>
          {loading ? (
            <div className="chart-loading">Loading...</div>
          ) : lineChartData.length === 0 ? (
            <div className="chart-empty">No trend data</div>
          ) : (
            <ResponsiveContainer width="100%" height={290}>
              <LineChart
                data={lineChartData}
                margin={{ top: 8, right: 20, left: 0, bottom: 8 }}
                onMouseMove={handleLineHover}
              >
                <CartesianGrid stroke="#dfe3e8" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#5b6470', fontSize: 11 }}
                  tickFormatter={(d) => format(parseISO(d), 'dd/MM/yy')}
                  minTickGap={18}
                />
                <YAxis tick={{ fill: '#5b6470', fontSize: 12 }} />
                <Tooltip labelFormatter={(label) => format(parseISO(label), 'PPP')} />
                <Line type="monotone" dataKey="clicks" stroke="#2f6f92" strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </article>
      </section>
    </div>
  );
}
