import React, { useState, useEffect } from 'react';
import { reportService } from '../services/apiService';
import { 
  Package, 
  AlertTriangle, 
  Activity, 
  Radio,
  TrendingUp,
  MapPin,
  Clock
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const StatCard = ({ title, value, icon: Icon, color = 'blue', trend }) => (
  <div className="card">
    <div className="flex items-center">
      <div className={`flex-shrink-0 p-3 rounded-lg bg-${color}-100`}>
        <Icon className={`h-6 w-6 text-${color}-600`} />
      </div>
      <div className="ml-4 flex-1">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className="flex items-center">
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          {trend && (
            <span className={`ml-2 text-sm font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp className="inline h-4 w-4 mr-1" />
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      </div>
    </div>
  </div>
);

const AlertCard = ({ alert }) => (
  <div className={`p-4 rounded-lg border ${
    alert.severity === 'high' ? 'alert-high' : 
    alert.severity === 'medium' ? 'alert-medium' : 'alert-low'
  }`}>
    <div className="flex">
      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
      <div className="ml-3 flex-1">
        <h4 className="text-sm font-medium capitalize">
          {alert.alert_type?.replace('_', ' ')}
        </h4>
        <p className="text-sm mt-1">{alert.message}</p>
        {alert.asset_name && (
          <p className="text-xs mt-1 opacity-75">Asset: {alert.asset_name}</p>
        )}
        <p className="text-xs mt-1 opacity-75">
          {new Date(alert.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  </div>
);

const MovementCard = ({ movement }) => (
  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
    <MapPin className="h-5 w-5 text-gray-400 flex-shrink-0" />
    <div className="ml-3 flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 truncate">
        {movement.assetName}
      </p>
      <p className="text-sm text-gray-500">
        {movement.fromZone ? `${movement.fromZone} → ` : ''}
        {movement.toZone || 'Unknown Location'}
      </p>
      <p className="text-xs text-gray-400 flex items-center">
        <Clock className="h-3 w-3 mr-1" />
        {new Date(movement.timestamp).toLocaleString()}
      </p>
    </div>
  </div>
);

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await reportService.getDashboardData();
      setDashboardData(response.data);
      setError(null);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-500">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="btn-primary mt-4"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { assetStats, readerStats, recentAlerts, recentMovements, assetsByDepartment } = dashboardData || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Real-time overview of your RFID asset tracking system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Assets"
          value={assetStats?.total_assets || 0}
          icon={Package}
          color="blue"
        />
        <StatCard
          title="Active Assets"
          value={assetStats?.active_assets || 0}
          icon={Activity}
          color="green"
        />
        <StatCard
          title="Missing Assets"
          value={assetStats?.missing_assets || 0}
          icon={AlertTriangle}
          color="red"
        />
        <StatCard
          title="Online Readers"
          value={`${readerStats?.online_readers || 0}/${readerStats?.total_readers || 0}`}
          icon={Radio}
          color="purple"
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Alerts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Recent Alerts</h3>
            <span className="text-sm text-gray-500">
              {recentAlerts?.length || 0} unacknowledged
            </span>
          </div>
          <div className="space-y-3">
            {recentAlerts && recentAlerts.length > 0 ? (
              recentAlerts.slice(0, 5).map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">No recent alerts</p>
            )}
          </div>
        </div>

        {/* Recent Movements */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Recent Movements</h3>
            <span className="text-sm text-gray-500">Last 24 hours</span>
          </div>
          <div className="space-y-3">
            {recentMovements && recentMovements.length > 0 ? (
              recentMovements.slice(0, 5).map((movement) => (
                <MovementCard key={movement.id} movement={movement} />
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">No recent movements</p>
            )}
          </div>
        </div>
      </div>

      {/* Assets by Department */}
      {assetsByDepartment && assetsByDepartment.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Assets by Department</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assetsByDepartment.map((dept) => (
              <div key={dept.department} className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    {dept.department || 'Unassigned'}
                  </span>
                  <span className="text-lg font-semibold text-blue-600">
                    {dept.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;