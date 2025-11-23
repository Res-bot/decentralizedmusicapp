import axios from './axios';

export const getAllTracks = async (params = {}) => {
  const response = await axios.get('/tracks', { params });
  return response.data;
};

export const getTrendingTracks = async (limit = 10) => {
  const response = await axios.get('/tracks/trending', { params: { limit } });
  return response.data;
};

export const getTrackById = async (id) => {
  const response = await axios.get(`/tracks/${id}`);
  return response.data;
};

export const uploadTrack = async (trackData) => {
  const response = await axios.post('/tracks/upload', trackData);
  return response.data;
};

export const incrementStream = async (trackId, amount) => {
  const response = await axios.post(`/tracks/${trackId}/stream`, { amount });
  return response.data;
};

export const searchTracks = async (query) => {
  const response = await axios.get('/tracks', { 
    params: { search: query, limit: 20 } 
  });
  return response.data;
};