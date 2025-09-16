import api from './authService';

export const assetService = {
  getAssets: (params = {}) => {
    return api.get('/assets', { params });
  },

  getAsset: (id) => {
    return api.get(`/assets/${id}`);
  },

  createAsset: (assetData) => {
    return api.post('/assets', assetData);
  },

  updateAsset: (id, assetData) => {
    return api.put(`/assets/${id}`, assetData);
  },

  deleteAsset: (id) => {
    return api.delete(`/assets/${id}`);
  },

  getAssetStats: () => {
    return api.get('/assets/stats/overview');
  },
};

export const rfidService = {
  getReaders: () => {
    return api.get('/rfid/readers');
  },

  createReader: (readerData) => {
    return api.post('/rfid/readers', readerData);
  },

  updateReader: (id, readerData) => {
    return api.put(`/rfid/readers/${id}`, readerData);
  },

  getReadings: (params = {}) => {
    return api.get('/rfid/readings', { params });
  },

  simulateReading: (data) => {
    return api.post('/rfid/simulate', data);
  },
};

export const floorPlanService = {
  getFloorPlans: () => {
    return api.get('/floor-plan');
  },

  getFloorPlan: (id) => {
    return api.get(`/floor-plan/${id}`);
  },

  createFloorPlan: (formData) => {
    return api.post('/floor-plan', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  createZone: (floorPlanId, zoneData) => {
    return api.post(`/floor-plan/${floorPlanId}/zones`, zoneData);
  },

  updateZone: (zoneId, zoneData) => {
    return api.put(`/floor-plan/zones/${zoneId}`, zoneData);
  },

  deleteZone: (zoneId) => {
    return api.delete(`/floor-plan/zones/${zoneId}`);
  },
};

export const reportService = {
  getDashboardData: () => {
    return api.get('/reports/dashboard');
  },

  getInventoryReport: (params = {}) => {
    return api.get('/reports/inventory', { params });
  },

  getMovementReport: (params = {}) => {
    return api.get('/reports/movements', { params });
  },

  getAlertsReport: (params = {}) => {
    return api.get('/reports/alerts', { params });
  },

  acknowledgeAlert: (alertId) => {
    return api.post(`/reports/alerts/${alertId}/acknowledge`);
  },
};