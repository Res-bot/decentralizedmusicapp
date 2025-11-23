import axios from './axios';

export const requestStream = async (songId, authHeader) => {
  const response = await axios.get(`/stream/${songId}`, {
    headers: {
      'Authorization': authHeader
    }
  });
  return response.data;
};