import axios from './axios';

export const getArtistStats = async (walletAddress) => {
  const response = await axios.get(`/artists/${walletAddress}/stats`);
  return response.data;
};

export const getArtistTracks = async (walletAddress) => {
  const response = await axios.get(`/artists/${walletAddress}/tracks`);
  return response.data;
};