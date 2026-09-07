document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const fileUpload        = document.getElementById('fileUpload');
  const gridSize          = document.getElementById('gridSize');
  const brightness        = document.getElementById('brightness');
  const contrast          = document.getElementById('contrast');
  const gamma             = document.getElementById('gamma');
  const smoothing         = document.getElementById('smoothing');
  const ditherType        = document.getElementById('ditherType');
  const resetButton       = document.getElementById('resetButton');
  const saveButton        = document.getElementById('saveButton');
  const exportType        = document.getElementById('exportType');
  const videoFrameControls = document.getElementById('videoFrameControls');
  const frameSlider       = document.getElementById('frameSlider');
  const frameTime         = document.getElementById('frameTime');
  const framePreview      = document.getElementById('framePreview');
  
  const gridSizeVal       = document.getElementById('gridSizeVal');
  const brightnessVal     = document.getElementById('brightnessVal');
  const contrastVal       = document.getElementById('contrastVal');
  const gammaVal          = document.getElementById('gammaVal');
  const smoothingVal      = document.getElementById('smoothingVal');
  
  const halftoneCanvas    = document.getElementById('halftoneCanvas');
  
  // Global variables for preview
  let imageElement = null;
  let videoElement = null;
  let isVideo = false;
  let animationFrameId;
  let isPaused = false;
  let currentFrame = 0;
  let mediaRecorder = null;
  let recordedChunks = [];
  let isRecording = false;
  let recordingStartTime = 0;
  
  // Recording settings
  const recordingFPS = 60;
  const recordingInterval = 1000 / recordingFPS;
  
  function updateRecordingUI(recording) {
    saveButton.textContent = recording ? 'Stop Recording' : 'Start Recording';
    saveButton.classList.toggle('recording', recording);
  }

  function startVideoRecording() {
    // Reset video to beginning before starting recording
    videoElement.currentTime = 0;
    videoElement.play();
    
    const stream = halftoneCanvas.captureStream(recordingFPS);
    mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000
    });

    recordedChunks = [];
    isRecording = true;
    recordingStartTime = Date.now();
    updateRecordingUI(true);
    
    // Add recording time display with FPS and size info
    const recordingTimeDisplay = document.createElement('div');
    recordingTimeDisplay.id = 'recordingTime';
    recordingTimeDisplay.style.cssText = 'position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.7); color: white; padding: 8px 12px; border-radius: 4px; font-family: monospace; font-size: 14px;';
    
    // Add recording info display
    const recordingInfoDisplay = document.createElement('div');
    recordingInfoDisplay.id = 'recordingInfo';
    recordingInfoDisplay.style.cssText = 'position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 8px 12px; border-radius: 4px; font-family: monospace; font-size: 14px;';
    
    halftoneCanvas.parentElement.appendChild(recordingTimeDisplay);
    halftoneCanvas.parentElement.appendChild(recordingInfoDisplay);
    
    let recordedSize = 0;
    
    function updateRecordingTime() {
        if (!isRecording) return;
        
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const totalDuration = Math.floor(videoElement.duration);
        const totalMinutes = Math.floor(totalDuration / 60);
        const totalSeconds = totalDuration % 60;
        
        // Update time display
        recordingTimeDisplay.textContent = `Recording: ${minutes}:${seconds.toString().padStart(2, '0')} / ${totalMinutes}:${totalSeconds.toString().padStart(2, '0')}`;
        
        // Update info display
        recordedSize = (recordedChunks.reduce((size, chunk) => size + chunk.size, 0) / (1024 * 1024)).toFixed(1);
        recordingInfoDisplay.textContent = `FPS: ${recordingFPS} | Size: ${recordedSize}MB`;
        
        // Stop recording if we reach the video duration
        if (elapsed >= totalDuration) {
            stopVideoRecording();
            return;
        }
        
        requestAnimationFrame(updateRecordingTime);
    }
    updateRecordingTime();

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'halftone-video.webm';
        link.click();
        URL.revokeObjectURL(url);
        isRecording = false;
        updateRecordingUI(false);
        recordingTimeDisplay.remove();
        recordingInfoDisplay.remove();
    };

    mediaRecorder.start(1000);
  }

  function stopVideoRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        updateRecordingUI(false);
        const recordingTimeDisplay = document.getElementById('recordingTime');
        const recordingInfoDisplay = document.getElementById('recordingInfo');
        if (recordingTimeDisplay) recordingTimeDisplay.remove();
        if (recordingInfoDisplay) recordingInfoDisplay.remove();
    }
  }
  
  // Default parameter values
  const defaults = {
    gridSize: 20,
    brightness: 20,
    contrast: 0,
    gamma: 1.0,
    smoothing: 0,
    ditherType: "None"
  };
  
  // Debounce helper to limit update frequency.
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
  
  function updateAndProcess() {
    gridSizeVal.textContent = gridSize.value;
    brightnessVal.textContent = brightness.value;
    contrastVal.textContent = contrast.value;
    gammaVal.textContent = gamma.value;
    smoothingVal.textContent = smoothing.value;
    if (imageElement || videoElement) {
      processFrame();
    }
  }
  
  const debouncedUpdate = debounce(updateAndProcess, 150);
  
  // Attach listeners to controls.
  gridSize.addEventListener('input', debouncedUpdate);
  brightness.addEventListener('input', debouncedUpdate);
  contrast.addEventListener('input', debouncedUpdate);
  gamma.addEventListener('input', debouncedUpdate);
  smoothing.addEventListener('input', debouncedUpdate);
  ditherType.addEventListener('change', debouncedUpdate);
  
  fileUpload.addEventListener('change', handleFileUpload);
  
  // Update frame preview based on slider position
  function updateFramePreview() {
    if (!videoElement || !isVideo) {
        console.log("No video element or not a video file.");
        return;
    }
    
    const time = parseFloat(frameSlider.value);
    videoElement.currentTime = time;
    
    // Format time as MM:SS.ms
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    frameTime.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;

    // Calculate preview dimensions maintaining aspect ratio
    const container = framePreview.parentElement;
    const containerWidth = container.clientWidth - 16;
    const containerHeight = container.clientHeight - 16;
    const videoAspectRatio = videoElement.videoWidth / videoElement.videoHeight;
    
    let previewWidth, previewHeight;
    if (containerWidth / containerHeight > videoAspectRatio) {
        previewHeight = containerHeight;
        previewWidth = containerHeight * videoAspectRatio;
    } else {
        previewWidth = containerWidth;
        previewHeight = containerWidth / videoAspectRatio;
    }
    
    // Update preview canvas dimensions
    framePreview.width = Math.round(previewWidth);
    framePreview.height = Math.round(previewHeight);
    
    // Center the preview canvas
    framePreview.style.position = 'absolute';
    framePreview.style.left = '50%';
    framePreview.style.top = '50%';
    framePreview.style.transform = 'translate(-50%, -50%)';
    
    // Draw the current frame
    const ctx = framePreview.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, framePreview.width, framePreview.height);
    
    // Process the halftone frame
    processFrame();
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fileURL = URL.createObjectURL(file);
    
    // Reset export type and hide frame controls
    exportType.value = 'png';
    videoFrameControls.style.display = 'none';
    if (file.type.startsWith('video/')) {
      isVideo = true;
      exportType.value = 'video'; // Default to video export for video files
      saveButton.textContent = 'Start Recording';
      
      if (videoElement) {
        videoElement.src = fileURL;
      } else {
        videoElement = document.createElement('video');
        videoElement.crossOrigin = "anonymous";
        videoElement.src = fileURL;
        videoElement.autoplay = true;
        videoElement.loop = true;
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.setAttribute("webkit-playsinline", "true");
        
        // Initialize frame preview canvas
        const previewCtx = framePreview.getContext('2d');
        
        videoElement.addEventListener('loadedmetadata', () => {
          // Set up frame slider once video metadata is loaded
          frameSlider.min = 0;
          frameSlider.max = videoElement.duration;
          frameSlider.step = 0.1;
          
          // Show frame controls for video files
          if (exportType.value === 'png') {
            videoFrameControls.style.display = 'block';
            videoElement.pause();
            isPaused = true;
            updateFramePreview();
          }
        });
        
        // Event listeners for accurate frame previews
        videoElement.addEventListener('seeked', () => {
          updateFramePreview();
          processFrame();
        });
        
        videoElement.addEventListener('timeupdate', () => {
          if (isPaused || exportType.value === 'png') {
            updateFramePreview();
            processFrame();
          }
        });
        
        videoElement.addEventListener('loadeddata', () => {
          setupCanvasDimensions(videoElement.videoWidth, videoElement.videoHeight);
          
          if (exportType.value === 'png') {
            videoFrameControls.style.display = 'block';
            videoElement.pause();
            isPaused = true;
            updateFramePreview();
          } else {
            videoElement.play();
            processVideoFrame();
          }
        });
        
        videoElement.addEventListener('error', (e) => {
          console.error("Error loading video:", e);
        });
      }
    } else if (file.type.startsWith('image/')) {
      isVideo = false;
      saveButton.textContent = 'Export PNG';
      if (videoElement) {
        cancelAnimationFrame(animationFrameId);
        videoElement.pause();
      }
      imageElement = new Image();
      imageElement.src = fileURL;
      imageElement.addEventListener('load', () => {
        setupCanvasDimensions(imageElement.width, imageElement.height);
        processFrame();
      });
    }
  }
  
  function setupCanvasDimensions(originalWidth, originalHeight) {
    const container = document.querySelector('.canvas-container');
    const containerWidth = container.clientWidth - 32; // Account for padding
    const containerHeight = container.clientHeight - 32; // Account for padding
    
    // Calculate the scaling factor to fit the image/video within the container
    const scaleWidth = containerWidth / originalWidth;
    const scaleHeight = containerHeight / originalHeight;
    const scale = Math.min(scaleWidth, scaleHeight);
    
    // Calculate new dimensions while maintaining aspect ratio
    let newWidth = Math.round(originalWidth * scale);
    let newHeight = Math.round(originalHeight * scale);
    
    // Ensure minimum dimensions
    const minDimension = 200;
    if (newWidth < minDimension || newHeight < minDimension) {
        const minScale = minDimension / Math.min(newWidth, newHeight);
        newWidth = Math.round(newWidth * minScale);
        newHeight = Math.round(newHeight * minScale);
    }
    
    // Update canvas dimensions
    halftoneCanvas.width = newWidth;
    halftoneCanvas.height = newHeight;
    
    // Set the canvas style dimensions to match
    halftoneCanvas.style.width = `${newWidth}px`;
    halftoneCanvas.style.height = `${newHeight}px`;
    
    // Center the canvas in the container
    halftoneCanvas.style.position = 'absolute';
    halftoneCanvas.style.left = '50%';
    halftoneCanvas.style.top = '50%';
    halftoneCanvas.style.transform = 'translate(-50%, -50%)';
    
    // Log dimensions for debugging
    console.log(`Original: ${originalWidth}x${originalHeight}`);
    console.log(`Container: ${containerWidth}x${containerHeight}`);
    console.log(`New: ${newWidth}x${newHeight} (scale: ${scale})`);
    
    return { width: newWidth, height: newHeight, scale };
  }
  
  function processFrame() {
    if (!imageElement && !videoElement) return;
    generateHalftone(halftoneCanvas, 1);
  }
  
  function processVideoFrame() {
    if (!isVideo) return;
    if (!isPaused) {
        processFrame();
    }
    animationFrameId = requestAnimationFrame(processVideoFrame);
  }
  
  // Generate halftone: compute grayscale per grid cell by iterating over full‑resolution data.
  function generateHalftone(targetCanvas, scaleFactor) {
    const previewWidth = halftoneCanvas.width;
    const previewHeight = halftoneCanvas.height;
    const targetWidth = previewWidth * scaleFactor;
    const targetHeight = previewHeight * scaleFactor;
    
    targetCanvas.width = targetWidth;
    targetCanvas.height = targetHeight;
    
    // Draw the full‑resolution image/video onto a temporary canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (isVideo) {
        tempCtx.drawImage(videoElement, 0, 0, targetWidth, targetHeight);
    } else {
        tempCtx.drawImage(imageElement, 0, 0, targetWidth, targetHeight);
    }
    
    const imgData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
    const data = imgData.data;
    
    // Enhanced image processing
    const brightnessAdj = parseInt(brightness.value, 10);
    const contrastAdj = parseInt(contrast.value, 10);
    const gammaValNum = parseFloat(gamma.value);
    const contrastFactor = (259 * (contrastAdj + 255)) / (255 * (259 - contrastAdj));
    
    // Compute grayscale with enhanced color sensitivity
    const grayData = new Float32Array(targetWidth * targetHeight);
    const lumR = 0.299, lumG = 0.587, lumB = 0.114; // Standard luminance weights
    
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        
        // Enhanced color processing
        let gray = Math.pow(r/255, gammaValNum) * lumR + 
                  Math.pow(g/255, gammaValNum) * lumG + 
                  Math.pow(b/255, gammaValNum) * lumB;
        
        // Apply contrast and brightness with better dynamic range
        gray = ((gray * 255 - 128) * contrastFactor + 128 + brightnessAdj) / 255;
        gray = Math.max(0, Math.min(1, gray));
        
        // Apply alpha channel consideration
        gray = gray * (a / 255);
        
        grayData[i / 4] = gray * 255;
    }
    
    // Enhanced grid processing
    const grid = parseInt(gridSize.value, 10) * scaleFactor;
    const numCols = Math.ceil(targetWidth / grid);
    const numRows = Math.ceil(targetHeight / grid);
    let cellValues = new Float32Array(numRows * numCols);
    
    // Improved cell value calculation with edge detection
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            let sum = 0, count = 0;
            let edgeValue = 0;
            const startY = row * grid;
            const startX = col * grid;
            const endY = Math.min(startY + grid, targetHeight);
            const endX = Math.min(startX + grid, targetWidth);
            
            // Calculate local contrast and edge detection
            for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {
                    const idx = y * targetWidth + x;
                    const val = grayData[idx];
                    sum += val;
                    count++;
                    
                    // Simple edge detection
                    if (x < endX - 1 && y < endY - 1) {
                        const rightVal = grayData[idx + 1];
                        const bottomVal = grayData[idx + targetWidth];
                        edgeValue += Math.abs(val - rightVal) + Math.abs(val - bottomVal);
                    }
                }
            }
            
            // Combine average value with edge information
            const avgValue = sum / count;
            const edgeFactor = Math.min(1, edgeValue / (count * 255 * 0.5));
            cellValues[row * numCols + col] = avgValue * (1 - edgeFactor * 0.3);
        }
    }
    
    // Apply enhanced smoothing if enabled
    const smoothingStrength = parseFloat(smoothing.value);
    if (smoothingStrength > 0) {
        cellValues = applyEnhancedSmoothing(cellValues, numRows, numCols, smoothingStrength);
    }
    
    // Apply dithering with improved patterns
    const selectedDither = ditherType.value;
    if (selectedDither === "FloydSteinberg") {
        applyFloydSteinbergDithering(cellValues, numRows, numCols);
    } else if (selectedDither === "Ordered") {
        applyOrderedDithering(cellValues, numRows, numCols);
    } else if (selectedDither === "Noise") {
        applyNoiseDithering(cellValues, numRows, numCols);
    }
    
    // Draw enhanced halftone dots
    const ctx = targetCanvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            const brightnessValue = cellValues[row * numCols + col];
            const norm = brightnessValue / 255;
            const maxRadius = grid / 2;
            
            // Enhanced dot size calculation
            const radius = maxRadius * Math.pow(1 - norm, 1.2); // Adjusted power for better contrast
            
            if (radius > 0.5) {
                ctx.beginPath();
                const centerX = col * grid + grid / 2;
                const centerY = row * grid + grid / 2;
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.fillStyle = 'black';
                ctx.fill();
            }
        }
    }
  }
  
  function applyEnhancedSmoothing(cellValues, numRows, numCols, strength) {
    let result = new Float32Array(cellValues);
    const passes = Math.floor(strength);
    const kernel = [
        [0.0625, 0.125, 0.0625],
        [0.125,  0.25,  0.125],
        [0.0625, 0.125, 0.0625]
    ];
    
    for (let p = 0; p < passes; p++) {
        let temp = new Float32Array(result.length);
        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {
                let sum = 0, weightSum = 0;
                
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const r = row + ky;
                        const c = col + kx;
                        
                        if (r >= 0 && r < numRows && c >= 0 && c < numCols) {
                            const weight = kernel[ky+1][kx+1];
                            sum += result[r * numCols + c] * weight;
                            weightSum += weight;
                        }
                    }
                }
                
                temp[row * numCols + col] = sum / weightSum;
            }
        }
        result = temp;
    }
    
    // Apply fractional smoothing
    const frac = strength - Math.floor(strength);
    if (frac > 0) {
        for (let i = 0; i < result.length; i++) {
            result[i] = cellValues[i] * (1 - frac) + result[i] * frac;
        }
    }
    
    return result;
  }
  
  function applyFloydSteinbergDithering(cellValues, numRows, numCols) {
    const threshold = 128;
    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        const index = row * numCols + col;
        const oldVal = cellValues[index];
        const newVal = oldVal < threshold ? 0 : 255;
        const error = oldVal - newVal;
        cellValues[index] = newVal;
        if (col + 1 < numCols) {
          cellValues[row * numCols + (col + 1)] += error * (7 / 16);
        }
        if (row + 1 < numRows) {
          if (col - 1 >= 0) {
            cellValues[(row + 1) * numCols + (col - 1)] += error * (3 / 16);
          }
          cellValues[(row + 1) * numCols + col] += error * (5 / 16);
          if (col + 1 < numCols) {
            cellValues[(row + 1) * numCols + (col + 1)] += error * (1 / 16);
          }
        }
      }
    }
  }
  
  function applyOrderedDithering(cellValues, numRows, numCols) {
    const bayerMatrix = [[0,2],[3,1]];
    const matrixSize = 2;
    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        const index = row * numCols + col;
        const threshold = ((bayerMatrix[row % matrixSize][col % matrixSize] + 0.5) *
                           (255 / (matrixSize * matrixSize)));
        cellValues[index] = cellValues[index] < threshold ? 0 : 255;
      }
    }
  }
  
  function applyNoiseDithering(cellValues, numRows, numCols) {
    const threshold = 128;
    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        const index = row * numCols + col;
        const noise = (Math.random() - 0.5) * 50;
        const adjustedVal = cellValues[index] + noise;
        cellValues[index] = adjustedVal < threshold ? 0 : 255;
      }
    }
  }
  
  resetButton.addEventListener('click', () => {
    gridSize.value = defaults.gridSize;
    brightness.value = defaults.brightness;
    contrast.value = defaults.contrast;
    gamma.value = defaults.gamma;
    smoothing.value = defaults.smoothing;
    ditherType.value = defaults.ditherType;
    updateAndProcess();
  });
  
  // Handle frame selection
  frameSlider.addEventListener('input', () => {
    if (!videoElement) return;
    isPaused = true;
    videoElement.pause();
    // Use requestAnimationFrame to ensure smooth updates
    requestAnimationFrame(() => {
        updateFramePreview();
    });
  });

  // Handle export type change
  exportType.addEventListener('change', () => {
    if (isVideo) {
      const isPNG = exportType.value === 'png';
      videoFrameControls.style.display = isPNG ? 'block' : 'none';
      saveButton.textContent = isPNG ? 'Export PNG' : 'Start Recording';
      
      if (!isPNG) {
        videoElement.play();
        isPaused = false;
        processVideoFrame();
      } else {
        videoElement.pause();
        isPaused = true;
        requestAnimationFrame(() => {
            updateFramePreview();
        });
      }
    }
  });

  saveButton.addEventListener('click', () => {
    if (!imageElement && !videoElement) return;
    
    if (exportType.value === 'png') {
      const exportCanvas = document.createElement('canvas');
      generateHalftone(exportCanvas, 2);
      const dataURL = exportCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataURL;
      link.download = 'halftone.png';
      link.click();
      
      // Resume video playback if it was playing
      if (isVideo && !isPaused) {
        videoElement.play();
      }
    } else if (exportType.value === 'video' && isVideo) {
      // Toggle recording state
      if (!isRecording) {
        startVideoRecording();
      } else {
        stopVideoRecording();
      }
    }
  });
  
  // Add resize handler
  window.addEventListener('resize', debounce(() => {
    if (videoElement) {
        setupCanvasDimensions(videoElement.videoWidth, videoElement.videoHeight);
    } else if (imageElement) {
        setupCanvasDimensions(imageElement.width, imageElement.height);
    }
    processFrame();
  }, 250));
  
  setupCanvasDimensions(800, 600);
  const ctx = halftoneCanvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, halftoneCanvas.width, halftoneCanvas.height);
  
  // Automatically load the default video.
  (function loadDefaultVideo() {
    const videoURL = "https://i.imgur.com/5PrJCc2.mp4";
    isVideo = true;
    videoElement = document.createElement('video');
    videoElement.crossOrigin = "anonymous";
    videoElement.playsInline = true;
    videoElement.setAttribute("webkit-playsinline", "true");
    videoElement.src = videoURL;
    videoElement.autoplay = true;
    videoElement.loop = true;
    videoElement.muted = true;
    videoElement.addEventListener('loadeddata', () => {
      setupCanvasDimensions(videoElement.videoWidth, videoElement.videoHeight);
      videoElement.play();
      processVideoFrame();
    });
    videoElement.addEventListener('error', (e) => {
      console.error("Error loading default video:", e);
    });
  })();
});

/* ===== Credits: "Rahul" rendered as living halftone dots =====
   The name is rasterized offscreen, sampled on a grid, and redrawn
   as dots whose size/color ride a traveling sine wave — a mini
   version of the editor's own halftone effect. */
(function initCreditsHalftone() {
  const canvas = document.getElementById('creditsHalftone');
  if (!canvas) return;

  const TEXT = 'Rahul';
  const FONT = '700 20px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
  const GRID = 3;                 // dot spacing (CSS px)
  const MAX_R = 1.35;             // max dot radius (CSS px)
  const COLOR_A = [144, 202, 249]; // #90CAF9 light blue
  const COLOR_B = [33, 150, 243];  // #2196F3 brand blue

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function build() {
    const dpr = window.devicePixelRatio || 1;

    // Rasterize the text offscreen
    const off = document.createElement('canvas');
    const offCtx = off.getContext('2d');
    offCtx.font = FONT;
    const cssW = Math.ceil(offCtx.measureText(TEXT).width) + 4;
    const cssH = 24;

    off.width = cssW * dpr;
    off.height = cssH * dpr;
    offCtx.scale(dpr, dpr);
    offCtx.font = FONT;
    offCtx.textBaseline = 'middle';
    offCtx.fillStyle = '#000';
    offCtx.fillText(TEXT, 2, cssH / 2 + 1);

    // Size the visible canvas (crisp on retina)
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Sample alpha on a grid -> dot list
    const img = offCtx.getImageData(0, 0, off.width, off.height).data;
    const dots = [];
    for (let y = GRID / 2; y < cssH; y += GRID) {
      for (let x = GRID / 2; x < cssW; x += GRID) {
        const px = Math.min(off.width - 1, Math.round(x * dpr));
        const py = Math.min(off.height - 1, Math.round(y * dpr));
        const alpha = img[(py * off.width + px) * 4 + 3] / 255;
        if (alpha > 0.25) {
          dots.push({ x, y, r: alpha * MAX_R });
        }
      }
    }
    return { ctx, dots };
  }

  let state = build();
  let hover = 0;
  let hoverTarget = 0;
  let start = performance.now();
  let rafId = null;

  const link = canvas.closest('.credits-text');
  if (link) {
    link.addEventListener('mouseenter', () => { hoverTarget = 1; });
    link.addEventListener('mouseleave', () => { hoverTarget = 0; });
  }

  function drawDots(getRadiusAndColor) {
    const { ctx, dots } = state;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const d of dots) {
      const out = getRadiusAndColor(d);
      if (out.r <= 0.05) continue;
      ctx.fillStyle = out.color;
      ctx.beginPath();
      ctx.arc(d.x, d.y, out.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(now) {
    const t = (now - start) / 1000;
    hover += (hoverTarget - hover) * 0.08;

    const amp = 0.28 + hover * 0.35;   // wave deepens on hover
    const speed = 2.2 + hover * 2.5;   // and travels faster

    drawDots((d) => {
      const wave = (Math.sin(t * speed - d.x * 0.09) + 1) / 2; // 0..1 across the name
      const r = d.r * (1 - amp + amp * 2 * wave);
      const cr = Math.round(COLOR_A[0] + (COLOR_B[0] - COLOR_A[0]) * wave);
      const cg = Math.round(COLOR_A[1] + (COLOR_B[1] - COLOR_A[1]) * wave);
      const cb = Math.round(COLOR_A[2] + (COLOR_B[2] - COLOR_A[2]) * wave);
      return { r, color: 'rgb(' + cr + ',' + cg + ',' + cb + ')' };
    });

    rafId = requestAnimationFrame(frame);
  }

  function renderStatic() {
    drawDots((d) => ({ r: d.r, color: '#2196F3' }));
  }

  // Rebuild dots if devicePixelRatio changes (zoom, monitor move)
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      state = build();
      if (reduceMotion.matches) renderStatic();
    }, 150);
  });

  if (typeof reduceMotion.addEventListener === 'function') {
    reduceMotion.addEventListener('change', () => {
      if (reduceMotion.matches) {
        if (rafId) cancelAnimationFrame(rafId);
        renderStatic();
      } else {
        start = performance.now();
        rafId = requestAnimationFrame(frame);
      }
    });
  }

  if (reduceMotion.matches) {
    renderStatic();
  } else {
    rafId = requestAnimationFrame(frame);
  }
})();
