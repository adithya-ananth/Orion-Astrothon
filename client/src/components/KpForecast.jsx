import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Title,
} from 'chart.js';
import { fetchForecast3Day } from '../utils/api';
import { kpColor } from '../utils/colors';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Title);

export default function KpForecast() {
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchForecast3Day()
      .then((data) => {
        if (!cancelled) {
          setForecast(Array.isArray(data) ? data : data.forecast || []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="kp-chart-container">
        <h3>3-Day Kp Forecast</h3>
        <div className="skeleton" style={{ height: 120 }} />
      </div>
    );
  }

  if (error || forecast.length === 0) {
    return (
      <div className="kp-chart-container">
        <h3>3-Day Kp Forecast</h3>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {error ? 'Unable to load forecast' : 'No forecast data available'}
        </p>
      </div>
    );
  }

  const labels = forecast.map(
    (f) => f.time_tag || f.label || f.date || `${f.hour || ''}h`
  );
  const values = forecast.map((f) => f.kp ?? f.kp_index ?? f.value ?? 0);
  const colors = values.map((kp) => kpColor(kp));

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Kp Index',
        data: values,
        backgroundColor: colors,
        borderColor: colors,
        borderWidth: 1,
        borderRadius: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15,15,40,0.9)',
        titleColor: '#e0e0ff',
        bodyColor: '#e0e0ff',
        borderColor: 'rgba(100,100,180,0.3)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: { color: '#8888aa', font: { size: 9 }, maxRotation: 45 },
        grid: { color: 'rgba(100,100,180,0.1)' },
      },
      y: {
        min: 0,
        max: 9,
        ticks: { color: '#8888aa', stepSize: 1 },
        grid: { color: 'rgba(100,100,180,0.1)' },
      },
    },
  };

  return (
    <div className="kp-chart-container">
      <h3>3-Day Kp Forecast</h3>
      <div style={{ height: 140 }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
