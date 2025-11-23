import React, { useState, useEffect, useCallback } from 'react';
import { Music, Upload, Wallet, BarChart3, User, Search, Play, DollarSign, TrendingUp, Clock, Award, Heart, Pause, SkipBack, SkipForward, Volume2, Repeat, Shuffle, List, Grid, Settings, LogOut, Bell, CheckCircle, Sparkles, Headphones, Mic2 } from 'lucide-react';

// API imports
import * as authAPI from './api/auth';
import * as tracksAPI from './api/tracks';
import * as artistsAPI from './api/artists';
import * as streamAPI from './api/stream';
import { generatePlaylist, generateTrackDescription } from './api/gemini';
import { signRequest, simulateMetamaskLogin, generateSessionKeys, } from './services/cryptoService';

const Router = ({ children }) => {
  const [currentPath, setCurrentPath] = useState('landing');
  return (
    <RouterContext.Provider value={{ currentPath, setCurrentPath }}>
      {children}
    </RouterContext.Provider>
  );
};

const RouterContext = React.createContext();

const Link = ({ to, children, className }) => {
  const { setCurrentPath } = React.useContext(RouterContext);
  return (
    <button onClick={() => setCurrentPath(to)} className={className}>
      {children}
    </button>
  );
};

const Route = ({ path, children }) => {
  const { currentPath } = React.useContext(RouterContext);
  return currentPath === path ? children : null;
};

export default function App() {
  const [userRole, setUserRole] = useState(null);
  const [currentPage, setCurrentPage] = useState('home');
  const [currentTrack, setCurrentTrack] = useState(null);
  const [playing, setPlaying] = useState(false);
  
  // Session State
  const [session, setSession] = useState({
    walletAddress: null,
    sessionPublicKey: null,
    sessionPrivateKey: null,
    balance: 0,
  });

  // Data State
  const [tracks, setTracks] = useState([]);
  const [trendingTracks, setTrendingTracks] = useState([]);
  const [artistStats, setArtistStats] = useState(null);
  const [artistTracks, setArtistTracks] = useState([]);
  const [loading, setLoading] = useState(false);

  // AI State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResults, setAiResults] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Artist Upload State
  const [uploadData, setUploadData] = useState({ 
    title: '', 
    genre: '', 
    streamCost: '0.0001',
    duration: 180 
  });
  const [uploadDescription, setUploadDescription] = useState('');
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  // Logs
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);

  const addLog = useCallback((source, message, status = 'success') => {
    const entry = {
      id: Math.random().toString(36),
      timestamp: new Date().toLocaleTimeString(),
      source,
      message,
      status,
    };
    setLogs(prev => {
      if (prev.length === 0) {
        setTimeout(() => setShowLogs(true), 100);
      }
      return [...prev, entry];
    });
  }, []);

  // Fetch tracks on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [allTracksRes, trendingRes] = await Promise.all([
          tracksAPI.getAllTracks({ limit: 20 }),
          tracksAPI.getTrendingTracks(6)
        ]);
        
        setTracks(allTracksRes.tracks || []);
        setTrendingTracks(trendingRes.tracks || []);
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
        addLog('Client', 'Failed to load tracks from backend', 'error');
      }
    };

    fetchInitialData();
  }, []);

  // Fetch artist data when artist role is selected
  useEffect(() => {
    if (userRole === 'artist' && session.walletAddress) {
      fetchArtistData();
    }
  }, [userRole, session.walletAddress]);

  const fetchArtistData = async () => {
    try {
      setLoading(true);
      const [statsRes, tracksRes] = await Promise.all([
        artistsAPI.getArtistStats(session.walletAddress),
        artistsAPI.getArtistTracks(session.walletAddress)
      ]);
      
      setArtistStats(statsRes.stats);
      setArtistTracks(tracksRes.tracks || []);
    } catch (error) {
      console.error('Failed to fetch artist data:', error);
      addLog('Client', 'Failed to load artist data', 'error');
    } finally {
      setLoading(false);
    }
  };


const handleConnectWallet = async () => {
  try {
    addLog('Client', 'Initiating Metamask Connection...', 'pending');
    const address = await simulateMetamaskLogin();
    addLog('Client', `Wallet Connected: ${address.substring(0, 6)}...`, 'success');
    
    // Generate session keys on client
    const sessionKeys = generateSessionKeys();
    addLog('Client', 'Session keys generated', 'success');
    
    addLog('Backend', 'Registering session with backend...', 'pending');
    const result = await authAPI.connectWallet(address, userRole);
    
    setSession({
      walletAddress: result.user.walletAddress,
      sessionPublicKey: sessionKeys.publicKey,
      sessionPrivateKey: sessionKeys.privateKey,  // <-- NOW SET PROPERLY
      balance: result.user.balance
    });
    
    addLog('Backend', `Session registered successfully`, 'success');
  } catch (error) {
    console.error('Connect wallet error:', error);
    addLog('Client', 'Failed to connect wallet', 'error');
  }
};
  const handleDeposit = async () => {
    if (!session.walletAddress) return;
    
    try {
      addLog('Client', 'Requesting 0.005 ETH deposit...', 'pending');
      const result = await authAPI.deposit(session.walletAddress, 0.005);
      
      setSession(prev => ({ ...prev, balance: result.newBalance }));
      addLog('Backend', 'Deposit confirmed. Balance updated.', 'success');
    } catch (error) {
      console.error('Deposit error:', error);
      addLog('Client', 'Deposit failed', 'error');
    }
  };

  const handleWithdraw = async () => {
    if (!session.walletAddress) return;
    
    try {
      addLog('Client', 'Requesting withdrawal...', 'pending');
      const result = await authAPI.withdraw(session.walletAddress);
      
      setSession(prev => ({ ...prev, balance: 0 }));
      addLog('Backend', `Withdrawn ${result.amount} ETH successfully`, 'success');
    } catch (error) {
      console.error('Withdraw error:', error);
      addLog('Client', 'Withdrawal failed', 'error');
    }
  };

  const handlePlayTrack = async (track) => {
    if (!session.sessionPrivateKey) {
      alert('Please connect wallet to stream music.');
      await handleConnectWallet();
      return;
    }

    if (userRole === 'listener' && session.balance < track.streamCost) {
      addLog('Backend', `Insufficient balance. Required: ${track.streamCost} ETH`, 'error');
      alert('Insufficient Balance! Please deposit ETH to stream.');
      return;
    }

    try {
      setPlaying(false);
      addLog('Client', `Preparing stream request for: ${track.title}`, 'pending');

      // Sign request
      const timestamp = Date.now().toString();
      const message = `STREAM:${track.id}:${timestamp}`;
      const signature = signRequest(message, session.sessionPrivateKey || 'mock_key');
      addLog('Client', `Request signed`, 'success');

      // Request stream
      addLog('Backend', 'Verifying payment signature...', 'pending');
      const authHeader = `x402 ${session.walletAddress}:${signature}:${message}`;
      
      const streamResult = await streamAPI.requestStream(track.id, authHeader);
      addLog('Backend', 'Payment verified. Stream authorized.', 'success');

      // Update balance for listeners
      if (userRole === 'listener') {
        setSession(prev => ({ 
          ...prev, 
          balance: Math.max(0, prev.balance - track.streamCost) 
        }));
        addLog('Backend', `Micro-payment ${track.streamCost} ETH processed`, 'success');
      }

      // Increment stream count
      await tracksAPI.incrementStream(track.id, track.streamCost);

      setCurrentTrack(track);
      setPlaying(true);
      addLog('IPFS', `Streaming content from CID: ${track.ipfsCid || 'QmXyZ...'}`, 'success');

    } catch (error) {
      console.error('Play track error:', error);
      addLog('Client', 'Failed to start stream', 'error');
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    
    try {
      setIsGenerating(true);
      addLog('Gemini', `Analyzing mood: "${aiPrompt}"...`, 'pending');
      
      const results = await generatePlaylist(aiPrompt);
      setAiResults(results);
      
      addLog('Gemini', `Generated ${results.length} track suggestions`, 'success');
    } catch (error) {
      console.error('AI generate error:', error);
      addLog('Gemini', 'Failed to generate playlist', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleArtistGenerateDescription = async () => {
    if (!uploadData.title || !uploadData.genre) {
      alert('Please enter title and genre first.');
      return;
    }
    
    try {
      setIsGeneratingDesc(true);
      addLog('Gemini', `Generating description for "${uploadData.title}"...`, 'pending');
      
      const desc = await generateTrackDescription(uploadData.title, uploadData.genre);
      setUploadDescription(desc);
      
      addLog('Gemini', 'Description generated successfully', 'success');
    } catch (error) {
      console.error('Generate description error:', error);
      addLog('Gemini', 'Failed to generate description', 'error');
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const handleArtistUpload = async () => {
    if (!session.walletAddress) {
      alert('Connect wallet to upload tracks.');
      return;
    }

    if (!uploadData.title || !uploadData.genre) {
      alert('Please fill in all required fields.');
      return;
    }

    try {
      addLog('Client', 'Preparing upload metadata...', 'pending');
      
      const trackData = {
        title: uploadData.title,
        artist: 'Artist Name', // Should come from artist profile
        artistAddress: session.walletAddress,
        genre: uploadData.genre,
        duration: uploadData.duration,
        streamCost: parseFloat(uploadData.streamCost),
        description: uploadDescription,
        coverUrl: `https://picsum.photos/seed/${Date.now()}/300`
      };

      addLog('Backend', 'Uploading to IPFS...', 'pending');
      await new Promise(r => setTimeout(r, 800)); // Simulate IPFS upload
      
      addLog('Backend', 'Minting NFT on blockchain...', 'pending');
      const result = await tracksAPI.uploadTrack(trackData);
      
      addLog('Backend', `NFT Minted! Track ID: ${result.track.id}`, 'success');
      alert('Track uploaded successfully!');
      
      // Reset form
      setUploadData({ title: '', genre: '', streamCost: '0.0001', duration: 180 });
      setUploadDescription('');
      
      // Refresh artist tracks
      await fetchArtistData();
      
    } catch (error) {
      console.error('Upload error:', error);
      addLog('Backend', 'Upload failed', 'error');
    }
  };

  // Role Selection Screen
  if (!userRole) {
    return (
      <div className="flex h-screen w-full bg-black text-white items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-900/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-900/20 rounded-full blur-3xl"></div>

        <div className="flex flex-col items-center z-10 max-w-4xl w-full px-4">
          <div className="mb-12 text-center">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                <Music size={24} className="text-black" />
              </div>
              <h1 className="text-5xl font-bold tracking-tight">DecentraMusic</h1>
            </div>
            <p className="text-xl text-gray-400">Decentralized Streaming. Fair Pay. AI Powered.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
            <button 
              onClick={() => { setUserRole('listener'); setCurrentPage('home'); }}
              className="group relative bg-slate-900 border border-slate-800 p-10 rounded-2xl text-left hover:border-emerald-500 transition-all hover:scale-105"
            >
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 group-hover:bg-emerald-500 transition-colors">
                <Headphones size={32} className="text-emerald-500 group-hover:text-black" />
              </div>
              <h2 className="text-2xl font-bold mb-2">I am a Listener</h2>
              <p className="text-gray-400">Discover music, create AI playlists, support artists directly.</p>
            </button>

            <button 
              onClick={() => { setUserRole('artist'); setCurrentPage('dashboard'); }}
              className="group relative bg-slate-900 border border-slate-800 p-10 rounded-2xl text-left hover:border-orange-500 transition-all hover:scale-105"
            >
              <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-6 group-hover:bg-orange-500 transition-colors">
                <Mic2 size={32} className="text-orange-500 group-hover:text-black" />
              </div>
              <h2 className="text-2xl font-bold mb-2">I am an Artist</h2>
              <p className="text-gray-400">Upload tracks, view analytics, receive instant payouts.</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Header Component
  const renderHeader = () => {
    const isArtist = userRole === 'artist';
    const accentColor = isArtist ? 'text-orange-400' : 'text-emerald-400';

    return (
      <div className="sticky top-0 bg-black/95 backdrop-blur-md z-20 px-8 py-4 flex justify-between items-center border-b border-slate-800">
        <div className="flex gap-4">
          {!isArtist && currentPage === 'search' && (
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-500" size={20}/>
              <input 
                type="text" 
                className="bg-slate-800 rounded-full py-2.5 pl-10 pr-4 w-80 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Search for songs, artists..."
                autoFocus
              />
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {session.balance > 0 && (
            <div className={`flex items-center gap-2 ${accentColor} bg-slate-800 px-3 py-1.5 rounded-full text-sm font-mono`}>
              <Wallet size={14} />
              {session.balance.toFixed(4)} ETH
            </div>
          )}
          
          {!session.walletAddress ? (
            <button 
              onClick={handleConnectWallet}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-full text-sm transition-all"
            >
              Connect Wallet
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button 
                onClick={isArtist ? handleWithdraw : handleDeposit} 
                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2"
              >
                <Wallet size={14} />
                {isArtist ? 'Withdraw' : 'Deposit'}
              </button>
              <div className="w-10 h-10 bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-full flex items-center justify-center" title={session.walletAddress}>
                <User size={20} className="text-white" />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Sidebar Component
  const Sidebar = () => {
    const isArtist = userRole === 'artist';
    
    const navItemClass = (page) => 
      `flex items-center gap-4 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
        currentPage === page ? 'text-white bg-slate-800 rounded-lg' : 'text-gray-400 hover:text-white'
      }`;

    return (
      <div className="w-64 bg-black h-full flex flex-col border-r border-slate-900">
        <div className="p-6">
          <div className="flex items-center gap-2 text-white mb-8">
            <Music className="w-8 h-8 text-emerald-400" />
            <span className="text-xl font-bold">DecentraMusic</span>
          </div>

          <nav className="space-y-1">
            {isArtist ? (
              <>
                <div onClick={() => setCurrentPage('dashboard')} className={navItemClass('dashboard')}>
                  <BarChart3 size={24} />
                  Dashboard
                </div>
                <div onClick={() => setCurrentPage('upload')} className={navItemClass('upload')}>
                  <Upload size={24} />
                  Upload Music
                </div>
                <div onClick={() => setCurrentPage('tracks')} className={navItemClass('tracks')}>
                  <Music size={24} />
                  My Tracks
                </div>
              </>
            ) : (
              <>
                <div onClick={() => setCurrentPage('home')} className={navItemClass('home')}>
                  <Music size={24} />
                  Home
                </div>
                <div onClick={() => setCurrentPage('search')} className={navItemClass('search')}>
                  <Search size={24} />
                  Search
                </div>
                <div onClick={() => setCurrentPage('library')} className={navItemClass('library')}>
                  <Heart size={24} />
                  Liked Songs
                </div>
              </>
            )}
          </nav>
        </div>
        
        <div className="mt-auto p-6 border-t border-slate-900">
          <div className="text-xs text-gray-500">
            <p>Powered by Stylus & x402</p>
            <p className="mt-1">v1.0.0</p>
          </div>
        </div>
      </div>
    );
  };

  // Player Component
  const Player = () => {
    if (!currentTrack) return null;

    return (
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 z-50">
        <div className="max-w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              <img src={currentTrack.coverUrl} className="w-14 h-14 rounded shadow-lg" alt={currentTrack.title} />
              <div>
                <h4 className="text-white font-semibold text-sm">{currentTrack.title}</h4>
                <p className="text-gray-400 text-xs">{currentTrack.artist}</p>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col items-center">
              <div className="flex items-center space-x-6 mb-2">
                <button className="text-gray-400 hover:text-white transition-colors">
                  <Shuffle className="w-4 h-4" />
                </button>
                <button className="text-gray-400 hover:text-white transition-colors">
                  <SkipBack className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setPlaying(!playing)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full p-3 transition-all"
                >
                  {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <button className="text-gray-400 hover:text-white transition-colors">
                  <SkipForward className="w-5 h-5" />
                </button>
                <button className="text-gray-400 hover:text-white transition-colors">
                  <Repeat className="w-4 h-4" />
                </button>
              </div>
              <div className="w-full max-w-md flex items-center space-x-2">
                <span className="text-xs text-gray-500">1:23</span>
                <div className="flex-1 bg-slate-700 rounded-full h-1">
                  <div className="bg-emerald-500 h-1 rounded-full" style={{width: '40%'}}></div>
                </div>
                <span className="text-xs text-gray-500">{Math.floor(currentTrack.duration / 60)}:{String(currentTrack.duration % 60).padStart(2, '0')}</span>
              </div>
            </div>
            
            <div className="flex-1 flex items-center justify-end space-x-3">
              <Volume2 className="w-5 h-5 text-gray-400" />
              <div className="w-24 bg-slate-700 rounded-full h-1">
                <div className="bg-emerald-500 h-1 rounded-full" style={{width: '70%'}}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Listener Views
  const renderHome = () => (
    <div className="px-8 pb-32 pt-8">
      <h1 className="text-3xl font-bold mb-8">Good evening</h1>
      
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading tracks...</div>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-bold mb-6">Trending Now</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-12">
            {trendingTracks.map((track) => (
              <div key={track.id} className="bg-slate-900/50 p-4 rounded-xl hover:bg-slate-900 transition-all group cursor-pointer">
                <div className="relative mb-4">
                  <img src={track.coverUrl} className="w-full aspect-square object-cover rounded-lg shadow-lg" alt={track.title} />
                  <button 
                    onClick={() => handlePlayTrack(track)}
                    className="absolute bottom-2 right-2 w-12 h-12 bg-emerald-600 rounded-full shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                  >
                    <Play className="w-5 h-5 text-white fill-white" />
                  </button>
                </div>
                <h3 className="font-bold text-white truncate">{track.title}</h3>
                <p className="text-sm text-gray-400 truncate">{track.artist}</p>
                <p className="text-xs text-gray-500 mt-1">{track.streams.toLocaleString()} plays</p>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold mb-6">All Tracks</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {tracks.map((track) => (
              <div key={track.id} className="bg-slate-900/50 p-4 rounded-xl hover:bg-slate-900 transition-all group cursor-pointer">
                <div className="relative mb-4">
                  <img src={track.coverUrl} className="w-full aspect-square object-cover rounded-lg shadow-lg" alt={track.title} />
                  <button 
                    onClick={() => handlePlayTrack(track)}
                    className="absolute bottom-2 right-2 w-12 h-12 bg-emerald-600 rounded-full shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                  >
                    <Play className="w-5 h-5 text-white fill-white" />
                  </button>
                </div>
                <h3 className="font-bold text-white truncate">{track.title}</h3>
                <p className="text-sm text-gray-400 truncate">{track.artist}</p>
                <p className="text-xs text-emerald-400 mt-1">{track.streamCost} ETH</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const renderSearch = () => (
    <div className="px-8 pb-32 pt-8">
      <div className="bg-gradient-to-r from-purple-900 to-emerald-900 rounded-2xl p-8 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles size={24} className="text-purple-200" />
          <span className="font-bold text-sm">GEMINI AI CURATOR</span>
        </div>
        <h1 className="text-4xl font-bold mb-4">Describe the vibe.</h1>
        <p className="text-gray-300 mb-6 max-w-2xl">
          Let AI find the perfect tracks for your mood. Try "Cyberpunk coding music" or "Relaxing jazz for Sunday morning".
        </p>
        
        <div className="flex gap-4 max-w-xl">
          <input 
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="What are you feeling?"
            className="flex-1 bg-white/10 border border-white/20 rounded-full px-6 py-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
            onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
          />
          <button 
            onClick={handleAiGenerate}
            disabled={isGenerating}
            className="bg-white text-purple-900 font-bold px-8 py-4 rounded-full hover:bg-purple-100 transition disabled:opacity-50"
          >
            {isGenerating ? 'Thinking...' : 'Generate'}
          </button>
        </div>
      </div>

      {aiResults.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-6">AI Suggestions</h2>
          <div className="bg-slate-900 rounded-xl border border-slate-800">
            <div className="grid grid-cols-[auto_1fr_2fr_auto] px-6 py-4 text-gray-400 text-sm font-medium border-b border-slate-800">
              <span>#</span>
              <span>Title</span>
              <span>Reason</span>
              <span>Play</span>
            </div>
            {aiResults.map((result, idx) => {
              const matchedTrack = tracks.find(t => 
                t.title.toLowerCase().includes(result.title.toLowerCase()) ||
                t.artist.toLowerCase().includes(result.artist.toLowerCase())
              ) || tracks[Math.floor(Math.random() * tracks.length)];
              
              return (
                <div key={idx} className="grid grid-cols-[auto_1fr_2fr_auto] items-center px-6 py-4 border-b border-slate-800 last:border-0 hover:bg-slate-800/50 transition group">
                  <span className="text-gray-500 w-8">{idx + 1}</span>
                  <div className="flex flex-col">
                    <span className="font-medium text-white">{result.title}</span>
                    <span className="text-xs text-gray-400">{result.artist}</span>
                  </div>
                  <span className="text-gray-400 italic text-sm pr-4">{result.reason}</span>
                  <button 
                    onClick={() => handlePlayTrack(matchedTrack)}
                    className="opacity-0 group-hover:opacity-100 bg-emerald-600 hover:bg-emerald-700 rounded-full p-2 transition-all"
                  >
                    <Play size={16} className="text-white fill-white" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const renderLibrary = () => (
    <div className="flex flex-col items-center justify-center h-96 text-gray-400">
      <Heart size={64} className="mb-4 opacity-20" />
      <p>Your liked songs will appear here</p>
    </div>
  );

  // Artist Views
  const renderArtistDashboard = () => (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading stats...</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
              <div className="flex items-center gap-4 mb-4 text-gray-400">
                <TrendingUp size={20} />
                <span className="text-sm font-medium">Total Streams</span>
              </div>
              <p className="text-4xl font-bold text-white">
                {artistStats?.totalStreams?.toLocaleString() || '0'}
              </p>
              <p className="text-emerald-400 text-sm mt-2">All time</p>
            </div>
            
            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
              <div className="flex items-center gap-4 mb-4 text-gray-400">
                <DollarSign size={20} />
                <span className="text-sm font-medium">Revenue Generated</span>
              </div>
              <p className="text-4xl font-bold text-white">
                {artistStats?.totalRevenue?.toFixed(4) || '0.0000'} ETH
              </p>
              <p className="text-orange-400 text-sm mt-2">≈ ${(artistStats?.totalRevenue * 3000 || 0).toFixed(2)} USD</p>
            </div>
            
            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
              <div className="flex items-center gap-4 mb-4 text-gray-400">
                <Music size={20} />
                <span className="text-sm font-medium">Top Track</span>
              </div>
              <p className="text-2xl font-bold text-white truncate">
                {artistStats?.topTrack?.title || 'No tracks yet'}
              </p>
              <p className="text-gray-500 text-sm mt-2">
                {artistStats?.topTrack?.streams?.toLocaleString() || '0'} streams
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-6">Recent Uploads</h2>
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] px-6 py-4 bg-slate-900/50 text-sm text-gray-400 font-medium">
              <span>Track Name</span>
              <span className="mr-12">Streams</span>
              <span className="mr-12">Revenue</span>
              <span>Status</span>
            </div>
            {artistStats?.recentTracks?.length > 0 ? (
              artistStats.recentTracks.map((track) => (
                <div key={track.id} className="grid grid-cols-[1fr_auto_auto_auto] px-6 py-4 border-b border-slate-800 last:border-0 items-center hover:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <img src={track.coverUrl} className="w-10 h-10 rounded" alt="" />
                    <span className="font-medium">{track.title}</span>
                  </div>
                  <div className="mr-12 text-gray-400 font-mono">{track.streams.toLocaleString()}</div>
                  <div className="mr-12 text-emerald-400 font-mono">{track.revenue.toFixed(4)} ETH</div>
                  <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-xs rounded-full border border-emerald-500/20">
                    Active
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-gray-500">
                No tracks uploaded yet. Upload your first track!
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  const renderArtistUpload = () => (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Upload New Track</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Track Title</label>
            <input 
              value={uploadData.title}
              onChange={e => setUploadData({...uploadData, title: e.target.value})}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
              placeholder="e.g. Neon Nights"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Genre</label>
              <input 
                value={uploadData.genre}
                onChange={e => setUploadData({...uploadData, genre: e.target.value})}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
                placeholder="e.g. Synthwave"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Cost (ETH)</label>
              <input 
                value={uploadData.streamCost}
                onChange={e => setUploadData({...uploadData, streamCost: e.target.value})}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Duration (seconds)</label>
            <input 
              type="number"
              value={uploadData.duration}
              onChange={e => setUploadData({...uploadData, duration: parseInt(e.target.value)})}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
            />
          </div>

          <div className="p-6 border-2 border-dashed border-slate-800 rounded-lg hover:border-orange-500/50 transition cursor-pointer flex flex-col items-center justify-center gap-2 group">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center group-hover:bg-orange-500/20 transition">
              <Upload className="text-gray-400 group-hover:text-orange-400" />
            </div>
            <p className="text-sm text-gray-400">Drag and drop audio file (MP3, WAV)</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl p-6 border border-slate-800">
          <div className="flex items-center gap-2 mb-4 text-orange-400">
            <Sparkles size={20} />
            <span className="font-bold text-sm tracking-wide">GEMINI AI ASSISTANT</span>
          </div>
          <p className="text-gray-400 text-sm mb-6">
            Let Gemini generate a professional description for your track.
          </p>
          
          {uploadDescription ? (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 mb-6 relative">
              <p className="text-sm text-gray-200 leading-relaxed italic">"{uploadDescription}"</p>
              <div className="absolute -top-2 -right-2 bg-orange-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                GENERATED
              </div>
            </div>
          ) : (
            <div className="h-32 bg-black/20 rounded-lg border border-slate-800 mb-6 flex items-center justify-center text-gray-600 text-sm italic">
              AI Output Area
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button 
              onClick={handleArtistGenerateDescription}
              disabled={isGeneratingDesc}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 rounded-lg transition border border-transparent hover:border-orange-500/30 flex items-center justify-center gap-2"
            >
              <Sparkles size={16} className={isGeneratingDesc ? "animate-spin" : "text-orange-400"} />
              {isGeneratingDesc ? 'Generating...' : 'Generate Description'}
            </button>

            <button 
              onClick={handleArtistUpload}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-lg transition shadow-lg mt-4 flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} />
              Mint NFT & Publish
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderArtistTracks = () => (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">My Tracks</h1>
      
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading tracks...</div>
        </div>
      ) : artistTracks.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {artistTracks.map((track) => (
            <div key={track.id} className="bg-slate-900/50 p-4 rounded-xl hover:bg-slate-900 transition-all">
              <img src={track.coverUrl} className="w-full aspect-square object-cover rounded-lg shadow-lg mb-4" alt={track.title} />
              <h3 className="font-bold text-white truncate">{track.title}</h3>
              <p className="text-sm text-gray-400">{track.genre}</p>
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs text-emerald-400">{track.streams} streams</span>
                <span className="text-xs text-orange-400">{track.revenue.toFixed(4)} ETH</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-96 text-gray-400">
          <Music size={64} className="mb-4 opacity-20" />
          <p>No tracks uploaded yet</p>
          <button 
            onClick={() => setCurrentPage('upload')}
            className="mt-4 bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-full transition"
          >
            Upload Your First Track
          </button>
        </div>
      )}
    </div>
  );

  // Log Console Component
  const LogConsole = () => {
    if (!showLogs) return null;

    return (
      <div className="fixed bottom-28 right-4 w-96 max-h-80 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl overflow-hidden flex flex-col z-40 font-mono text-xs">
        <div className="bg-slate-800 px-3 py-2 flex justify-between items-center border-b border-slate-700">
          <span className="font-bold text-emerald-400">⚡ Protocol Activity</span>
          <button onClick={() => setShowLogs(false)} className="text-gray-400 hover:text-white">×</button>
        </div>
        <div className="p-3 overflow-y-auto space-y-2 flex-1">
          {logs.length === 0 && <span className="text-gray-600 italic">Waiting for activity...</span>}
          {logs.map((log) => (
            <div key={log.id} className="flex flex-col border-b border-slate-800 pb-1 last:border-0">
              <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                <span>{log.source}</span>
                <span>{log.timestamp}</span>
              </div>
              <span className={`${
                log.status === 'success' ? 'text-emerald-300' : 
                log.status === 'error' ? 'text-red-400' : 'text-yellow-200'
              }`}>
                {log.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Main Layout
  return (
    <Router>
      <div className="flex h-screen bg-black text-white overflow-hidden">
        <Sidebar />
        
        <div className="flex-1 flex flex-col overflow-y-auto">
          {renderHeader()}
          
          {userRole === 'listener' && (
            <>
              {currentPage === 'home' && renderHome()}
              {currentPage === 'search' && renderSearch()}
              {currentPage === 'library' && renderLibrary()}
            </>
          )}

          {userRole === 'artist' && (
            <>
              {currentPage === 'dashboard' && renderArtistDashboard()}
              {currentPage === 'upload' && renderArtistUpload()}
              {currentPage === 'tracks' && renderArtistTracks()}
            </>
          )}
        </div>

        <button 
          onClick={() => setShowLogs(!showLogs)}
          className={`fixed bottom-28 right-4 z-30 p-3 rounded-full shadow-lg transition-all hover:scale-110 ${
            showLogs ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-gray-400'
          }`}
        >
          <BarChart3 size={20} />
        </button>

        <LogConsole />
        <Player />
      </div>
    </Router>
  );
}