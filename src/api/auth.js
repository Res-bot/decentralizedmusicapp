import axios from './axios';

export const connectWallet = async (walletAddress, role) => {
  const response = await axios.post('/auth/connect', { walletAddress, role });
  return response.data;
};

export const registerSession = async (walletAddress, sessionPublicKey) => {
  const response = await axios.post('/auth/register-session', { 
    walletAddress, 
    sessionPublicKey 
  });
  return response.data;
};

export const getBalance = async (walletAddress) => {
  const response = await axios.get(`/auth/balance/${walletAddress}`);
  return response.data;
};

export const deposit = async (walletAddress, amount) => {
  const response = await axios.post('/auth/deposit', { walletAddress, amount });
  return response.data;
};

export const withdraw = async (walletAddress) => {
  const response = await axios.post('/auth/withdraw', { walletAddress });
  return response.data;
};