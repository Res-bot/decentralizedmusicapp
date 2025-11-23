import axios from './axios';

const GEMINI_API_URL = 'http://localhost:5000/api'; // Adjust if needed

export const generatePlaylist = async (prompt) => {
  try {
    const response = await axios.post(`${GEMINI_API_URL}/gemini/playlist`, { prompt });
    return response.data.playlist || [];
  } catch (error) {
    console.error('Gemini playlist error:', error);
    return [];
  }
};

export const generateTrackDescription = async (title, genre) => {
  try {
    const response = await axios.post(`${GEMINI_API_URL}/gemini/description`, { 
      title, 
      genre 
    });
    return response.data.description || 'Error generating description.';
  } catch (error) {
    console.error('Gemini description error:', error);
    return 'Error generating description.';
  }
};