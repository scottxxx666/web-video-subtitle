// Subtitle overlay utility for creating and managing video subtitles

export function createSubtitleOverlay(video: HTMLVideoElement): HTMLElement {
  // Create subtitle container
  const subtitleContainer = document.createElement('div');
  subtitleContainer.style.cssText = `
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    font-family: Arial, sans-serif;
    font-size: 16px;
    font-weight: bold;
    text-align: center;
    max-width: 80%;
    word-wrap: break-word;
    z-index: 10000;
    pointer-events: none;
    display: none;
  `;
  
  // Position relative to video element
  const videoContainer = video.parentElement || document.body;
  
  // Make sure the video container has relative positioning
  if (videoContainer !== document.body) {
    const containerStyle = getComputedStyle(videoContainer);
    if (containerStyle.position === 'static') {
      videoContainer.style.position = 'relative';
    }
  }
  
  videoContainer.appendChild(subtitleContainer);
  
  console.log('Subtitle overlay created');
  return subtitleContainer;
}

export function updateSubtitles(text: string, subtitleElement: HTMLElement): void {
  if (!subtitleElement || !text.trim()) {
    return;
  }
  
  console.log('Updating subtitles:', text);
  
  // Update subtitle text
  subtitleElement.textContent = text;
  subtitleElement.style.display = 'block';
  
  // Auto-hide subtitles after 5 seconds of no updates
  clearTimeout((subtitleElement as any).hideTimeout);
  (subtitleElement as any).hideTimeout = setTimeout(() => {
    subtitleElement.style.display = 'none';
  }, 5000);
}

export function removeSubtitleOverlay(subtitleElement: HTMLElement | null): void {
  if (subtitleElement) {
    // Clear any pending timeout
    clearTimeout((subtitleElement as any).hideTimeout);
    subtitleElement.remove();
  }
}