import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import mapboxgl from 'mapbox-gl';
import EXIF from 'exif-js';
import './App.css';
import 'mapbox-gl/dist/mapbox-gl.css';

// Replace with your new token
mapboxgl.accessToken = 'pk.eyJ1IjoieWF5LWNha2UiLCJhIjoiY204NXFoOGg0MTZmbTJqczdpbXVxcXAyNCJ9.TiXWfrlv3z2vZ4iVswDkPQ'; // Your new token here

// IndexedDB setup
const dbName = 'photomapsDB';
const storeName = 'images';
const version = 1;

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' });
      }
    };
  });
};

// Add a utility function to chunk large strings
const chunkString = (str, size) => {
  const numChunks = Math.ceil(str.length / size);
  const chunks = new Array(numChunks);

  for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.substr(o, size);
  }

  return chunks;
};

function App() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [db, setDb] = useState(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);

  // Initialize IndexedDB
  useEffect(() => {
    initDB().then(database => setDb(database));
  }, []);

  // Load files from IndexedDB on mount
  useEffect(() => {
    if (!db) return;

    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => {
      const loadedFiles = request.result;
      console.log('Loaded from IndexedDB:', loadedFiles); // Debug log
      setFiles(loadedFiles);
    };

    request.onerror = (event) => {
      console.error('Error loading from IndexedDB:', event.target.error);
    };
  }, [db]);

  // Initialize map
  useEffect(() => {
    const mapInstance = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/light-v10',
      center: [-122.4194, 37.7749], // Default to San Francisco
      zoom: 12
    });

    setMap(mapInstance);

    return () => mapInstance.remove();
  }, []);

  const extractLocationFromImage = (file) => {
    return new Promise((resolve) => {
      EXIF.getData(file, function() {
        const lat = EXIF.getTag(this, 'GPSLatitude');
        const long = EXIF.getTag(this, 'GPSLongitude');
        const latRef = EXIF.getTag(this, 'GPSLatitudeRef');
        const longRef = EXIF.getTag(this, 'GPSLongitudeRef');
        
        console.log('EXIF Data:', {
          lat, long, latRef, longRef,
          allTags: EXIF.getAllTags(this)
        });
        
        if (lat && long) {
          // Convert coordinates to decimal
          const latDecimal = lat[0] + lat[1]/60 + lat[2]/3600;
          const longDecimal = long[0] + long[1]/60 + long[2]/3600;
          
          // Apply ref (N/S, E/W)
          const latitude = latRef === 'N' ? latDecimal : -latDecimal;
          const longitude = longRef === 'E' ? longDecimal : -longDecimal;
          
          console.log('Converted coordinates:', { latitude, longitude });
          resolve({ latitude, longitude });
        } else {
          console.log('No location data found in image');
          resolve(null);
        }
      });
    });
  };

  const saveToIndexedDB = async (newFiles) => {
    if (!db) return;

    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    // Process each file
    newFiles.forEach(file => {
      // Split preview data into chunks if it's too large
      if (file.preview.length > 500000) { // 500KB chunks
        const chunks = chunkString(file.preview, 500000);
        const fileData = {
          ...file,
          preview: chunks,
          isChunked: true
        };
        store.put(fileData);
      } else {
        store.put(file);
      }
    });

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  };

  // Modify the files display logic to handle chunked data
  const getPreviewSrc = (file) => {
    if (file.isChunked && Array.isArray(file.preview)) {
      return file.preview.join('');
    }
    return file.preview;
  };

  const createCustomMarker = (file) => {
    // Create marker element
    const el = document.createElement('div');
    el.className = 'custom-marker';
    
    // Create thumbnail image
    const img = document.createElement('img');
    img.src = file.preview;
    img.alt = file.name;
    el.appendChild(img);

    // Create and add marker to map
    const marker = new mapboxgl.Marker({
      element: el,
      anchor: 'center'
    })
      .setLngLat([file.location.longitude, file.location.latitude])
      .setPopup(
        new mapboxgl.Popup({
          offset: 25,
          className: 'photo-popup'
        }).setHTML(`
          <div class="popup-content">
            <img src="${file.preview}" alt="${file.name}" />
            <p>${file.name}</p>
          </div>
        `)
      )
      .addTo(map);

    return marker;
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    setLoading(true);
    console.log('Files dropped:', acceptedFiles);

    const processFiles = acceptedFiles.map(async (file) => {
      const location = await extractLocationFromImage(file);
      const preview = URL.createObjectURL(file);

      return {
        preview,
        name: file.name,
        id: `${file.name}-${Date.now()}`,
        location
      };
    });

    const newFiles = await Promise.all(processFiles);
    console.log('All files processed:', newFiles);
    setFiles(prevFiles => [...prevFiles, ...newFiles]);

    // Collect coordinates for fitting bounds
    const bounds = new mapboxgl.LngLatBounds();

    // Add markers for new files
    newFiles.forEach(file => {
      if (file.location) {
        console.log('Creating marker for:', file.name, file.location);
        const marker = createCustomMarker(file);
        setMarkers(prev => [...prev, marker]);

        // Extend bounds to include this marker's location
        bounds.extend([file.location.longitude, file.location.latitude]);
      } else {
        console.log('No location data for:', file.name);
      }
    });

    // Fit the map to the bounds of the markers
    if (map) {
      map.fitBounds(bounds, {
        padding: { top: 20, bottom: 20, left: 20, right: 20 },
        maxZoom: 15 // Optional: set a maximum zoom level
      });
    }

    setLoading(false);
  }, [map]);

  // Clean up
  // useEffect(() => {
  //   return () => {
  //     files.forEach(file => {
  //       if (file.preview) {
  //         URL.revokeObjectURL(file.preview);
  //       }
  //     });
  //     markers.forEach(marker => marker.remove());
  //   };
  // }, [markers]);

  const handleDelete = useCallback((idToDelete) => {
    setFiles(prevFiles => {
      const fileToDelete = prevFiles.find(file => file.id === idToDelete);
      if (fileToDelete && fileToDelete.preview) {
        URL.revokeObjectURL(fileToDelete.preview);
      }
      return prevFiles.filter(file => file.id !== idToDelete);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.heic']
    }
  });

  return (
    <div className="App">
      <h1 className="title">PhotoMaps</h1>
      <div className="content-container">
        <div id="map" className="map-container"></div>
        <div className="upload-section">
          <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
            <input {...getInputProps()} />
            <div className="dropzone-content">
              <p>{isDragActive ? 'Drop files here!' : 'Drag & drop files here'}</p>
              <button className="upload-button">upload files</button>
            </div>
          </div>

          {loading && <div className="loading">Loading images...</div>}

          {files.length > 0 && (
            <div className="thumbnails-container">
              {files.map(file => (
                <div key={file.id} className="thumbnail">
                  <img
                    src={file.preview}
                    alt={file.name}
                    onError={(e) => {
                      console.error('Image load error:', file.name);
                    }}
                    onLoad={() => console.log('Image loaded successfully:', file.name)}
                  />
                  <button 
                    className="delete-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(file.id);
                    }}
                    aria-label="Delete image"
                  >
                    <svg 
                      width="14" 
                      height="14" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                  </button>
                  <span className="filename">{file.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
