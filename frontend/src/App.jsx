// frontend/src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  UploadCloud,
  Video,
  FileSpreadsheet,
  Printer,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Search,
  Filter,
  Sparkles,
  CheckCircle2,
  X,
  ExternalLink,
  Eye,
  Activity,
  Gauge,
  Users
} from 'lucide-react';

/**
 * @typedef {Object} Incident
 * @property {number} id - Unique incremental incident identifier.
 * @property {string} type - Violation classification ('TRIPLE_RIDING' | 'NO_HELMET').
 * @property {string} description - Human-readable violation description.
 * @property {string} timestamp - Formatted time string (MM:SS).
 * @property {number} timestamp_sec - Exact frame timestamp in seconds.
 * @property {number} frame - Source frame index.
 * @property {string} snapshot_url - Relative URL path to the evidence screenshot.
 */

/**
 * @typedef {Object} ProcessResponse
 * @property {string} video_url - Path to the H.264 processed video with visual AI overlay.
 * @property {number} duration - Total video duration in seconds.
 * @property {number} total_violations - Count of all recorded violations.
 * @property {Incident[]} incidents - List of all logged violation incidents.
 */

/**
 * Traffic Violation AI Surveillance & Law Enforcement Workstation.
 * Features automated detection with per-vehicle deduplication:
 *   1. TRIPLE_RIDING (Red Box, >=3 persons on 1 motorcycle)
 *   2. NO_HELMET (Orange Box, bare head in rider zone)
 *
 * @returns {JSX.Element} The rendered workstation dashboard.
 */
export default function App() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [activeModalIncident, setActiveModalIncident] = useState(null);
  const [activeSnapshotModal, setActiveSnapshotModal] = useState(null);
  const [loadingStep, setLoadingStep] = useState(0);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  const loadingSteps = [
    'Uploading surveillance footage to FastAPI server...',
    'Running YOLOv8 + ByteTrack multi-object tracking...',
    'Executing spatial clustering & multi-violation evaluation...',
    'Synthesizing H.264 video stream with color-coded tags...',
    'Compiling deduplicated incident review queue...'
  ];

  // Cycling loading progress messages
  useEffect(() => {
    let interval;
    if (loading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingSteps.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  /**
   * Tracks video playback time to synchronize the active incident in the review queue.
   * @param {React.SyntheticEvent<HTMLVideoElement, Event>} e - Video time update event.
   * @returns {void}
   */
  const handleTimeUpdate = (e) => {
    setCurrentVideoTime(e.currentTarget.currentTime);
  };

  /**
   * Handles user video file selection and uploads to the FastAPI backend.
   * @param {File} file - The selected video file.
   * @returns {Promise<void>}
   */
  const processUpload = async (file) => {
    if (!file) return;
    setSelectedFile(file);
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/process-video', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      alert(`Processing failed: ${err.message}. Ensure backend is running at http://127.0.0.1:8000`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * File input change handler.
   * @param {React.ChangeEvent<HTMLInputElement>} event - The file input event.
   * @returns {void}
   */
  const handleFileInputChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      processUpload(file);
    }
  };

  /**
   * Handles drag-and-drop file drop event.
   * @param {React.DragEvent<HTMLDivElement>} event - The drag drop event.
   * @returns {void}
   */
  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      processUpload(file);
    }
  };

  /**
   * Seeks the HTML5 video player to a designated timestamp in seconds and begins playback.
   * @param {number} sec - The target timestamp in seconds.
   * @returns {void}
   */
  const jumpToSecond = (sec) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, sec - 0.5);
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  /**
   * Toggles video play and pause state.
   * @returns {void}
   */
  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  /**
   * Shifts the current video playback position by a delta in seconds.
   * @param {number} delta - Seconds to shift (e.g. -5 or +5).
   * @returns {void}
   */
  const skipVideoTime = (delta) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime + delta);
    }
  };

  /**
   * Updates playback speed multiplier for detailed forensic inspection.
   * @param {number} rate - Playback rate (0.5, 1, 1.5, 2).
   * @returns {void}
   */
  const changePlaybackRate = (rate) => {
    setPlaybackSpeed(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  /**
   * Generates and triggers download of the complete violations audit log as a CSV file.
   * @returns {void}
   */
  const exportAuditLogCSV = () => {
    if (!data || !data.incidents || data.incidents.length === 0) {
      alert('No violations available to export.');
      return;
    }

    const headers = ['Incident ID', 'Violation Type', 'Description', 'Timestamp (MM:SS)', 'Timestamp (Sec)', 'Frame Index', 'Evidence Snapshot URL'];
    const rows = data.incidents.map((inc) => [
      inc.id,
      `"${inc.type}"`,
      `"${inc.description.replace(/"/g, '""')}"`,
      `"${inc.timestamp}"`,
      inc.timestamp_sec,
      inc.frame,
      `"http://127.0.0.1:8000${inc.snapshot_url}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `traffic_multi_violation_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Triggers official browser print dialogue for the generated E-Challan notice.
   * @returns {void}
   */
  const handlePrintChallan = () => {
    window.print();
  };

  /**
   * Helper function returning theme styling for each violation type.
   * @param {string} type - Violation code.
   * @returns {{badgeBg: string, textColor: string, borderColor: string, label: string, fine: string, section: string}}
   */
  const getViolationTheme = (type) => {
    switch (type) {
      case 'TRIPLE_RIDING':
        return {
          badgeBg: 'bg-red-500/20',
          textColor: 'text-red-400',
          borderColor: 'border-red-500/40',
          label: 'Triple Riding (3+ on 1)',
          fine: '₹1,000 INR',
          section: 'Section 128 (Motor Vehicles Act)'
        };
      case 'NO_HELMET':
        return {
          badgeBg: 'bg-orange-500/20',
          textColor: 'text-orange-400',
          borderColor: 'border-orange-500/40',
          label: 'No Helmet',
          fine: '₹1,000 INR',
          section: 'Section 129 (Motor Vehicles Act)'
        };
      default:
        return {
          badgeBg: 'bg-blue-500/20',
          textColor: 'text-blue-400',
          borderColor: 'border-blue-500/40',
          label: type,
          fine: '₹1,000 INR',
          section: 'Motor Vehicles Act'
        };
    }
  };

  // Filter and search incidents
  const filteredIncidents = (data?.incidents || []).filter((item) => {
    const matchesFilter = filterType === 'ALL' || item.type === filterType;
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.timestamp.includes(searchQuery);

    return matchesFilter && matchesSearch;
  });

  const tripleCount = (data?.incidents || []).filter((i) => i.type === 'TRIPLE_RIDING').length;
  const helmetCount = (data?.incidents || []).filter((i) => i.type === 'NO_HELMET').length;

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Law Enforcement Command Bar */}
      <header className="border-b border-[#1f293d] bg-[#0d131f]/90 backdrop-blur sticky top-0 z-40 px-6 py-3.5 shadow-lg no-print">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.25)]">
              <ShieldAlert className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">TRAFFIC EYE AI</h1>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  Enforcement Station v3.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automated Traffic Violation Enforcement: Single-Bike Triple Riding & Helmet Verification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141b29] border border-[#1f293d]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-300">FastAPI Port:</span>
              <span className="text-emerald-400 font-semibold">8000</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141b29] border border-[#1f293d]">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-300">Tracking:</span>
              <span className="text-cyan-400 font-semibold">ByteTrack + Deduplication</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 no-print space-y-6">
        {/* KPI Summary Stat Cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#121824] border border-[#1f293d] rounded-xl p-3.5 shadow-sm hover:border-slate-700 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Total Logged</span>
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {data ? data.total_violations : '--'}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">Deduplicated per vehicle</div>
          </div>

          <div className="bg-[#121824] border border-[#1f293d] rounded-xl p-3.5 shadow-sm hover:border-red-900/50 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Triple Riding</span>
              <Users className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-red-400 mt-1">
              {data ? tripleCount : '--'}
            </div>
            <div className="text-[10px] text-red-400/70 font-mono mt-0.5">3+ on 1 Motorcycle</div>
          </div>

          <div className="bg-[#121824] border border-[#1f293d] rounded-xl p-3.5 shadow-sm hover:border-orange-900/50 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">No Helmet</span>
              <AlertTriangle className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-orange-400 mt-1">
              {data ? helmetCount : '--'}
            </div>
            <div className="text-[10px] text-orange-400/70 font-mono mt-0.5">Bare Head Detected</div>
          </div>

          <div className="bg-[#121824] border border-[#1f293d] rounded-xl p-3.5 shadow-sm hover:border-slate-700 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Footage Duration</span>
              <Gauge className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
              {data ? `${data.duration}s` : '--'}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">Processed Video</div>
          </div>
        </section>

        {/* Upload & Ingestion Zone */}
        <section
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 p-8 text-center ${
            isDragging
              ? 'border-blue-500 bg-blue-500/10 scale-[1.005]'
              : 'border-[#1f293d] bg-[#121824]/80 hover:border-blue-500/50 hover:bg-[#121824]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/*"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={loading}
          />

          {loading ? (
            <div className="py-6 max-w-lg mx-auto space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 animate-spin">
                <RotateCw className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Running Multi-Infraction AI Engine</h3>
                <p className="text-xs text-blue-400 mt-1 font-mono transition-all duration-500">
                  {loadingSteps[loadingStep]}
                </p>
              </div>
              <div className="w-full bg-[#1a2333] h-2 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600 rounded-full animate-pulse"></div>
              </div>
              <p className="text-[11px] text-slate-500">
                Evaluating Triple Riding, Bare Heads, and Registration Plates simultaneously...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner">
                <UploadCloud className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  Drop surveillance footage or select video to audit
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Processes multi-violations simultaneously with zero duplicate rows per vehicle.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs tracking-wide shadow-lg shadow-blue-600/30 transition flex items-center gap-2"
                >
                  <Video className="w-4 h-4" />
                  Select Video File
                </button>
                {selectedFile && (
                  <span className="text-xs font-mono text-slate-300 bg-[#1a2333] px-3 py-1.5 rounded-lg border border-[#1f293d]">
                    Active: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Main Workstation Analysis Grid */}
        {data && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Evidence Player & Controls */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-[#121824] border border-[#1f293d] rounded-2xl overflow-hidden shadow-xl">
                {/* HUD Header */}
                <div className="px-4 py-3 bg-[#0d131f] border-b border-[#1f293d] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                    <span className="text-xs font-mono font-semibold tracking-wider text-slate-200 uppercase">
                      AI EVIDENCE PLAYBACK HUD
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                    <span>SEEK: {currentVideoTime.toFixed(2)}s</span>
                    <span>/</span>
                    <span>{data.duration}s</span>
                  </div>
                </div>

                {/* HTML5 Video Display with Cache-busting */}
                <div className="relative bg-black aspect-video flex items-center justify-center">
                  <video
                    ref={videoRef}
                    id="main-player"
                    key={data.video_url}
                    controls={false}
                    autoPlay
                    muted
                    playsInline
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    className="w-full h-full object-contain"
                  >
                    <source
                      src={`http://127.0.0.1:8000${data.video_url}?t=${Date.now()}`}
                      type="video/mp4"
                    />
                  </video>
                  <div className="scanline-effect pointer-events-none"></div>
                </div>

                {/* Interactive Player Controls */}
                <div className="p-3 bg-[#0d131f] border-t border-[#1f293d] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={togglePlayPause}
                      className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition"
                      title={isPlaying ? 'Pause Video' : 'Play Video'}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => skipVideoTime(-5)}
                      className="p-2 rounded-lg bg-[#1a2333] hover:bg-[#253247] text-slate-300 transition"
                      title="Rewind 5 Seconds"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => skipVideoTime(5)}
                      className="p-2 rounded-lg bg-[#1a2333] hover:bg-[#253247] text-slate-300 transition"
                      title="Forward 5 Seconds"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-slate-400 mr-1 text-[11px]">Speed:</span>
                    {[0.5, 1, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => changePlaybackRate(rate)}
                        className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                          playbackSpeed === rate
                            ? 'bg-blue-600 text-white'
                            : 'bg-[#1a2333] text-slate-400 hover:text-white'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono">
                    H.264 High-Profile Stream
                  </div>
                </div>
              </div>

              {/* Bounding Box Legend */}
              <div className="bg-[#121824] border border-[#1f293d] rounded-xl p-3.5 text-xs">
                <div className="text-slate-300 font-semibold mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  Color-Coded Visual AI Overlay Legend
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                  <div className="flex items-center gap-2 p-1.5 rounded bg-[#0d131f] border border-red-900/50">
                    <span className="w-3 h-3 rounded-sm bg-red-600"></span>
                    <span className="text-red-400 font-medium">🔴 Triple Riding (3+)</span>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 rounded bg-[#0d131f] border border-orange-900/50">
                    <span className="w-3 h-3 rounded-sm bg-orange-500"></span>
                    <span className="text-orange-400 font-medium">🟠 No Helmet</span>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 rounded bg-[#0d131f] border border-yellow-900/50">
                    <span className="w-3 h-3 rounded-sm bg-yellow-400"></span>
                    <span className="text-yellow-300 font-medium">🟡 Plate Detected</span>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 rounded bg-[#0d131f] border border-emerald-900/50">
                    <span className="w-3 h-3 rounded-sm bg-emerald-500"></span>
                    <span className="text-emerald-400 font-medium">🟢 Helmet (Safe)</span>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 rounded bg-[#0d131f] border border-slate-700">
                    <span className="w-3 h-3 rounded-sm bg-amber-400"></span>
                    <span className="text-amber-300 font-medium">Rider Bounding</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Incident Review Queue */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-[#121824] border border-[#1f293d] rounded-2xl p-4 shadow-xl flex flex-col h-[680px]">
                {/* Queue Title & Action Buttons */}
                <div className="flex items-center justify-between pb-3 border-b border-[#1f293d]">
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Incident Review Queue</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {filteredIncidents.length} / {data.incidents.length}
                      </span>
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Strict per-vehicle deduplication: click card to seek video
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={exportAuditLogCSV}
                    className="px-3 py-1.5 rounded-lg bg-[#1a2333] hover:bg-[#253247] text-slate-200 border border-[#1f293d] hover:border-slate-600 text-xs font-medium flex items-center gap-1.5 transition"
                    title="Export Audit Log CSV"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>CSV</span>
                  </button>
                </div>

                {/* Filter and Search Bar */}
                <div className="py-3 space-y-2 border-b border-[#1f293d]">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter by description or timestamp (e.g. 00:04)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#0d131f] border border-[#1f293d] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-mono flex-wrap">
                    <button
                      type="button"
                      onClick={() => setFilterType('ALL')}
                      className={`px-2 py-1 rounded-md transition ${
                        filterType === 'ALL'
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'bg-[#1a2333] text-slate-400 hover:text-white'
                      }`}
                    >
                      All ({data.incidents.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType('TRIPLE_RIDING')}
                      className={`px-2 py-1 rounded-md transition ${
                        filterType === 'TRIPLE_RIDING'
                          ? 'bg-red-600 text-white font-semibold'
                          : 'bg-[#1a2333] text-slate-400 hover:text-white'
                      }`}
                    >
                      Triple ({tripleCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType('NO_HELMET')}
                      className={`px-2 py-1 rounded-md transition ${
                        filterType === 'NO_HELMET'
                          ? 'bg-orange-600 text-white font-semibold'
                          : 'bg-[#1a2333] text-slate-400 hover:text-white'
                      }`}
                    >
                      Helmet ({helmetCount})
                    </button>
                  </div>
                </div>

                {/* Scrollable Incident Cards List */}
                <div className="flex-1 overflow-y-auto pt-3 space-y-2.5 pr-1">
                  {filteredIncidents.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mb-2" />
                      <p className="text-xs font-medium text-slate-300">No violations match the filter</p>
                      <p className="text-[11px] text-slate-500 mt-1">All processed motorcycle clusters comply with regulations.</p>
                    </div>
                  ) : (
                    filteredIncidents.map((item) => {
                      const theme = getViolationTheme(item.type);
                      const isCurrentlyActive = Math.abs(currentVideoTime - item.timestamp_sec) < 1.2;

                      return (
                        <div
                          key={item.id}
                          className={`group relative rounded-xl border p-3 transition-all duration-200 cursor-pointer ${
                            isCurrentlyActive
                              ? 'bg-blue-950/40 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                              : 'bg-[#0d131f] border-[#1f293d] hover:border-slate-600 hover:bg-[#111827]'
                          }`}
                          onClick={() => jumpToSecond(item.timestamp_sec)}
                        >
                          <div className="flex items-start gap-3">
                            {/* Evidence Snapshot Thumbnail */}
                            <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-black flex-shrink-0 border border-[#1f293d] group-hover:border-slate-500 transition">
                              <img
                                src={`http://127.0.0.1:8000${item.snapshot_url}`}
                                alt={`Incident ${item.id} Snapshot`}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveSnapshotModal(item);
                                }}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition"
                                title="Expand Full Resolution Snapshot"
                              >
                                <Eye className="w-4 h-4 text-cyan-300" />
                              </button>
                            </div>

                            {/* Incident Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span
                                  className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${theme.badgeBg} ${theme.textColor} ${theme.borderColor}`}
                                >
                                  {item.type}
                                </span>
                                <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                                  <span>{item.timestamp}</span>
                                  <span className="text-slate-600">({item.timestamp_sec}s)</span>
                                </span>
                              </div>

                              <p className="text-xs text-slate-200 font-medium leading-snug line-clamp-2">
                                {item.description}
                              </p>

                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1a2333]">
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Frame #{item.frame}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveModalIncident(item);
                                    }}
                                    className="px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-semibold transition flex items-center gap-1"
                                  >
                                    <Printer className="w-3 h-3" />
                                    <span>E-Challan</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {isCurrentlyActive && (
                            <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 bg-blue-600 text-white text-[9px] font-mono font-bold rounded-full shadow">
                              ACTIVE
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Official E-Challan Citation Modal */}
      {activeModalIncident && (() => {
        const theme = getViolationTheme(activeModalIncident.type);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="echallan-print-container bg-white text-slate-900 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative border border-slate-300">
              {/* Close Button (Hidden on Print) */}
              <button
                type="button"
                onClick={() => setActiveModalIncident(null)}
                className="no-print absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                title="Close Citation Modal"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Official Header */}
              <div className="border-b-2 border-slate-900 pb-4 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-900 text-white mb-2">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-extrabold uppercase tracking-wide text-slate-900">
                  STATE TRAFFIC POLICE DEPARTMENT
                </h2>
                <p className="text-xs text-slate-600 font-semibold tracking-wider uppercase">
                  Automated Multi-Violation Electronic Enforcement Citation
                </p>
                <div className="mt-2 inline-block px-3 py-1 bg-slate-100 border border-slate-300 rounded font-mono text-xs font-bold text-slate-800">
                  CITATION NO: ECH-2026-{activeModalIncident.id.toString().padStart(5, '0')}
                </div>
              </div>

              {/* Offense Details */}
              <div className="py-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-slate-500 font-semibold block uppercase text-[10px]">Violation Type:</span>
                    <span className="font-bold text-sm text-red-600 font-mono">{activeModalIncident.type}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block uppercase text-[10px]">Timestamp / Frame:</span>
                    <span className="font-bold text-slate-800 font-mono">
                      {activeModalIncident.timestamp} (Frame #{activeModalIncident.frame})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block uppercase text-[10px]">Statutory Act & Clause:</span>
                    <span className="font-bold text-slate-800">
                      {theme.section}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block uppercase text-[10px]">Prescribed Penalty:</span>
                    <span className="font-bold text-emerald-700 text-sm">{theme.fine}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-semibold block uppercase text-[10px] mb-1">Offense Summary:</span>
                  <p className="font-medium text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200">
                    {activeModalIncident.description}
                  </p>
                </div>

                {/* Evidence Snapshot */}
                <div>
                  <span className="text-slate-500 font-semibold block uppercase text-[10px] mb-1">Photographic Evidence:</span>
                  <div className="rounded-lg overflow-hidden border border-slate-300 max-h-56 bg-black flex items-center justify-center">
                    <img
                      src={`http://127.0.0.1:8000${activeModalIncident.snapshot_url}`}
                      alt="E-Challan Evidence Still"
                      className="w-full h-auto object-contain max-h-56"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Actions (Hidden on Print) */}
              <div className="no-print pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveModalIncident(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handlePrintChallan}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow transition flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Notice / PDF</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Snapshot Lightbox Modal */}
      {activeSnapshotModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={() => setActiveSnapshotModal(null)}
        >
          <div
            className="max-w-3xl w-full bg-[#121824] border border-[#1f293d] rounded-2xl overflow-hidden shadow-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-semibold">
                High-Resolution Evidence Still - Incident #{activeSnapshotModal.id} ({activeSnapshotModal.type})
              </span>
              <button
                type="button"
                onClick={() => setActiveSnapshotModal(null)}
                className="p-1 rounded-lg bg-[#1a2333] hover:bg-[#253247] text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border border-[#1f293d] bg-black">
              <img
                src={`http://127.0.0.1:8000${activeSnapshotModal.snapshot_url}`}
                alt="Enlarged Snapshot"
                className="w-full h-auto object-contain max-h-[75vh]"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>Time: <strong>{activeSnapshotModal.timestamp}</strong> ({activeSnapshotModal.timestamp_sec}s)</span>
              <a
                href={`http://127.0.0.1:8000${activeSnapshotModal.snapshot_url}`}
                target="_blank"
                rel="noreferrer"
                download
                className="text-cyan-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Original in New Tab
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
