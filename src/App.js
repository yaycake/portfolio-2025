import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import './App.css';

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

  const onDrop = useCallback(acceptedFiles => {
    if (!db) return;
    setLoading(true);

    const processFiles = acceptedFiles.map(file => {
      return new Promise((resolve) => {
        // Store the file object directly
        const fileData = {
          preview: URL.createObjectURL(file),
          name: file.name,
          id: `${file.name}-${Date.now()}`,
          type: file.type,
          lastModified: file.lastModified,
          file: file // Store the actual file
        };
        
        resolve(fileData);
      });
    });

    Promise.all(processFiles)
      .then(newFiles => {
        console.log('Saving files:', newFiles);
        setFiles(prevFiles => [...prevFiles, ...newFiles]);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error processing files:', error);
        setLoading(false);
      });
  }, [db]);

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      files.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);

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
      <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
        <input {...getInputProps()} />
        <div className="dropzone-content">
          <p>{isDragActive ? 'Drop files here!' : 'Drag & drop files here'}</p>
          <button className="upload-button">
            upload files
          </button>
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
  );
}

export default App;
